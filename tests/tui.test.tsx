import React,{act} from 'react';
import {it,expect,vi} from 'vitest';
import {render} from 'ink-testing-library';
import {Composer,caret,editInput,graphemes} from '../src/tui/Composer.js';
import {App,GREETINGS} from '../src/tui/App.js';
import {palette} from '../src/tui/theme.js';
import {parseLimits,mergeLimits,windowsFor} from '../src/session/limits.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {defaults} from '../src/config.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,70));
it('Ctrl+C interrupts busy work, then exits only after idle session cleanup; paste never exits',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const session=new InteractiveSession('unused','fixture',structuredClone(defaults),true);
  session.busy=true;
  const interrupt=vi.spyOn(session,'interrupt').mockResolvedValue();
  let finishClose!:()=>void;
  const close=vi.spyOn(session,'close').mockImplementation(()=>new Promise<void>(resolve=>{finishClose=resolve;}));
  let ui!:ReturnType<typeof render>;
  try{
    await act(async()=>{ui=render(<App session={session}/>);});
    const key=async(value:string)=>{await act(async()=>{ui.stdin.write(value);await tick();});};
        await key('\x03');expect(interrupt).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();
    await act(async()=>{session.busy=false;session.emit('change');await tick();});
    // Idle: the first Ctrl+C only arms exit and says so; any other input disarms it.
    await key('\x03');expect(ui.lastFrame()).toContain('See you later codingborn.');expect(close).not.toHaveBeenCalled();
    await key('\x1b[200~\x03\x1b[201~');expect(close).not.toHaveBeenCalled();expect(ui.lastFrame()).not.toContain('codingborn');
    await key('\x03');expect(close).not.toHaveBeenCalled();await key('\x03');expect(close).toHaveBeenCalledTimes(1);
    // The App remains subscribed while the owned session is being cleaned up.
    expect(session.listenerCount('change')).toBe(1);
    await act(async()=>{finishClose();await tick();});
    expect(session.listenerCount('change')).toBe(0);
  }finally{await act(async()=>ui?.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();}
});
it('deletes whole Korean/emoji graphemes and bounds paste',()=>{const value='가👨‍👩‍👧‍👦e\u0301';expect(graphemes(value)).toHaveLength(3);expect(editInput(value,2,'backspace')).toEqual({value:'가e\u0301',cursor:1});expect(editInput('a',1,'insert','x'.repeat(70000)).value).toBe('a');});
it('bracketed multiline slash paste cannot submit or become a slash action',async()=>{const submitted:string[]=[];const ui=render(<Composer language="ko" busy={false} send={t=>submitted.push(t)} cancel={()=>{}}/>);await tick();ui.stdin.write('\x1b[200~/quit\n한글\x1b[201~');await tick();expect(submitted).toHaveLength(0);ui.stdin.write('\r');await tick();expect(submitted).toEqual([' /quit\n한글']);ui.unmount();});
it('renders Korean readiness and bounded sanitized transcript',async()=>{const session=new InteractiveSession('unused','한글 workspace',structuredClone(defaults),true);session.add('\x1b]52;c;payload\x07안녕하세요');const ui=render(<App session={session}/>);await tick();expect(ui.lastFrame()).toContain('안녕하세요');expect(ui.lastFrame()).toContain('선택 필요');expect(ui.lastFrame()).not.toContain('payload');ui.unmount();});
it('does not treat controls embedded in a text chunk as submission',async()=>{const submitted:string[]=[];const ui=render(<Composer language="en" busy={false} send={t=>submitted.push(t)} cancel={()=>{}}/>);await tick();ui.stdin.write('/help\r');await tick();expect(submitted).toEqual([]);ui.stdin.write('\x13');await tick();expect(submitted).toEqual([]);ui.stdin.write('\r');await tick();expect(submitted).toEqual(['/help\n']);ui.unmount();});
it('drops every hue for NO_COLOR or ui.color=never and keeps them otherwise',()=>{
  expect(palette('auto',{}).gold).toMatch(/^#[0-9a-f]{6}$/);expect(palette('auto',{NO_COLOR:''}).gold).toBeDefined();
  for(const plain of [palette('never',{}),palette('auto',{NO_COLOR:'1'})])expect(Object.values(plain).every(hue=>hue===undefined)).toBe(true);
});
it('keeps conversation scrollback and status without a workflow track at wide and narrow widths',async()=>{
  const session=new InteractiveSession('unused','fixture',structuredClone(defaults),true);
  session.add(Array.from({length:60},(_,i)=>`entry ${i} ${'가나다라 '.repeat(40)}`).join('\n')+'\nYou: 마지막 요청');
  const ui=render(<App session={session}/>);await tick();
  expect(ui.lastFrame()).not.toMatch(/ANALYZE|QUIESCE|◆ 작업/);expect(ui.lastFrame()).toContain('Ready');expect(ui.lastFrame()).toContain('You: 마지막 요청');expect(ui.lastFrame()).toContain('entry 0 ');expect(ui.lastFrame()).toContain('entry 59 ');
  // A finished line is written once; later output appends below it instead of redrawing it.
  session.add('\nHera: 이어지는 답변');await tick();expect(ui.lastFrame()!.split('You: 마지막 요청')).toHaveLength(2);expect(ui.lastFrame()!.split('entry 0 ')).toHaveLength(2);expect(ui.lastFrame()).toContain('Hera: 이어지는 답변');
  Object.defineProperty(ui.stdout,'columns',{get:()=>60});ui.stdout.emit('resize');await tick();
  expect(ui.lastFrame()).not.toMatch(/ANALYZE|QUIESCE|◆ 작업/);expect(ui.lastFrame()).toContain('Ready');expect(ui.lastFrame()).toContain('You: 마지막 요청');expect(ui.lastFrame()).not.toContain('승인');expect(ui.lastFrame()).not.toContain('Ctrl+');
  await act(async()=>{session.approval='fixture/requestApproval: denied';session.emit('change');await tick();});expect(ui.lastFrame()).toContain('◆ fixture/requestApproval: denied');expect(ui.lastFrame()).toContain('Hera: 이어지는 답변');
  ui.unmount();
});
it('clears the terminal on every resize and reprints the conversation',async()=>{
  const session=new InteractiveSession('unused','fixture',structuredClone(defaults),true);session.add('You: 크기 변경 전\n');
  const ui=render(<App session={session}/>);await tick();const before=ui.frames.length;
  Object.assign(ui.stdout,{isTTY:true});Object.defineProperty(ui.stdout,'columns',{get:()=>50});ui.stdout.emit('resize');
  // The wipe is written before Ink repaints for the same event, so no stale rows survive a drag.
  expect(ui.frames[before]).toBe('\x1b[2J\x1b[3J\x1b[H');
  await tick();expect(ui.frames.length).toBeGreaterThan(before+1);ui.stdout.emit('resize');await tick();await tick();expect(ui.frames.slice(before).filter(frame=>frame==='\x1b[2J\x1b[3J\x1b[H')).toHaveLength(2);
  expect(ui.lastFrame()).toContain('You: 크기 변경 전');expect(ui.lastFrame()).toContain('I can do anything with you.');ui.unmount();
});
it('names the configured worker model and effort for each mode',async()=>{
  const config=structuredClone(defaults);config.workers.gptModel='fixture-worker';config.workers.reasoningEffort='max';
  const gpt=render(<App session={new InteractiveSession('unused','fixture',config,true)}/>);await tick();expect(gpt.lastFrame()).toMatch(/워커\s+fixture-worker · effort max/);gpt.unmount();
  const go=render(<App session={new InteractiveSession('unused','fixture',{...config,mode:'external_workers'},true)}/>);await tick();expect(go.lastFrame()).toMatch(/워커\s+deepseek-v4\.1-flash · effort low/);go.unmount();
});
it('places the IME caret by terminal cells across Korean text, newlines and hard wraps',()=>{
  expect(caret('',0,80)).toEqual({x:2,y:0});expect(caret('한글 ab',5,80)).toEqual({x:9,y:0});expect(caret('한글 ab',1,80)).toEqual({x:4,y:0});
  expect(caret('a\n가나',4,80)).toEqual({x:4,y:1});expect(caret('가'.repeat(5),5,9)).toEqual({x:4,y:1});
});
it('shows only the limit windows the runtime returned and merges sparse updates',async()=>{
  const read={rateLimits:{limitId:'codex',primary:{usedPercent:21,windowDurationMins:10080,resetsAt:1791948567},secondary:null},rateLimitsByLimitId:{codex:{limitId:'codex',normalModelSlug:null,primary:{usedPercent:21,windowDurationMins:10080,resetsAt:1791948567},secondary:null}}};
  const limits=parseLimits(read);expect(windowsFor(limits,'any')).toHaveLength(1);expect(windowsFor([],'any')).toEqual([]);
  const merged=mergeLimits(limits,{rateLimits:{limitId:'codex',primary:null,secondary:{usedPercent:90,windowDurationMins:300,resetsAt:null}}});expect(windowsFor(merged,null).map(w=>w.usedPercent)).toEqual([21,90]);expect(mergeLimits(limits,{bad:true})).toBe(limits);
  const session=new InteractiveSession('unused','fixture',structuredClone(defaults),true);const ui=render(<App session={session}/>);await tick();expect(ui.lastFrame()).toContain('확인 전');
  session.limits=merged;session.emit('change');await tick();expect(ui.lastFrame()).toMatch(/메인[^\n]*· 주간 79% 남음 \(\d+\/\d+ \d\d:\d\d 리셋\) · 5h 10% 남음/);expect(ui.lastFrame()).toMatch(/워커[^\n]*· 메인과 한도 공유/);
  session.limits=null;session.emit('change');await tick();expect(ui.lastFrame()).toContain('한도 정보 없음');ui.unmount();
});
it('points Go limits to the provider console instead of showing a figure',async()=>{
  const session=new InteractiveSession('unused','fixture',{...structuredClone(defaults),mode:'external_workers'},true);
  const ui=render(<App session={session}/>);await tick();expect(ui.lastFrame()).toMatch(/워커[^\n]*· 한도: OpenCode 콘솔\s*$/);expect(ui.lastFrame()).not.toContain('토큰');expect(ui.lastFrame()).not.toContain('%');ui.unmount();
});
it('follows Claude Code keys: Enter sends, newline keys, history, double Escape and word delete',async()=>{
  const sent:string[]=[];const ui=render(<Composer language="ko" busy={false} send={t=>sent.push(t)} cancel={()=>{}}/>);await tick();
  const keys=async(...values:string[])=>{for(const value of values){ui.stdin.write(value);await tick();}};
  await keys('a','\\','\r','b','\n','c','\r');expect(sent).toEqual(['a\nb\nc']);
  await keys('two','\r','\x1b[A','\x1b[A','\x1b[B','\r');expect(sent).toEqual(['a\nb\nc','two','two']);
  await keys('foo bar','\x17','\r');expect(sent.at(-1)).toBe('foo ');
  await keys('draft','\x1b');expect(ui.lastFrame()).toContain('draft');await keys('\x1b');expect(ui.lastFrame()).toContain('I can do anything with you.');
  await keys('text','\x03');expect(ui.lastFrame()).toContain('See you later codingborn.');expect(sent).toHaveLength(4);ui.unmount();
});
it('Escape interrupts active work and Enter does not send while busy',async()=>{
  const sent:string[]=[];let cancels=0;const ui=render(<Composer language="ko" busy send={t=>sent.push(t)} cancel={()=>cancels++}/>);await tick();
  ui.stdin.write('wait');await tick();ui.stdin.write('\r');await tick();expect(sent).toEqual([]);ui.stdin.write('\x1b');await tick();expect(cancels).toBe(1);expect(ui.lastFrame()).toContain('wait');ui.unmount();
});
it('greets with one pooled line per start and keeps it across re-renders',async()=>{
  const random=vi.spyOn(Math,'random').mockReturnValue(0.99);const session=new InteractiveSession('unused','fixture',structuredClone(defaults),true);
  const ui=render(<App session={session}/>);await tick();expect(GREETINGS.length).toBeGreaterThan(1);expect(Math.max(...GREETINGS.map(line=>line.length))).toBe(51);expect(ui.lastFrame()).toContain(GREETINGS.at(-1));
  random.mockReturnValue(0);session.status='Working';session.emit('change');await tick();expect(ui.lastFrame()).toContain('Working');expect(ui.lastFrame()).toContain(GREETINGS.at(-1));expect(ui.lastFrame()).not.toContain(GREETINGS[0]);
  ui.unmount();random.mockRestore();
});
it('keeps pasted backslash commands literal',async()=>{const submitted:string[]=[];const ui=render(<Composer language="ko" busy={false} send={t=>submitted.push(t)} cancel={()=>{}}/>);await tick();ui.stdin.write('\x1b[200~\\workers 8\x1b[201~');await tick();ui.stdin.write('\r');await tick();expect(submitted).toEqual([' \\workers 8']);ui.unmount();});
