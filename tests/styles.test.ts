import {it,expect,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,access,unlink,readdir,open,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {defaults} from '../src/config.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {listStyles,activeStyle,setStyle,SCOPE,LABELS} from '../src/session/styles.js';
vi.mock('node:fs/promises',async importOriginal=>{
  const fs=await importOriginal<typeof import('node:fs/promises')>();
  return {...fs,open:vi.fn(fs.open),rename:vi.fn(fs.rename)};
});
it('lists user voice files, applies one between markers and restores the own voice without touching other instructions',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-style-'));const agents=join(home,'codex','AGENTS.md');
  const session=new InteractiveSession(home,home,structuredClone(defaults),true);
  await session.submit('/style');expect(session.selection?.options.map(o=>o.value)).toEqual(['default']);expect(session.transcript).toContain('output-styles');await session.selectOption('default');
  await mkdir(join(home,'output-styles'));await mkdir(join(home,'codex'));await writeFile(agents,'Keep this user note.\n');
  await writeFile(join(home,'output-styles','spartan.md'),'---\nname: Spartan\n---\n\n<!-- body-start -->\nLine one is the answer.\n');
  await writeFile(join(home,'output-styles','attention-kind.md'),'---\nname: Attention-kind\n---\nAnswer first.\n');
  await writeFile(join(home,'output-styles','mine.md'),'Speak like me.\n');await writeFile(join(home,'output-styles','default.md'),'reserved');await writeFile(join(home,'output-styles','notes.txt'),'ignored');
  expect(await listStyles(home)).toEqual(['attention-kind','spartan','mine']);
  await session.submit('/style');expect(session.selection?.options.map(o=>o.value)).toEqual(['attention-kind','spartan','mine','default']);expect(session.selection?.current).toBe('default');
  expect(session.selection?.options.map(o=>o.label).slice(0,2)).toEqual(['[현자] 답 먼저 · 짧고 친절하게','[전사] 군말 없이 핵심만']);
  await session.selectOption('spartan');expect(await activeStyle(home)).toBe('spartan');
  expect(await readFile(agents,'utf8')).toBe('Keep this user note.\n\n<!-- hera-style:start spartan -->\n'+SCOPE+'\n\nLine one is the answer.\n\n'+LABELS+'\n<!-- hera-style:end -->\n');
  await session.submit('/style attention-kind');expect(await readFile(agents,'utf8')).toBe('Keep this user note.\n\n<!-- hera-style:start attention-kind -->\n'+SCOPE+'\n\nAnswer first.\n\n'+LABELS+'\n<!-- hera-style:end -->\n');
  const before=await readFile(agents,'utf8');await session.submit('/style missing');expect(session.status).toBe('INVALID_STYLE');await session.submit('/style ../config');expect(session.status).toBe('INVALID_STYLE');expect(await readFile(agents,'utf8')).toBe(before);
  await session.submit('/style default');expect(await readFile(agents,'utf8')).toBe('Keep this user note.\n');expect(await activeStyle(home)).toBeNull();
  // With nothing else in the file, clearing the voice removes the file instead of leaving it empty.
  await writeFile(agents,'');await setStyle(home,'mine');expect(await readFile(agents,'utf8')).toContain('Speak like me.');await setStyle(home,null);await expect(access(agents)).rejects.toMatchObject({code:'ENOENT'});
});
it('offers and clears the active voice after its source file is removed',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-style-reset-'));await mkdir(join(home,'output-styles'));await mkdir(join(home,'codex'));
  const agents=join(home,'codex','AGENTS.md');const voice=join(home,'output-styles','mine.md');
  await writeFile(agents,'Keep this note.\n');await writeFile(voice,'Answer briefly.');await setStyle(home,'mine');await unlink(voice);
  const session=new InteractiveSession(home,home,structuredClone(defaults),true);
  try{
    await session.submit('/style');expect(session.selection?.current).toBe('mine');expect(session.selection?.options.map(o=>o.value)).toEqual(['default']);
    await session.selectOption('default');expect(await activeStyle(home)).toBeNull();expect(await readFile(agents,'utf8')).toBe('Keep this note.\n');
  }finally{await session.close();}
});
it.each(['write','rename'])('preserves existing instructions and cleans temporary files when %s fails',async step=>{
  const fs=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  const home=await mkdtemp(join(tmpdir(),'hera-style-failure-'));await mkdir(join(home,'output-styles'));await mkdir(join(home,'codex'));
  const agents=join(home,'codex','AGENTS.md');await writeFile(agents,'Keep this note.\n');await writeFile(join(home,'output-styles','mine.md'),'Answer briefly.');await setStyle(home,'mine');
  const before=await readFile(agents,'utf8');const failure=Object.assign(new Error('Injected storage failure'),{code:step==='write'?'ENOSPC':'EPERM'});
  try{
    if(step==='write')vi.mocked(open).mockImplementationOnce(async(...args)=>{
      const handle=await fs.open(...args);const write=handle.writeFile.bind(handle);
      vi.spyOn(handle,'writeFile').mockImplementationOnce(async()=>{await write('partial');throw failure;});return handle;
    });
    else vi.mocked(rename).mockRejectedValueOnce(failure);
    await expect(setStyle(home,null)).rejects.toBe(failure);
    expect(await readFile(agents,'utf8')).toBe(before);expect(await readdir(join(home,'codex'))).toEqual(['AGENTS.md']);
    await setStyle(home,null);expect(await readFile(agents,'utf8')).toBe('Keep this note.\n');
  }finally{vi.restoreAllMocks();vi.mocked(open).mockImplementation(fs.open);vi.mocked(rename).mockImplementation(fs.rename);}
});
