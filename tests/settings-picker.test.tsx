import React from 'react';
import {it,expect,vi} from 'vitest';
import {render} from 'ink-testing-library';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {CodexClient,type ModelView} from '../src/codex/client.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {defaults,saveConfig,loadConfig} from '../src/config.js';
import {App} from '../src/tui/App.js';

it('opens keyboard menus, shows model-specific efforts, cancels atomically and revalidates the catalog',async()=>{
  const catalog:ModelView[]=[
    {id:'a',model:'fixture-a',displayName:'A',supportedReasoningEfforts:[{reasoningEffort:'high'},{reasoningEffort:'ultra'}]},
    {id:'b',model:'fixture-b',displayName:'B',supportedReasoningEfforts:[{reasoningEffort:'high'},{reasoningEffort:'max'}]}
  ];
  const connect=vi.spyOn(CodexClient,'connect').mockImplementation(async()=>{const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));await client.initialize();vi.spyOn(client,'models').mockImplementation(async()=>structuredClone(catalog));return client;});
  const home=await mkdtemp(join(tmpdir(),'hera-picker-'));const config=structuredClone(defaults);config.main={model:'fixture-a',reasoningEffort:'ultra'};config.workers.gptModel='fixture-b';config.workers.reasoningEffort='max';await saveConfig(home,config);
  const original=await readFile(join(home,'config.json'),'utf8');const session=new InteractiveSession(home,home,config,true);const ui=render(<App session={session}/>);
  const tick=()=>new Promise(resolve=>setTimeout(resolve,80));
  const wait=async(check:()=>boolean)=>{for(let i=0;i<60;i++){await tick();if(check())return;}throw new Error('Picker did not reach expected state');};
  const key=async(value:string)=>{ui.stdin.write(value);await tick();};
  try{
    await tick();await key('/model');await key('\r');await wait(()=>session.selection?.options[0]?.value==='main');expect(ui.lastFrame()).toContain('설정할 역할 선택');
    await key('\x1b[B');await key('\r');await wait(()=>session.selection?.options[0]?.value==='fixture-a');
    await key('\x1b[A');await key('\r');await wait(()=>session.selection?.options[0]?.value==='default');expect(ui.lastFrame()).toContain('ultra');
    expect(await readFile(join(home,'config.json'),'utf8')).toBe(original);await key('\x1b');expect(session.selection).toBeNull();expect(await readFile(join(home,'config.json'),'utf8')).toBe(original);
    await key('/effort');await key('\r');await wait(()=>session.selection?.options[0]?.value==='main');await key('\x1b[B');await key('\r');await wait(()=>session.selection?.options[0]?.value==='default');
    expect(session.selection?.options.map(o=>o.value)).toEqual(['default','high','max']);
    await key('\x1b[200~\r\x1b[201~');expect(session.selection).not.toBeNull();expect(await readFile(join(home,'config.json'),'utf8')).toBe(original);
    await key('\x1b[A');await key('\r');await wait(()=>!session.busy&&!session.selection);expect((await loadConfig(home)).config.workers.reasoningEffort).toBe('high');
    await key('/workers');await key('\r');await wait(()=>session.selection?.options[0]?.value==='1');await key('\x1b[B');await key('\r');await wait(()=>!session.busy&&!session.selection);expect((await loadConfig(home)).config.workers.maxConcurrent).toBe(4);
    // A model switch with an incompatible old effort must wait for an explicit new choice.
    await session.submit('/model main');await session.selectOption('fixture-b');expect(session.selection?.options.map(o=>o.value)).not.toContain('ultra');expect(config.main.model).toBe('fixture-a');await session.selectOption('max');expect(config.main).toEqual({model:'fixture-b',reasoningEffort:'max'});
    await session.submit('/effort main');catalog[1]!.supportedReasoningEfforts=[{reasoningEffort:'high'}];await session.selectOption('max');expect(session.status).toBe('UNSUPPORTED_EFFORT');expect((await loadConfig(home)).config.main.reasoningEffort).toBe('max');
  }finally{ui.unmount();connect.mockRestore();await session.close();}
},15000);
