import {it,expect,vi} from 'vitest';
import {withStartupChecks,startupCheck} from '../src/codex/startup.js';
import {discoverOpenAI,providerStatus} from '../src/providers/accounts.js';
import {CodexClient} from '../src/codex/client.js';
import * as credentials from '../src/providers/go-credentials.js';
import {defaults} from '../src/config.js';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

it('shares in-flight checks only within one attempt, including nesting, and drops success and failure afterward',async()=>{
  const read=vi.fn(async()=>({value:1}));let later!:()=>Promise<unknown>;
  await withStartupChecks(async()=>{
    const [a,b]=await Promise.all([startupCheck('fixture',read),withStartupChecks(()=>startupCheck('fixture',read))]);
    expect(a).toBe(b);expect(read).toHaveBeenCalledTimes(1);
    // A runtime may keep async callbacks created during startup alive after Ready.
    const {AsyncResource}=await import('node:async_hooks');const resource=new AsyncResource('fixture');
    later=()=>resource.runInAsyncScope(()=>startupCheck('fixture',read));
  });
  await later();await withStartupChecks(()=>startupCheck('fixture',read));expect(read).toHaveBeenCalledTimes(3);
  const failure=vi.fn(async()=>{throw new Error('fixture failure');});
  for(let i=0;i<2;i++)await expect(withStartupChecks(()=>startupCheck('failure',failure))).rejects.toThrow('fixture failure');
  expect(failure).toHaveBeenCalledTimes(2);
  await Promise.all([withStartupChecks(()=>startupCheck('fixture',read)),withStartupChecks(()=>startupCheck('fixture',read))]);expect(read).toHaveBeenCalledTimes(5);
});

it('reuses account/model discovery through provider setup and native startup, then starts fresh for another attempt',async()=>{
  const connect=vi.spyOn(CodexClient,'connect').mockImplementation(async()=>{
    const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));await client.initialize();return client;
  });
  vi.spyOn(credentials,'goCredentialStatus').mockResolvedValue({credentialReady:true,credentialStored:true,credentialSource:'keyring'});
  try{
    await withStartupChecks(async()=>{
      expect((await providerStatus('fixture','fixture',defaults)).openai.ready).toBe(true);
      const [a,b]=await Promise.all([discoverOpenAI('fixture','fixture',defaults),discoverOpenAI('fixture','fixture',defaults)]);
      expect(a).toBe(b);expect(a.models[0]?.model).toBe('fixture-gpt');expect(connect).toHaveBeenCalledTimes(1);
    });
    await withStartupChecks(()=>providerStatus('fixture','fixture',defaults));expect(connect).toHaveBeenCalledTimes(2);
  }finally{vi.restoreAllMocks();}
});
