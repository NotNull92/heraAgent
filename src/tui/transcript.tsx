import React from 'react';
import chalk from 'chalk';
import wrapAnsi from 'wrap-ansi';
import stringWidth from 'string-width';
import {Text,type Palette} from './theme.js';

export const KEPT_LINES=2000;
export type TextFormat={fence:string;user:boolean};
export type TranscriptLine={id:number;text:string;literal:boolean;cache?:{width:number;colors:Palette;rows:string[]}};
export type TranscriptRow={id:number;offset:number;text:string};
const ansi=chalk;
export function bannerRows(width:number,cwd:string,greeting:string,language:'ko'|'en',emblem:string[],colors:Palette,version:string){
  const tint=(text:string,color:string|undefined)=>color?ansi.hex(color)(text):text;
  const ornate=(text:string)=>text.split(/(◆|[◇━─╾╼┥┝]+)/).map((part,i)=>i%2?tint(part,part==='◆'?colors.gold:colors.iron):part).join('');
  const center=(text:string)=>' '.repeat(Math.max(0,Math.floor((width-stringWidth(text))/2)))+text;
  const side=Math.max(0,width-25);
  const lines=[ornate('╾'+'━'.repeat(side>>1)+'◇━━━━ ◆ ')+ansi.bold('H E R A')+ornate(' ◆ ━━━━◇'+'━'.repeat(side-(side>>1))+'╼'),' ',
    ...emblem.map(line=>center(ansi.bold(ornate(line)))),' ',center(tint(greeting,colors.iron)),' ',
    tint('◇ '+(language==='ko'?'작업 폴더':'Workspace')+'  ',colors.iron)+cwd+tint(' · api v'+version,colors.iron)];
  return lines.flatMap(line=>wrapAnsi(line,Math.max(1,width),{hard:true,wordWrap:false,trim:false}).split('\n'));
}

export function emphasis(text:string){
  const parts:React.ReactNode[]=[];let at=0,cursor=0;
  const prose=(end:number)=>{
    for(const match of text.slice(at,end).matchAll(/\*\*(\S(?:.*?\S)?)\*\*/g)){
      const start=at+match.index;parts.push(text.slice(cursor,start),<Text key={start} bold>{match[1]}</Text>);cursor=start+match[0].length;
    }
    parts.push(text.slice(cursor,end));
  };
  const ticks=[...text.matchAll(/`+/g)];
  for(let i=0;i<ticks.length;i++){
    const start=ticks[i]!;prose(start.index);
    let end=i+1;while(end<ticks.length&&ticks[end]![0].length!==start[0].length)end++;
    at=end<ticks.length?ticks[end]!.index+ticks[end]![0].length:text.length;
    parts.push(text.slice(start.index,at));cursor=at;i=end;
  }
  prose(text.length);return parts;
}
export function formatLine(text:string,state:TextFormat,id:number):TranscriptLine{
  const speaker=/^(You|Hera): /.exec(text);
  if(speaker&&(speaker[1]==='You'||!state.fence)){state.fence='';state.user=speaker[1]==='You';}
  const body=state.fence?text:text.slice(speaker?.[0].length??0);
  if(state.user)return {id,text,literal:true};
  const fence=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(body);
  if(state.fence){
    if(fence&&fence[1]![0]===state.fence[0]&&fence[1]!.length>=state.fence.length&&!fence[2]!.trim())state.fence='';
    return {id,text,literal:true};
  }
  if(fence&&(fence[1]![0]==='~'||!fence[2]!.includes('`'))){state.fence=fence[1]!;return {id,text,literal:true};}
  return {id,text,literal:/^( {4}|\t)/.test(body)};
}
export function wrappedRows(line:TranscriptLine,width:number,colors:Palette):string[]{
  if(line.cache?.width===width&&line.cache.colors===colors)return line.cache.rows;
  const tint=(text:string,color:string|undefined)=>color?ansi.hex(color)(text):text;
  const prose=(text:string)=>line.literal?text:emphasis(text).map(part=>typeof part==='string'?part:React.isValidElement<{children:string}>(part)?ansi.bold(part.props.children):'').join('');
  const speaker=/^(You|Hera): /.exec(line.text);
  const text=speaker?tint(ansi.bold(speaker[0]),speaker[1]==='You'?colors.frost:colors.gold)+prose(line.text.slice(speaker[0].length))
    :tint(prose(line.text)||' ',line.text.startsWith('Tool exit: ')?colors.iron:undefined);
  const rows=wrapAnsi(text,Math.max(1,width),{hard:true,wordWrap:false,trim:false}).split('\n');
  line.cache={width,colors,rows};return rows;
}
