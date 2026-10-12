import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {Controller} from '../dist/session/controller.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {bundledSkillsRoot} from '../dist/codex/skills.js';

if(!process.argv.includes('--live'))throw new Error('Opt-in --live required: three interview turns and one handoff in a disposable workspace.');
const mode=process.argv.find(arg=>arg.startsWith('--mode='))?.slice(7)??'adaptive';
assert(['adaptive','external_workers'].includes(mode));
const home=await heraHome();const {config}=await loadConfig(home);config.mode=mode;
const cwd=await mkdtemp(join(tmpdir(),'hera-skills-live-'));
const projectRules='Handoff convention: save the requested handoff to HANDOFF.md in this workspace, in English. Preserve other files.\n';
await writeFile(join(cwd,'AGENTS.md'),projectRules);
let controller;let timer;
async function run(stage,prompt){
  console.log(JSON.stringify({stage,mode}));
  try{
    const result=await Promise.race([controller.run(prompt),new Promise((_,reject)=>{timer=setTimeout(()=>{void controller.interrupt().catch(()=>{});reject(new Error(stage+' exceeded 180 seconds'));},180000);})]);
    await controller.workers.assertIdle(controller.client,true);
    return await controller.client.read(result.threadId);
  }finally{clearTimeout(timer);}
}
function interview(thread){
  const items=thread.turns.at(-1).items;
  assert(items.every(item=>['userMessage','agentMessage','reasoning'].includes(item.type)),'Interview must stay conversational without tools, writes or delegation');
  const answer=items.filter(item=>item.type==='agentMessage').map(item=>item.text).join('\n');
  assert(/[가-힣]/u.test(answer)&&/추천/.test(answer),'Expected a Korean question with a recommendation');
  assert.equal((answer.match(/\?/g)??[]).length,1,'Expected exactly one question');
}
try{
  const client=await CodexClient.session(home,cwd,config,'workspace-write',true,true);
  controller=new Controller(client,home,cwd,config,true,true);controller.lock=await acquireWorkspace(home,cwd);await controller.start();
  controller.on('requests',()=>{for(const request of controller.requests.values())controller.answerRequest(request.id,request.questions?{}:'decline');});
  interview(await run('grilling','/grilling 친구들과의 하루 소풍 계획을 질문으로 다듬어줘. 프로젝트 이름은 HERA-PICNIC이다. 아직 인원, 장소, 예산은 정하지 않았다. 한 번에 질문 하나와 추천안을 한국어로 말하고 내 답을 기다려. 도구, 웹, 위임, 파일 변경은 하지 마.'));
  interview(await run('followup','인원은 나를 포함해 4명으로 정했어. 이어서 질문 하나와 추천안을 말해줘. 계속 도구나 위임 없이 대화만 해줘.'));
  interview(await run('grill-me','/grill-me 같은 HERA-PICNIC 계획을 이어서 점검해줘. 총예산은 37000원으로 정했어. 다음 질문 하나와 추천안을 한국어로 말하고 기다려. 도구, 웹, 위임, 파일 변경은 하지 마.'));
  assert.deepEqual(await readdir(cwd),['AGENTS.md']);
  const thread=await run('handoff','/handoff 인터뷰는 여기서 멈추고 다음 세션에 소풍 장소 결정을 이어갈 수 있도록 현재 대화를 인수인계 문서로 저장해줘. AGENTS.md의 저장 위치와 언어 규칙을 따라 HANDOFF.md만 작성해. 웹, 위임, 테스트, 커밋, 푸시는 하지 마.');
  const document=await readFile(join(cwd,'HANDOFF.md'),'utf8');
  assert(document.includes('HERA-PICNIC')&&/37,?000/.test(document)&&/\b4\b|four/i.test(document),'Handoff must preserve the project and agreed decisions');
  assert(/skill/i.test(document),'Handoff must suggest skills');
  assert.equal(await readFile(join(cwd,'AGENTS.md'),'utf8'),projectRules);
  assert.deepEqual((await readdir(cwd)).sort(),['AGENTS.md','HANDOFF.md']);assert.equal(controller.workers.count,0);
  const trace=(await readFile(thread.path,'utf8')).trim().split('\n').map(JSON.parse);
  const selected=trace.filter(row=>row.type==='response_item'&&row.payload.type==='message').flatMap(row=>row.payload.content??[]).map(item=>item.text??'');
  const catalog=selected.find(text=>text.includes('<skills_instructions>'));assert(catalog,'Native skills catalog must be present');
  const rootLine=catalog.split('\n').find(line=>line.includes(bundledSkillsRoot.replaceAll('\\','/').replace(/\/$/,'')));
  const alias=/- `(r\d+)`/.exec(rootLine??'')?.[1];assert(alias,'Packaged skill root must be in the catalog');
  assert(catalog.includes(`(file: ${alias}/grilling/SKILL.md)`));
  for(const name of ['grill-me','handoff'])assert(!catalog.includes(`(file: ${alias}/${name}/SKILL.md)`),'Explicit-only packaged skills must not enter the implicit catalog');
  for(const name of ['grilling','grill-me','handoff']){
    const content=(await readFile(join(bundledSkillsRoot,name,'SKILL.md'),'utf8')).trimEnd();
    assert(selected.some(text=>text.includes('<skill>')&&text.includes(content)),`Full packaged ${name} must reach native model context`);
  }
  console.log(JSON.stringify({bundledSkills:'pass',mode,platform:process.platform,arch:process.arch,threadId:thread.id,cwd,checks:['grilling','followup','grill-me','handoff','fullNativeInjection','noDelegation']}));
}finally{clearTimeout(timer);if(controller&&!await controller.close())process.exitCode=5;}
