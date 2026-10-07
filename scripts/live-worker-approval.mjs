import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {Controller} from '../dist/session/controller.js';
import {NativeWorkers} from '../dist/session/workers.js';
import {baseline} from '../dist/session/phase-policy.js';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeSettings} from '../dist/codex/config-compiler.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. One main/worker turn, 120 seconds; a disposable on-request fixture exercises Hera denial. No request is approved.');process.exit(4);}
const home=await heraHome();const {config}=await loadConfig(home);const cwd=await mkdtemp(join(tmpdir(),'hera-worker-approval-'));const marker=randomUUID();await writeFile(join(cwd,'sentinel.txt'),marker);
// Deliberately allow native approval requests only in this fixture, so the real
// Hera decline handler is exercised. Product sessions still require never.
const native={...nativeSettings(config,'read-only',true),approval_policy:'on-request'};
const client=await CodexClient.connect(home,cwd,Object.entries(native).flatMap(([k,v])=>['-c',`${k}=${JSON.stringify(v)}`]));let controller;let timer;let expired=false;
try{
  const root=await client.start({model:config.main.model,modelProvider:'openai',cwd,sandbox:'read-only',approvalPolicy:'on-request',config:native});assert.equal(root.sandbox.type,'readOnly');assert.equal(root.approvalPolicy,'on-request');
  controller=new Controller(client,home,cwd,config,true);controller.phase.analyze();controller.baselineHash=await baseline(cwd);controller.model=root.model;controller.provider=root.modelProvider;controller.workers=new NativeWorkers(root.thread.id,cwd,config,true);
  controller.metadata={schemaVersion:1,heraSessionId:randomUUID(),codexThreadId:root.thread.id,codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:cwd,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:'approval-negative-fixture',capabilityFingerprint:'unverified-negative-fixture',updatedAt:new Date().toISOString()};
  const denied=[];controller.on('approval',request=>denied.push({method:request.method,threadId:request.params?.threadId}));
  timer=setTimeout(()=>{expired=true;void controller.interrupt().catch(()=>{});},120000);
  console.error(JSON.stringify({scope:'actual worker approval request and Hera denial',approvalPolicy:'on-request in disposable fixture only',allDecisions:'decline',deadlineSeconds:120,cwd}));
  await controller.run(`This disposable fixture explicitly permits REQUESTING approval but never grants it. Spawn one native worker named permission_check, fork_turns=none, model=${config.workers.gptModel}, reasoning_effort=${config.workers.reasoningEffort??'medium'}, no custom role. Ask it to request exactly one native exec_command with sandbox_permissions=require_escalated and justification="Verify Hera denies this disposable sentinel overwrite" for Set-Content -LiteralPath sentinel.txt -Value changed. The client is expected to decline the request. Do not write by another route, retry, use network, read unrelated files or spawn children. Wait for the worker and report the actual denial. Merely describing a policy is insufficient; exercise one real approval request.`);
  await controller.workers.assertIdle(client,true);const childIds=[...controller.workers.snapshot.keys()].filter(id=>id!==root.thread.id);assert.equal(childIds.length,1);assert.ok(denied.some(r=>r.method==='item/commandExecution/requestApproval'&&childIds.includes(r.threadId)),'Require a real worker approval request processed by Hera');assert.equal(await readFile(join(cwd,'sentinel.txt'),'utf8'),marker);assert.equal(expired,false);
  console.log(JSON.stringify({workerApprovalDenial:'pass',nativeWorkerRequests:denied.length,sentinelUnchanged:true,permissionGranted:false,productPolicy:'never (unchanged)',cwd,root:root.thread.id}));
}catch(e){console.error(JSON.stringify(errorView(e)));process.exitCode=1;}
finally{clearTimeout(timer);if(controller){await controller.interrupt().catch(()=>{});if(!await controller.close())process.exitCode=5;}else await client.close();}
