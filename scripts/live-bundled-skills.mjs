import {tempFixture} from './temp-fixture.mjs';
import assert from 'node:assert/strict';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {Controller} from '../dist/session/controller.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {bundledSkillsRoot} from '../dist/codex/skills.js';
import {ASTRA_ROLE} from '../dist/codex/external-runtime.js';
import {assertSingleSkillSpawn} from './bundled-skill-evidence.mjs';

if(!process.argv.includes('--live'))throw new Error('Opt-in --live required: three interview turns and one handoff in a disposable workspace.');
const mode=process.argv.find(arg=>arg.startsWith('--mode='))?.slice(7)??'adaptive';
assert(['adaptive','external_workers'].includes(mode));
const home=await heraHome();const {config}=await loadConfig(home);config.mode=mode;
const cwd=await tempFixture('hera-skills-live-');
const projectRules='Handoff convention: save the requested handoff to HANDOFF.md in this workspace, in English. Preserve other files.\n';
await writeFile(join(cwd,'AGENTS.md'),projectRules);
let controller;let timer;let astraId;let firstRoundMs;let spawnEvidence;const events=[];const roundCounts=[];
async function run(stage,prompt){
  events.length=0;const started=performance.now();
  console.log(JSON.stringify({stage,mode}));
  try{
    const result=await Promise.race([controller.run(prompt),new Promise((_,reject)=>{timer=setTimeout(()=>{void controller.interrupt().catch(()=>{});reject(new Error(stage+' exceeded 180 seconds'));},180000);})]);
    await controller.workers.assertIdle(controller.client,true);
    const elapsedMs=Math.round(performance.now()-started);if(stage==='grilling')firstRoundMs=elapsedMs;
    console.log(JSON.stringify({stage,mode,elapsedMs,threadId:result.threadId}));
    return await controller.client.read(result.threadId);
  }finally{clearTimeout(timer);}
}
const messages=thread=>thread.turns.at(-1).items.filter(item=>item.type==='agentMessage');
const finalText=thread=>messages(thread).at(-1)?.text??'';
function round(answer){
  assert(/[가-힣]/u.test(answer),'Expected Korean questions');
  const plain=answer.replaceAll('**','');const numbered=[...plain.matchAll(/^\s*(?:#{1,6}\s*)?(\d+)\s*(?:[.)]|→)\s+/gm)];
  assert(numbered.length>=1&&numbered.length<=5,'Expected one to five numbered questions');
  assert((plain.match(/추천|권장/g)??[]).length>=numbered.length,'Each numbered question needs a recommendation, which may precede its number');
  numbered.forEach((match,index)=>{
    assert.equal(Number(match[1]),index+1);
    const question=plain.slice(match.index,numbered[index+1]?.index);
    assert(question.includes('?'),'Each numbered entry must contain a question');
  });
  roundCounts.push(numbered.length);
}
async function interview(thread,first=false){
  const items=thread.turns.at(-1).items;
  if(mode==='external_workers')assert(items.every(item=>['userMessage','agentMessage','reasoning'].includes(item.type)),'Development interview must remain on the GPT root');
  else{
    const calls=items.filter(item=>item.type==='collabAgentToolCall');
    const spawns=calls.filter(item=>item.tool==='spawnAgent');
    if(first){
      assert.equal(spawns.length,1,'One Astra child for the interview');astraId=spawns[0].receiverThreadIds[0];
      const spawnIndex=items.indexOf(spawns[0]);
      assert(items.slice(0,spawnIndex).some(item=>item.type==='agentMessage'&&/Astra|아스트라/i.test(item.text)&&/[가-힣]/u.test(item.text)),'Announce Astra before spawning');
      const delta=events.findIndex(e=>e.method==='item/agentMessage/delta'&&e.params.threadId===thread.id&&e.params.delta);
      assert(delta>=0&&delta<events.findIndex(e=>e.method==='item/started'&&e.params.item.id===spawns[0].id),'Announcement must stream before spawn');
    }else{
      assert.equal(spawns.length,0,'Reuse the interview child');
      assert(calls.some(item=>item.tool==='sendInput'&&item.receiverThreadIds.includes(astraId)),'Follow-up must reach the same Astra');
    }
    assert(calls.some(item=>item.tool==='wait'&&item.receiverThreadIds.includes(astraId)),'Wait for Astra');
    const child=await controller.client.read(astraId);const route=controller.workers.snapshot.get(astraId);
    assert.equal(route.modelProvider,'openai');assert.equal(route.model,config.main.model);
    assert.equal(finalText(thread).trim(),finalText(child).trim(),'Relay Astra verbatim');
    assert(child.turns.every(turn=>turn.items.every(item=>['userMessage','agentMessage','reasoning'].includes(item.type))),'Astra interview must not use tools or write');
  }
  round(finalText(thread));
}

try{
  const client=await CodexClient.session(home,cwd,config,'workspace-write',true,true);
  controller=new Controller(client,home,cwd,config,true,true);controller.lock=await acquireWorkspace(home,cwd);await controller.start();
  controller.on('event',e=>events.push(e));
  controller.on('requests',()=>{for(const request of controller.requests.values())controller.answerRequest(request.id,request.questions?{}:'decline');});
  await interview(await run('grilling','/grilling 친구들과의 하루 소풍 계획을 질문으로 다듬어줘. 프로젝트 이름은 HERA-PICNIC이다. 아직 인원, 장소, 예산은 정하지 않았다. 한국어로 질문하고 내 답을 기다려. 웹, 파일 변경은 하지 마.'),true);
  await interview(await run('followup','인원은 나를 포함해 4명으로 정했어. 나머지는 아직 미정이야. 이어서 다음 질문 라운드와 추천안을 말해줘. 웹, 파일 변경 없이 대화만 해줘.'));
  await interview(await run('grill-me','/grill-me 같은 HERA-PICNIC 계획을 이어서 점검해줘. 총예산은 37000원으로 정했어. 다음 질문 라운드와 추천안을 한국어로 말하고 기다려. 웹, 파일 변경은 하지 마.'));
  assert.deepEqual(await readdir(cwd),['AGENTS.md']);
  const thread=await run('handoff','/handoff 인터뷰는 여기서 멈추고 다음 세션에 소풍 장소 결정을 이어갈 수 있도록 현재 대화를 인수인계 문서로 저장해줘. AGENTS.md의 저장 위치와 언어 규칙을 따라 HANDOFF.md만 작성해. 웹, 테스트, 커밋, 푸시는 하지 마.');
  const document=await readFile(join(cwd,'HANDOFF.md'),'utf8');
  assert(document.includes('HERA-PICNIC')&&/37,?000/.test(document)&&/\b4\b|four/i.test(document),'Handoff must preserve the project and agreed decisions');
  assert(/skill/i.test(document),'Handoff must suggest skills');
  assert.equal(await readFile(join(cwd,'AGENTS.md'),'utf8'),projectRules);
  assert.deepEqual((await readdir(cwd)).sort(),['AGENTS.md','HANDOFF.md']);assert.equal(controller.workers.count,mode==='adaptive'?1:0);
  if(mode==='adaptive'){
    const items=thread.turns.at(-1).items;const calls=items.filter(item=>item.type==='collabAgentToolCall');
    assert(!calls.some(item=>item.tool==='spawnAgent'),'Handoff reuses the interview Astra');
    assert(calls.some(item=>item.tool==='sendInput'&&item.receiverThreadIds.includes(astraId)));
    const waitIndex=items.findIndex(item=>item.type==='collabAgentToolCall'&&item.tool==='wait');assert(waitIndex>=0);
    const child=await controller.client.read(astraId);const composed=finalText(child).trim();
    assert.equal(document.trim(),composed,'Root must save the exact document composed by Astra');
    const relayIndex=items.findIndex((item,index)=>index>waitIndex&&item.type==='agentMessage'&&item.text.includes(composed));assert(relayIndex>waitIndex,'Relay the document before saving');
    assert(items.slice(relayIndex+1).some(item=>item.type==='fileChange'||item.type==='commandExecution'),'Root writes after relay');
    assert(!child.turns.at(-1).items.some(item=>['fileChange','commandExecution'].includes(item.type)),'Astra must not write');
    const childTrace=(await readFile(child.path,'utf8')).trim().split('\n').map(JSON.parse);
    const childMessages=childTrace.filter(row=>row.type==='response_item'&&row.payload.type==='message').flatMap(row=>row.payload.content??[]).map(item=>item.text??'');
    for(const name of ['grilling','grill-me','handoff']){
      const content=(await readFile(join(bundledSkillsRoot,name,'SKILL.md'),'utf8')).trimEnd();
      assert(childMessages.some(text=>text.includes('<skill>')&&text.includes(content)),`Full packaged ${name} must reach Astra`);
    }
  }
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
  if(mode==='adaptive'){
    spawnEvidence=assertSingleSkillSpawn(trace,astraId,ASTRA_ROLE);
  }
  console.log(JSON.stringify({bundledSkills:'pass',mode,platform:process.platform,arch:process.arch,threadId:thread.id,astraId,spawnEvidence,firstRoundMs,roundCounts,cwd,checks:['grilling','followup','grill-me','handoff','fullNativeInjection',mode==='adaptive'?'astraReuseAndRootHandoffWrite':'gptRootOnly']}));
}finally{clearTimeout(timer);if(controller&&!await controller.close())process.exitCode=5;}
