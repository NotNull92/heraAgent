import React from 'react';
import {it,expect} from 'vitest';
import {render} from 'ink-testing-library';
import {App} from '../src/tui/App.js';
import {InteractiveSession} from '../src/session/interactive.js';
import {defaults} from '../src/config.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,70));
// Ink repaints asynchronously; under full-suite load one tick is not always enough.
const until=async(ready:()=>boolean)=>{for(let i=0;i<40&&!ready();i++)await tick();};
it('names what the root thread is doing while nothing is printed, and clears it when text streams',async()=>{
  const session=new InteractiveSession('unused','fixture',structuredClone(defaults),true);
  const snapshot=new Map([['astra-child',{modelProvider:'openai'}],['go-child',{modelProvider:'hera_opencode_go'}]]);
  session.controller={metadata:{codexThreadId:'root'},workers:{snapshot,activeCount:0},requests:new Map(),review:null,collaborationEnabled:false} as never;
  session.busy=true;session.status='Working';
  const ui=render(<App session={session}/>);await tick();
  const started=(threadId:string,item:Record<string,unknown>)=>session.observe({method:'item/started',params:{threadId,item}});
  session.observe({method:'item/reasoning/textDelta',params:{threadId:'root',delta:'…'}});await until(()=>/생각 중/.test(ui.lastFrame()??''));expect(ui.lastFrame()).toMatch(/생각 중 0:0\d/);
  started('root',{type:'mcpToolCall',server:'hera_web',tool:'load_instructions'});expect(session.activity).toBe('핸드북 읽는 중');
  started('root',{type:'collabAgentToolCall',tool:'spawnAgent',receiverThreadIds:['astra-child']});expect(session.activity).toBe('Astra에게 맡기는 중');
  started('root',{type:'collabAgentToolCall',tool:'wait',receiverThreadIds:['go-child']});expect(session.activity).toBe('워커 답 기다리는 중');
  // A worker's own events never change the root's activity line.
  started('go-child',{type:'reasoning'});expect(session.activity).toBe('워커 답 기다리는 중');
  session.observe({method:'item/completed',params:{threadId:'root',item:{type:'collabAgentToolCall'}}});expect(session.activity).toBe('응답 기다리는 중');
  session.observe({method:'item/agentMessage/delta',params:{threadId:'root',delta:'안녕'}});await until(()=>!(ui.lastFrame()??'').includes('기다리는 중'));
  expect(session.activity).toBe('');expect(ui.lastFrame()).not.toContain('기다리는 중');expect(session.transcript).toContain('안녕');
  ui.unmount();
});
