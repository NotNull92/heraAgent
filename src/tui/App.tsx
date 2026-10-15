import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Box,useApp,useStdout,useStdin,useBoxMetrics} from 'ink';
import type {DOMElement} from 'ink';
import {KEPT_LINES,bannerRows,formatLine,wrappedRows,type TranscriptLine,type TranscriptRow,type TextFormat} from './transcript.js';
import {transcriptInput} from './transcript-input.js';
export {KEPT_LINES,emphasis} from './transcript.js';
import type {InteractiveSession} from '../session/interactive.js';
import {ProviderKeyInput,ProviderLogin} from './ProviderInput.js';
import {Composer} from './Composer.js';
import {ApplyReview} from './ApplyReview.js';
import {SettingsPicker} from './SettingsPicker.js';
import {NativePrompt} from './NativePrompt.js';
import {Glint,Text,ThemeContext,palette,useTheme} from './theme.js';
import {safeText} from '../errors.js';
import {windowsFor} from '../session/limits.js';
import type {LimitWindow} from '../session/limits.js';
import {designEffort} from '../config.js';
import {GO_MODEL} from '../providers/opencode-go.js';
import {CODEX_VERSION} from '../codex/launcher.js';

// Title-screen greetings: well-known Skyrim lines of at most 51 characters, one chosen per TUI start.
export const GREETINGS=["Hey, you. You're finally awake.","Let me guess: someone stole your sweetroll?","Do you get to the Cloud District very often?","Fus Ro Dah!","I am sworn to carry your burdens.","Skyrim belongs to the Nords!","Never should have come here!","Some may call this junk. Me, I call them treasures.","No lollygaggin'.","Khajiit has wares, if you have coin.","Sky above, voice within."];
const EMBLEM=['◇','◇ ┃ ◇','◇   ┃   ◇','◆━━━━━╋━━━━━◆','◇   ┃   ◇','◇ ┃ ◇','◆'];
// One footer line per role: the configured route, the remaining share of each limit window the runtime
// actually returned, or a plain statement when there is none.
// Effort hue climbs with the setting: iron off, moss low, gold middle, blood hot; the words stay readable without color.
function effortColor(effort:string,c:ReturnType<typeof palette>){return /^(none|minimal)$/.test(effort)?c.iron:effort==='low'?c.moss:/^(high|xhigh|max)$/.test(effort)?c.blood:c.gold;}
function Role({label,model,effort,windows,fallback,reset,language}:{label:string;model:string;effort:string;windows:LimitWindow[];fallback:string;reset:boolean;language:'ko'|'en'}){
  const {c}=useTheme();const children=<Text><Text color={c.frost}>{model}</Text><Text color={c.iron}> · effort </Text><Text bold color={effortColor(effort,c)}>{effort}</Text></Text>;const ko=language==='ko';const two=(n:number)=>String(n).padStart(2,'0');
  const name=(mins:number|null)=>mins===300?'5h':mins===1440?(ko?'일간':'daily'):mins===10080?(ko?'주간':'weekly'):mins?`${Math.round(mins/60)}h`:(ko?'한도':'limit');
  return <Text><Text color={c.iron}>{label}  </Text>{children}<Text color={c.iron}> · </Text>{windows.length?windows.map((w,i)=>{
    const left=Math.max(0,Math.min(100,Math.round(100-w.usedPercent)));const at=w.resetsAt===null||!reset?null:new Date(w.resetsAt*1000);const when=at&&`${at.getMonth()+1}/${at.getDate()} ${two(at.getHours())}:${two(at.getMinutes())}`;
    return <Text key={i}><Text color={c.iron}>{i?' · ':''}</Text>{name(w.windowDurationMins)} <Text bold color={left>=50?c.moss:left>=20?c.gold:c.blood}>{left}%</Text>{ko?' 남음':' left'}{when&&<Text color={c.iron}>{ko?` (${when} 리셋)`:` (resets ${when})`}</Text>}</Text>;
  }):<Text color={c.iron}>{fallback}</Text>}</Text>;
}
// Only prose gets bold; preserve code spans, including an unfinished span while streaming.
// The root thread's current pause (thinking, a tool, a worker wait) with its elapsed time, ticking once a second.
function Activity({text,since}:{text:string;since:number}){
  const {c}=useTheme();const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(!text)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[text,since]);
  if(!text)return null;const s=Math.max(0,Math.floor((now-since)/1000));
  return <Text color={c.iron}> · {safeText(text)} {Math.floor(s/60)}:{String(s%60).padStart(2,'0')}</Text>;
}
export function App({session}:{session:InteractiveSession}){
  const [,update]=useState(0);const [greeting]=useState(()=>GREETINGS[Math.floor(Math.random()*GREETINGS.length)]!);const {exit}=useApp();const {stdout}=useStdout();
  const {stdin}=useStdin();
  const view=useRef<{anchor:Pick<TranscriptRow,'id'|'offset'>|null;unread:number;count:number;width:number}>({anchor:null,unread:0,count:0,width:0});
  const viewport=useRef<DOMElement>(null);const metrics=useBoxMetrics(viewport);
  const rowState=useRef<{rows:TranscriptRow[];height:number}>({rows:[],height:1});
  const follow=()=>{view.current.anchor=null;view.current.unread=0;update(n=>n+1);};
  const scroll=(direction:number,page:boolean)=>{
    const {rows,height}=rowState.current;const state=view.current;const bottom=Math.max(0,rows.length-height);
    const at=state.anchor?Math.max(0,rows.findIndex(row=>row.id===state.anchor!.id&&row.offset===state.anchor!.offset)):bottom;
    const next=Math.max(0,Math.min(bottom,at+direction*(page?Math.max(1,height-2):3)));
    if(next===bottom){follow();return;}const row=rows[next];if(row){state.anchor={id:row.id,offset:row.offset};update(n=>n+1);}
  };
  const scrollRef=useRef(scroll);scrollRef.current=scroll;
  useEffect(()=>transcriptInput(stdin,stdout,(direction,page)=>scrollRef.current(direction,page)),[stdin,stdout]);
  useEffect(()=>{let dirty=false;const changed=()=>{dirty=true;};const resized=()=>{dirty=true;};const quit=()=>exit();session.on('change',changed);session.on('quit',quit);stdout.prependListener('resize',resized);const timer=setInterval(()=>{
    if(dirty){dirty=false;update(n=>n+1);}},50);return()=>{clearInterval(timer);session.off('change',changed);session.off('quit',quit);stdout.off('resize',resized);};},[session,exit,stdout]);
  const {color,reducedMotion}=session.config.ui;const theme=useMemo(()=>({c:palette(color),motion:!reducedMotion}),[color,reducedMotion]);const c=theme.c;
  const ko=session.config.language==='ko';const width='columns'in stdout&&typeof stdout.columns==='number'?stdout.columns:80;const height='rows'in stdout&&typeof stdout.rows==='number'?stdout.rows:24;
  const log=useRef({seen:0,tail:'',tailLine:null as TranscriptLine|null,lines:[] as TranscriptLine[],format:{fence:'',user:false} as TextFormat,nextId:0});
  const fresh=session.written>log.current.seen;let dropped=0;
  if(fresh){
    const count=session.written-log.current.seen;const parts=(log.current.tail+session.transcript.slice(-Math.min(count,session.transcript.length))).split('\n');
    const format={...log.current.format};const next=[...log.current.lines,...parts.slice(0,-1).map(text=>formatLine(text,format,log.current.nextId++))];
    const removed=next.splice(0,Math.max(0,next.length-KEPT_LINES));dropped=removed.reduce((n,line)=>n+wrappedRows(line,width,c).length,0);
    const tail=parts.at(-1)!;log.current={...log.current,seen:session.written,tail,tailLine:tail?formatLine(tail,{...format},log.current.nextId):null,lines:next,format};
  }
  const banner=useMemo(()=>bannerRows(width,safeText(session.cwd),greeting,session.config.language,EMBLEM,c,CODEX_VERSION),[theme,width,session.cwd,greeting,session.config.language]);
  const transcriptRows:TranscriptRow[]=banner.map((text,offset)=>({id:-1,offset,text}));
  for(const line of [...log.current.lines,...(log.current.tailLine?[log.current.tailLine]:[])])wrappedRows(line,width,c).forEach((text,offset)=>transcriptRows.push({id:line.id,offset,text}));
  if(fresh&&view.current.anchor&&view.current.width===width)view.current.unread+=Math.max(0,transcriptRows.length-view.current.count+dropped);
  view.current.count=transcriptRows.length;view.current.width=width;
  const viewportHeight=metrics.hasMeasured?Math.max(0,Math.floor(metrics.height)):Math.max(0,height-6);
  rowState.current={rows:transcriptRows,height:viewportHeight};
  let top=Math.max(0,transcriptRows.length-viewportHeight);
  if(view.current.anchor){
    const anchor=view.current.anchor;let at=transcriptRows.findIndex(row=>row.id===anchor.id&&row.offset===anchor.offset);
    if(at<0)at=transcriptRows.findIndex(row=>row.id>=anchor.id);
    top=Math.max(0,at);const row=transcriptRows[top];if(row)view.current.anchor={id:row.id,offset:row.offset};
  }
  const visible=transcriptRows.slice(top,top+Math.max(0,viewportHeight-Number(!!view.current.anchor)));
  const footer=useRef<DOMElement>(null);const footerMetrics=useBoxMetrics(footer);
  const approval=safeText(session.approval);const rows=height-5-Number(!!approval);
  const request=session.controller?.requests.values().next().value;
  const active=session.controller?.workers?.activeCount??0;const limit=session.config.workers.maxConcurrent;
  const tone=session.busy?c.gold:session.status==='Ready'||session.status==='COMPLETE'?c.moss:/^[A-Z][A-Z0-9_-]+$/.test(session.status)?c.blood:undefined;
  const quit=()=>{void session.close().finally(()=>exit());};const external=session.config.mode!=='gpt_only';const adaptive=session.config.mode==='adaptive';
  const unread=session.limits===undefined?(ko?'확인 전':'not read yet'):(ko?'한도 정보 없음':'limit unavailable');const unset=ko?'선택 필요':'unselected';
  const mainWindows=session.limits?windowsFor(session.limits,session.config.main.model):[];const workerWindows=session.limits?windowsFor(session.limits,session.config.workers.gptModel):[];
  // Go limits exist only in the provider console; a GPT worker normally draws on the main model's bucket.
  const shared=workerWindows.length>0&&JSON.stringify(workerWindows)===JSON.stringify(mainWindows);
  const workerNote=external?(ko?'한도: OpenCode 콘솔':'limits: OpenCode console'):shared?(ko?'메인과 한도 공유':'shares the main limit'):unread;
  return <ThemeContext.Provider value={theme}>
    <Box flexDirection="column" width={width} height={height} overflow="hidden">
    <Box ref={viewport} flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0} overflow="hidden">
      {visible.map(row=><Text key={row.id+':'+row.offset} wrap="truncate-end">{row.text}</Text>)}
      {view.current.anchor&&viewportHeight>0&&<Box marginTop={Math.max(0,viewportHeight-visible.length-1)}><Text color={c.iron} wrap="truncate-end">{ko?'↑ 이전 대화 보는 중':'↑ Viewing earlier output'}{view.current.unread?(ko?' · 새 출력 '+view.current.unread+'줄':' · '+view.current.unread+' new lines'):''}{ko?' · 휠 아래로 또는 PgDn':' · wheel down or PgDn'}</Text></Box>}
    </Box>
    <Box flexDirection="column" flexShrink={0} maxHeight={Math.max(1,height-(footerMetrics.height||3)-1)} overflow="hidden">
      {approval&&<Text bold color={c.gold}>◆ {approval}</Text>}
      {session.providerKeyInput?<ProviderKeyInput language={session.config.language} save={key=>{void session.saveProviderKey(key);}} cancel={()=>session.cancelProviderKey()}/>
        :session.providerLoginText?<ProviderLogin text={session.providerLoginText} cancel={()=>{void session.interrupt();}} quit={quit}/>
        :request?<NativePrompt key={request.id} request={request} language={session.config.language} rows={Math.max(7,rows)} answer={value=>{try{session.controller!.answerRequest(request.id,value);}catch(e){session.add(String(e));}}} quit={quit}/>
        :session.controller?.review&&!session.busy?<ApplyReview key={session.controller.review.id} review={session.controller.review} rows={Math.max(8,rows)} columns={width} language={session.config.language} approve={()=>{void session.approveApply();}} cancel={()=>session.cancelApply()}/>
        :session.selection?<SettingsPicker key={session.selection.title} menu={session.selection} language={session.config.language} rows={Math.max(7,rows)} choose={value=>{void session.selectOption(value);}} cancel={()=>session.cancelSelection()} quit={quit}/>
        :<Composer language={session.config.language} rows={Math.max(1,height-8)} busy={session.busy} send={text=>{follow();void session.submit(text);}} cancel={()=>{void session.interrupt().catch(e=>session.add(String(e)));}} quit={quit}/>}
    </Box>
    <Box ref={footer} flexDirection="column" flexShrink={0}>
      <Box><Glint active={session.busy}/><Text color={tone}> {session.status}</Text><Activity text={session.activity} since={session.activitySince}/><Text color={c.iron}> · {ko?'모드':'Mode'} </Text><Text>{adaptive?(ko?'HERA 설계':'HERA Design'):external?(ko?'HERA 개발':'HERA Development'):(ko?'모드 선택 필요':'Select a mode')}</Text>
        {session.controller?.collaborationEnabled&&<Text><Text color={c.iron}> · {ko?'워커':'Workers'} </Text><Text color={c.frost}>{'◆'.repeat(Math.min(active,limit))}</Text><Text color={c.iron}>{'◇'.repeat(Math.max(0,limit-active))}</Text>{ko?` ${active} 활성 / 상한 ${limit}`:` ${active} active / limit ${limit}`}</Text>}</Box>
      <Role label={adaptive?(ko?'깊은 추론':'Reasoning'):(ko?'메인':'Main')} windows={mainWindows} fallback={unread} reset={width>=70} language={session.config.language} model={safeText(session.config.main.model??unset)} effort={session.config.main.reasoningEffort??'default'}/>
      <Role label={adaptive?(ko?'설계·조사':'Design/research'):(ko?'워커':'Worker')} windows={external||shared?[]:workerWindows} fallback={workerNote} reset={width>=70} language={session.config.language} model={safeText((external?GO_MODEL:session.config.workers.gptModel)??unset)} effort={(adaptive?designEffort(session.config):external?session.config.workers.goReasoningEffort:session.config.workers.reasoningEffort)??'default'}/>
    </Box>
    </Box>
  </ThemeContext.Provider>;
}
