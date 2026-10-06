import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeSettings,validateModelChoices} from '../dist/codex/config-compiler.js';
import {errorView} from '../dist/errors.js';
const verifyId=process.argv[process.argv.indexOf('--verify-thread')+1];const verifyOnly=process.argv.includes('--verify-thread');
if(!process.argv.includes('--live')&&!verifyOnly){console.error('Opt-in required: node scripts/live-workers.mjs --live. One parent turn, one concurrent worker, 180 seconds; product gates stay blocked.');process.exit(4);}
const home=await heraHome();const {config}=await loadConfig(home);
assert.ok(config.workers.gptModel);
const cwd=await realpath(verifyOnly?process.argv[process.argv.indexOf('--cwd')+1]:await mkdtemp(join(tmpdir(),'hera-workers-fixture-')));
assert.ok(dirname(cwd)===await realpath(tmpdir())&&basename(cwd).startsWith('hera-workers-fixture-'),'Only an owned worker fixture may be checked');
const marker=verifyOnly?await readFile(join(cwd,'sentinel.txt'),'utf8'):randomUUID();
if(!verifyOnly)await writeFile(join(cwd,'sentinel.txt'),marker);
const native={...nativeSettings(config),'agents.enabled':true,'features.multi_agent':true,'features.multi_agent_v2':true,'agents.max_concurrent_threads_per_session':1};
const args=Object.entries(native).flatMap(([key,value])=>['-c',`${key}=${JSON.stringify(value)}`]);
let client;let timer;let root;const calls=[];const children=new Set();let failure;
try{
  client=await CodexClient.connect(home,cwd,args);validateModelChoices(config,await client.models());
  if(verifyOnly){root={thread:await client.read(verifyId),sandbox:{type:'readOnly'}};assert.equal(root.thread.cwd,cwd);}else{
  root=await client.start({model:config.main.model,modelProvider:'openai',cwd,sandbox:'read-only',approvalPolicy:'never',config:native});
  assert.equal(root.sandbox.type,'readOnly');
  const done=new Promise((resolve,reject)=>{
    failure=reject;client.on('fault',reject);
    client.on('request',request=>{if(['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(request.method))client.rpc.respond(request.id,{decision:'decline'});else reject(new Error(`Unexpected request: ${request.method}`));});
    client.on('event',event=>{
      const item=event.params?.item;
      if(event.method==='item/completed'&&item?.type==='subAgentActivity'&&item.kind==='started')children.add(item.agentThreadId);
      if(event.method==='item/completed'&&item?.type==='collabAgentToolCall'){
        calls.push(item);if(item.tool==='spawnAgent'&&item.status==='completed')for(const id of item.receiverThreadIds)children.add(id);
      }
      if(event.method==='turn/completed'&&event.params.threadId===root.thread.id)resolve(event.params.turn);
    });
    timer=setTimeout(()=>reject(new Error('Native worker fixture exceeded 180 seconds; no retry')),180000);
  });void done.catch(()=>{});
  console.error(JSON.stringify({scope:'native worker verification only',model:config.main.model,worker:config.workers.gptModel,effort:config.workers.reasoningEffort,fixtureConcurrency:1,deadlineSeconds:180}));
  await client.turn({threadId:root.thread.id,effort:config.main.reasoningEffort,input:[{type:'text',text_elements:[],text:`This is an authorized bounded native collaboration test in a disposable read-only workspace. Use the native collaboration tools, not independent processes.
1. Spawn a worker named reader with fork_turns=none, model=${config.workers.gptModel}, reasoning_effort=${config.workers.reasoningEffort??'medium'}. Tell it to read sentinel.txt with the native shell, attempt to overwrite ONLY sentinel.txt once (permission denial is expected), confirm the original marker remains, then sleep for 15 seconds with a native shell command and return the marker. No networking, no other writes and no child agents.
2. Immediately attempt a second worker named overflow with the same model/effort and no history fork. The configured concurrency is 1; record the actual limit rejection. Do not retry that spawn.
3. Wait for reader's result. Then use followup_task to ask reader to recall the marker from its existing conversation without tools and use send_message to send it to you. Wait for that follow-up result. Do not create another worker.
4. Return a concise report including the marker, the actual write denial, second-spawn limit result, and follow-up result. Do not change any files yourself. Do not claim an unobserved test passed.`}]});
  const turn=await done;assert.equal(turn.status,'completed');
  }
  const parent=await client.read(root.thread.id);
  for(const turn of parent.turns??[])for(const item of turn.items)if(item.type==='subAgentActivity'&&item.kind==='started')children.add(item.agentThreadId);
  // Test-only evidence from this fixture's pinned native rollout; never copy or edit it.
  const history=await readFile(parent.path,'utf8');
  const toolItems=history.trim().split('\n').map(JSON.parse).filter(r=>r.type==='response_item').map(r=>r.payload);
  const spawnIds=new Set(toolItems.filter(i=>i.type==='function_call'&&i.name==='spawn_agent').map(i=>i.call_id));
  const limitDenied=toolItems.some(i=>i.type==='function_call_output'&&spawnIds.has(i.call_id)&&JSON.stringify(i.output).includes('agent thread limit reached'));
  const childReports=[];
  for(const id of children){const child=await client.read(id);childReports.push({id,model:child.model,effort:child.reasoningEffort,status:child.status,turns:child.turns});}
  const report={spawned:children.size,limitDenied,tools:toolItems.filter(i=>i.type==='function_call').map(i=>i.name),children:childReports.map(c=>({id:c.id,model:c.model,effort:c.effort,status:c.status,turns:c.turns?.map(t=>({status:t.status,commands:t.items.filter(i=>i.type==='commandExecution').map(i=>({status:i.status,exitCode:i.exitCode}))}))}))};
  console.log(JSON.stringify(report));
  assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);
  assert.equal(children.size,1,'Native concurrency limit must reject the second worker');
  assert.ok(limitDenied,'Require a native tool result for the limit rejection');
  assert.ok(parent.turns.some(t=>t.items.some(i=>i.type==='subAgentActivity'&&i.kind==='interacted')));
  for(const child of childReports){assert.equal(child.model,config.workers.gptModel);assert.equal(child.effort,config.workers.reasoningEffort);assert.ok(child.turns.length>=2);
    assert.ok(child.turns.some(t=>t.items.some(i=>i.type==='commandExecution'&&/denied|EPERM|EACCES/i.test(i.aggregatedOutput??'')&&(i.aggregatedOutput??'').includes(marker))),'Require observed worker write denial and marker read');
    assert.ok(child.turns.some(t=>t.items.some(i=>i.type==='subAgentActivity'&&i.kind==='interacted'&&i.agentThreadId===root.thread.id)),'Require worker-to-parent messaging');
  }
  assert.ok(JSON.stringify(parent.turns).includes(marker));
  console.log(JSON.stringify({nativeWorkerProbe:'pass',fullGates:'not_complete',workerCancellation:'not_run',resume:'not_run',apply:'not_run'}));
}catch(error){console.error(JSON.stringify(errorView(error)));process.exitCode=1;}
finally{
  clearTimeout(timer);if(failure)client?.off('fault',failure);
  if(client){if(!verifyOnly)for(const id of [...children,root?.thread.id].filter(Boolean)){const thread=await client.read(id).catch(()=>null);for(const t of thread?.turns??[])if(t.status==='inProgress')await client.interrupt(id,t.id).catch(()=>{});await client.cleanBackgroundTerminals(id).catch(()=>{process.exitCode=5;});}if(!await client.close())process.exitCode=5;}
}
