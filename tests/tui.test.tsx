import React,{act} from 'react';
import {it,expect,vi} from 'vitest';
import {render} from 'ink-testing-library';
import {Composer,editInput,graphemes} from '../src/tui/Composer.js';
import {App} from '../src/tui/App.js';
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
    expect(ui.lastFrame()).toContain('Ctrl+C: 중단 요청');
    await key('\x03');expect(interrupt).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();
    await act(async()=>{session.busy=false;session.emit('change');await tick();});
    expect(ui.lastFrame()).toContain('Ctrl+C: 종료');
    await key('\x1b[200~\x03\x1b[201~');expect(close).not.toHaveBeenCalled();
    await key('\x03');expect(close).toHaveBeenCalledTimes(1);
    // The App remains subscribed while the owned session is being cleaned up.
    expect(session.listenerCount('change')).toBe(1);
    await act(async()=>{finishClose();await tick();});
    expect(session.listenerCount('change')).toBe(0);
  }finally{await act(async()=>ui?.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();}
});
it('deletes whole Korean/emoji graphemes and bounds paste',()=>{const value='가👨‍👩‍👧‍👦e\u0301';expect(graphemes(value)).toHaveLength(3);expect(editInput(value,2,'backspace')).toEqual({value:'가e\u0301',cursor:1});expect(editInput('a',1,'insert','x'.repeat(70000)).value).toBe('a');});
it('bracketed multiline slash paste cannot submit or become a slash action',async()=>{const submitted:string[]=[];const ui=render(<Composer language="ko" busy={false} send={t=>submitted.push(t)} cancel={()=>{}}/>);await tick();ui.stdin.write('\x1b[200~/quit\n한글\x1b[201~');await tick();expect(submitted).toHaveLength(0);ui.stdin.write('\x13');await tick();expect(submitted).toEqual([' /quit\n한글']);ui.unmount();});
it('renders Korean readiness and bounded sanitized transcript',async()=>{const session=new InteractiveSession('unused','한글 workspace',structuredClone(defaults),true);session.add('\x1b]52;c;payload\x07안녕하세요');const ui=render(<App session={session}/>);await tick();expect(ui.lastFrame()).toContain('안녕하세요');expect(ui.lastFrame()).toContain('선택 필요');expect(ui.lastFrame()).not.toContain('payload');ui.unmount();});
it('does not treat controls embedded in a text chunk as submission',async()=>{const submitted:string[]=[];const ui=render(<Composer language="en" busy={false} send={t=>submitted.push(t)} cancel={()=>{}}/>);await tick();ui.stdin.write('/help\x13');await tick();expect(submitted).toEqual([]);ui.stdin.write('\x13');await tick();expect(submitted).toEqual(['/help']);ui.unmount();});
it('keeps pasted backslash commands literal',async()=>{const submitted:string[]=[];const ui=render(<Composer language="ko" busy={false} send={t=>submitted.push(t)} cancel={()=>{}}/>);await tick();ui.stdin.write('\x1b[200~\\workers 8\x1b[201~');await tick();ui.stdin.write('\x13');await tick();expect(submitted).toEqual([' \\workers 8']);ui.unmount();});
