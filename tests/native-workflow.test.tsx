import React from 'react';
import {it,expect,vi} from 'vitest';
import {spawn} from 'node:child_process';
import {mkdtemp,open,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {render} from 'ink-testing-library';
import {CodexClient} from '../src/codex/client.js';
import {Controller,NATIVE_BASE_INSTRUCTIONS} from '../src/session/controller.js';
import {defaults} from '../src/config.js';
import {nativeSettings} from '../src/codex/config-compiler.js';
import {NativePrompt} from '../src/tui/NativePrompt.js';
import {InteractiveSession} from '../src/session/interactive.js';
it('executes native turns without a workspace baseline, and answers approvals while streaming',async()=>{
  for(const decision of ['accept','decline','headless'] as const){
    const home=await mkdtemp(join(tmpdir(),'hera-native-home-'));const cwd=await mkdtemp(join(tmpdir(),'hera-native-work-'));
    const file=await open(join(cwd,'large.bin'),'wx');await file.truncate(129*1024*1024);await file.close();
    const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs'),'native-approval'],{windowsHide:true,stdio:['pipe','pipe','pipe']}));
    const controller=new Controller(client,home,cwd,structuredClone(defaults),false,true);controller.phase.phase='NATIVE';controller.metadata={schemaVersion:1,heraSessionId:randomUUID(),codexThreadId:'fixture-thread',codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:cwd,phase:'NATIVE',lastKnownTurnId:null,status:'idle',configFingerprint:'fixture',capabilityFingerprint:'fixture',updatedAt:new Date().toISOString()};
    let observed:unknown;controller.on('event',e=>{if(e.method==='fixture/decision')observed=e.params;});
    if(decision!=='headless')controller.on('requests',()=>{for(const request of controller.requests.values())controller.answerRequest(request.id,decision);});
    const turn=vi.spyOn(client,'turn');
    try{
    const start=vi.spyOn(client,'start').mockRejectedValueOnce(new Error('capture native params'));
    await expect(Reflect.apply(Reflect.get(controller,'startNative'),controller,[])).rejects.toThrow('capture native params');
    expect(start.mock.calls[0]?.[0]).toMatchObject({baseInstructions:NATIVE_BASE_INSTRUCTIONS,approvalPolicy:'on-request',sandbox:'workspace-write'});
    const handbook=await readFile(new URL('../assets/codex/coding-instructions.md',import.meta.url),'utf8');
    expect(createHash('sha256').update(handbook).digest('hex')).toBe('ac8ae107a0d72fe3476b430afb161ea4e67da2e446d778aefc44828160559807');
    expect(handbook.length).toBe(20751);
    const initial=JSON.stringify(start.mock.calls[0]?.[0]);
    expect(initial).not.toContain('## Task execution');expect(initial).not.toContain('DRD-1');
    expect(NATIVE_BASE_INSTRUCTIONS).toContain('load_instructions');
    expect((start.mock.calls[0]?.[0].developerInstructions??'').length).toBeLessThan(1500);
    expect(NATIVE_BASE_INSTRUCTIONS.length).toBeLessThan(1500);start.mockRestore();
      await client.initialize();await expect(controller.run('fixture')).resolves.toMatchObject({status:'completed'});expect(observed).toEqual({decision:decision==='headless'?'decline':decision});expect(turn.mock.calls[0]?.[0]).toMatchObject({approvalPolicy:'on-request',sandboxPolicy:{type:'workspaceWrite',networkAccess:false}});expect(()=>controller.answerRequest('native-approval','accept')).toThrow('no longer pending');
      await controller.run('plan',undefined,true);expect(turn.mock.calls[1]?.[0]).toMatchObject({approvalPolicy:'never',sandboxPolicy:{type:'readOnly',networkAccess:false}});
      await controller.run('ordinary edit');expect(turn.mock.calls[2]?.[0]).toMatchObject({approvalPolicy:'on-request',sandboxPolicy:{type:'workspaceWrite'},input:[expect.objectContaining({text:'ordinary edit'})]});
    }finally{await controller.close();}
  }
});
it('compiles explicit native sandbox settings and leaves legacy qualification unchanged',()=>{const settings=nativeSettings(defaults,'workspace-write',true,'http://127.0.0.1:1234/mcp',true);expect(settings.approval_policy).toBe('on-request');expect(settings['agents.enabled']).toBe(true);expect(settings['mcp_servers.hera_web.enabled']).toBe(true);expect(settings['sandbox_workspace_write.network_access']).toBe(false);expect(()=>nativeSettings(defaults,'workspace-write',true)).toThrow();});
it('defaults native approval to decline and treats apply as a compatibility notice',async()=>{const answer=vi.fn();const ui=render(<NativePrompt request={{id:'a',threadId:'root',turnId:'turn',itemId:'item',summary:'fixture'}} language="ko" rows={12} answer={answer} quit={()=>{}}/>);await new Promise(r=>setTimeout(r,70));ui.stdin.write('\r');await new Promise(r=>setTimeout(r,70));expect(answer).toHaveBeenCalledWith('decline');ui.unmount();const session=new InteractiveSession('unused','unused',structuredClone(defaults),true);await session.submit('/apply');expect(session.transcript).toContain('별도 /apply는 필요하지 않습니다');expect(session.controller).toBeNull();});
