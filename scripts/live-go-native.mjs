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
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. One native Go read-only turn, 120 seconds, provider HTTP/stream retries disabled; no fallback.');process.exit(4);}
const home=await heraHome();const {config}=await loadConfig(home);const {key}=await resolveGoCredential(home);if(!key){console.error('BLOCKED_NO_CREDENTIALS');process.exit(3);}
const cwd=await mkdtemp(join(tmpdir(),'hera-go-native-'));const marker=randomUUID();await writeFile(join(cwd,'sentinel.txt'),marker);await verifyContract();
const settings={...nativeSettings(config),model_provider:'hera_go_probe',model_reasoning_effort:'low','model_providers.hera_go_probe':{name:'Hera Go native fixture',base_url:GO_URL,env_key:'HERA_OPENCODE_GO_API_KEY',wire_api:'responses',requires_openai_auth:false,request_max_retries:0,stream_max_retries:0,stream_idle_timeout_ms:20000,supports_websockets:false,http_headers:{'User-Agent':'hera/0.1.0-alpha.1','x-opencode-session':randomUUID()}}};
// A test-owned runtime receives the key in memory only. Its tool environment uses
// the product core-only policy and excludes *KEY*; no credential file or CLI argument.
function args(values,prefix=''){return Object.entries(values).flatMap(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?args(v,prefix+k+'.'):['-c',`${prefix+k}=${JSON.stringify(v)}`]);}
const child=spawn(process.execPath,[runtimeLauncher(),'app-server','--strict-config',...args(settings)],{cwd,env:{...childEnvironment(home,cwd),HERA_OPENCODE_GO_API_KEY:key},shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
const client=new CodexClient(child);let root;let turnId;let timer;let rejectTurn;
try{
  client.on('fault',error=>rejectTurn?.(error));client.on('request',r=>{if(['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(r.method))client.rpc.respond(r.id,{decision:'decline'});else client.rpc.fail(new Error('Unexpected approval request'));});await client.initialize();
  const started=await client.start({model:GO_MODEL,modelProvider:'hera_go_probe',cwd,sandbox:'read-only',approvalPolicy:'never',config:settings});root=started.thread.id;assert.equal(started.modelProvider,'hera_go_probe');assert.equal(started.model,GO_MODEL);
  const done=new Promise((resolve,reject)=>{rejectTurn=reject;client.on('event',e=>{if(e.method==='turn/completed'&&e.params.threadId===root)resolve(e.params.turn);});timer=setTimeout(()=>reject(new Error('Native Go deadline')),120000);});void done.catch(()=>{});
  console.error(JSON.stringify({scope:'native Go streaming and tool read',route:GO_URL,model:GO_MODEL,deadlineSeconds:120,retries:0,cwd,root}));
  turnId=(await client.turn({threadId:root,effort:'low',input:[{type:'text',text_elements:[],text:'Read sentinel.txt using a native shell tool and return its exact contents. No edits, permissions, network, tests, workers or environment inspection.'}]})).id;
  const result=await done;
  if(result.status!=='completed'){
    const errorText=JSON.stringify(result.error??{});const code=result.error?.codexErrorInfo;const category=/content.type|text\/html|event.stream|stream/i.test(errorText)?'STREAM_PROTOCOL_REJECTED':/model|unsupported/i.test(errorText)?'MODEL_OR_PROTOCOL_REJECTED':'NATIVE_TURN_FAILED';
    console.log(JSON.stringify({nativeGo:'blocked',category,nativeErrorType:typeof code==='string'?code:Object.keys(code??{}),turnStatus:result.status,root,externalMode:'blocked'}));process.exitCode=4;
  }else{
    const history=await client.read(root);const items=history.turns.find(t=>t.id===turnId)?.items??[];assert.ok(items.some(i=>i.type==='commandExecution'&&i.exitCode===0&&i.aggregatedOutput?.includes(marker)),'Require native tool output');assert.ok(items.some(i=>i.type==='agentMessage'&&i.text.includes(marker)),'Require model read result');
    console.log(JSON.stringify({nativeGo:'pass',scope:'single native Go read-only tool turn only',root,externalMode:'blocked',remaining:['cross-provider assignment/messages','concurrency','cancellation','resume','single-writer transition']}));
  }
  assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);
}catch(error){console.error(JSON.stringify({nativeGo:'blocked',errorCode:error?.errorCode??'NATIVE_PROBE_FAILED',rawErrorOmitted:true,root,externalMode:'blocked'}));process.exitCode=5;}
finally{clearTimeout(timer);if(root&&turnId)await client.interrupt(root,turnId).catch(()=>{});if(root)await client.cleanBackgroundTerminals(root).catch(()=>{});if(!await client.close())process.exitCode=5;}
