import {it,expect,vi} from 'vitest';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {skillInput,bundledSkillsRoot} from '../src/codex/skills.js';
import {CodexClient} from '../src/codex/client.js';
import {InteractiveSession} from '../src/session/interactive.js';
import type {Controller} from '../src/session/controller.js';
import {defaults} from '../src/config.js';

it('bundles numbered rounds of up to five recommended questions and keeps execution opt-in',async()=>{
  const skill=await readFile(join(bundledSkillsRoot,'grilling/SKILL.md'),'utf8');
  expect(skill).toContain('up to five questions per round, numbered 1-5, each with a short recommended answer');
  expect(skill).toContain("Wait for the user's answers before the next round");
  expect(skill).toContain('Do not act on it until I confirm');
  expect(skill).toContain("Use the user's language");
  expect(skill).not.toMatch(/one question per turn|questions one at a time|Bundling several questions/i);
  expect(await readFile(join(bundledSkillsRoot,'grill-me/SKILL.md'),'utf8')).toContain('../grilling/SKILL.md');
});

it.each(['grilling','grill-me','handoff'])('attaches the packaged %s skill without changing the user text',name=>{
  for(const prefix of ['/','$']){
    const prompt=`${prefix}${name} 한글 요청\n다음 줄`;
    const input=skillInput(prompt);
    expect(input[0]).toEqual({type:'text',text:prompt,text_elements:[]});
    expect(input.slice(1)).toEqual((name==='grill-me'?[name,'grilling']:[name]).map(name=>({type:'skill',name,path:join(bundledSkillsRoot,name,'SKILL.md')})));
    expect(skillInput(prefix+name).length).toBe(input.length);
  }
});
it.each([' /handoff','explain $grilling','/grilling-extra','/handoff/../../private','/unknown','$grill-meeting'])('leaves non-invocation text unchanged: %s',prompt=>{
  expect(skillInput(prompt)).toEqual([{type:'text',text:prompt,text_elements:[]}]);
});
it('registers only the bundled root with the initialized native server',async()=>{
  const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));
  const request=vi.spyOn(client.rpc,'request');
  try{await client.initialize();expect(request.mock.calls.slice(0,2)).toEqual([
    ['initialize',expect.anything(),20000],['skills/extraRoots/set',{extraRoots:[bundledSkillsRoot]}]
  ]);}finally{await client.close();}
});
it.each(['grilling','grill-me','handoff'])('sends /%s through the existing conversation and keeps multiline arguments',async name=>{
  const session=new InteractiveSession('unused','unused',structuredClone(defaults),true);
  const run=vi.fn().mockResolvedValue({status:'completed'});session.controller={run} as unknown as Controller;
  vi.spyOn(session,'connect').mockResolvedValue();vi.spyOn(session,'refreshLimits').mockResolvedValue();
  const prompt=`/${name} 한글 주제\n두 번째 줄`;
  await session.submit(prompt);expect(run).toHaveBeenCalledExactlyOnceWith(prompt);expect(session.status).toBe('Ready');
});
