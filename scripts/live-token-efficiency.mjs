import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {errorView} from '../dist/errors.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. One disposable GPT-only fixture, at most five main turns, two Node tests, 240 seconds. --before uses the preserved pre-change build. No worker or credential changes.');process.exit(4);}
const beforeMode=process.argv.includes('--before');const base=beforeMode?'../.artifacts/efficiency-before/dist/':'../dist/';
const {Controller}=await import(base+'session/controller.js');const {CodexClient}=await import(base+'codex/client.js');
const cwd=await mkdtemp(join(tmpdir(),'hera-efficiency-'));const home=await heraHome();const {config}=await loadConfig(home);config.mode='gpt_only';
const before='module.exports = (a,b) => a - b;\n'+Array.from({length:100},(_,i)=>`// Unchanged fixture documentation line ${i}: preserve this text.\n`).join('');const after=before.replace('a - b','a + b');
const check="const assert = require('node:assert/strict'); assert.equal(require('./sum.cjs')(2,3),5);\n";
await writeFile(join(cwd,'sum.cjs'),before);await writeFile(join(cwd,'check-one.cjs'),check);await writeFile(join(cwd,'check-two.cjs'),check);
const tests=[{command:'node check-one.cjs'},{command:'node check-two.cjs'}];
const requests=[];let usage=null;const attached=new WeakSet();const original=CodexClient.prototype.turn;
CodexClient.prototype.turn=async function(params){
 if(!attached.has(this)){attached.add(this);this.on('event',e=>{if(e.method==='thread/tokenUsage/updated')usage=e.params.tokenUsage;});}
 requests.push({inputCharacters:JSON.stringify(params.input).length,outputSchemaCharacters:JSON.stringify(params.outputSchema??null).length});
 assert.ok(requests.length<=5,'Bounded fixture exceeded five main turns');return original.call(this,params);
};
let controller;let expired=false;const timer=setTimeout(()=>{expired=true;void controller?.interrupt().catch(()=>{});},240000);
try{
 console.error(JSON.stringify({scope:'token efficiency fixture',variant:beforeMode?'before':'after',main:config.main,maxMainTurns:5,deadlineSeconds:240}));
 // Retain the historical proposal comparison; normal Hera no longer uses /apply.
 if(beforeMode)controller=await Controller.open(home,cwd,config,true);
 else{const client=await CodexClient.session(home,cwd,config,'read-only',false);controller=new Controller(client,home,cwd,config);controller.lock=await acquireWorkspace(home,cwd);await controller.start();}
 await controller.run('Inspect sum.cjs and propose the smallest addition fix: replace a - b with a + b. Preserve every documentation line exactly. Future approval scope: only sum.cjs, followed by exactly these tests in order: node check-one.cjs, node check-two.cjs. Keep both test files unchanged. No workers, writes or tests yet.');
 const review=await controller.requestApply();assert.equal(await readFile(join(cwd,'sum.cjs'),'utf8'),before);assert.deepEqual(review.proposal.changes,[{path:'sum.cjs',content:after}]);assert.deepEqual(review.proposal.tests,tests);
 if(!beforeMode){assert.ok(review.edits);assert.ok(JSON.stringify(review.edits.changes).length<before.length/2);}
 const result=await controller.applyApproved(review.id);assert.deepEqual(result,tests.map(t=>({...t,exitCode:0})));assert.equal(controller.phase.phase,'COMPLETE');assert.equal(await readFile(join(cwd,'sum.cjs'),'utf8'),after);
 for(const file of ['check-one.cjs','check-two.cjs'])assert.equal(await readFile(join(cwd,file),'utf8'),check);
 assert.equal(expired,false);assert.equal(requests.length,beforeMode?5:4);
 console.log(JSON.stringify({variant:beforeMode?'before':'after',pass:true,root:controller.metadata.codexThreadId,model:config.main,mainTurns:requests.length,requests,usage,fileCharacters:before.length,applyPayloadCharacters:JSON.stringify(review.edits?.changes??review.proposal.changes).length,tests:result,scope:'One paired fixture; counts include cache and are not a general savings or billing claim.'}));
}catch(e){console.error(JSON.stringify(errorView(e)));process.exitCode=1;}
finally{clearTimeout(timer);CodexClient.prototype.turn=original;if(controller&&!await controller.close())process.exitCode=5;}
