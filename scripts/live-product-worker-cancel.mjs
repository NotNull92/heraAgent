import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Controller} from '../dist/session/controller.js';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {startupArgs} from '../dist/codex/config-compiler.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. One main/worker turn in a disposable workspace, 120 seconds.');process.exit(4);}
const cwd=await mkdtemp(join(tmpdir(),'hera-worker-cancel-'));const home=await heraHome();const {config}=await loadConfig(home);
const unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});let controller;let running;
try{
  const client=await CodexClient.connect(home,cwd,startupArgs(config,'read-only',true));controller=new Controller(client,home,cwd,config,true);controller.lock=await acquireWorkspace(home,cwd);await controller.start();
  console.error(JSON.stringify({scope:'product worker cancellation',deadlineSeconds:120,cwd}));
  running=controller.run(`Spawn one native worker named sleeper, fork_turns=none, model=${config.workers.gptModel}, reasoning_effort=${config.workers.reasoningEffort??'medium'}, no custom role. Ask it to run exactly one new 90-second native shell sleep for this cancellation test, without writes, network or more workers. After the spawn acknowledgment return immediately without waiting. A test client will interrupt the child; do not retry it.`);void running.catch(()=>{});
  const deadline=performance.now()+120000;let child;
  for(;;){await controller.workers.refresh(client);for(const t of controller.workers.snapshot.values())if(t.id!==controller.metadata.codexThreadId){const list=await client.rpc.request('thread/backgroundTerminals/list',{threadId:t.id});if(list.data.length)child=t;}if(child)break;if(performance.now()>deadline)throw new Error('No actual worker command observed within deadline');await delay(250);}
  await assert.rejects(controller.requestApply(),e=>['APPLY_GATE_BLOCKED','NOT_QUIESCENT'].includes(e.errorCode));await controller.interrupt();await running.catch(e=>{if(e.errorCode!=='INTERRUPTED')throw e;});await controller.workers.assertIdle(client);
  const after=await client.read(child.id);assert.equal(after.turns.at(-1).status,'interrupted');assert.equal(unrelated.exitCode,null);assert.equal(unrelated.killed,false);
  assert.equal(await controller.close(),true);console.log(JSON.stringify({productWorkerCancel:'pass',actualWorkerCommandInterrupted:true,pendingWorkerApplyBlocked:true,treeIdle:true,workspaceReleased:true,unrelatedProcessPreserved:true}));
}catch(e){console.error(JSON.stringify(errorView(e)));process.exitCode=1;}
finally{if(controller){await controller.interrupt().catch(()=>{});await running?.catch(()=>{});if(!await controller.close())process.exitCode=5;}unrelated.kill();}
