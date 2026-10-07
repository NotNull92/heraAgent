import {it,expect} from 'vitest';
import {mkdtemp,writeFile,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {externalRuntime,installExternalRuntime} from '../src/codex/external-runtime.js';
import {atomicJson} from '../src/paths.js';
import {workerCapability} from '../src/codex/capabilities.js';
import {defaults} from '../src/config.js';
import {InteractiveSession} from '../src/session/interactive.js';

it('rejects runtime tampering and never treats installed binaries as live acceptance',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-runtime-check-'));expect(await externalRuntime(home)).toBeNull();
  const contents='fixture, never executable';const binarySha256=createHash('sha256').update(contents).digest('hex');
  const executable=process.platform==='win32'?'codex.exe':'codex';const path='bin/'+executable;
  const directory=join(home,'runtimes','provider-v1',binarySha256);await mkdir(join(directory,'bin'),{recursive:true});await writeFile(join(directory,path),contents);
  const bundleSha256=createHash('sha256').update(path).update('\0').update(binarySha256).digest('hex');
  const pin=JSON.parse(await readFile('assets/codex-provider/manifest.json','utf8'));
  await atomicJson(join(home,'runtimes','external-runtime.json'),{schemaVersion:1,platform:process.platform+'-'+process.arch,patchSha256:pin.patchSha256,binarySha256,bundleSha256});
  expect((await externalRuntime(home))?.receipt.binarySha256).toBe(binarySha256);
  expect((await workerCapability(home,{...defaults,mode:'external_workers'})).ready).toBe(false);
  await writeFile(join(directory,'helper.txt'),'unexpected executable helper');await expect(externalRuntime(home)).rejects.toMatchObject({errorCode:'EXTERNAL_RUNTIME_MISMATCH'});
  await expect(installExternalRuntime(home,join(directory,path),'0'.repeat(64))).rejects.toMatchObject({errorCode:'EXTERNAL_RUNTIME_MISMATCH'});
});
it('shows only qualified Go choices without replacing the saved GPT worker configuration',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-go-menu-'));const config=structuredClone(defaults);config.mode='external_workers';config.workers.gptModel='saved-gpt';config.workers.reasoningEffort='max';
  const session=new InteractiveSession(home,home,config,false);await session.submit('/model worker');
  expect(session.selection?.options.map(o=>o.value)).toEqual(['deepseek-v4.1-flash']);await session.selectOption('deepseek-v4.1-flash');expect(session.selection?.options.map(o=>o.value)).toEqual(['low']);await session.selectOption('low');
  expect(config.workers.gptModel).toBe('saved-gpt');expect(config.workers.reasoningEffort).toBe('max');expect(session.transcript).toContain('deepseek-v4.1-flash / low');
});
