import assert from 'node:assert/strict';
import {realpath,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,basename,join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeSettings} from '../dist/codex/config-compiler.js';
import {errorView} from '../dist/errors.js';
import {randomUUID} from 'node:crypto';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live --thread <worker-probe-parent> --cwd <worker-fixture>. One resumed parent turn, one existing worker, 120 seconds.');process.exit(4);}
const rootId=process.argv[process.argv.indexOf('--thread')+1];
const cwd=await realpath(process.argv[process.argv.indexOf('--cwd')+1]);
assert.equal(dirname(cwd),await realpath(tmpdir()));assert.ok(basename(cwd).startsWith('hera-workers-fixture-'));
const home=await heraHome();const {config}=await loadConfig(home);
const native={...nativeSettings(config),'agents.enabled':true,'features.multi_agent':true,'features.multi_agent_v2':true,'agents.max_concurrent_threads_per_session':1};
const client=await CodexClient.connect(home,cwd,Object.entries(native).flatMap(([k,v])=>['-c',`${k}=${JSON.stringify(v)}`]));
let timer;let poll;let polling=false;let interrupted=false;let childId;let fail;
try{
  const before=await client.read(rootId);assert.equal(before.cwd,cwd);
  childId=before.turns.flatMap(t=>t.items).find(i=>i.type==='subAgentActivity'&&i.kind==='started')?.agentThreadId;assert.ok(childId);
  const childBefore=await client.read(childId);const oldTurns=childBefore.turns.length;
  const session=await client.resume({threadId:rootId,model:config.main.model,modelProvider:'openai',cwd,sandbox:'read-only',approvalPolicy:'never',config:native});assert.equal(session.sandbox.type,'readOnly');
  const done=new Promise((resolve,reject)=>{
    fail=reject;client.on('fault',reject);client.on('request',request=>reject(new Error(`Unexpected approval: ${request.method}`)));
    client.on('event',event=>{if(event.method==='turn/completed'&&event.params.threadId===rootId)resolve(event.params.turn);});
    timer=setTimeout(()=>reject(new Error('Worker recovery deadline exceeded')),120000);
  });void done.catch(()=>{});
  poll=setInterval(()=>{if(polling||interrupted)return;polling=true;void(async()=>{
    const child=await client.read(childId);const active=child.turns.at(-1);
    if(child.turns.length<=oldTurns||active.status!=='inProgress')return;
    const terminals=await client.rpc.request('thread/backgroundTerminals/list',{threadId:childId});
    if(!terminals.data.length)return;
    interrupted=true;await client.interrupt(childId,active.id);await client.cleanBackgroundTerminals(childId);
  })().catch(fail).finally(()=>{polling=false;});},500);
  await client.turn({threadId:rootId,effort:config.main.reasoningEffort,input:[{type:'text',text_elements:[],text:`Start a NEW independent read-only cancellation probe ${randomUUID()}; this authorizes one new sleep command and is not a request to replay any prior interrupted operation. Resume our existing reader worker using followup_task; do not spawn or replace it. Ask it to recall the sentinel marker from its previous messages without reading files, then execute this newly requested 30-second native shell sleep. A test client will interrupt that worker command. Wait for the worker interruption and report its observed status and the previous marker. Do not retry this new command, write files, use network, or perform a sleep yourself.`}]});
  const ended=await done;assert.equal(ended.status,'completed','Parent must complete');assert.equal(interrupted,true,'Probe must observe and interrupt a newly running worker command');
  while(polling)await new Promise(r=>setTimeout(r,25));
  const after=await client.read(childId);assert.equal(after.model,config.workers.gptModel);assert.equal(after.reasoningEffort,config.workers.reasoningEffort);
  assert.ok(after.turns.length>oldTurns);assert.equal(after.turns.at(-1).status,'interrupted');
  const parent=await client.read(rootId);const marker=await readFile(join(cwd,'sentinel.txt'),'utf8');
  assert.ok(parent.turns.at(-1).items.some(i=>i.type==='agentMessage'&&i.text.includes(marker)));
  await client.cleanBackgroundTerminals(rootId);
  console.log(JSON.stringify({workerRecovery:'pass',rootThreadPreserved:true,childThreadPreserved:true,model:after.model,effort:after.reasoningEffort,activeWorkerCommandInterrupted:true,backgroundCommandsEmpty:true,fullGates:'not_complete'}));
}catch(error){console.error(JSON.stringify(errorView(error)));process.exitCode=1;}
finally{clearTimeout(timer);clearInterval(poll);if(fail)client.off('fault',fail);for(const id of [childId,rootId].filter(Boolean)){const t=await client.read(id).catch(()=>null);for(const turn of t?.turns??[])if(turn.status==='inProgress')await client.interrupt(id,turn.id).catch(()=>{});await client.cleanBackgroundTerminals(id).catch(()=>{process.exitCode=5;});}if(!await client.close())process.exitCode=5;}
