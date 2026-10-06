import React,{useState} from 'react';
import {Box,Text,useInput,usePaste} from 'ink';
import type {ApplyReview as Review} from '../session/apply-review.js';
import {safeText} from '../errors.js';

export function ApplyReview({review,rows,columns,language,approve,cancel}:{review:Review;rows:number;columns:number;language:'ko'|'en';approve:()=>void;cancel:()=>void}){
  const ko=language==='ko';const width=Math.max(10,Math.floor((columns-6)/2));
  // Conservative wrapping keeps wide Korean characters visible without terminal-width dependencies.
  const lines=review.text.split('\n').flatMap(line=>{const chars=Array.from(line.replaceAll('\t','    '));return chars.length?Array.from({length:Math.ceil(chars.length/width)},(_,i)=>chars.slice(i*width,(i+1)*width).join('')):[''];});
  const size=Math.max(1,rows-6);const [page,setPage]=useState(0);const last=Math.max(0,Math.ceil(lines.length/size)-1);
  usePaste(()=>{});
  useInput((input,key)=>{if(key.escape||key.ctrl&&input==='c'){cancel();return;}if(key.downArrow||key.pageDown||key.return){setPage(p=>Math.min(last,p+1));return;}if(key.upArrow||key.pageUp){setPage(p=>Math.max(0,p-1));return;}if(input==='a'&&page===last)approve();});
  return <Box borderStyle="single" flexDirection="column"><Text bold>{ko?'적용 검토':'Review application'} · {page+1}/{last+1}</Text>
    <Text>{safeText(lines.slice(page*size,(page+1)*size).join('\n'))}</Text>
    <Text>{ko?'승인 범위: 이 작업 폴더 쓰기 및 표시된 테스트. 네트워크·워커 비활성.':'Approval: workspace writes and listed tests. Network and workers disabled.'}</Text>
    <Text>{page===last?(ko?'a 승인 · Esc 취소':'a approve · Esc cancel'):(ko?'↓/Enter 다음 · ↑ 이전 · Esc 취소':'↓/Enter next · ↑ previous · Esc cancel')}</Text>
  </Box>;
}
