import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Controller} from '../dist/session/controller.js';
import {loadConfig} from '../dist/config.js';
import {heraHome} from '../dist/paths.js';
import {nativeCapability} from '../dist/codex/capabilities.js';

if(!process.argv.includes('--live'))throw new Error('Explicit --live required: two bounded adaptive native-worker turns.');
const home=await heraHome();const original=await readFile(join(home,'config.json'),'utf8');
const {config}=await loadConfig(home);config.mode='adaptive';
const cwd=await mkdtemp(join(tmpdir(),'hera-effort-switch-'));let fingerprint;
for(const effort of ['high','low']){
  config.workers.goReasoningEffort=effort;
  const capability=await nativeCapability(home,config);assert(capability.ready,'Qualify native adaptive workflow first');
  fingerprint??=capability.fingerprint;assert.equal(capability.fingerprint,fingerprint);
  let controller;let timer;
  try{
    controller=await Controller.open(home,cwd,config,false);
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{void controller.interrupt().catch(()=>{});reject(new Error('Effort turn exceeded 180 seconds'));},180000);});
    await Promise.race([controller.run('Use exactly one routine native worker to reply hello, then wait for its reply. No files, shell, web or additional workers.'),deadline]);
    await controller.workers.assertIdle(controller.client,true);
    const threads=[...controller.workers.snapshot.values()];assert(threads.length>=2);
    for(const thread of threads){assert.equal(thread.model,'deepseek-v4.1-flash');assert.equal(thread.reasoningEffort,effort);}
    console.log(JSON.stringify({effort,rootAndWorker:'pass',qualification:'unchanged',nativeThreadIds:threads.map(t=>t.id)}));
  }finally{clearTimeout(timer);if(controller)assert.equal(await controller.close(),true);}
}
assert.equal(await readFile(join(home,'config.json'),'utf8'),original,'User configuration must remain unchanged');
