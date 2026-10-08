import {it,expect,vi} from 'vitest';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {CodexClient} from '../src/codex/client.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {defaults,loadConfig} from '../src/config.js';
import {requireMode} from '../src/codex/config-compiler.js';
import {atomicJson} from '../src/paths.js';
it('offers only Design and Development, preserving retired settings without executing them',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-retired-mode-'));
  const legacy={...structuredClone(defaults),mode:'gpt_only' as const};
  await atomicJson(join(home,'config.json'),legacy);const before=await readFile(join(home,'config.json'),'utf8');
  expect((await loadConfig(home)).config.mode).toBe('gpt_only');
  expect(()=>requireMode(legacy,true)).toThrow('GPT 밸런스는 제거');
  await expect(CodexClient.session(home,home,legacy,'workspace-write',false,true)).rejects.toMatchObject({errorCode:'MODE_REMOVED'});
  const session=new InteractiveSession(home,home,legacy,true);
  await session.submit('/mode');
  expect(session.selection?.options.map(o=>o.value)).toEqual(['adaptive','external_workers']);
  expect(session.selection?.options[0]?.label).toContain('HERA 설계');
  session.cancelSelection();await session.submit('/mode gpt_only');expect(session.status).toBe('INVALID_MODE');
  expect(await readFile(join(home,'config.json'),'utf8')).toBe(before);await session.close();
});
it('opens the research menu without a model connection and keeps CAPTCHA actions analysis-only',async()=>{
  const session=new InteractiveSession('unused','unused',structuredClone(defaults),true);
  await session.submit('/research');expect(session.selection?.options.map(o=>o.value)).toEqual(['status','setup','open','resume']);
  await session.submit('/research status');expect(session.transcript).toContain('"connected": false');
  for(const action of ['open','resume']){await session.submit('/research '+action);expect(session.status).toBe('RESEARCH_UNAVAILABLE');}
  expect(session.controller).toBeNull();await session.close();
});
it('persists both command prefixes, validates before saving, and rejects active-turn changes',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-settings-'));
  const connect=vi.spyOn(CodexClient,'connect').mockImplementation(async()=>{const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));await client.initialize();return client;});
  const session=new InteractiveSession(home,home,structuredClone(defaults),true);
  try{
    await session.submit('/model main fixture-gpt low');await session.submit('/model worker deepseek-v4.1-flash high');await session.submit('/workers 5');
    const saved=(await loadConfig(home)).config;expect(saved.main).toEqual({model:'fixture-gpt',reasoningEffort:'low'});expect(saved.workers.goReasoningEffort).toBe('high');expect(saved.workers.maxConcurrent).toBe(5);
    await session.submit('/effort main default');expect((await loadConfig(home)).config.main.reasoningEffort).toBeNull();
    const before=await readFile(join(home,'config.json'),'utf8');
    for(const command of ['/effort worker ultra','/model main missing low','/workers 0','/workers 9','/workers 2 extra']){await session.submit(command);expect(await readFile(join(home,'config.json'),'utf8')).toBe(before);}
    await writeFile(join(home,'.hera.json'),JSON.stringify({maxConcurrent:5}));await session.submit('/workers 6');expect(session.status).toBe('PROJECT_WORKER_LIMIT');expect(await readFile(join(home,'config.json'),'utf8')).toBe(before);
    session.busy=true;await expect(session.submit('/workers 2')).rejects.toMatchObject({errorCode:'TURN_ACTIVE'});expect(session.config.workers.maxConcurrent).toBe(5);
  }finally{connect.mockRestore();await session.close();}
});
