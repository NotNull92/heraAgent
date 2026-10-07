import {it,expect,vi} from 'vitest';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {CodexClient} from '../src/codex/client.js';
import {Controller} from '../src/session/controller.js';
import {defaults} from '../src/config.js';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {baseline} from '../src/session/phase-policy.js';
import {randomUUID} from 'node:crypto';
import {NativeWorkers} from '../src/session/workers.js';
it('drives bidirectional fake native lifecycle and retains pre-ack events',async()=>{const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));const events:string[]=[];client.on('event',e=>events.push(e.method));try{await client.initialize();expect(await client.account()).toEqual({ready:true,category:'chatgpt'});expect((await client.models())[0]?.model).toBe('fixture-gpt');const session=await client.start({model:'fixture-gpt',sandbox:'read-only',approvalPolicy:'never'});expect(session.modelProvider).toBe('openai');await client.turn({threadId:session.thread.id,input:[{type:'text',text:'fixture',text_elements:[]}]});expect(events).toContain('turn/completed');expect(events).toContain('item/agentMessage/delta');expect((await client.resume({threadId:session.thread.id,model:'fixture-gpt'})).thread.id).toBe(session.thread.id);await client.interrupt(session.thread.id,'fixture-turn');}finally{expect(await client.close()).toBe(true);}});
it('shared controller blocks unexpected workers and never turns repeated uncertain shutdown into success',async()=>{const home=await mkdtemp(join(tmpdir(),'hera-controller-'));const sentinel=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));try{await client.initialize();const controller=new Controller(client,home,home,structuredClone(defaults));client.emit('event',{method:'item/started',params:{item:{id:'unexpected',type:'collabAgentToolCall'}}});expect(await controller.close()).toBe(false);expect(await controller.close()).toBe(false);expect(sentinel.exitCode).toBeNull();expect(sentinel.killed).toBe(false);}finally{await client.close();sentinel.kill();}});
it('requires both setup acknowledgment and completion, handles early events and cleans listeners',async()=>{
  for(const [scenario,errorCode] of [['sandbox-ok',null],['sandbox-fail','SANDBOX_SETUP_FAILED'],['sandbox-not-started','SANDBOX_SETUP_NOT_STARTED'],['sandbox-silent','SANDBOX_SETUP_TIMEOUT'],['sandbox-abort','SANDBOX_SETUP_INTERRUPTED']] as const){
    const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs'),scenario],{stdio:['pipe','pipe','pipe'],windowsHide:true}));
    try{await client.initialize();const abort=new AbortController();if(scenario==='sandbox-abort')abort.abort();
      const setup=client.setupWindowsSandbox('unelevated',process.cwd(),abort.signal,100);
      if(errorCode)await expect(setup).rejects.toMatchObject({errorCode});else{await setup;expect(await client.windowsSandboxReadiness()).toEqual({status:'ready'});}
      expect(client.listenerCount('event')).toBe(0);expect(client.listenerCount('fault')).toBe(0);
    }finally{await client.close();}
  }
});
it('reconciles terminal native command evidence when its completion notification trails the turn',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-interrupt-order-'));
  const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs'),'interrupt-order'],{stdio:['pipe','pipe','pipe'],windowsHide:true}));
  try{await client.initialize();const controller=new Controller(client,home,home,structuredClone(defaults));
    controller.metadata={schemaVersion:1,heraSessionId:randomUUID(),codexThreadId:'fixture-thread',codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:home,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:'fixture',capabilityFingerprint:'fixture',updatedAt:new Date().toISOString()};
    // Keep reference metadata outside the fixture workspace, as in production.
    const cwd=await mkdtemp(join(tmpdir(),'hera-interrupt-work-'));
    Object.assign(controller,{cwd,baselineHash:await baseline(cwd)});
    await expect(controller.run('fixture interruption')).rejects.toMatchObject({errorCode:'INTERRUPTED'});
    expect(controller.metadata.status).toBe('interrupted');expect(await controller.close()).toBe(true);
  }finally{await client.close();}
});
it('does not treat a native cleanup acknowledgment as proof that commands stopped',async()=>{
  const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs'),'cleanup-pending'],{stdio:['pipe','pipe','pipe'],windowsHide:true}));
  try{await client.initialize();await expect(client.cleanBackgroundTerminals('fixture-thread',0)).rejects.toMatchObject({errorCode:'INTERRUPTED_UNCONFIRMED',outcomeKnown:false});}finally{await client.close();}
});
it('rejects repeated native inventory cursors instead of claiming a complete worker tree',async()=>{
  const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs'),'loaded-cycle'],{stdio:['pipe','pipe','pipe'],windowsHide:true}));try{await client.initialize();await expect(client.loadedThreads()).rejects.toMatchObject({errorCode:'THREAD_INVENTORY_LIMIT'});}finally{await client.close();}
});
it('allows the read-only root to finish while an owned worker runs, but still blocks apply and unresolved main commands',async()=>{
  for(const scenario of ['active-child-command','active-main-command','canceling-child-command']){
    const home=await mkdtemp(join(tmpdir(),'hera-command-owner-'));const cwd=await mkdtemp(join(tmpdir(),'hera-command-work-'));
    const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs'),scenario==='canceling-child-command'?'active-child-command':scenario],{stdio:['pipe','pipe','pipe'],windowsHide:true}));
    try{
      await client.initialize();const config=structuredClone(defaults);const controller=new Controller(client,home,cwd,config,true);controller.phase.analyze();Object.assign(controller,{baselineHash:await baseline(cwd)});
      controller.metadata={schemaVersion:1,heraSessionId:randomUUID(),codexThreadId:'fixture-thread',codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:cwd,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:'fixture',capabilityFingerprint:'fixture',updatedAt:new Date().toISOString()};
      const workers=new NativeWorkers('fixture-thread',cwd,config);controller.workers=workers;
      const child={id:'fixture-child',parentThreadId:'fixture-thread',cwd,modelProvider:'openai',model:null,reasoningEffort:null,status:{type:'active' as const},turns:[{id:'child-turn',status:'inProgress' as const,items:[]}]};
      workers.snapshot.set(child.id,child);vi.spyOn(workers,'refresh').mockImplementation(async()=>workers.snapshot);
      if(scenario==='canceling-child-command'){
        const canceled={...child,status:{type:'idle' as const},turns:[{id:'child-turn',status:'interrupted' as const,items:[{id:'pending-command',type:'commandExecution',status:'inProgress',exitCode:null as number|null}]}]};
        client.on('event',event=>{if(event.method==='item/started'){workers.snapshot.set(child.id,canceled);Object.assign(controller,{stopping:new Promise<void>(resolve=>setTimeout(()=>{Object.assign(canceled.turns[0]!.items[0]!,{status:'failed',exitCode:-1});resolve();},50))});}});
        await expect(controller.run('fixture')).resolves.toMatchObject({status:'completed'});expect(controller.metadata.status).toBe('complete');
      }
      else if(scenario==='active-child-command'){await expect(controller.run('fixture')).resolves.toMatchObject({status:'completed'});expect(controller.busy).toBe(true);await expect(controller.requestApply()).rejects.toMatchObject({errorCode:'NOT_QUIESCENT'});}
      else await expect(controller.run('fixture')).rejects.toMatchObject({errorCode:'INTERRUPTED_UNCONFIRMED',outcomeKnown:false});
    }finally{await client.close();}
  }
});
