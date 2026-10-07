import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Controller} from '../dist/session/controller.js';
import {CodexClient} from '../dist/codex/client.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. Four bounded main-model turns in a disposable fixture, maximum 180 seconds.');process.exit(4);}
const cwd=await mkdtemp(join(tmpdir(),'hera-product-apply-'));const home=await heraHome();const {config}=await loadConfig(home);config.mode='gpt_only';
const before='module.exports = (a,b) => a - b;\n';const after='module.exports = (a,b) => a + b;\n';
const check="const assert = require('node:assert/strict'); assert.equal(require('./sum.cjs')(2,3),5); console.log('HERA_PRODUCT_APPLY_PASS');\n";
await writeFile(join(cwd,'sum.cjs'),before);await writeFile(join(cwd,'check.cjs'),check);
let controller;let timeout;let expired=false;
try{
  // Historical phased qualification, not the public native-workspace entry point.
  const client=await CodexClient.session(home,cwd,config,'read-only',false);controller=new Controller(client,home,cwd,config);controller.lock=await acquireWorkspace(home,cwd);await controller.start();
  timeout=setTimeout(()=>{expired=true;void controller.interrupt().catch(()=>{});},180000);
  await controller.run('Inspect sum.cjs and propose the smallest addition fix. The future approval scope is only sum.cjs with exact content '+JSON.stringify(after)+' and exactly one test command: node check.cjs. Keep check.cjs unchanged. Do not write files yet.');
  const root=controller.metadata.codexThreadId;
  const review=await controller.requestApply();assert.equal(await readFile(join(cwd,'sum.cjs'),'utf8'),before);
  assert.deepEqual(review.proposal.changes,[{path:'sum.cjs',content:after}]);assert.deepEqual(review.proposal.tests,[{command:'node check.cjs'}]);
  await assert.rejects(controller.applyApproved('stale-id'),{errorCode:'STALE_APPROVAL'});
  const results=await controller.applyApproved(review.id);
  assert.equal(controller.metadata.codexThreadId,root);assert.equal(await readFile(join(cwd,'sum.cjs'),'utf8'),after);assert.equal(await readFile(join(cwd,'check.cjs'),'utf8'),check);
  assert.deepEqual(results,[{command:'node check.cjs',exitCode:0}]);assert.equal(controller.phase.phase,'COMPLETE');assert.equal(expired,false);
  console.log(JSON.stringify({productApply:'pass',sameThread:true,unapprovedWrite:false,testExit:0,cwd}));
}catch(e){console.error(JSON.stringify(errorView(e)));process.exitCode=1;}
finally{clearTimeout(timeout);if(controller&&!await controller.close())process.exitCode=5;}
