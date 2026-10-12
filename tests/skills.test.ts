import {it,expect,vi} from 'vitest';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {skillInput,bundledSkillsRoot} from '../src/codex/skills.js';
import {CodexClient} from '../src/codex/client.js';
import {InteractiveSession} from '../src/session/interactive.js';
import type {Controller} from '../src/session/controller.js';
import {defaults} from '../src/config.js';

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
