import {it,expect} from 'vitest';
import {defaults,configSchema,parseEffort} from '../src/config.js';
import {nativeSettings,requireMode,validateModelChoices} from '../src/codex/config-compiler.js';
import {childEnvironment} from '../src/codex/launcher.js';
it('requires explicit single-agent and model selection without provider fallback',()=>{expect(()=>requireMode(defaults,true)).toThrow('explicitly select');expect(()=>requireMode({...defaults,mode:'external_workers'},true)).toThrow('no fallback');expect(()=>requireMode({...defaults,main:{model:'catalog-choice',reasoningEffort:null}},false)).toThrow('unverified');const native=nativeSettings(defaults);expect(native['agents.enabled']).toBe(false);expect(native['features.multi_agent']).toBe(false);expect(native['features.multi_agent_v2']).toBe(false);expect(native['agents.max_concurrent_threads_per_session']).toBe(3);});
it('child environment does not inherit provider or deployment secrets',()=>{const env=childEnvironment('/home/hera','/project',{PATH:process.execPath,GH_TOKEN:'private',HERA_OPENCODE_GO_API_KEY:'private',OPENAI_API_KEY:'private',SYSTEMROOT:'Windows'});expect(env.GH_TOKEN).toBeUndefined();expect(env.HERA_OPENCODE_GO_API_KEY).toBeUndefined();expect(env.OPENAI_API_KEY).toBeUndefined();expect(env.CODEX_HOME).toContain('codex');});
it('validates both role efforts against their own catalog and preserves older settings',()=>{
  const config=structuredClone(defaults);config.main={model:'main-fixture',reasoningEffort:'ultra'};config.workers.gptModel='worker-fixture';config.workers.reasoningEffort='max';
  const models=[{id:'m',model:'main-fixture',displayName:'Main',supportedReasoningEfforts:[{reasoningEffort:'ultra'}]},{id:'w',model:'worker-fixture',displayName:'Worker',supportedReasoningEfforts:[{reasoningEffort:'max'}]}];
  expect(()=>validateModelChoices(config,models)).not.toThrow();expect(nativeSettings(config).model_reasoning_effort).toBe('ultra');expect(nativeSettings(config)['agents.default_subagent_reasoning_effort']).toBe('max');
  config.workers.reasoningEffort='ultra';expect(()=>validateModelChoices(config,models)).toThrow('worker');config.workers.gptModel=null;expect(()=>validateModelChoices(config,models)).toThrow('Select the worker');
  const {reasoningEffort,...oldWorkers}=defaults.workers;expect(configSchema.parse({...defaults,workers:oldWorkers}).workers.reasoningEffort).toBeNull();expect(parseEffort('default')).toBeNull();expect(()=>parseEffort('not a level')).toThrow();
});
