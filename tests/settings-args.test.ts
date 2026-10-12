import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {defaults} from '../src/config.js';
import {nativeSettings,settingsArgs,startupArgs} from '../src/codex/config-compiler.js';

// Independent 9389a17 serializers, retained only as equivalence oracles.
const flat=(values:Record<string,unknown>)=>Object.entries(values).flatMap(([key,value])=>['-c',`${key}=${JSON.stringify(value)}`]);
function recursive(values:Record<string,unknown>,prefix=''):string[]{return Object.entries(values).flatMap(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?recursive(v as Record<string,unknown>,prefix+k+'.'):['-c',`${prefix+k}=${JSON.stringify(v)}`]);}
const mixed=JSON.parse(readFileSync(new URL('./fixtures/mixed-settings-9389a17.json',import.meta.url),'utf8')) as {mode:'adaptive'|'external_workers';overrides:Record<string,unknown>}[];
it('preserves startupArgs and official client argv for all current nativeSettings branches',()=>{
  for(const mode of ['adaptive','external_workers','gpt_only'] as const)for(const effort of [null,'high'] as const){
    const config={...structuredClone(defaults),mode,main:{model:'fixture-main',reasoningEffort:effort},workers:{...defaults.workers,gptModel:'fixture-worker',reasoningEffort:effort}};
    for(const sandbox of ['read-only','workspace-write'] as const)for(const workers of [false,true])for(const nativeFlow of [false,true]){
      if(workers&&sandbox==='workspace-write'&&!nativeFlow)continue;
      for(const url of [undefined,'http://127.0.0.1:12345/mcp']){
        const settings=nativeSettings(config,sandbox,workers,url,nativeFlow);
        expect(settingsArgs(settings)).toEqual(flat(settings));
      }
      if(!nativeFlow)expect(startupArgs(config,sandbox,workers)).toEqual(flat(nativeSettings(config,sandbox,workers)));
    }
  }
});
it('preserves mixed launcher argv with captured provider overrides and nested headers',()=>{
  for(const row of mixed){
    const config={...structuredClone(defaults),mode:row.mode,main:{model:'fixture-main',reasoningEffort:'high' as const},workers:{...defaults.workers,gptModel:null,reasoningEffort:null,maxConcurrent:2},designReasoningEffort:'max' as const};
    for(const sandbox of ['read-only','workspace-write'] as const)for(const workers of [false,true]){
      const settings={...nativeSettings(config,sandbox,workers,'http://127.0.0.1:12345/mcp',true),...row.overrides};
      expect(settingsArgs(settings)).toEqual(recursive(settings));
    }
  }
});
it('preserves dotted keys, nesting, array leaves, null and false without changing argument order',()=>{
  const settings={'already.dotted':false,provider:{headers:{'User-Agent':'hera/fixture'},empty:null,list:['한글',true,null,{kept:'object'}]},enabled:true};
  const expected=['-c','already.dotted=false','-c','provider.headers.User-Agent="hera/fixture"','-c','provider.empty=null','-c','provider.list=["한글",true,null,{"kept":"object"}]','-c','enabled=true'];
  expect(settingsArgs(settings)).toEqual(expected);expect(recursive(settings)).toEqual(expected);
});
