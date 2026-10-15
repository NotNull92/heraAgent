import React from 'react';
import {it,expect,vi} from 'vitest';
import {render} from 'ink-testing-library';
import {render as renderInk} from 'ink';
import {PassThrough,Writable} from 'node:stream';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import {App} from '../src/tui/App.js';
import {formatLine,wrappedRows} from '../src/tui/transcript.js';
import {transcriptInput} from '../src/tui/transcript-input.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {defaults} from '../src/config.js';
import {palette} from '../src/tui/theme.js';

const up='\x1b[<64;2;2M',down='\x1b[<65;2;2M';
const marker=(n:number)=>`line-${String(n).padStart(3,'0')}`;
function fixture(){
  const session=new InteractiveSession('unused','fixture',{...structuredClone(defaults),language:'en'},true);
  session.add(Array.from({length:60},(_,i)=>marker(i+1)).join('\n')+'\n');
  const ui=render(<App session={session}/>);
  Object.defineProperty(ui.stdout,'rows',{value:20,configurable:true});ui.stdout.emit('resize');
  const frame=()=>stripAnsi(ui.lastFrame()??'');
  const ready=()=>vi.waitFor(()=>{expect(frame()).toContain(marker(60));expect(frame().split('\n').length).toBeLessThanOrEqual(20);});
  const key=async(input:string,check:()=>void)=>{ui.stdin.write(input);await vi.waitFor(check);};
  return {session,ui,frame,ready,key};
}
it('scrolls a pinned viewport by wheel and pages, clamps at the banner and returns to follow mode',async()=>{
  const {ui,frame,ready,key}=fixture();
  try{
    await ready();const top=Number(/line-(\d+)/.exec(frame())![1]);const count=(frame().match(/line-\d+/g)??[]).length;
    expect(frame()).not.toContain(marker(1));
    await key(up,()=>{expect(frame()).toContain(marker(top-3));expect(frame()).toContain('Viewing earlier output');});
    await key(up.repeat(40),()=>expect(frame()).toContain('H E R A'));
    const atTop=frame();await key(up,()=>expect(frame()).toBe(atTop));
    await key(down.repeat(40),()=>{expect(frame()).toContain(marker(60));expect(frame()).not.toContain('Viewing earlier output');});
    await key('\x1b[5~',()=>expect(frame()).toContain(marker(top-(count-2))));
    await key('\x1b[6~',()=>{expect(frame()).toContain(marker(60));expect(frame()).not.toContain('Viewing earlier output');});
  }finally{ui.unmount();}
});
it('anchors streamed output, counts new rows, keeps history keys and follows a submitted prompt',async()=>{
  const {session,ui,frame,ready,key}=fixture();
  const submit=vi.spyOn(session,'submit').mockImplementation(async text=>{session.add(`You: ${text}\nHera: submitted`);});
  try{
    await ready();await key('first',()=>expect(frame()).toContain('> first'));await key('\r',()=>expect(submit).toHaveBeenCalledWith('first'));
    await key(up.repeat(3),()=>expect(frame()).toContain('Viewing earlier output'));
    const anchor=/line-\d+/.exec(frame())![0];session.busy=true;session.add('\nline-061\nline-062\npartial');
    await vi.waitFor(()=>{expect(frame()).toContain(anchor);expect(frame()).toContain('3 new lines');});
    session.add(' continued');await vi.waitFor(()=>expect(frame()).toContain('3 new lines'));
    session.busy=false;session.emit('change');await key('\x1b[A',()=>expect(frame()).toContain('> first'));
    await key('\x1b[B',()=>expect(frame()).toContain('I can do anything with you.'));
    await key('/',()=>expect(frame()).toContain('› /help'));await key('\x1b[B',()=>expect(frame()).toContain('› /model'));
    await key('\x15',()=>expect(frame()).not.toContain('Tab complete'));
    await key('second',()=>expect(frame()).toContain('> second'));await key('\r',()=>{expect(submit).toHaveBeenCalledWith('second');expect(frame()).not.toContain('Viewing earlier output');});
  }finally{ui.unmount();submit.mockRestore();}
});
it.each(['composer','commands','question','settings','provider'])('consumes split and batched mouse reports in %s and ignores clicks',async state=>{
  const {session,ui,frame,ready,key}=fixture();
  const save=vi.spyOn(session,'saveProviderKey').mockResolvedValue();
  try{
    await ready();
    if(state==='commands')await key('/',()=>expect(frame()).toContain('Tab complete'));
    if(state==='question')session.controller={metadata:{codexThreadId:'root'},requests:new Map([['q',{id:'q',summary:'',questions:[{id:'a',question:'Choose',options:[{label:'One',description:'first'},{label:'Two',description:'second'}]}]}]])} as never;
    if(state==='settings')session.selection={title:'Settings',current:null,options:[{value:'one',label:'One'},{value:'two',label:'Two'}],choose:async()=>{}};
    if(state==='provider')session.providerKeyInput=true;
    session.emit('change');await vi.waitFor(()=>expect(frame()).toContain(state==='question'?'Choose':state==='settings'?'Settings':state==='provider'?'API key':'Ready'));
    ui.stdin.write('\x1b[<64;2;');await key('2M'+up+'\x1b[<0;2;2M\x1b[<0;2;2m',()=>expect(frame()).toContain('Viewing earlier output'));
    expect(frame()).not.toMatch(/\[<|64;2|2M|2m/);
    const before=frame();await key('\x1b[<0;9;9M\x1b[<1;9;9m',()=>expect(frame()).toBe(before));
    if(state==='commands'||state==='settings'||state==='question')await key('\x1b[B',()=>expect(frame()).toContain(state==='commands'?'› /model':'› Two'));
    if(state==='composer')await key('hello',()=>expect(frame()).toContain('> hello'));
    if(state==='provider'){await key('abc',()=>expect(frame()).toContain('***'));await key('\r',()=>expect(save).toHaveBeenCalledWith('abc'));}
  }finally{ui.unmount();save.mockRestore();}
});
it('wraps Korean and bold spans before slicing, retains literal fences and caches unchanged lines',()=>{
  const level=chalk.level;chalk.level=3;
  try{
    const colors=palette('auto',{});const state={fence:'',user:false};
    const line=formatLine('Hera: **가나다라마바사아자차**',state,0);const rows=wrappedRows(line,12,colors);
    expect(rows.length).toBeGreaterThan(1);expect(rows.every(row=>stringWidth(row)<=12)).toBe(true);
    expect(rows.map(stripAnsi).join('')).toBe('Hera: 가나다라마바사아자차');expect(rows.at(-1)).toContain('\x1b[1m');
    expect(wrappedRows(line,12,colors)).toBe(rows);
    formatLine('```',state,1);const code=formatLine('**literal**',state,2);
    expect(wrappedRows(code,12,colors).map(stripAnsi).join('')).toBe('**literal**');
    expect(wrappedRows(line,12,palette('never',{})).join('')).not.toMatch(/\x1b\[(?:38;|3[0-7]m)/);
  }finally{chalk.level=level;}
});
it('consumes SGR reports split at every byte boundary and restores stdin on setup failure',()=>{
  for(let at=1;at<up.length;at++){
    const chunks:(string|null)[]=[up.slice(0,at),null];const stdin={read:()=>chunks.shift()??null,emit:()=>true};const read=stdin.read;
    const scroll=vi.fn();const stdout=new Writable({write(_chunk,_encoding,done){done();}});
    const restore=transcriptInput(stdin,stdout,scroll);
    expect(stdin.read()).toBeNull();chunks.push(up.slice(at),null);expect(stdin.read()).toBeNull();expect(scroll).toHaveBeenCalledExactlyOnceWith(-1,false);
    restore();expect(stdin.read).toBe(read);stdout.destroy();
  }
  const stdin={read:()=>null,emit:()=>true};const read=stdin.read;
  const stdout=Object.assign(new Writable(),{isTTY:true,write:()=>{throw new Error('closed terminal');}});
  expect(()=>transcriptInput(stdin,stdout,()=>{})).toThrow('closed terminal');expect(stdin.read).toBe(read);stdout.destroy();
});
it('keeps the composer caret row and footer visible for an input taller than the terminal',async()=>{
  const {ui,frame,ready,key}=fixture();
  try{
    await ready();const text=Array.from({length:40},(_,i)=>`draft-${i}`).join('\n');
    await key('\x1b[200~'+text+'\x1b[201~',()=>{expect(frame()).toContain('draft-39');expect(frame()).toContain('HERA Design');expect(frame().split('\n').length).toBeLessThanOrEqual(20);});
    expect(frame()).not.toContain('draft-0');
  }finally{ui.unmount();}
});
it('keeps the logical top anchor on resize and pins a multiline composer and open command list',async()=>{
  const {session,ui,frame,ready,key}=fixture();const submit=vi.spyOn(session,'submit').mockResolvedValue();
  try{
    await ready();await key(up.repeat(4),()=>expect(frame()).toContain('Viewing earlier output'));const anchor=/line-\d+/.exec(frame())![0];
    Object.defineProperty(ui.stdout,'columns',{get:()=>60});ui.stdout.emit('resize');await vi.waitFor(()=>expect(frame().split('\n')[0]).toBe(anchor));
    await key(down.repeat(40),()=>expect(frame()).toContain(marker(60)));
    await key('\x1b[200~a\nb\nc\x1b[201~',()=>{expect(frame()).toContain('> a\nb\nc');expect(frame().split('\n').length).toBeLessThanOrEqual(20);});
    await key('\r',()=>expect(submit).toHaveBeenCalledWith('a\nb\nc'));
    await key('/',()=>{expect(frame()).toContain('Tab complete');expect(frame()).toContain('HERA Design');expect(frame().split('\n').length).toBeLessThanOrEqual(20);});
  }finally{ui.unmount();submit.mockRestore();}
});
it.each(['quit','stop'])('disables mouse reports before alternate-screen exit (%s)',async mode=>{
  const session=new InteractiveSession('unused','fixture',structuredClone(defaults),true);
  const frames:string[]=[];const stdout=new Writable({write(chunk,_encoding,done){frames.push(String(chunk));done();}});Object.assign(stdout,{isTTY:true,columns:80,rows:20});
  const stdin=new PassThrough();Object.assign(stdin,{isTTY:true,setRawMode:()=>stdin});const original=stdin.read;
  const ui=renderInk(<App session={session}/>,{stdout,stdin,interactive:true,alternateScreen:true,exitOnCtrlC:false,patchConsole:false});
  try{
    await ui.waitUntilRenderFlush();await vi.waitFor(()=>expect(frames.join('')).toContain('\x1b[?1006h'));
    if(mode==='quit')session.emit('quit');else{await session.close();ui.unmount();}
    await ui.waitUntilExit();const text=frames.join('');
    expect(text.indexOf('\x1b[?1000h')).toBeGreaterThan(text.indexOf('\x1b[?1049h'));
    expect(text.indexOf('\x1b[?1006l')).toBeGreaterThan(text.indexOf('\x1b[?1006h'));
    expect(text.indexOf('\x1b[?1000l')).toBeLessThan(text.indexOf('\x1b[?1049l'));
    expect(stdin.read).toBe(original);
  }finally{ui.unmount();stdin.destroy();stdout.destroy();}
});
