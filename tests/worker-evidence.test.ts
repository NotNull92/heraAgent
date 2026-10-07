import {it,expect} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {workerCapability,capabilityReport} from '../src/codex/capabilities.js';
import {atomicJson} from '../src/paths.js';
import {defaults} from '../src/config.js';
it('invalidates native evidence on relevant configuration drift and never promotes missing or incomplete records',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-evidence-test-'));const config=structuredClone(defaults);const initial=await workerCapability(home,config);expect(initial.ready).toBe(false);
  const record={schemaVersion:1,fingerprint:initial.fingerprint,checkedAt:new Date().toISOString(),checks:{readOnly:'pass',concurrency:'pass',communication:'pass',resume:'pass',cancel:'pass',approvalDenial:'pass',applySpawn:'pass',singleWriter:'pass'},nativeThreadIds:['offline-fixture-only']};
  // A temporary parser fixture only: never write an acceptance record in the real Hera home.
  await atomicJson(join(home,'metadata/worker-verification.json'),record);expect((await workerCapability(home,config)).ready).toBe(true);
  expect((await workerCapability(home,{...config,language:'en'})).ready).toBe(true);
  expect((await workerCapability(home,{...config,workers:{...config.workers,maxConcurrent:2}})).ready).toBe(false);
  const report=await capabilityReport(config,home);expect(report.checks.G02?.state).toBe('pass');expect(report.checks.G12?.state).toBe('not_run');
  await atomicJson(join(home,'metadata/worker-verification.json'),{...record,checks:{readOnly:'pass'}});expect((await workerCapability(home,config)).ready).toBe(false);
});
