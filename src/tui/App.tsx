import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Box,Static,useApp,useStdout} from 'ink';
import type {InteractiveSession} from '../session/interactive.js';
import type {Phase} from '../session/phase-policy.js';
import {ProviderKeyInput,ProviderLogin} from './ProviderInput.js';
import {Composer} from './Composer.js';
import {ApplyReview} from './ApplyReview.js';
import {SettingsPicker} from './SettingsPicker.js';
import {NativePrompt} from './NativePrompt.js';
import {Glint,Ornate,Text,ThemeContext,palette,useTheme} from './theme.js';
import {safeText} from '../errors.js';
import {GO_EFFORT} from '../codex/external-runtime.js';
import {windowsFor} from '../session/limits.js';
import type {LimitWindow} from '../session/limits.js';
import {GO_MODEL} from '../providers/opencode-go.js';

const TRACK:[Phase,string][]=[['IDLE','IDLE'],['ANALYZE_READ_ONLY','ANALYZE'],['QUIESCING','QUIESCE'],['READY_TO_APPLY','READY'],['APPLY_SINGLE_WRITER','APPLY'],['VERIFY_SINGLE_WRITER','VERIFY'],['COMPLETE','COMPLETE']];
// Title-screen greetings: well-known Skyrim lines of at most 51 characters, one chosen per TUI start.
export const GREETINGS=["Hey, you. You're finally awake.","Let me guess: someone stole your sweetroll?","Do you get to the Cloud District very often?","Fus Ro Dah!","I am sworn to carry your burdens.","Skyrim belongs to the Nords!","Never should have come here!","Some may call this junk. Me, I call them treasures.","No lollygaggin'.","Khajiit has wares, if you have coin.","Sky above, voice within."];
const EMBLEM=['◇','◇ ┃ ◇','◇   ┃   ◇','◆━━━━━╋━━━━━◆','◇   ┃   ◇','◇ ┃ ◇','◆'];
// Lines already written to the terminal keep their slot but drop their text beyond this many.
const KEPT_LINES=2000;
// Footer phase track. NEEDS_FIX takes the terminal slot; narrow terminals get studs plus the current name.
function Track({phase,wide,ko}:{phase:Phase;wide:boolean;ko:boolean}){
  const {c}=useTheme();
  if(phase==='NATIVE')return <Text>{ko?'◆ 작업 · 추가 권한이 필요할 때 확인':'◆ Work · ask when extra permission is needed'}</Text>;
  const failed=phase==='NEEDS_FIX';const at=(id:Phase)=>id===phase||failed&&id==='COMPLETE';const hue=failed?c.blood:c.gold;
  if(!wide)return <Text>{TRACK.map(([id])=><Text key={id} color={at(id)?hue:c.iron}>{at(id)?'◆':'◇'}</Text>)}<Text bold color={hue}> {failed?'NEEDS_FIX':TRACK.find(([id])=>id===phase)?.[1]}</Text></Text>;
  return <Text>{TRACK.map(([id,label],i)=><Text key={id}><Text color={c.iron}>{i?' ── ':''}</Text><Text bold={at(id)} color={at(id)?hue:c.iron}>{at(id)?'◆':'◇'} {at(id)&&failed?'NEEDS_FIX':label}</Text></Text>)}</Text>;
}
// One footer line per role: the configured route, the remaining share of each limit window the runtime
// actually returned, or a plain statement when there is none.
function Role({label,children,windows,fallback,reset,language}:{label:string;children:React.ReactNode;windows:LimitWindow[];fallback:string;reset:boolean;language:'ko'|'en'}){
  const {c}=useTheme();const ko=language==='ko';const two=(n:number)=>String(n).padStart(2,'0');
  const name=(mins:number|null)=>mins===300?'5h':mins===1440?(ko?'일간':'daily'):mins===10080?(ko?'주간':'weekly'):mins?`${Math.round(mins/60)}h`:(ko?'한도':'limit');
  return <Text><Text color={c.iron}>{label}  </Text>{children}<Text color={c.iron}> · </Text>{windows.length?windows.map((w,i)=>{
    const left=Math.max(0,Math.min(100,Math.round(100-w.usedPercent)));const at=w.resetsAt===null||!reset?null:new Date(w.resetsAt*1000);const when=at&&`${at.getMonth()+1}/${at.getDate()} ${two(at.getHours())}:${two(at.getMinutes())}`;
    return <Text key={i}><Text color={c.iron}>{i?' · ':''}</Text>{name(w.windowDurationMins)} <Text bold color={left>=50?c.moss:left>=20?c.gold:c.blood}>{left}%</Text>{ko?' 남음':' left'}{when&&<Text color={c.iron}>{ko?` (${when} 리셋)`:` (resets ${when})`}</Text>}</Text>;
  }):<Text color={c.iron}>{fallback}</Text>}</Text>;
}
function Line({text}:{text:string}){
  const {c}=useTheme();const speaker=/^(You|Hera): /.exec(text);
  if(speaker)return <Text><Text bold color={speaker[1]==='You'?c.frost:c.gold}>{speaker[0]}</Text>{text.slice(speaker[0].length)}</Text>;
  return <Text color={text.startsWith('Tool exit: ')?c.iron:undefined}>{text||' '}</Text>;
}
// Printed once at the top of the session, then it scrolls away with the conversation.
function Banner({width,cwd,greeting,language}:{width:number;cwd:string;greeting:string;language:'ko'|'en'}){
  const {c}=useTheme();const side=Math.max(0,width-25);
  return <Box flexDirection="column" width={width}>
    <Box><Ornate text={'╾'+'━'.repeat(side>>1)+'◇━━━━ ◆ '}/><Text bold>H E R A</Text><Ornate text={' ◆ ━━━━◇'+'━'.repeat(side-(side>>1))+'╼'}/></Box>
    <Box flexDirection="column" alignItems="center" paddingY={1}>{EMBLEM.map((line,i)=><Ornate key={i} text={line} bold/>)}<Text> </Text><Text color={c.iron}>{greeting}</Text></Box>
    <Text wrap="truncate-middle"><Text color={c.iron}>◇ {language==='ko'?'작업 폴더':'Workspace'}  </Text>{safeText(cwd)}<Text color={c.iron}> · Codex 0.160.1</Text></Text>
  </Box>;
}
export function App({session}:{session:InteractiveSession}){
  const [,update]=useState(0);const [greeting]=useState(()=>GREETINGS[Math.floor(Math.random()*GREETINGS.length)]!);const {exit}=useApp();const {stdout}=useStdout();
  useEffect(()=>{let dirty=false;const changed=()=>{dirty=true;};const quit=()=>exit();session.on('change',changed);session.on('quit',quit);stdout.on('resize',changed);const timer=setInterval(()=>{if(dirty){dirty=false;update(n=>n+1);}},50);return()=>{clearInterval(timer);session.off('change',changed);session.off('quit',quit);stdout.off('resize',changed);};},[session,exit,stdout]);
  const {color,reducedMotion}=session.config.ui;const theme=useMemo(()=>({c:palette(color),motion:!reducedMotion}),[color,reducedMotion]);const c=theme.c;
  const ko=session.config.language==='ko';const width='columns'in stdout&&typeof stdout.columns==='number'?stdout.columns:80;const height='rows'in stdout&&typeof stdout.rows==='number'?stdout.rows:24;
  // The conversation flows into the terminal's own scrollback like a shell session: every finished
  // line is written once above the live area, and only the unfinished line stays live. The session
  // keeps a sliding window, so its running character count tells which text is new.
  const log=useRef({seen:0,tail:'',lines:[] as string[]});
  if(session.written>log.current.seen){
    const fresh=session.written-log.current.seen;const parts=(log.current.tail+session.transcript.slice(-Math.min(fresh,session.transcript.length))).split('\n');
    const before=log.current.lines;const next=[...before,...parts.slice(0,-1)];for(let i=Math.max(0,before.length-KEPT_LINES);i<next.length-KEPT_LINES;i++)next[i]='';
    log.current={seen:session.written,tail:parts.at(-1)!,lines:next};
  }
  const items=useMemo(()=>[null,...log.current.lines],[log.current.lines]);
  const approval=safeText(session.approval);const rows=height-6-Number(!!approval);
  const request=session.controller?.requests.values().next().value;
  const phase=session.controller?.phase.phase??'NATIVE';const active=session.controller?.workers?.activeCount??0;const limit=session.config.workers.maxConcurrent;
  const tone=session.busy?c.gold:session.status==='Ready'||session.status==='COMPLETE'?c.moss:/^[A-Z][A-Z0-9_-]+$/.test(session.status)?c.blood:undefined;
  const quit=()=>{void session.close().finally(()=>exit());};const external=session.config.mode!=='gpt_only';const adaptive=session.config.mode==='adaptive';
  const unread=session.limits===undefined?(ko?'확인 전':'not read yet'):(ko?'한도 정보 없음':'limit unavailable');const unset=ko?'선택 필요':'unselected';
  const mainWindows=session.limits?windowsFor(session.limits,session.config.main.model):[];const workerWindows=session.limits?windowsFor(session.limits,session.config.workers.gptModel):[];
  // Go limits exist only in the provider console; a GPT worker normally draws on the main model's bucket.
  const shared=workerWindows.length>0&&JSON.stringify(workerWindows)===JSON.stringify(mainWindows);
  const workerNote=external?(ko?'한도: OpenCode 콘솔':'limits: OpenCode console'):shared?(ko?'메인과 한도 공유':'shares the main limit'):unread;
  return <ThemeContext.Provider value={theme}>
    <Static items={items}>{(line,i)=>line===null?<Banner key={i} width={width} cwd={session.cwd} greeting={greeting} language={session.config.language}/>:<Line key={i} text={line}/>}</Static>
    <Box flexDirection="column">
      {log.current.tail!==''&&<Line text={log.current.tail}/>}
      {approval&&<Text bold color={c.gold}>◆ {approval}</Text>}
      {session.providerKeyInput?<ProviderKeyInput language={session.config.language} save={key=>{void session.saveProviderKey(key);}} cancel={()=>session.cancelProviderKey()}/>
        :session.providerLoginText?<ProviderLogin text={session.providerLoginText} cancel={()=>{void session.interrupt();}} quit={quit}/>
        :request?<NativePrompt key={request.id} request={request} language={session.config.language} rows={Math.max(7,rows)} answer={value=>{try{session.controller!.answerRequest(request.id,value);}catch(e){session.add(String(e));}}} quit={quit}/>
        :session.controller?.review&&!session.busy?<ApplyReview key={session.controller.review.id} review={session.controller.review} rows={Math.max(8,rows)} columns={width} language={session.config.language} approve={()=>{void session.approveApply();}} cancel={()=>session.cancelApply()}/>
        :session.selection?<SettingsPicker key={session.selection.title} menu={session.selection} language={session.config.language} rows={Math.max(7,rows)} choose={value=>{void session.selectOption(value);}} cancel={()=>session.cancelSelection()} quit={quit}/>
        :<Composer language={session.config.language} busy={session.busy} send={text=>{void session.submit(text);}} cancel={()=>{void session.interrupt().catch(e=>session.add(String(e)));}} quit={quit}/>}
      <Track phase={phase} wide={width>=76} ko={ko}/>
      <Box><Glint active={session.busy}/><Text color={tone}> {session.status}</Text><Text color={c.iron}> · {ko?'모드':'Mode'} </Text><Text>{adaptive?'DeepSeek + Astra':external?'GPT + DeepSeek':'GPT'}</Text>
        {session.controller?.collaborationEnabled&&<Text><Text color={c.iron}> · {ko?'워커':'Workers'} </Text><Text color={c.frost}>{'◆'.repeat(Math.min(active,limit))}</Text><Text color={c.iron}>{'◇'.repeat(Math.max(0,limit-active))}</Text>{ko?` ${active} 활성 / 상한 ${limit}`:` ${active} active / limit ${limit}`}</Text>}</Box>
      <Role label={adaptive?(ko?'깊은 추론':'Reasoning'):(ko?'메인':'Main')} windows={mainWindows} fallback={unread} reset={width>=70} language={session.config.language}>{safeText(session.config.main.model??unset)}<Text color={c.iron}> · effort </Text>{session.config.main.reasoningEffort??'default'}</Role>
      <Role label={adaptive?(ko?'일상 작업':'Routine'):(ko?'워커':'Worker')} windows={external||shared?[]:workerWindows} fallback={workerNote} reset={width>=70} language={session.config.language}>{safeText((external?GO_MODEL:session.config.workers.gptModel)??unset)}<Text color={c.iron}> · effort </Text>{(external?GO_EFFORT:session.config.workers.reasoningEffort)??'default'}</Role>
    </Box>
  </ThemeContext.Provider>;
}
