import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {CodexClient} from '../dist/codex/client.js';
import {childEnvironment,runtimeLauncher} from '../dist/codex/launcher.js';
import {verifyContract} from '../dist/codex/capabilities.js';
import {nativeSettings} from '../dist/codex/config-compiler.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {resolveGoCredential} from '../dist/providers/go-credentials.js';
import {GO_URL,GO_MODEL} from '../dist/providers/opencode-go.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. One GPT parent with one Go child and one follow-up, 180 seconds. No retry or provider fallback.');process.exit(4);}
const home=await heraHome();const {config}=await loadConfig(home);const {key}=await resolveGoCredential(home);if(!key){console.error('BLOCKED_NO_CREDENTIALS');process.exit(3);}
const cwd=await mkdtemp(join(tmpdir(),'hera-go-collaboration-'));const marker=randomUUID();await writeFile(join(cwd,'sentinel.txt'),marker);await verifyContract();
const rolePath=join(cwd,'go-role.toml');await writeFile(rolePath,`model = "${GO_MODEL}"\nmodel_provider = "hera_go_probe"\nmodel_reasoning_effort = "low"\nsandbox_mode = "read-only"\napproval_policy = "never"\n`);
const settings={...nativeSettings(config,'read-only',true),'agents.max_concurrent_threads_per_session':1,'agents.go_probe':{description:'Read-only Go DeepSeek fixture worker. Use only for this explicitly authorized routing test.',config_file:rolePath},'model_providers.hera_go_probe':{name:'Hera Go collaboration fixture',base_url:GO_URL,env_key:'HERA_OPENCODE_GO_API_KEY',wire_api:'responses',requires_openai_auth:false,request_max_retries:0,stream_max_retries:0,stream_idle_timeout_ms:20000,supports_websockets:false,http_headers:{'User-Agent':'hera/0.1.0-alpha.1','x-opencode-session':randomUUID()}}};
if(process.argv.includes('--v1'))settings['features.multi_agent_v2']=false;
function args(values,prefix=''){return Object.entries(values).flatMap(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?args(v,prefix+k+'.'):['-c',`${prefix+k}=${JSON.stringify(v)}`]);}
const child=spawn(process.execPath,[runtimeLauncher(),'app-server','--strict-config','-c','cli_auth_credentials_store="keyring"',...args(settings)],{cwd,env:{...childEnvironment(home,cwd),HERA_OPENCODE_GO_API_KEY:key},shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
const client=new CodexClient(child);let root;let turnId;let timer;let rejectTurn;const childIds=new Set();
try{
  client.on('fault',error=>rejectTurn?.(error));client.on('request',r=>{if(['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(r.method))client.rpc.respond(r.id,{decision:'decline'});else client.rpc.fail(new Error('Unexpected approval request'));});await client.initialize();
  const started=await client.start({model:config.main.model,modelProvider:'openai',cwd,sandbox:'read-only',approvalPolicy:'never',config:settings});root=started.thread.id;assert.equal(started.modelProvider,'openai');
  const done=new Promise((resolve,reject)=>{rejectTurn=reject;client.on('event',e=>{if(e.method==='item/completed'&&e.params.item?.type==='subAgentActivity'&&e.params.item.kind==='started')childIds.add(e.params.item.agentThreadId);if(e.method==='item/completed'&&e.params.item?.type==='collabAgentToolCall'&&e.params.item.tool==='spawnAgent'&&e.params.item.status==='completed')for(const id of e.params.item.receiverThreadIds)childIds.add(id);if(e.method==='turn/completed'&&e.params.threadId===root)resolve(e.params.turn);});timer=setTimeout(()=>reject(new Error('Cross-provider deadline')),180000);});void done.catch(()=>{});
  console.error(JSON.stringify({scope:'native GPT to Go role assignment and follow-up',main:config.main,worker:GO_MODEL,deadlineSeconds:180,cwd,root}));
  turnId=(await client.turn({threadId:root,effort:config.main.reasoningEffort,input:[{type:'text',text_elements:[],text:`This is an authorized native cross-provider compatibility test. Use the actual available native tool parameters; if this backend calls follow-up send_input rather than followup_task, use send_input. Use spawn_agent exactly once with name=go_reader, agent_type=go_probe, ${process.argv.includes('--role-model')?'omit the model argument so the go_probe role file selects its model':`model=${GO_MODEL}`}, reasoning_effort=low, no inherited conversation (fork_turns=none or fork_context=false, according to the actual tool schema). Its task: read sentinel.txt using a native shell tool and return the exact marker. No writes, permissions, networking, tests, environment inspection, additional workers or alternative model/provider. Wait for completion. If successful, use followup_task once to ask it to recall the same marker from its own saved context without rereading and send_message to return it; wait. Report the marker and actual outcome. On any failure stop; do not retry, replace the worker or try another provider. Do not yourself read the marker.`}]})).id;
  const result=await done;assert.equal(result.status,'completed');assert.equal(childIds.size,1,'Require exactly one native child');
  const worker=await client.read([...childIds][0]);assert.equal(worker.parentThreadId,root);assert.equal(worker.modelProvider,'hera_go_probe');assert.equal(worker.model,GO_MODEL);
  const items=worker.turns.flatMap(t=>t.items);const read=items.some(i=>i.type==='commandExecution'&&i.exitCode===0&&i.aggregatedOutput?.includes(marker));const followup=worker.turns.length>=2&&worker.turns.at(-1).status==='completed'&&worker.turns.at(-1).items.some(i=>i.type==='agentMessage'&&i.text.includes(marker));
  const parent=await client.read(root);const returned=parent.turns.at(-1).items.some(i=>i.type==='agentMessage'&&i.text.includes(marker));
  assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);
  console.log(JSON.stringify({nativeGoCollaboration:read&&followup&&returned?'pass':'blocked',observedProvider:worker.modelProvider,observedModel:worker.model,nativeRead:read,nativeFollowup:followup,parentReceivedMarker:returned,childTurnStatuses:worker.turns.map(t=>t.status),root,child:worker.id,externalMode:'blocked'}));if(!read||!followup||!returned)process.exitCode=4;
}catch(error){console.error(JSON.stringify({nativeGoCollaboration:'blocked',errorCode:error?.errorCode??'COLLABORATION_ASSERTION_FAILED',rawErrorOmitted:true,root,observedChildCount:childIds.size,externalMode:'blocked'}));process.exitCode=5;}
finally{clearTimeout(timer);for(const id of [root,...childIds].filter(Boolean)){try{const t=await client.read(id);for(const turn of t.turns??[])if(turn.status==='inProgress')await client.interrupt(id,turn.id);await client.cleanBackgroundTerminals(id);}catch{}}if(!await client.close())process.exitCode=5;}
