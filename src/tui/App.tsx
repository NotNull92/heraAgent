import React,{useEffect,useMemo,useState} from 'react';
import {Box,useApp,useStdout} from 'ink';
import type {InteractiveSession} from '../session/interactive.js';
import type {Phase} from '../session/phase-policy.js';
import {ProviderKeyInput,ProviderLogin} from './ProviderInput.js';
import {Composer} from './Composer.js';
import {ApplyReview} from './ApplyReview.js';
import {SettingsPicker} from './SettingsPicker.js';
import {Frame,Glint,Ornate,Text,ThemeContext,palette,useTheme} from './theme.js';
import {safeText} from '../errors.js';
import {GO_EFFORT} from '../codex/external-runtime.js';
import {windowsFor} from '../session/limits.js';
import type {LimitSnapshot} from '../session/limits.js';
import {GO_MODEL} from '../providers/opencode-go.js';

const TRACK:[Phase,string][]=[['IDLE','IDLE'],['ANALYZE_READ_ONLY','ANALYZE'],['QUIESCING','QUIESCE'],['READY_TO_APPLY','READY'],['APPLY_SINGLE_WRITER','APPLY'],['VERIFY_SINGLE_WRITER','VERIFY'],['COMPLETE','COMPLETE']];
const EMBLEM=['◇','◇ ┃ ◇','◇   ┃   ◇','◆━━━━━╋━━━━━◆','◇   ┃   ◇','◇ ┃ ◇','◆'];
// Compass-style phase track. NEEDS_FIX takes the terminal slot so the row keeps one width.
function Compass({phase}:{phase:Phase}){
  const {c}=useTheme();const failed=phase==='NEEDS_FIX';
  return <Box justifyContent="center">{TRACK.map(([id,label],i)=>{const here=id===phase||failed&&id==='COMPLETE';return <Text key={id}><Text color={c.iron}>{i?' ── ':''}</Text><Text bold={here} color={here?(failed?c.blood:c.gold):c.iron}>{here?'◆':'◇'} {here&&failed?'NEEDS_FIX':label}</Text></Text>;})}</Box>;
}
function Stat({label,children}:{label:string;children:React.ReactNode}){
  const {c}=useTheme();
  return <Text><Text color={c.iron}>◇ {label}  </Text>{children}</Text>;
}
// Remaining share of each window the runtime actually returned; a missing window is simply not drawn.
const compact=(n:number)=>n<1000?String(n):n<1e6?`${(n/1000).toFixed(1)}k`:`${(n/1e6).toFixed(1)}M`;
// Observed cumulative thread tokens (cached input included); drawn only once the runtime reported them.
function Tokens({total,lead,language}:{total:number|null;lead:boolean;language:'ko'|'en'}){
  const {c}=useTheme();if(total===null)return null;
  return <Text><Text color={c.iron}>{lead?' · ':''}</Text>{language==='ko'?`누적 ${compact(total)} 토큰`:`${compact(total)} tokens so far`}</Text>;
}
// Go limits are visible only in the provider console, so the row says so instead of estimating.
function GoUsage({total,language}:{total:number|null;language:'ko'|'en'}){
  const {c}=useTheme();const ko=language==='ko';
  return <Text><Text color={c.iron}>    {ko?'사용량':'Usage'}  </Text><Tokens total={total} lead={false} language={language}/><Text color={c.iron}>{total===null?'':' · '}{ko?'한도: OpenCode 콘솔에서 확인':'limits: see the OpenCode console'}</Text></Text>;
}
function Usage({limits,model,total,language}:{limits:LimitSnapshot[]|null|undefined;model:string|null;total:number|null;language:'ko'|'en'}){
  const {c}=useTheme();const ko=language==='ko';const windows=limits?windowsFor(limits,model):[];const two=(n:number)=>String(n).padStart(2,'0');
  const name=(mins:number|null)=>mins===300?'5h':mins===1440?(ko?'일간':'daily'):mins===10080?(ko?'주간':'weekly'):mins?`${Math.round(mins/60)}h`:(ko?'한도':'limit');
  return <Text><Text color={c.iron}>    {ko?'사용량':'Usage'}  </Text>{windows.length?windows.map((w,i)=>{
    const left=Math.max(0,Math.min(100,Math.round(100-w.usedPercent)));const at=w.resetsAt===null?null:new Date(w.resetsAt*1000);const when=at&&`${at.getMonth()+1}/${at.getDate()} ${two(at.getHours())}:${two(at.getMinutes())}`;
    return <Text key={i}><Text color={c.iron}>{i?' · ':''}</Text>{name(w.windowDurationMins)} <Text bold color={left>=50?c.moss:left>=20?c.gold:c.blood}>{left}%</Text>{ko?' 남음':' left'}{when&&<Text color={c.iron}>{ko?` (${when} 리셋)`:` (resets ${when})`}</Text>}</Text>;
  }):<Text color={c.iron}>{limits===undefined?(ko?'확인 전':'not read yet'):(ko?'한도 정보 없음':'limit unavailable')}</Text>}<Tokens total={total} lead language={language}/></Text>;
}
function Journal({transcript,rows,language}:{transcript:string;rows:number;language:'ko'|'en'}){
  const {c}=useTheme();const ko=language==='ko';const inner=Math.max(1,rows-2);
  const lines=transcript.split('\n').slice(-inner).join('\n').slice(-12000).split('\n');
  if(!transcript.trim())return <Frame title={ko?'일지':'Journal'} height={inner}><Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
    {inner>=12&&EMBLEM.map((line,i)=><Ornate key={i} text={line} bold/>)}
    {inner>=5&&<><Text> </Text><Text bold>H   E   R   A</Text><Ornate text="─────── ◆ ───────"/><Text color={c.iron}>Hey, you. You&apos;re finally awake.</Text></>}
  </Box></Frame>;
  // Bottom-anchored so wrapped lines push old text out instead of hiding the newest output.
  return <Frame title={ko?'일지':'Journal'} height={inner}><Box flexDirection="column" justifyContent="flex-end" flexGrow={1} overflow="hidden">
    {lines.map((line,i)=>{const speaker=/^(You|Hera): /.exec(line);const text=safeText(line);
      return <Box key={i} flexShrink={0}>{speaker?<Text><Text bold color={speaker[1]==='You'?c.frost:c.gold}>{speaker[0]}</Text>{text.slice(speaker[0].length)}</Text>:<Text color={line.startsWith('Tool exit: ')?c.iron:undefined}>{text||' '}</Text>}</Box>;})}
  </Box></Frame>;
}
export function App({session}:{session:InteractiveSession}){
  const [,update]=useState(0);const {exit}=useApp();const {stdout}=useStdout();
  useEffect(()=>{let dirty=false;const changed=()=>{dirty=true;};const quit=()=>exit();session.on('change',changed);session.on('quit',quit);stdout.on('resize',changed);const timer=setInterval(()=>{if(dirty){dirty=false;update(n=>n+1);}},50);return()=>{clearInterval(timer);session.off('change',changed);session.off('quit',quit);stdout.off('resize',changed);};},[session,exit,stdout]);
  const {color,reducedMotion}=session.config.ui;const theme=useMemo(()=>({c:palette(color),motion:!reducedMotion}),[color,reducedMotion]);const c=theme.c;
  const ko=session.config.language==='ko';const width='columns'in stdout&&typeof stdout.columns==='number'?stdout.columns:80;const height='rows'in stdout&&typeof stdout.rows==='number'?stdout.rows:24;
  // Auxiliary rows collapse first on small terminals. The worker row needs live collaboration
  // and the approval row a pending notice; neither shows filler text when there is nothing to report.
  const approval=safeText(session.approval);const compass=width>=80&&height>=24;const workersRow=width>=65&&!!session.controller?.collaborationEnabled;const tokens=session.tokenTotals();const rows=height-(7+Number(compass)+Number(workersRow)+Number(!!approval))-1;
  const phase=session.controller?.phase.phase??'IDLE';const active=session.controller?.workers?.activeCount??0;const limit=session.config.workers.maxConcurrent;
  const tone=session.busy?c.gold:session.status==='Ready'||session.status==='COMPLETE'?c.moss:/^[A-Z][A-Z0-9_-]+$/.test(session.status)?c.blood:undefined;
  const quit=()=>{void session.close().finally(()=>exit());};const external=session.config.mode==='external_workers';
  // Title plate: the fixed centre is 25 cells wide; the heavy rules take the rest.
  const side=Math.max(0,width-25);
  return <ThemeContext.Provider value={theme}><Box flexDirection="column">
    <Box><Ornate text={'╾'+'━'.repeat(side>>1)+'◇━━━━ ◆ '}/><Text bold>H E R A</Text><Ornate text={' ◆ ━━━━◇'+'━'.repeat(side-(side>>1))+'╼'}/></Box>
    {compass&&<Compass phase={phase}/>}
    <Text wrap="truncate-middle"><Text color={c.iron}>◇ {ko?'작업 폴더':'Workspace'}  </Text>{safeText(session.cwd)}</Text>
    <Box><Stat label={ko?'모드':'Mode'}>{session.config.mode==='external_workers'?'GPT + DeepSeek':'GPT'}</Stat><Text color={c.iron}> · {ko?'단계':'Phase'}  </Text><Text bold color={phase==='NEEDS_FIX'?c.blood:undefined}>{phase}</Text><Text color={c.iron}> · </Text><Glint active={session.busy}/><Text color={tone}> {session.status}</Text></Box>
    <Stat label={ko?'요청 모델':'Requested model'}>{safeText(session.config.main.model??(ko?'선택 필요':'unselected'))}<Text color={c.iron}> · effort  </Text>{session.config.main.reasoningEffort??'default'}<Text color={c.iron}> · Codex 0.160.1</Text></Stat>
    <Usage limits={session.limits} model={session.config.main.model} total={tokens.main} language={session.config.language}/>
    <Stat label={ko?'워커 모델':'Worker model'}>{external?'OpenCode Go':'OpenAI'}<Text color={c.iron}> · </Text>{safeText((external?GO_MODEL:session.config.workers.gptModel)??(ko?'선택 필요':'unselected'))}<Text color={c.iron}> · effort  </Text>{(external?GO_EFFORT:session.config.workers.reasoningEffort)??'default'}</Stat>
    {external?<GoUsage total={tokens.workers} language={session.config.language}/>:<Usage limits={session.limits} model={session.config.workers.gptModel} total={tokens.workers} language={session.config.language}/>}
    {workersRow&&<Stat label={ko?'워커':'Workers'}><Text color={c.frost}>{'◆'.repeat(Math.min(active,limit))}</Text><Text color={c.iron}>{'◇'.repeat(Math.max(0,limit-active))}</Text>{ko?`  ${active} 활성 / 상한 ${limit} · 적용: 검토 승인 필요`:`  ${active} active / limit ${limit} · Apply: review required`}</Stat>}
    {approval&&<Text bold color={c.gold}>◆ {approval}</Text>}
    {session.providerKeyInput?<ProviderKeyInput language={session.config.language} save={key=>{void session.saveProviderKey(key);}} cancel={()=>session.cancelProviderKey()}/>
      :session.providerLoginText?<ProviderLogin text={session.providerLoginText} cancel={()=>{void session.interrupt();}} quit={quit}/>
      :session.controller?.review&&!session.busy?<ApplyReview key={session.controller.review.id} review={session.controller.review} rows={Math.max(8,rows)} columns={width} language={session.config.language} approve={()=>{void session.approveApply();}} cancel={()=>session.cancelApply()}/>
      :session.selection?<SettingsPicker key={session.selection.title} menu={session.selection} language={session.config.language} rows={Math.max(7,rows)} choose={value=>{void session.selectOption(value);}} cancel={()=>session.cancelSelection()} quit={quit}/>
      :<><Journal transcript={session.transcript} rows={Math.max(5,rows-4)} language={session.config.language}/><Composer language={session.config.language} busy={session.busy} send={text=>{void session.submit(text);}} cancel={()=>{void session.interrupt().catch(e=>session.add(String(e)));}} quit={quit}/></>}
  </Box></ThemeContext.Provider>;
}
