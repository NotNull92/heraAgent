import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Controller} from '../dist/session/controller.js';
import {CodexClient} from '../dist/codex/client.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {GO_ROLE} from '../dist/codex/external-runtime.js';

if(!process.argv.includes('--live'))throw new Error('Opt-in --live required: three workers, one rejected spawn, child cancellation and recovery; 300 seconds maximum.');
const mode=process.argv.find(a=>a.startsWith('--mode='))?.slice(7)??'adaptive';
assert(['adaptive','external_workers'].includes(mode));
const home=await heraHome();const {config}=await loadConfig(home);config.mode=mode;config.workers.maxConcurrent=3;
const cwd=await mkdtemp(join(tmpdir(),'hera-native-boundaries-'));
const client=await CodexClient.session(home,cwd,config,'workspace-write',true,true);
const controller=new Controller(client,home,cwd,config,true,true);
let timer;let expired=false;let peak=0;
const route=`agent_type=${GO_ROLE}, fork_context=false, no model/effort overrides`;
const sleep=process.platform==='win32'?'Start-Sleep -Seconds 45':'sleep 45';
try{
  controller.lock=await acquireWorkspace(home,cwd);await controller.start();
  const root=controller.metadata.codexThreadId;
  controller.on('workers',()=>{peak=Math.max(peak,controller.workers.activeCount);});
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;void controller.interrupt().catch(()=>{});reject(new Error('Native boundary fixture exceeded 300 seconds'));},300000);});void deadline.catch(()=>{});
  const run=prompt=>Promise.race([controller.run(prompt),deadline]);
  console.log(JSON.stringify({stage:'N+1',mode,limit:3,root,cwd,deadlineSeconds:300}));
  await run(`Authorized limit test in this disposable workspace. Start exactly three native workers (${route}) before waiting. Each task is only to run ${sleep} using its native shell, wait for completion, then say done; no files, web, other tools or descendants. Immediately attempt a fourth spawn with the same route ONCE, while the first three are still busy. This deliberate attempt must exercise the native limit; do not merely describe the limit. Do not close or interrupt any worker to make room. Record the actual error, then wait for the first three to finish. No alternative processes/providers or retries.`);
  await controller.workers.assertIdle(client,true);assert.equal(controller.workers.count,3);assert.equal(peak,3);
  const thread=await client.read(root);const records=(await readFile(thread.path,'utf8')).trim().split('\n').map(JSON.parse).filter(r=>r.type==='response_item').map(r=>r.payload);
  assert(records.some(i=>['function_call_output','custom_tool_call_output'].includes(i.type)&&/agent thread limit reached/i.test(JSON.stringify(i.output))),'Require a native tool limit error, not a model assertion');
  console.log(JSON.stringify({stage:'N+1',mode,result:'pass',peak}));
  const child=[...controller.workers.snapshot.keys()].find(id=>id!==root);
  let stopped;const stop=new Promise((resolve,reject)=>{stopped={resolve,reject};});void stop.catch(()=>{});
  const listener=e=>{if(e.method==='item/started'&&e.params.threadId!==root&&e.params.item.type==='commandExecution'){
    controller.off('event',listener);void controller.interrupt().then(stopped.resolve,stopped.reject);
  }};controller.on('event',listener);
  await assert.rejects(run(`Reuse the existing native worker ${child}; resume it first if unloaded. Send it the task to run ${sleep} and wait. Do not spawn new workers or use files/web. Wait for its completion.`),e=>e.errorCode==='INTERRUPTED');
  await Promise.race([stop,deadline]);await controller.workers.assertIdle(client,true);
  await run('취소 후 연결 확인입니다. 도구나 워커 없이 한 문장으로 답해주세요.');
  await controller.workers.assertIdle(client,true);assert.equal(controller.workers.activeCount,0);assert.equal(expired,false);
  console.log(JSON.stringify({nativeBoundaries:'pass',mode,root,peak,limit:3,overflow:'native rejection',childCancellation:'pass',recovery:'pass',nativeThreadIds:[...controller.workers.snapshot.keys()]}));
}finally{clearTimeout(timer);if(!await controller.close())process.exitCode=5;}
