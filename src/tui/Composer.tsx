import React,{useEffect,useState,useRef} from 'react';
import {Box,useBoxMetrics,useCursor,useInput,usePaste} from 'ink';
import type {DOMElement} from 'ink';
import {safeText} from '../errors.js';
import {Text,useTheme} from './theme.js';
const commands=[
  ['help','명령어 도움말','Show command help'],
  ['model','메인·워커 모델 선택','Choose main or worker model'],
  ['mode','에이전트 모드 선택','Choose agent mode'],
  ['effort','추론 강도 선택','Choose reasoning effort'],
  ['workers','동시 워커 수 선택','Choose worker limit'],
  ['providers','로그인 및 API 키 관리','Manage sign-in and API keys'],
  ['research','웹 리서치 설정 및 상태','Web research setup and status'],
  ['plan','읽기 전용 계획 작성 · 요청 입력','Read-only plan · enter a request'],
  ['diff','작업 변경사항 보기','Show workspace changes'],
  ['resume','이전 세션 이어가기','Resume a previous session'],
  ['doctor','설정 및 런타임 상태 확인','Check configuration and runtime'],
  ['quit','Hera 종료','Quit Hera'],
] as const;
export const graphemes=(value:string)=>Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value),s=>s.segment);
export function editInput(value:string,cursor:number,operation:'insert'|'backspace'|'delete',text=''){
  const parts=graphemes(value);const index=Math.max(0,Math.min(cursor,parts.length));
  if(operation==='backspace'){if(index>0)parts.splice(index-1,1);return {value:parts.join(''),cursor:Math.max(0,index-1)};}
  if(operation==='delete'){parts.splice(index,1);return {value:parts.join(''),cursor:index};}
  const inserted=graphemes(safeText(text.replaceAll('\r\n','\n').replaceAll('\r','\n')));if(parts.join('').length+inserted.join('').length>65536)return {value,cursor};parts.splice(index,0,...inserted);return {value:parts.join(''),cursor:index+inserted.length};
}
// Terminal cells of one grapheme: Hangul, CJK, fullwidth forms and emoji take two.
const cells=(grapheme:string)=>/[ᄀ-ᅟ⺀-〾ぁ-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]|\p{Extended_Pictographic}/u.test(grapheme)?2:1;
// Caret cell inside the input row, mirroring its hard wrap; the prompt occupies the first two cells.
export function caret(value:string,cursor:number,width:number){
  let x=2,y=0;
  for(const grapheme of graphemes(value).slice(0,cursor)){if(grapheme==='\n'){x=0;y++;continue;}const w=cells(grapheme);if(x+w>width){x=0;y++;}x+=w;}
  return {x:Math.min(x,Math.max(0,width-1)),y};
}
// Key bindings follow Claude Code: Enter sends; backslash+Enter, Shift/Alt+Enter or Ctrl+J add a line;
// Escape interrupts active work or, pressed twice, clears the input; Ctrl+C interrupts, then clears
// and arms exit, and a second Ctrl+C exits; Up/Down recall sent input; Ctrl+A/E/U/K/W edit the line.
// A leading command prefix opens suggestions: Up/Down select, Tab completes, Escape dismisses.
// Pasted text never submits or exits by itself, and a pasted leading slash stays literal text.
export function Composer({busy,send,cancel,quit,language,rows=6}:{busy:boolean;send:(text:string)=>void;cancel:()=>void;quit?:()=>void;language:'ko'|'en';rows?:number}){
  const [state,renderState]=useState({value:'',cursor:0});const current=useRef(state);const pasteRef=useRef(false);
  const [menu,renderMenu]=useState({index:0,hidden:false});const menuRef=useRef(menu);
  const setMenu=(next:typeof menu)=>{menuRef.current=next;renderMenu(next);};
  const matches=()=>!busy&&!pasteRef.current&&!menuRef.current.hidden&&/^[\\/][a-z]*$/i.test(current.current.value)&&current.current.cursor===current.current.value.length?commands.filter(([name])=>name.startsWith(current.current.value.slice(1).toLowerCase())):[];
  const [armed,renderArmed]=useState(false);const armedRef=useRef(false);const lastEscape=useRef(0);const history=useRef({items:[] as string[],at:-1,draft:''});
  const setState=(next:typeof state|((s:typeof state)=>typeof state))=>{const previous=current.current.value;current.current=typeof next==='function'?next(current.current):next;if(previous!==current.current.value)setMenu({index:0,hidden:false});renderState(current.current);};
  const arm=(value:boolean)=>{if(armedRef.current!==value){armedRef.current=value;renderArmed(value);}};
  const insert=(text:string)=>setState(s=>editInput(s.value,s.cursor,'insert',text));
  const reset=()=>{setState({value:'',cursor:0});pasteRef.current=false;};
  const replace=(value:string)=>setState({value,cursor:graphemes(value).length});
  usePaste(text=>{arm(false);pasteRef.current=true;insert(text);});
  useInput((input,key)=>{
    if(key.ctrl&&(input==='c'||input==='d')){
      if(busy&&input==='c'){cancel();return;}
      if(armedRef.current){quit?.();return;}
      if(input==='d'&&current.current.value)return;
      reset();arm(true);return;
    }
    arm(false);
    const options=matches();const selected=options[menuRef.current.index];
    if(key.ctrl&&input==='q'){quit?.();return;}
    if(key.escape){if(busy){cancel();return;}if(options.length){setMenu({...menuRef.current,hidden:true});lastEscape.current=0;return;}const now=Date.now();if(now-lastEscape.current<1000){reset();lastEscape.current=0;}else lastEscape.current=now;return;}
    if(input==='\n'||key.ctrl&&input==='j'||key.return&&(key.shift||key.meta)){insert('\n');return;}
    if(key.tab&&selected){replace(current.current.value[0]+selected[0]+' ');return;}
    if(key.return){
      const {value,cursor}=current.current;
      if(graphemes(value)[cursor-1]==='\\'){setState(s=>{const cut=editInput(s.value,s.cursor,'backspace');return editInput(cut.value,cut.cursor,'insert','\n');});return;}
      if(busy||!value.trim())return;
      if(selected?.[0]==='plan'){replace(value[0]+'plan ');return;}
      const text=selected?value[0]+selected[0]:value;
      const submitted=pasteRef.current&&/^[\\/]/.test(text)?` ${text}`:text;
      send(submitted);history.current.items=[...history.current.items,submitted].slice(-100);history.current.at=-1;reset();return;
    }
    if(key.ctrl){
      const parts=graphemes(current.current.value);const at=current.current.cursor;
      if(input==='a')setState(s=>({...s,cursor:0}));
      else if(input==='e')setState(s=>({...s,cursor:parts.length}));
      else if(input==='u')setState({value:parts.slice(at).join(''),cursor:0});
      else if(input==='k')setState({value:parts.slice(0,at).join(''),cursor:at});
      else if(input==='w'){let start=at;while(start>0&&/\s/.test(parts[start-1]!))start--;while(start>0&&!/\s/.test(parts[start-1]!))start--;setState({value:[...parts.slice(0,start),...parts.slice(at)].join(''),cursor:start});}
      return;
    }
    if(key.meta)return;
    if(key.upArrow||key.downArrow){
      if(options.length){setMenu({...menuRef.current,index:(menuRef.current.index+(key.upArrow?-1:1)+options.length)%options.length});return;}
      const h=history.current;if(h.at<0&&current.current.value.includes('\n'))return;
      if(key.upArrow&&h.at<h.items.length-1){if(h.at<0)h.draft=current.current.value;h.at++;replace(h.items[h.items.length-1-h.at]!);}
      else if(key.downArrow&&h.at>=0){h.at--;replace(h.at<0?h.draft:h.items[h.items.length-1-h.at]!);}
      return;
    }
    if(key.leftArrow){setState(s=>({...s,cursor:Math.max(0,s.cursor-1)}));return;}
    if(key.rightArrow){setState(s=>({...s,cursor:Math.min(graphemes(s.value).length,s.cursor+1)}));return;}
    if(key.backspace||key.delete){setState(s=>editInput(s.value,s.cursor,key.backspace?'backspace':'delete'));return;}
    if(input)insert(input);
  });
  const {c}=useTheme();
  // A terminal IME draws the syllable being composed at the real cursor, so the cursor must sit
  // at the caret; otherwise Korean text only appears after each syllable is committed.
  // The composer is a direct child of the root column, so its top is the output row.
  const row=useRef<DOMElement>(null);const {top,width,hasMeasured}=useBoxMetrics(row);const {setCursorPosition}=useCursor();
  const at=caret(state.value,state.cursor,width||80);setCursorPosition(hasMeasured?{x:at.x,y:top+1+at.y}:undefined);
  useEffect(()=>()=>setCursorPosition(undefined),[setCursorPosition]);
  const options=matches();const visible=Math.max(1,Math.min(6,rows));const start=Math.max(0,Math.min(menu.index-Math.floor(visible/2),options.length-visible));
  return <>
    <Box ref={row} borderStyle="single" borderLeft={false} borderRight={false} {...(c.gold?{borderColor:c.gold}:{})}><Text wrap="hard"><Text bold color={c.gold}>&gt; </Text>{state.value||(armed?<Text color={c.blood}>See you later codingborn.</Text>:<Text color={c.iron}>I can do anything with you.</Text>)}</Text></Box>
    {options.length>0&&<Box flexDirection="column">
      {options.slice(start,start+visible).map(([name,ko,en],i)=><Text key={name} wrap="truncate-end" bold={start+i===menu.index} color={start+i===menu.index?c.gold:undefined}>{start+i===menu.index?'› ':'  '}{state.value[0]}{name.padEnd(11)}{language==='ko'?ko:en}</Text>)}
      <Text color={c.iron} wrap="truncate-end">{menu.index+1}/{options.length} · {language==='ko'?'↑↓ 이동 · Tab 완성 · Enter 선택 · Esc 닫기':'↑↓ move · Tab complete · Enter select · Esc close'}</Text>
    </Box>}
  </>;
}
