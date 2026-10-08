import React from 'react';
import {it,expect,vi} from 'vitest';
import {render} from 'ink-testing-library';
import {InteractiveSession} from '../src/session/interactive.js';
import {ProviderKeyInput} from '../src/tui/ProviderInput.js';
import {Composer} from '../src/tui/Composer.js';
import {defaults} from '../src/config.js';
import * as accounts from '../src/providers/accounts.js';
import * as credentials from '../src/providers/go-credentials.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,80));
it('requires both configured providers at startup and supports manual slash setup without logging keys',async()=>{
  const status={openai:{ready:false,category:'none'},go:{credentialReady:false,credentialStored:false,credentialSource:'none'}};
  vi.spyOn(accounts,'providerStatus').mockImplementation(async()=>structuredClone(status));
  const save=vi.spyOn(credentials,'saveGoCredential').mockImplementation(async()=>{status.go={credentialReady:true,credentialStored:true,credentialSource:'keyring'};});
  vi.spyOn(accounts,'loginOpenAI').mockImplementation(async(_h,_c,_cfg,show)=>{show('https://example.invalid/oauth');status.openai={ready:true,category:'chatgpt'};});
  const session=new InteractiveSession('fixture','fixture',structuredClone(defaults),true);
  try{
    await session.initializeProviders();expect(session.providerSetupRequired).toBe(true);expect(session.selection?.options.map(o=>o.value)).toEqual(['openai','go','refresh','quit']);
    session.cancelSelection();expect(session.selection).not.toBeNull();await expect(session.connect()).rejects.toMatchObject({errorCode:'PROVIDER_SETUP_REQUIRED'});expect(session.controller).toBeNull();
    await session.selectOption('go');expect(session.providerKeyInput).toBe(true);await session.saveProviderKey('fixture-private-value');expect(save).toHaveBeenCalledWith('fixture','fixture-private-value');expect(session.transcript).not.toContain('fixture-private-value');expect(session.providerSetupRequired).toBe(true);
    await session.selectOption('openai');expect(session.providerSetupRequired).toBe(false);expect(session.providerLoginText).toBe('');await session.selectOption('done');expect(session.selection).toBeNull();
    await session.submit('/providers');expect(session.selection?.options.slice(0,2).map(o=>o.value)).toEqual(['openai','go']);session.cancelSelection();
    const fresh=new InteractiveSession('fixture','fixture',structuredClone(defaults),true);await fresh.initializeProviders();expect(fresh.selection).toBeNull();expect(fresh.providerSetupRequired).toBe(false);
  }finally{vi.restoreAllMocks();await session.close();}
});
it('masks secret typing/paste, never submits pasted Enter, and clears on cancel',async()=>{
  const saved:string[]=[];let canceled=0;const ui=render(<ProviderKeyInput language="ko" save={key=>saved.push(key)} cancel={()=>canceled++}/>);await tick();
  ui.stdin.write('\x1b[200~fixture-hidden-key\r\n\x1b[201~');await tick();expect(saved).toEqual([]);expect(ui.lastFrame()).toContain('***');expect(ui.frames.join('')).not.toContain('fixture-hidden-key');ui.stdin.write('\r');await tick();expect(saved).toEqual(['fixture-hidden-key']);ui.stdin.write('\x1b');await tick();expect(canceled).toBe(1);ui.unmount();
});
it('opens providers with Enter and rejects invalid keys without revealing them',async()=>{
  const sent:string[]=[];const ui=render(<Composer language="ko" busy={false} send={s=>sent.push(s)} cancel={()=>{}}/>);await tick();ui.stdin.write('/providers');await tick();ui.stdin.write('\r');await tick();expect(sent).toEqual(['/providers']);ui.unmount();
  for(const key of ['', 'fixture bad', 'fixture\nsecret','x'.repeat(2049)])expect(()=>credentials.validateGoKey(key)).toThrow('Go key must');
});
