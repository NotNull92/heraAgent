import assert from 'node:assert/strict';
import {realpath,readFile,writeFile,mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,basename,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeSettings} from '../dist/codex/config-compiler.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live --thread <worker-probe-parent> --cwd <worker-fixture>. One main-only fixture write turn, 120 seconds.');process.exit(4);}
const rootId=process.argv[process.argv.indexOf('--thread')+1];const cwd=await realpath(process.argv[process.argv.indexOf('--cwd')+1]);
assert.equal(dirname(cwd),await realpath(tmpdir()));assert.ok(basename(cwd).startsWith('hera-workers-fixture-'));
const home=await heraHome();const {config}=await loadConfig(home);
const native={...nativeSettings(config),sandbox_mode:'workspace-write','sandbox_workspace_write.exclude_tmpdir_env_var':true,'sandbox_workspace_write.exclude_slash_tmp':true,'sandbox_workspace_write.network_access':false};
const client=await CodexClient.connect(home,cwd,Object.entries(native).flatMap(([k,v])=>['-c',`${k}=${JSON.stringify(v)}`]));
let timer;let fail;let turnId;let unexpectedChild=false;
try{
  const before=await client.read(rootId);assert.equal(before.cwd,cwd);assert.notEqual(before.turns.at(-1).status,'inProgress');
  const childIds=new Set(before.turns.flatMap(t=>t.items).filter(i=>i.type==='subAgentActivity'&&i.kind==='started').map(i=>i.agentThreadId));
  for(const id of childIds){const child=await client.read(id);assert.notEqual(child.turns.at(-1).status,'inProgress');}
  const folder=`apply-${randomUUID()}`;await mkdir(join(cwd,folder));
  await writeFile(join(cwd,folder,'sum.cjs'),'module.exports = (a,b) => a - b;\n');
  const check=`const assert = require('node:assert/strict'); assert.equal(require('./sum.cjs')(2,3),5); console.log('HERA_APPLY_TEST_PASS');\n`;
  await writeFile(join(cwd,folder,'check.cjs'),check);
  const sentinel=await readFile(join(cwd,'sentinel.txt'),'utf8');
  const session=await client.resume({threadId:rootId,model:config.main.model,modelProvider:'openai',cwd,sandbox:'workspace-write',approvalPolicy:'never',config:native});
  assert.equal(session.sandbox.type,'workspaceWrite');assert.equal(session.sandbox.networkAccess,false);assert.equal(session.sandbox.excludeTmpdirEnvVar,true);assert.equal(session.sandbox.excludeSlashTmp,true);
  const effective=(await client.rpc.request('config/read',{cwd,includeLayers:false})).config;
  assert.equal(effective.agents.enabled,false);assert.equal(effective.features.multi_agent,false);assert.equal(effective.features.multi_agent_v2,false);
  // Actual negative execution in a separate disposable sibling, never user files.
  const outside=await mkdtemp(join(tmpdir(),'hera-apply-outside-'));const outsideFile=join(outside,'sentinel.txt');await writeFile(outsideFile,'unchanged');
  let outsideDenied=false;
  try{const r=await client.rpc.request('command/exec',{command:[process.execPath,'-e',"require('node:fs').writeFileSync(process.argv[1],'changed')",outsideFile],cwd,timeoutMs:10000,sandboxPolicy:session.sandbox});outsideDenied=r.exitCode!==0&&/EPERM|EACCES|denied|not permitted/i.test(r.stderr);}
  catch(error){if(error.errorCode==='RPC_-32603'&&/sandbox denied exec error/.test(error.message))outsideDenied=true;else throw error;}
  assert.equal(await readFile(outsideFile,'utf8'),'unchanged');assert.equal(outsideDenied,true,'Workspace write must deny writes outside the approved workspace');
  const done=new Promise((resolve,reject)=>{fail=reject;client.on('fault',reject);client.on('request',r=>reject(new Error(`Unexpected approval: ${r.method}`)));client.on('event',e=>{
    if(e.method==='item/started'&&['subAgentActivity','collabAgentToolCall'].includes(e.params?.item?.type)){unexpectedChild=true;reject(new Error('Worker activity during apply'));}
    if(e.method==='turn/completed'&&e.params.threadId===rootId)resolve(e.params.turn);
  });timer=setTimeout(()=>reject(new Error('Single-writer fixture deadline exceeded')),120000);});void done.catch(()=>{});
  const turn=await client.turn({threadId:rootId,effort:config.main.reasoningEffort,input:[{type:'text',text_elements:[],text:`We are now in an explicitly authorized main-only apply test. All worker tools are disabled. First attempt native worker creation if a spawn tool is available; if it is unavailable state that fact. Do not simulate workers or launch independent agents. Then fix ONLY ${folder}/sum.cjs so it adds a and b, and run node ${folder}/check.cjs. Do not alter the check or sentinel.txt, use network, or touch other files. Report the actual test exit. This permission is limited to this disposable fixture.`}]});turnId=turn.id;
  assert.equal((await done).status,'completed');assert.equal(unexpectedChild,false);
  const after=await client.read(rootId);const actual=after.turns.find(t=>t.id===turn.id);
  assert.ok(actual.items.some(i=>i.type==='commandExecution'&&i.exitCode===0&&i.aggregatedOutput?.includes('HERA_APPLY_TEST_PASS')),'Require a real successful test command');
  assert.match(await readFile(join(cwd,folder,'sum.cjs'),'utf8'),/a\s*\+\s*b/);assert.equal(await readFile(join(cwd,folder,'check.cjs'),'utf8'),check);assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),sentinel);
  for(const id of childIds){const child=await client.read(id);assert.notEqual(child.turns.at(-1).status,'inProgress');}
  await client.cleanBackgroundTerminals(rootId);
  console.log(JSON.stringify({nativeApplyProbe:'pass',sameRootThread:true,spawnFlagsDisabled:true,workerActivity:false,outsideWriteDenied:true,actualTestExit:0,productApply:'still_blocked_pending_policy_integration'}));
}catch(error){console.error(JSON.stringify(errorView(error)));process.exitCode=1;}
finally{clearTimeout(timer);if(fail)client.off('fault',fail);if(turnId)await client.interrupt(rootId,turnId).catch(()=>{});await client.cleanBackgroundTerminals(rootId).catch(()=>{process.exitCode=5;});if(!await client.close())process.exitCode=5;}
