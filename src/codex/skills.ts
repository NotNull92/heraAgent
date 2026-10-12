import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import type {UserInput} from './generated/v2/UserInput.js';

export const bundledSkillsRoot=fileURLToPath(new URL('../../assets/skills/',import.meta.url));
export const bundledSkillFiles=['grilling/SKILL.md','grill-me/SKILL.md','grill-me/agents/openai.yaml','handoff/SKILL.md','handoff/agents/openai.yaml'] as const;

export function skillInput(prompt:string):UserInput[]{
  const input:UserInput[]=[{type:'text',text:prompt,text_elements:[]}];
  const name=/^(?:\/|\$)(grilling|grill-me|handoff)(?=\s|$)/.exec(prompt)?.[1];
  if(name){
    input.push({type:'skill',name,path:join(bundledSkillsRoot,name,'SKILL.md')});
    if(name==='grill-me')input.push({type:'skill',name:'grilling',path:join(bundledSkillsRoot,'grilling','SKILL.md')});
  }
  return input;
}
