import {it,expect} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {workerCapability,capabilityReport,nativeCapability} from '../src/codex/capabilities.js';
import {atomicJson} from '../src/paths.js';
import {defaults as productDefaults} from '../src/config.js';
// Historical GPT fixtures must not depend on the current product default.
const defaults={...productDefaults,mode:'gpt_only' as const};
it('keeps native qualification across effort tuning but rejects model, mode, permission and provider drift',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-effort-evidence-'));const config=structuredClone(defaults);
  const initial=await nativeCapability(home,config);
  await atomicJson(join(home,'metadata/native-gpt_only-verification.json'),{schemaVersion:1,fingerprint:initial.fingerprint,checkedAt:new Date().toISOString(),checks:{conversation:'pass',editTest:'pass',resume:'pass',cancel:'pass',approval:'pass',routing:'pass',concurrency:'pass'},nativeThreadIds:['offline-fixture-only']});
  for(const level of ['low','high','max'] as const){const tuned=structuredClone(config);tuned.main.reasoningEffort=level;tuned.workers.reasoningEffort=level;tuned.workers.goReasoningEffort=level;expect((await nativeCapability(home,tuned)).ready).toBe(true);}
  for(const changed of [
    {...config,main:{...config.main,model:'another-model'}},
    {...config,workers:{...config.workers,gptModel:'another-worker'}},
    {...config,mode:'adaptive' as const},
    {...config,safety:{...config.safety,approvalPolicy:'never'}},
    {...config,providers:{opencode_go_deepseek:{...config.providers.opencode_go_deepseek,baseUrl:'https://example.invalid'}}}
  ])expect((await nativeCapability(home,changed as typeof config)).ready).toBe(false);
});
it('invalidates native evidence on relevant configuration drift and never promotes missing or incomplete records',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-evidence-test-'));const config=structuredClone(defaults);const initial=await workerCapability(home,config);expect(initial.ready).toBe(false);
  const record={schemaVersion:1,fingerprint:initial.fingerprint,checkedAt:new Date().toISOString(),checks:{readOnly:'pass',concurrency:'pass',communication:'pass',resume:'pass',cancel:'pass',approvalDenial:'pass',applySpawn:'pass',singleWriter:'pass'},nativeThreadIds:['offline-fixture-only']};
  // A temporary parser fixture only: never write an acceptance record in the real Hera home.
  await atomicJson(join(home,'metadata/worker-verification.json'),record);expect((await workerCapability(home,config)).ready).toBe(true);
  expect((await nativeCapability(home,config)).ready).toBe(false);
  expect((await workerCapability(home,{...config,language:'en'})).ready).toBe(true);
  expect((await workerCapability(home,{...config,workers:{...config.workers,maxConcurrent:2}})).ready).toBe(false);
  const report=await capabilityReport(config,home);expect(report.checks.G02?.state).toBe('pass');expect(report.checks.G12?.state).toBe('not_run');
  await atomicJson(join(home,'metadata/worker-verification.json'),{...record,checks:{readOnly:'pass'}});expect((await workerCapability(home,config)).ready).toBe(false);
});
it('requires complete separate native-workflow evidence and invalidates changed limits',async()=>{const home=await mkdtemp(join(tmpdir(),'hera-native-evidence-'));const config=structuredClone(defaults);const initial=await nativeCapability(home,config);const record={schemaVersion:1,fingerprint:initial.fingerprint,checkedAt:new Date().toISOString(),checks:{conversation:'pass',editTest:'pass',resume:'pass',cancel:'pass',approval:'pass',routing:'pass',concurrency:'pass'},nativeThreadIds:['offline-fixture-only']};await atomicJson(join(home,'metadata/native-gpt_only-verification.json'),record);expect((await nativeCapability(home,config)).ready).toBe(true);expect((await nativeCapability(home,{...config,workers:{...config.workers,maxConcurrent:2}})).ready).toBe(false);await atomicJson(join(home,'metadata/native-gpt_only-verification.json'),{...record,checks:{conversation:'pass'}});expect((await nativeCapability(home,config)).ready).toBe(false);});
