import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Controller} from '../dist/session/controller.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {errorView} from '../dist/errors.js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
if(!process.argv.includes('--live')){console.error('Opt-in required: npm run test:live -- --live. Two read-only GPT turns at most; native internal retries are not a guaranteed billable-call limit.');process.exit(4);}
const home=await heraHome();const {config}=await loadConfig(home);
console.error(JSON.stringify({provider:'openai',requestedModel:config.main.model,scope:'temporary read-only fixture; initial turn and resume follow-up',deadlineSeconds:90,workerTests:'blocked pending native safety gates'}));
const marker=randomUUID();
const cwd=await mkdtemp(join(tmpdir(),'hera-live-fixture-'));await writeFile(join(cwd,'sum.ts'),`// fixture marker: ${marker}\nexport const sum = (a: number, b: number) => a - b;\n`);
async function verifyReply(controller,requireRead){
  const thread=await controller.client.read(controller.metadata.codexThreadId);
  const turn=thread.turns?.find(t=>t.id===controller.metadata.lastKnownTurnId);
  assert.equal(turn?.status,'completed');
  const text=turn.items.filter(i=>i.type==='agentMessage').map(i=>i.text).join('\n');
  assert.ok(text.includes(marker),'Reply must contain the unpredictable file marker');
  assert.match(text,/a\s*\+\s*b/,'Reply must propose the correct expression');
  if(requireRead)assert.ok(turn.items.some(i=>i.type==='commandExecution'&&i.exitCode===0&&i.aggregatedOutput?.includes(marker)),'Require an observed successful native file read');
}
let controller;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;void controller?.close();},90000);
try{
  controller=await Controller.open(home,cwd,config,true);
  await controller.run('Use the native command tool to read sum.ts. Quote its fixture marker and propose the smallest corrected TypeScript expression. Do not edit files, spawn agents, access the network or run commands with side effects. If tools are unavailable report failure.');
  await verifyReply(controller,true);
  const metadata=controller.metadata;if(!await controller.close())throw new Error('Initial turn quiescence unconfirmed');
  controller=await Controller.open(home,cwd,config,true,metadata);
  await controller.run('Without using tools or changing files, recall the exact fixture marker and corrected expression from our earlier exchange.');
  await verifyReply(controller,false);
  if(timedOut)throw new Error('Live fixture deadline reached');
  console.log(JSON.stringify({platform:process.platform,arch:process.arch,requestedModel:config.main.model,readOnlyTurn:'pass',nativeResumeFollowup:'pass',workerSafety:'not_run',external:'not_run'}));
}catch(e){console.error(JSON.stringify(errorView(e)));process.exitCode=errorView(e).exitCode;}finally{clearTimeout(timer);if(controller&&!await controller.close())process.exitCode=5;}
