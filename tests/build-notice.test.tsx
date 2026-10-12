import React from 'react';
import {it,expect,vi} from 'vitest';
import {statSync} from 'node:fs';
import {render} from 'ink-testing-library';
import {App} from '../src/tui/App.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {defaults} from '../src/config.js';
vi.mock('node:fs',async importOriginal=>{
  const fs=await importOriginal<typeof import('node:fs')>();
  return {...fs,statSync:vi.fn(fs.statSync)};
});
it('prints a localized transcript notice once per changed build and keeps accepting input when stat fails',async()=>{
  const stat=vi.mocked(statSync);
  for(const language of ['ko','en'] as const){
    let mtimeMs:number|undefined=100;
    stat.mockImplementation(()=>{if(mtimeMs===undefined)throw new Error('missing');return {mtimeMs} as ReturnType<typeof statSync>;});
    const session=new InteractiveSession('unused','unrelated-workspace',{...structuredClone(defaults),language},true);
    expect(stat).toHaveBeenLastCalledWith(new URL('../src/cli.js',import.meta.url));
    const notice=language==='ko'?'새 빌드가 감지되었습니다. 종료 후 다시 시작하면 반영됩니다.':'A newer build was detected. Quit and start Hera again to use it.';
    const ui=render(<App session={session}/>);
    try{
      await new Promise(resolve=>setTimeout(resolve,70));
      await session.submit('/apply');expect(session.transcript).not.toContain(notice);
      mtimeMs=200;await session.submit('/apply');await session.submit('/apply');
      expect(session.transcript.split(notice)).toHaveLength(2);
      for(let i=0;i<40&&!ui.frames.some(frame=>frame.includes(notice));i++)await new Promise(resolve=>setTimeout(resolve,70));
      expect(ui.frames.some(frame=>frame.includes(notice))).toBe(true);
      mtimeMs=undefined;await session.submit('/apply');expect(session.status).toBe('Ready');
      mtimeMs=200;await session.submit('/apply');expect(session.transcript.split(notice)).toHaveLength(2);
      mtimeMs=300;await session.submit('/apply');expect(session.transcript.split(notice)).toHaveLength(3);
      expect(session.transcript.match(/You: \/apply/g)).toHaveLength(6);
    }finally{ui.unmount();stat.mockRestore();}
  }
});
