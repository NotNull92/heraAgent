import {tempFixture} from './temp-fixture.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {Controller} from '../dist/session/controller.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeCapability} from '../dist/codex/capabilities.js';

if(!process.argv.includes('--live'))throw new Error('Opt-in --live required: one bounded Development bug-fix turn in a disposable workspace.');
const home=await heraHome();const {config}=await loadConfig(home);config.mode='external_workers';
const qualification=await nativeCapability(home,config);assert(qualification.ready,qualification.reason);
const cwd=await tempFixture('hera-discipline-live-');
await mkdir(join(cwd,'tests'));
await writeFile(join(cwd,'sum.cjs'),'module.exports=(a,b)=>a-b;\n');
await writeFile(join(cwd,'tests','sum.test.cjs'),"const assert=require('node:assert/strict');\nconst sum=require('../sum.cjs');\nassert.equal(sum(2,3),5,'adds positive integers');\nconsole.log('adds positive integers: passed');\n");
const runTests=()=>spawnSync(process.execPath,['tests/sum.test.cjs'],{cwd,encoding:'utf8',windowsHide:true});
const baseline=runTests();assert.equal(baseline.status,1);assert.match(baseline.stderr,/adds positive integers/);assert.match(baseline.stderr,/ERR_ASSERTION/);
let controller;let timer;let firstTextMs=null;
try{
  const client=await CodexClient.session(home,cwd,config,'workspace-write',true,true);
  controller=new Controller(client,home,cwd,config,true,true);controller.lock=await acquireWorkspace(home,cwd);await controller.start();
  const started=performance.now();
  controller.on('event',event=>{
    if(firstTextMs===null&&event.method==='item/agentMessage/delta'&&event.params.threadId===controller.metadata.codexThreadId&&event.params.delta)firstTextMs=Math.round(performance.now()-started);
  });
  controller.on('requests',()=>{for(const request of controller.requests.values())controller.answerRequest(request.id,request.questions?{}:'decline');});
  console.log(JSON.stringify({stage:'bug-fix',mode:config.mode,threadId:controller.metadata.codexThreadId}));
  const result=await Promise.race([
    controller.run('sum.cjs의 덧셈 버그를 고쳐줘. 양의 정수 2와 3을 더하면 5여야 하는데 -1이 나와. tests/ 폴더에 Node 테스트가 있어. 테스트는 node:test 없이 같은 프로세스에서 실행되는 일반 assert 스크립트이므로 `node tests/sum.test.cjs`로 실행해. 작은 작업이니 직접 처리하고 웹이나 다른 작업자는 쓰지 마.'),
    new Promise((_,reject)=>{timer=setTimeout(()=>{void controller.interrupt().catch(()=>{});reject(new Error('Discipline probe exceeded 180 seconds'));},180000);})
  ]);
  await controller.workers.assertIdle(controller.client,true);
  const totalMs=Math.round(performance.now()-started);
  console.log(JSON.stringify({stage:'bug-fix-completed',firstTextMs,totalMs,threadId:result.threadId}));
  assert.equal(result.status,'completed');assert.equal(controller.workers.count,0);
  const thread=await controller.client.read(result.threadId);const items=thread.turns.at(-1).items;
  const sourceChangeIndex=items.findIndex(item=>item.type==='fileChange'&&item.status==='completed'&&item.changes.some(change=>resolve(cwd,change.path)===join(cwd,'sum.cjs')));
  assert(sourceChangeIndex>=0,'Root must make an observed source fileChange');
  const reproducingTestIndex=items.findIndex(item=>item.type==='commandExecution'&&/sum\.test\.cjs/.test(item.command)&&typeof item.exitCode==='number'&&item.exitCode!==0&&/ERR_ASSERTION|AssertionError/.test(item.aggregatedOutput??''));
  assert(reproducingTestIndex>=0&&reproducingTestIndex<sourceChangeIndex,'Root must run the failing reproducer before changing source');
  const passingTestIndex=items.findIndex((item,index)=>index>sourceChangeIndex&&item.type==='commandExecution'&&item.exitCode===0&&/adds positive integers/.test(item.aggregatedOutput??''));
  assert(passingTestIndex>sourceChangeIndex,'Root must rerun the reproducer successfully after the fix');
  const final=items.filter(item=>item.type==='agentMessage').at(-1)?.text??'';
  assert.match(final,/가정|전제|assum(?:e|ed|ption)/i,'Final message must state an assumption');
  assert.equal(runTests().status,0,'Independent test rerun must pass');
  assert.equal(spawnSync(process.execPath,['-e',"const assert=require('node:assert/strict');const sum=require('./sum.cjs');assert.equal(sum(2,3),5);assert.equal(sum(-2,4),2);"],{cwd,windowsHide:true}).status,0);
  assert.notEqual(firstTextMs,null);
  console.log(JSON.stringify({engineeringDiscipline:'pass',mode:config.mode,platform:process.platform,arch:process.arch,fingerprint:qualification.fingerprint,threadId:result.threadId,firstTextMs,totalMs,reproducingTestIndex,sourceChangeIndex,passingTestIndex,assumptionStated:true,cwd,checks:['rootFailingTestBeforeSourceChange','rootPassingTestAfterFix','finalAssumption','independentTests']}));
}finally{clearTimeout(timer);if(controller&&!await controller.close())process.exitCode=5;}
