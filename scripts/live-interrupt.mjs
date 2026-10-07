import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Controller} from '../dist/session/controller.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: node scripts/live-interrupt.mjs --live (one read-only turn, 90 second deadline).');process.exit(4);}
const home=await heraHome();const {config}=await loadConfig(home);config.mode='gpt_only';
const cwd=await mkdtemp(join(tmpdir(),'hera-interrupt-fixture-'));
let controller;let timer;let interruptTimer;let requested=false;let interrupt;
const events=[];
try{
  controller=await Controller.open(home,cwd,config,true);
  timer=setTimeout(()=>void controller.close(),90000);
  controller.on('event',event=>{
    if(['item/started','item/completed','turn/completed'].includes(event.method))events.push({method:event.method,id:event.params?.item?.id,type:event.params?.item?.type,status:event.params?.item?.status??event.params?.turn?.status,exitCode:event.params?.item?.exitCode});
    if(!requested&&event.method==='item/started'&&event.params?.item?.type==='commandExecution'){
      requested=true;interruptTimer=setTimeout(()=>{interrupt=controller.interrupt();void interrupt.catch(()=>{});},1000);
    }
  });
  await assert.rejects(controller.run('Run exactly one native shell command that sleeps for 30 seconds (PowerShell Start-Sleep -Seconds 30 on Windows). Do not write files, spawn workers, or use network. This is a cancellation test; do not retry an interrupted command.',undefined,true),{errorCode:'INTERRUPTED'});
  assert.equal(requested,true,'A real command must start before interruption');await interrupt;
  const thread=await controller.client.read(controller.metadata.codexThreadId);
  assert.equal(thread.turns.at(-1).status,'interrupted');assert.equal(controller.metadata.status,'interrupted');
  assert.equal(await controller.close(),true,'Interrupted native commands must be quiescent');
  console.log(JSON.stringify({platform:process.platform,model:config.main.model,commandStarted:true,turnInterrupted:true,quiescent:true}));
}catch(error){console.error(JSON.stringify(errorView(error)));console.error(JSON.stringify({events}));if(controller?.metadata){const history=await controller.client.read(controller.metadata.codexThreadId).catch(()=>null);console.error(JSON.stringify({commands:history?.turns?.at(-1)?.items.filter(i=>i.type==='commandExecution').map(i=>({id:i.id,status:i.status,exitCode:i.exitCode}))}));}process.exitCode=1;}
finally{clearTimeout(timer);clearTimeout(interruptTimer);if(controller&&!await controller.close())process.exitCode=5;}
