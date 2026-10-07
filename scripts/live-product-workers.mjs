import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {Controller} from '../dist/session/controller.js';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {startupArgs} from '../dist/codex/config-compiler.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. Disposable GPT worker/resume/apply fixture, at most six main turns and two worker turns, 300 seconds. No Go call.');process.exit(4);}
const cwd=await mkdtemp(join(tmpdir(),'hera-product-workers-'));const home=await heraHome();const {config}=await loadConfig(home);const marker=randomUUID();
const before='module.exports = (a,b) => a - b;\n';const after='module.exports = (a,b) => a + b;\n';
const check="const assert = require('node:assert/strict'); assert.equal(require('./sum.cjs')(2,3),5); console.log('HERA_PRODUCT_WORKERS_PASS');\n";
await writeFile(join(cwd,'sum.cjs'),before);await writeFile(join(cwd,'check.cjs'),check);await writeFile(join(cwd,'sentinel.txt'),marker);
let controller;let expired=false;
const timeout=setTimeout(()=>{expired=true;void controller?.interrupt().catch(()=>{});},300000);
// This test alone enters the unverified path, in its own locked disposable workspace.
// Public Controller.open stays gated until native acceptance evidence is recorded.
async function open(previous){const client=await CodexClient.connect(home,cwd,startupArgs(config,'read-only',true));const current=new Controller(client,home,cwd,config,true);current.lock=await acquireWorkspace(home,cwd);try{await current.start(previous);return current;}catch(e){await current.close();throw e;}}
try{
  controller=await open();console.error(JSON.stringify({scope:'GPT native product worker fixture',cwd,main:config.main,worker:config.workers.gptModel,workerEffort:config.workers.reasoningEffort,configuredLimit:config.workers.maxConcurrent,deadlineSeconds:300}));
  await controller.run(`Use exactly one native worker named reader, fork_turns=none, model=${config.workers.gptModel}, reasoning_effort=${config.workers.reasoningEffort??'medium'}, no custom role. Ask it to read sentinel.txt and sum.cjs using native tools and return the marker and the addition fix in its required result contract. No writes, networking, permissions, tests or child spawns. Wait for the worker. Then send it a followup_task asking it to recall the marker from its prior context and use send_message to return it, preserving the required final result contract. Wait for that result. Return the marker and proposal. The only future approved change is sum.cjs with exact content ${JSON.stringify(after)}; the only future test is node check.cjs. Do not apply or run tests.`);
  await controller.workers.assertIdle(controller.client,true);assert.equal(controller.workers.count,1);assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);
  const root=controller.metadata.codexThreadId;const child=[...controller.workers.snapshot.values()].find(t=>t.id!==root);assert.ok(child.turns.length>=2);
  const previous=structuredClone(controller.metadata);assert.equal(await controller.close(),true);controller=await open(previous);assert.equal(controller.workers.count,1);
  await controller.run('Recall the worker result from our saved context without spawning or running tools. Confirm the marker and the exact sum.cjs replacement/test scope for review.');
  const history=await controller.client.read(root);assert.ok(history.turns.at(-1).items.some(i=>i.type==='agentMessage'&&i.text.includes(marker)));
  const review=await controller.requestApply();assert.equal(await readFile(join(cwd,'sum.cjs'),'utf8'),before);assert.deepEqual(review.proposal.changes,[{path:'sum.cjs',content:after}]);assert.deepEqual(review.proposal.tests,[{command:'node check.cjs'}]);
  const results=await controller.applyApproved(review.id);assert.deepEqual(results,[{command:'node check.cjs',exitCode:0}]);assert.equal(controller.metadata.codexThreadId,root);assert.equal(controller.phase.phase,'COMPLETE');assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);assert.equal(await readFile(join(cwd,'check.cjs'),'utf8'),check);assert.equal(expired,false);
  console.log(JSON.stringify({productWorkers:'pass',workerCount:1,configuredLimit:config.workers.maxConcurrent,nativeFollowup:true,sameRootAndChildResume:true,workerContractsValidated:true,mainOnlyApply:true,testExit:0,scope:'positive integration; permission and spawn negatives require separate fixtures',cwd,root}));
}catch(e){console.error(JSON.stringify(errorView(e)));process.exitCode=1;}
finally{clearTimeout(timeout);if(controller&&!await controller.close())process.exitCode=5;}
