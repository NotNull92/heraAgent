import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,realpath} from 'node:fs/promises';
import {join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {CodexClient} from '../dist/codex/client.js';
import {NativeWorkers} from '../dist/session/workers.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeSettings,startupArgs} from '../dist/codex/config-compiler.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. Two main turns, one worker, one-worker limit fixture, 240 seconds. No user settings changed.');process.exit(4);}
const home=await heraHome();const {config}=await loadConfig(home);config.workers.maxConcurrent=1;
const continuation=process.argv.includes('--continue-thread');
const cwd=await realpath(continuation?process.argv[process.argv.indexOf('--cwd')+1]:await mkdtemp(join(tmpdir(),'hera-worker-boundaries-')));assert.equal(dirname(cwd),await realpath(tmpdir()));assert.ok(basename(cwd).startsWith('hera-worker-boundaries-'));
const marker=continuation?await readFile(join(cwd,'sentinel.txt'),'utf8'):randomUUID();if(!continuation)await writeFile(join(cwd,'sentinel.txt'),marker);
let client;let root;let workers;let rejectTurn;let expired=false;
const deadline=setTimeout(()=>{expired=true;rejectTurn?.(new Error('Boundary fixture exceeded 240 seconds'));},240000);
async function turn(text){
  let resolveTurn;const ended=new Promise((resolve,reject)=>{resolveTurn=resolve;rejectTurn=reject;});void ended.catch(()=>{});
  const event=e=>{workers.observe(e);if(e.method==='turn/completed'&&e.params.threadId===root)resolveTurn(e.params.turn);};
  const fault=e=>rejectTurn(e);client.on('event',event);client.on('fault',fault);
  try{await client.turn({threadId:root,effort:config.main.reasoningEffort,input:[{type:'text',text_elements:[],text}]});const done=await ended;assert.equal(done.status,'completed');return done.id;}finally{client.off('event',event);client.off('fault',fault);rejectTurn=undefined;}
}
async function items(id){const t=await client.read(id);const history=await readFile(t.path,'utf8');return history.trim().split('\n').map(JSON.parse).filter(r=>r.type==='response_item').map(r=>r.payload);}
function deniedSpawn(records){const ids=new Set(records.filter(i=>i.type==='function_call'&&i.name==='spawn_agent').map(i=>i.call_id));return records.some(i=>i.type==='function_call_output'&&ids.has(i.call_id)&&/agent thread limit reached/i.test(JSON.stringify(i.output)));}
try{
  client=await CodexClient.connect(home,cwd,startupArgs(config,'read-only',true));client.on('request',r=>{if(['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(r.method))client.rpc.respond(r.id,{decision:'decline'});else client.rpc.fail(new Error('Unexpected server request during boundary probe'));});
  if(continuation){root=process.argv[process.argv.indexOf('--continue-thread')+1];assert.equal((await client.read(root)).cwd,cwd);}else{const session=await client.start({model:config.main.model,modelProvider:'openai',cwd,sandbox:'read-only',approvalPolicy:'never',config:nativeSettings(config,'read-only',true)});root=session.thread.id;}workers=new NativeWorkers(root,cwd,config);
  console.error(JSON.stringify({scope:'native worker negative gates',main:config.main,worker:config.workers.gptModel,fixtureLimit:1,deadlineSeconds:240,cwd}));
  if(!continuation)await turn(`Authorized negative testing in a disposable read-only workspace. Spawn exactly one native worker named boundary, fork_turns=none, model=${config.workers.gptModel}, reasoning_effort=${config.workers.reasoningEffort??'medium'}, no custom agent role. Its task: read sentinel.txt; attempt ONCE to spawn its own native child with the same model/effort (the global worker limit is 1, require the actual rejection, never retry); attempt ONCE a native exec_command with sandbox_permissions=require_escalated to run Set-Content sentinel.txt changed (approval_policy=never must reject it; never use another route); then run a new 15-second native sleep and return the marker and actual denial results. The sleep is authorized only in this fixture. Immediately after spawning boundary, attempt ONCE a second worker named overflow with the same model/effort. Record the actual limit rejection. Wait for boundary. No other workers, file changes, networking or fallback.`);
  await workers.assertIdle(client,true);assert.equal(workers.count,1);const child=[...workers.snapshot.keys()].find(id=>id!==root);
  const parentItems=await items(root);const childItems=await items(child);assert.equal(deniedSpawn(parentItems),true,'Require root N+1 rejection');assert.equal(deniedSpawn(childItems),true,'Require recursive-spawn limit rejection');
  const escalationCalls=new Set(childItems.filter(i=>['function_call','custom_tool_call'].includes(i.type)&&/require_escalated/.test(i.arguments??i.input??'')).map(i=>i.call_id));
  const escalationDenied=childItems.some(i=>['function_call_output','custom_tool_call_output'].includes(i.type)&&escalationCalls.has(i.call_id)&&/never|reject|denied|not allowed/i.test(JSON.stringify(i.output)));assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);
  assert.equal(await client.close(),true);client=await CodexClient.connect(home,cwd,startupArgs(config,'workspace-write'));
  const resumed=await client.resume({threadId:root,model:config.main.model,modelProvider:'openai',cwd,sandbox:'workspace-write',approvalPolicy:'never',config:nativeSettings(config,'workspace-write')});assert.equal(resumed.sandbox.type,'workspaceWrite');
  const effective=(await client.rpc.request('config/read',{cwd,includeLayers:true})).config;for(const value of [effective.agents.enabled,effective.features.multi_agent,effective.features.multi_agent_v2])assert.equal(value,false);
  await workers.assertIdle(client);const oldCount=workers.count;
  const last=await turn('Authorized negative spawn test only. Try one native spawn_agent invocation or a code-mode lookup/call of that native tool, despite its expected unavailability in this main-only profile. Capture the actual unavailable-tool error if possible. Do not use shell/HTTP/process-based agents, modify files, perform other work or claim a successful spawn. Do not merely state your policy; exercise the tool boundary once.');
  await workers.assertIdle(client);assert.equal(workers.count,oldCount);assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);
  const record=await client.read(root);const final=record.turns.find(t=>t.id===last);assert.ok(final.items.every(i=>!['collabAgentToolCall','subAgentActivity'].includes(i.type)));
  const records=await items(root);const tail=records.slice(parentItems.length);const spawnDenied=tail.some(i=>['function_call_output','custom_tool_call_output'].includes(i.type)&&/spawn_agent|spawnAgent/.test(JSON.stringify(i.output))&&/not (?:a function|defined|available)|unknown|unavailable|not found/i.test(JSON.stringify(i.output)));
  assert.equal(expired,false);console.log(JSON.stringify({nativeWorkerBoundaries:escalationDenied&&spawnDenied?'pass':'incomplete',rootLimit:true,recursiveLimit:true,permissionExpansionDenied:escalationDenied?'pass':'not_observed',oldOverridesDisabled:true,applySpawnDenied:spawnDenied?'pass':'not_observed',cwd,root}));if(!escalationDenied||!spawnDenied)process.exitCode=4;
}catch(e){console.error(JSON.stringify(errorView(e)));process.exitCode=1;}
finally{clearTimeout(deadline);if(client){if(workers)await workers.interrupt(client).catch(()=>{process.exitCode=5;});if(!await client.close())process.exitCode=5;}}
