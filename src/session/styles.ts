import {readdir,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {HeraError} from '../errors.js';
import {atomicWrite} from '../paths.js';
// Answer voices are user-owned Markdown files in <home>/output-styles. The chosen one is copied into the
// isolated runtime's AGENTS.md between these markers; anything else in that file is preserved.
const START=/<!-- hera-style:start ([a-z0-9_-]+) -->/i;const END='<!-- hera-style:end -->';
const BLOCK=/\n?<!-- hera-style:start [a-z0-9_-]+ -->[\s\S]*?<!-- hera-style:end -->\n?/gi;
// Hera's own framing for every voice: voice files are written in English for a human reader, but replies must
// stay in the user's language, and a worker's report is read by another agent, not a person.
export const SCOPE='The style below applies only to replies written for the human user. Write every reply entirely in the language the user writes in, including each heading and label this style defines (for example TL;DR or Your move); never mix in another language. If you are a worker or subagent reporting to another agent, ignore the style below and report in plain text without arrows, bold or emoji.';
// Placed after the voice text: models copy a style's literal English labels unless told last that they are placeholders.
export const LABELS='Final check before sending: the labels the style above spells in English (such as TL;DR, Your move, Also found, Next, Blocker, Pick a number) are placeholders, not fixed text. Do not add a label the style would not have used; when it does call for one, write it in the user\'s language (for a Korean user: 요약, 다음 행동, 덧붙임, 다음, 막힌 점, 번호 선택). A reply that keeps an English label or sentence when the user wrote in another language is wrong.';
const KNOWN=['attention-kind','spartan','rundown'];
export const stylesDir=(home:string)=>join(home,'output-styles');
const target=(home:string)=>join(home,'codex','AGENTS.md');
const read=(file:string)=>readFile(file,'utf8').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return '';throw e;});
// Known voices first in a fixed order, then the user's own files by name. "default" is reserved for "no voice".
export async function listStyles(home:string){
  const files=await readdir(stylesDir(home)).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return [] as string[];throw e;});
  const names=files.filter(f=>/^[a-z0-9][a-z0-9_-]{0,63}\.md$/i.test(f)).map(f=>f.slice(0,-3).toLowerCase()).filter(n=>n!=='default');
  return [...KNOWN.filter(n=>names.includes(n)),...names.filter(n=>!KNOWN.includes(n)).sort()];
}
export async function activeStyle(home:string){return START.exec(await read(target(home)))?.[1]?.toLowerCase()??null;}
export async function setStyle(home:string,name:string|null){
  const rest=(await read(target(home))).replace(BLOCK,'\n').trim();let block='';
  if(name){
    const source=await readFile(join(stylesDir(home),name+'.md'),'utf8');
    // Style files written for Claude Code start with YAML frontmatter; only the body is an instruction.
    const marked=source.indexOf('<!-- body-start -->');const body=(marked>=0?source.slice(marked+19):source.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/,'')).trim();
    if(!body||body.length>65536||body.includes(END))throw new HeraError('INVALID_STYLE','The style file is empty, larger than 64 KiB or contains a Hera style marker.',2);
    block=`<!-- hera-style:start ${name} -->\n${SCOPE}\n\n${body}\n\n${LABELS}\n${END}\n`;
  }
  const next=[rest,block].filter(Boolean).join('\n\n');
  if(!next){await unlink(target(home)).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;});return;}
  await atomicWrite(target(home),next.endsWith('\n')?next:next+'\n');
}
// Hera names for the three published voices; a user's own file shows its file name.
export function styleLabel(name:string,ko:boolean){
  if(name==='attention-kind')return ko?'[현자] 답 먼저 · 짧고 친절하게':'[Sage] answer first, short and kind';
  if(name==='spartan')return ko?'[전사] 군말 없이 핵심만':'[Warrior] blunt, signal only';
  if(name==='rundown')return ko?'[전령] 한 줄 요약 · 점검표 · 선택지':'[Herald] summary, checklist, numbered choices';
  return name;
}
