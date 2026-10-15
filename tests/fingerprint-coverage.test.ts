import {it,expect} from 'vitest';
import {readdir,readFile} from 'node:fs/promises';
import {posix} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {FINGERPRINT_SOURCES} from '../src/codex/capabilities.js';

const EXCLUDED:Record<string,string>={
  'codex/generated/':'Pinned protocol types and their namespace barrel; output is checked here and packaged JSON schemas are verified separately.',
  'cli.ts':'CLI argument dispatch and setup presentation; native policy and model instructions live in hashed modules.',
  'metadata.ts':'Serializes session references; Controller independently reconciles native ownership, routing and permissions.',
  'paths.ts':'Home selection and atomic storage utilities; filesystem and auth-home behavior have separate offline safety tests.',
  'errors.ts':'Error envelopes and terminal sanitization; does not choose runtime policy, routing or model instructions.',
  'secret-input.ts':'Masked terminal credential entry only; credential resolution and provider use are hashed separately.',
  'session/limits.ts':'Parses usage figures for display without changing model requests or capability gates.',
  'session/interactive.ts':'TUI command orchestration and presentation; the plan instruction is imported from hashed prompts.ts.',
  'tui/App.tsx':'Transcript, status and UI composition; native execution policy belongs to Controller.',
  'tui/transcript.tsx':'Transcript formatting and wrapped presentation rows, without model instructions or runtime policy.',
  'tui/transcript-input.ts':'Consumes terminal mouse/page reports for local viewport navigation only; no native tool or permission changes.',
  'tui/ApplyReview.tsx':'Legacy approval presentation, unreachable from Controller.open; phased checks remain hashed.',
  'tui/Composer.tsx':'Keyboard editing and completion; submitted requests pass through the hashed Controller.',
  'tui/NativePrompt.tsx':'Presents native approval/input choices; ownership, stale requests and grants are validated by Controller.',
  'tui/ProviderInput.tsx':'Masked credential/login presentation; provider authentication logic remains hashed.',
  'tui/SettingsPicker.tsx':'Selection-menu presentation; settings validation and native compilation remain hashed.',
  'tui/theme.tsx':'Colors and layout primitives, without model text or execution policy.'
};
async function sources(directory=''):Promise<string[]>{
  const entries=await readdir(new URL('../src/'+directory,import.meta.url),{withFileTypes:true});
  return (await Promise.all(entries.map(e=>e.isDirectory()?sources(directory+e.name+'/'):Promise.resolve(/\.tsx?$/.test(e.name)?[directory+e.name]:[])))).flat();
}
it('requires every source to be hashed or individually justified, without stale or overlapping entries',async()=>{
  const files=await sources();const hashed=FINGERPRINT_SOURCES.map(path=>posix.normalize('codex/'+path+'.ts'));
  expect(new Set(hashed).size).toBe(hashed.length);
  expect(hashed.filter(path=>!files.includes(path))).toEqual([]);
  for(const [path,reason] of Object.entries(EXCLUDED)){
    expect(reason.trim().length).toBeGreaterThan(20);expect(reason).not.toMatch(/[\r\n]/);
    expect(files.some(file=>path.endsWith('/')?file.startsWith(path):file===path)).toBe(true);
  }
  for(const file of files){
    const excluded=Object.keys(EXCLUDED).filter(path=>path.endsWith('/')?file.startsWith(path):file===path);
    expect(Number(hashed.includes(file))+excluded.length,`${file}: add to FINGERPRINT_SOURCES or justify exclusion`).toBe(1);
    if(file.startsWith('codex/generated/')){
      const source=await readFile(new URL('../src/'+file,import.meta.url),'utf8');
      let executable=stripTypeScriptTypes(source).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|export\s*\{\s*\};?/g,'').trim();
      if(file==='codex/generated/index.ts')executable=executable.replace('export * as v2 from "./v2/index.js";','').trim();
      expect(executable,`${file}: generated exclusion permits only types and the fixed v2 barrel`).toBe('');
    }
  }
});
