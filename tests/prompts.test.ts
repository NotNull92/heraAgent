import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {configSchema,type Config} from '../src/config.js';
import {nativeBaseInstructions,adaptiveRouting,developmentRouting,skillRouting,nativeDeveloperInstructions,PLAN_PREFIX} from '../src/session/prompts.js';
import {bundledSkillsRoot} from '../src/codex/skills.js';

// Hand-off G adds only the approved sentence to the preserved 9389a17 outputs; never regenerate from the builders.
const fixture=JSON.parse(readFileSync(new URL('./fixtures/native-prompts-hand-off-g-20261012.json',import.meta.url),'utf8')) as {researchHandbook:string;planPrefix:string;cases:{config:Config;workers:boolean;base:string;routing:string;skillRouting:string;developerInstructions:string}[]};
const portable=(text:string)=>text.replaceAll(JSON.stringify(bundledSkillsRoot),JSON.stringify('<bundled-skills-root>'));
it('preserves every prompt builder byte-for-byte against the Hand-off G baseline, including whitespace',()=>{
  expect(PLAN_PREFIX).toBe(fixture.planPrefix);
  for(const row of fixture.cases){
    const config=configSchema.parse(row.config);
    expect(nativeBaseInstructions(config.mode)).toBe(row.base);
    if(row.workers)expect(config.mode==='adaptive'?adaptiveRouting():developmentRouting(config)).toBe(row.routing);
    expect(portable(skillRouting(config,row.workers))).toBe(row.skillRouting);
    expect(portable(nativeDeveloperInstructions(config,row.workers,fixture.researchHandbook))).toBe(row.developerInstructions);
  }
});
