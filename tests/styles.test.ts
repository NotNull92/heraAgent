import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {defaults} from '../src/config.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {listStyles,activeStyle,setStyle,SCOPE,LABELS} from '../src/session/styles.js';
it('lists user voice files, applies one between markers and restores the own voice without touching other instructions',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-style-'));const agents=join(home,'codex','AGENTS.md');
  const session=new InteractiveSession(home,home,structuredClone(defaults),true);
  await session.submit('/style');expect(session.selection).toBeNull();expect(session.transcript).toContain('output-styles');
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
