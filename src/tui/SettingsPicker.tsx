import React,{useRef,useState} from 'react';
import {Box,Text,useInput,usePaste} from 'ink';
import type {SelectionMenu} from '../session/interactive.js';
import {safeText} from '../errors.js';

export function SettingsPicker({menu,language,rows,choose,cancel,quit}:{menu:SelectionMenu;language:'ko'|'en';rows:number;choose:(value:string)=>void;cancel:()=>void;quit:()=>void}){
  const [index,setIndex]=useState(Math.max(0,menu.options.findIndex(o=>o.value===menu.current)));const current=useRef(index);
  usePaste(()=>{});
  useInput((input,key)=>{
    if(key.escape||key.ctrl&&input==='c'){cancel();return;}
    if(key.ctrl&&input==='q'){quit();return;}
    if(key.upArrow||key.downArrow){current.current=(current.current+(key.upArrow?-1:1)+menu.options.length)%menu.options.length;setIndex(current.current);return;}
    if(key.return){const option=menu.options[current.current];if(option)choose(option.value);}
  });
  const visible=Math.max(1,rows-5);const start=Math.max(0,Math.min(index-Math.floor(visible/2),menu.options.length-visible));
  return <Box borderStyle="single" flexDirection="column">
    <Text bold>{safeText(menu.title)}</Text>
    {menu.options.slice(start,start+visible).map((option,i)=><Text key={option.value} inverse={start+i===index}>{start+i===index?'› ':'  '}{safeText(option.label)}{option.value===menu.current?(language==='ko'?' [현재]':' [current]'):''}</Text>)}
    <Text dimColor>{index+1}/{menu.options.length} · {language==='ko'?'↑↓ 이동 · Enter 선택 · Esc 취소':'↑↓ move · Enter select · Esc cancel'}</Text>
  </Box>;
}
