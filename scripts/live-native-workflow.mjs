import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,open,mkdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Controller} from '../dist/session/controller.js';
import {CodexClient} from '../dist/codex/client.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {heraHome,atomicJson} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeCapability} from '../dist/codex/capabilities.js';
if(!process.argv.includes('--live'))throw new Error('Opt-in --live required: bounded native edit/test, resume, routing and permission fixtures.');
const mode=process.argv.find(a=>a.startsWith('--mode='))?.slice(7)??'adaptive';
assert(['adaptive','external_workers','gpt_only'].includes(mode));
const home=await heraHome();const {config}=await loadConfig(home);config.mode=mode;
const goEffort=process.argv.find(a=>a.startsWith('--go-effort='))?.slice(12);
if(goEffort){assert(['low','high','max'].includes(goEffort));config.workers.goReasoningEffort=goEffort;}
const cwd=await mkdtemp(join(tmpdir(),'hera-native-work-'));const outside=await mkdtemp(join(tmpdir(),'hera-native-permission-'));
await writeFile(join(cwd,'sum.cjs'),'module.exports=(a,b)=>a-b;\n');await writeFile(join(cwd,'check.cjs'),"require('node:assert/strict').equal(require('./sum.cjs')(2,3),5); console.log('sum passed');\n");
await mkdir(join(cwd,'.artifacts'));const large=await open(join(cwd,'.artifacts','baseline-regression.bin'),'wx');await large.truncate(129*1024*1024);await large.close();
let controller;const checks={};const nativeThreadIds=[];let timer;const events=[];let approvals=0;let allowFixture=false;
async function start(previous){const client=await CodexClient.session(home,cwd,config,'workspace-write',true,true);controller=new Controller(client,home,cwd,config,true,true);controller.lock=await acquireWorkspace(home,cwd);await controller.start(previous);controller.on('event',e=>events.push(e));controller.on('requests',()=>{for(const r of controller.requests.values()){approvals++;const actions=JSON.parse(r.summary).request?.commandActions??[];const expected=`Set-Content -LiteralPath '${join(outside,'allowed.txt')}' -Value test`;const accepted=allowFixture&&actions.length===1&&actions[0].command===expected;console.log(JSON.stringify({approval:r.id,decision:accepted?'accept':'decline',fixtureTargetMatched:accepted}));controller.answerRequest(r.id,r.questions?{}:accepted?'accept':'decline');}});nativeThreadIds.push(controller.metadata.codexThreadId);}
async function run(name,prompt,plan=false){events.length=0;console.log(JSON.stringify({stage:name,mode}));let timedOut=false;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;void controller.interrupt().catch(()=>{});reject(new Error(name+' exceeded 180 seconds'));},180000);});try{const result=await Promise.race([controller.run(prompt,undefined,plan),deadline]);await controller.workers.assertIdle(controller.client,true);console.log(JSON.stringify({stage:name,status:result.status,threadId:result.threadId,turnId:result.turnId}));return await controller.client.read(result.threadId);}finally{clearTimeout(timer);if(timedOut)await controller.close();}}
try{
  await start();
  const greetingStarted=performance.now();
  const greeting=await run('conversation','안녕');assert.equal(controller.workers.count,0);assert(greeting.turns.at(-1).items.every(i=>['userMessage','agentMessage','reasoning'].includes(i.type)));checks.conversation='pass';
  const usage=events.findLast(e=>e.method==='thread/tokenUsage/updated'&&e.params.threadId===controller.metadata.codexThreadId)?.params.tokenUsage.last;
  console.log(JSON.stringify({stage:'conversation-metrics',mode,effort:mode==='adaptive'?config.workers.goReasoningEffort:config.main.reasoningEffort,elapsedMs:Math.round(performance.now()-greetingStarted),usage}));
  const edit=await run('edit-test','sum.cjs의 덧셈 버그를 고치고 node check.cjs로 실제 테스트해줘. 이 작은 작업은 직접 처리하고 다른 파일은 수정하지 마.');
  assert.equal((await import('node:child_process')).spawnSync(process.execPath,['check.cjs'],{cwd,windowsHide:true}).status,0);
  assert(edit.turns.at(-1).items.some(i=>i.type==='commandExecution'&&i.exitCode===0&&i.command.includes('check.cjs')));checks.editTest='pass';
  const saved=structuredClone(controller.metadata);assert.equal(await controller.close(),true);await start(saved);assert.equal(controller.metadata.codexThreadId,saved.codexThreadId);
  await run('resume','방금 수정한 파일과 실행한 테스트 이름만 알려줘. 파일을 바꾸거나 도구를 실행하지 마.');checks.resume='pass';
  if(mode==='adaptive'){await run('planning','할 일 앱에 오프라인 동기화를 넣으려 해. 충돌 해결과 데이터 모델을 깊이 검토해서 설계안을 두 문장으로 제시해줘. 파일 수정, 셸, 웹 검색은 필요 없어.');assert([...controller.workers.snapshot.values()].some(t=>t.id!==controller.metadata.codexThreadId&&t.modelProvider==='openai'&&t.model===config.main.model&&t.reasoningEffort===config.main.reasoningEffort));}
  else await run('routing','Use exactly one native worker to read sum.cjs and report its purpose in one sentence. Wait for completion. No files, shell, web or extra workers.');
  await controller.workers.refresh(controller.client);assert(controller.workers.count>0);checks.routing='pass';
  await run('permissions',`Permission test in a disposable fixture. Using the native shell tool, request sandbox_permissions=require_escalated with a short justification to write the word test to ${JSON.stringify(join(outside,'denied.txt'))}. This explicitly exercises the client's approval UI. Do not use another tool or attempt an alternative if declined. No workers.`);
  assert(approvals>0,'Expected a real native approval request');await assert.rejects(readFile(join(outside,'denied.txt')));
  allowFixture=true;
  await run('allow-once',`In this disposable fixture, request one native exec_command with sandbox_permissions=require_escalated and justification="Write the approved test-owned sentinel" to run Set-Content -LiteralPath '${join(outside,'allowed.txt')}' -Value test. The test client will approve only this exact temporary target. Do not use other tools or alternatives. No workers.`);
  allowFixture=false;assert.equal((await readFile(join(outside,'allowed.txt'),'utf8')).trim(),'test');checks.approval='pass';
  await run('plan','읽기 전용으로 sum.cjs 개선 계획을 한 문장으로 작성해줘. 파일이나 셸 변경 없이 직접 답해줘.',true);
  let stopped;const stop=new Promise(resolve=>{stopped=resolve;});const listener=e=>{if(e.method==='item/started'&&e.params.item.type==='commandExecution'){controller.off('event',listener);void controller.interrupt().then(stopped);}};controller.on('event',listener);
  await assert.rejects(run('cancel','Run Start-Sleep -Seconds 30 in the native PowerShell shell and wait. No workers, edits or other tools.'),e=>e.errorCode==='INTERRUPTED');await stop;checks.cancel='pass';
  await run('concurrency',`Start ${Math.min(2,config.workers.maxConcurrent)} native routine workers before waiting, each independently reading sum.cjs with native read tools and summarizing it in one sentence. No writes, web or further agents. Then wait for all. The worker limit is ${config.workers.maxConcurrent}.`);
  const spawns=events.filter(e=>e.method==='item/completed'&&['collabAgentToolCall','subAgentActivity'].includes(e.params.item.type));assert(spawns.length>0);assert(controller.workers.activeCount<=config.workers.maxConcurrent);checks.concurrency='pass';
  await controller.workers.refresh(controller.client);nativeThreadIds.push(...controller.workers.snapshot.keys());
  const evidence={schemaVersion:1,fingerprint:(await nativeCapability(home,config)).fingerprint,checkedAt:new Date().toISOString(),checks,nativeThreadIds:[...new Set(nativeThreadIds)]};
  // Only observed full-suite success is recorded, and only with explicit --record.
  if(process.argv.includes('--record')){const path=join(home,'metadata',`native-${mode}-verification.json`);await copyFile(path,path+'.'+Date.now()+'.bak',1).catch(e=>{if(e.code!=='ENOENT')throw e;});await atomicJson(path,evidence);}
  console.log(JSON.stringify({nativeWorkflow:'pass',platform:process.platform,arch:process.arch,...evidence}));
}finally{clearTimeout(timer);if(controller&&!await controller.close())process.exitCode=5;}
