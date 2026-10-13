import React from 'react';
import {it,expect,vi} from 'vitest';
import {render} from 'ink-testing-library';
import {NativePrompt} from '../src/tui/NativePrompt.js';
import type {NativeRequest} from '../src/session/controller.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,70));
const settled=async(check:()=>boolean)=>{for(let i=0;i<40;i++){await tick();if(check())return true;}return false;};
const request:NativeRequest={id:'question',threadId:'root',turnId:'turn',itemId:'item',summary:'fixture',questions:[
  {id:'scope',header:'Scope',question:'어떤 범위로 할까요?',isSecret:false,options:[{label:'하나',description:'한 파일'},{label:'모두',description:'모든 파일'}]},
  {id:'name',header:'Name',question:'이름은 무엇인가요?',isSecret:false,options:[{label:'기본',description:'기본 이름'},{label:'대안',description:'대안 이름'}]},
  {id:'note',header:'Note',question:'추가 설명은?',isSecret:false,options:null}
]};
for(const language of ['ko','en'] as const){
  it(`selects, types literal free text and completes three questions (${language})`,async()=>{
    const answer=vi.fn();const ui=render(<NativePrompt request={request} language={language} rows={12} answer={answer} quit={()=>{}}/>);
    const shown=async(text:string)=>expect(await settled(()=>ui.lastFrame()?.includes(text)??false)).toBe(true);
    const key=async(value:string,text:string)=>{ui.stdin.write(value);await shown(text);};
    try{
      await shown(language==='ko'?'직접 입력':'Type an answer');
      expect(ui.lastFrame()).not.toMatch(/↑↓|Enter|Esc/);
      await key('\x1b[B','› 모두');await key('\x1b[A','› 하나');await key('\x1b[B','› 모두');await key('\r','이름은 무엇인가요?');expect(answer).not.toHaveBeenCalled();
      await key('\x1b[B','› 대안');await key('\x1b[B',language==='ko'?'› 직접 입력':'› Type an answer');await key('\r','>');
      await key('/help','/help');expect(ui.lastFrame()).not.toMatch(/Tab|Show command help|명령어 도움말/);
      await key('\r','추가 설명은?');expect(answer).not.toHaveBeenCalled();
      await key('\x1b[200~/tmp/한글\x1b[201~','/tmp/한글');ui.stdin.write('\r');
      expect(await settled(()=>answer.mock.calls.length>0)).toBe(true);
      expect(answer).toHaveBeenCalledExactlyOnceWith({scope:{answers:['모두']},name:{answers:['/help']},note:{answers:['/tmp/한글']}});
    }finally{ui.unmount();}
  });
  it(`Escape cancels all answers from the picker or text input (${language})`,async()=>{
    for(const typing of [false,true]){
      const answer=vi.fn();const ui=render(<NativePrompt request={request} language={language} rows={12} answer={answer} quit={()=>{}}/>);
      const shown=async(text:string)=>expect(await settled(()=>ui.lastFrame()?.includes(text)??false)).toBe(true);
      const key=async(value:string,text:string)=>{ui.stdin.write(value);await shown(text);};
      try{
        await shown('› 하나');await key('\r','이름은 무엇인가요?');
        if(typing){await key('\x1b[B','› 대안');await key('\x1b[B',language==='ko'?'› 직접 입력':'› Type an answer');await key('\r','>');await key('draft','draft');}
        ui.stdin.write('\x1b');expect(await settled(()=>answer.mock.calls.length>0)).toBe(true);expect(answer).toHaveBeenCalledExactlyOnceWith({});
      }finally{ui.unmount();}
    }
  });
}
