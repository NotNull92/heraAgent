import React,{useState} from 'react';
import type {NativeRequest} from '../session/controller.js';
import {SettingsPicker} from './SettingsPicker.js';
import {Composer} from './Composer.js';
import {Text} from './theme.js';
import {safeText} from '../errors.js';

export function NativePrompt({request,language,rows,answer,quit}:{request:NativeRequest;language:'ko'|'en';rows:number;answer:(value:'accept'|'decline'|Record<string,{answers:string[]}>)=>void;quit:()=>void}){
  const [index,setIndex]=useState(0);const [typing,setTyping]=useState(false);const [answers,setAnswers]=useState<Record<string,{answers:string[]}>>({});const ko=language==='ko';
  const question=request.questions?.[index];const cancel=()=>answer(request.questions?{}:'decline');
  const respond=(value:string)=>{if(!question)return;const next={...answers,[question.id]:{answers:[value]}};if(index+1===request.questions!.length)answer(next);else{setAnswers(next);setIndex(index+1);setTyping(false);}};
  if(question?.isSecret)return <><Text>{ko?'비밀 정보는 /providers에서 설정하세요.':'Configure secrets with /providers.'}</Text><SettingsPicker menu={{title:question.header,current:'cancel',options:[{value:'cancel',label:ko?'질문 취소':'Cancel question'}],choose:async()=>{}}} language={language} rows={rows} choose={cancel} cancel={cancel} quit={quit}/></>;
  if(question&&(typing||!question.options?.length))return <><Text>{safeText(question.question)}</Text><Composer language={language} busy={false} send={respond} cancel={cancel} quit={quit}/></>;
  const options=question?[...question.options!.map((o,i)=>({value:String(i),label:`${o.label} · ${o.description}`})),{value:'text',label:ko?'직접 입력':'Type an answer'},{value:'cancel',label:ko?'취소':'Cancel'}]:[{value:'decline',label:ko?'거절':'Decline'},{value:'accept',label:ko?'위 작업을 이번 한 번 허용':'Allow the action above once'}];
  return <SettingsPicker key={question?.id??'approval'} menu={{title:question?.question??(ko?'추가 권한 요청 · 위 작업 내용 확인':'Extra permission · review the action above'),current:question?null:'decline',options,choose:async()=>{}}} language={language} rows={rows} choose={value=>{if(!question){answer(value==='accept'?'accept':'decline');return;}if(value==='cancel')cancel();else if(value==='text')setTyping(true);else respond(question.options![Number(value)]!.label);}} cancel={cancel} quit={quit}/>;
}
