import React,{useState,useRef} from 'react';
import {Text,useInput,usePaste} from 'ink';
import {safeText} from '../errors.js';
export const graphemes=(value:string)=>Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value),s=>s.segment);
export function editInput(value:string,cursor:number,operation:'insert'|'backspace'|'delete',text=''){
  const parts=graphemes(value);const index=Math.max(0,Math.min(cursor,parts.length));
  if(operation==='backspace'){if(index>0)parts.splice(index-1,1);return {value:parts.join(''),cursor:Math.max(0,index-1)};}
  if(operation==='delete'){parts.splice(index,1);return {value:parts.join(''),cursor:index};}
  const inserted=graphemes(safeText(text.replaceAll('\r\n','\n').replaceAll('\r','\n')));if(parts.join('').length+inserted.join('').length>65536)return {value,cursor};parts.splice(index,0,...inserted);return {value:parts.join(''),cursor:index+inserted.length};
}
export function Composer({busy,send,cancel,language}:{busy:boolean;send:(text:string)=>void;cancel:()=>void;language:'ko'|'en'}){
  const [state,renderState]=useState({value:'',cursor:0});const current=useRef(state);const [pasted,setPasted]=useState(false);const pasteRef=useRef(false);
  const setState=(next:typeof state|((s:typeof state)=>typeof state))=>{current.current=typeof next==='function'?next(current.current):next;renderState(current.current);};
  const insert=(text:string)=>setState(s=>editInput(s.value,s.cursor,'insert',text));
  usePaste(text=>{insert(text);pasteRef.current=true;setPasted(true);});
  useInput((input,key)=>{
    if(key.ctrl&&input==='c'){cancel();return;}
    if(key.escape){setState({value:'',cursor:0});pasteRef.current=false;setPasted(false);return;}
    if(key.ctrl&&input==='s'){const value=current.current.value;if(!busy&&value.trim()){send(pasteRef.current&&value.startsWith('/')?` ${value}`:value);setState({value:'',cursor:0});pasteRef.current=false;setPasted(false);}return;}
    if(key.ctrl||key.meta)return;
    if(key.leftArrow){setState(s=>({...s,cursor:Math.max(0,s.cursor-1)}));return;}
    if(key.rightArrow){setState(s=>({...s,cursor:Math.min(graphemes(s.value).length,s.cursor+1)}));return;}
    if(key.backspace||key.delete){setState(s=>editInput(s.value,s.cursor,key.backspace?'backspace':'delete'));return;}
    if(key.return){insert('\n');return;}
    if(input)insert(input);
  });
  const parts=graphemes(state.value);
  return <Text>{language==='ko'?'입력':'Input'} &gt; {parts.slice(0,state.cursor).join('')}│{parts.slice(state.cursor).join('')}{'\n'}{language==='ko'?'Enter: 줄바꿈 · Ctrl+S: 전송 · Esc: 입력 지우기 · Ctrl+C: 작업 중단 요청':'Enter: newline · Ctrl+S: send · Esc: clear · Ctrl+C: interrupt'}{pasted?' [paste: literal text]':''}</Text>;
}
