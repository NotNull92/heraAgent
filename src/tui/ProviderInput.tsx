import React,{useEffect,useRef,useState} from 'react';
import {Box,Text,useInput,usePaste} from 'ink';
import {safeText} from '../errors.js';
export function ProviderKeyInput({save,cancel,language}:{save:(key:string)=>void;cancel:()=>void;language:'ko'|'en'}){
  const secret=useRef('');const [length,setLength]=useState(0);const [invalid,setInvalid]=useState(false);const ko=language==='ko';
  const append=(text:string)=>{if(!/^[\x21-\x7e]*$/.test(text)||secret.current.length+text.length>2048){setInvalid(true);return;}secret.current+=text;setLength(secret.current.length);setInvalid(false);};
  useEffect(()=>()=>{secret.current='';},[]);
  usePaste(text=>append(text.trim()));
  useInput((input,key)=>{if(key.escape||key.ctrl&&input==='c'){secret.current='';cancel();return;}if(key.return){if(secret.current){const value=secret.current;secret.current='';save(value);}return;}if(key.backspace||key.delete){secret.current=secret.current.slice(0,-1);setLength(secret.current.length);return;}if(!key.ctrl&&!key.meta)append(input);});
  return <Box borderStyle="single" flexDirection="column"><Text bold>OpenCode Go · API key</Text><Text>{ko?'키를 붙여넣으세요. OS 자격 증명 저장소에 저장됩니다.':'Paste your key. It will be saved in the OS credential store.'}</Text><Text>{'*'.repeat(Math.min(length,60))||' '}</Text>{invalid&&<Text color="red">{ko?'공백·제어 문자가 없는 키를 입력하세요 (최대 2048자).':'Use a key without spaces or controls (maximum 2048 characters).'}</Text>}<Text>{ko?'Enter 저장 · Esc 취소':'Enter save · Esc cancel'}</Text></Box>;
}
export function ProviderLogin({text,cancel,quit}:{text:string;cancel:()=>void;quit:()=>void}){
  usePaste(()=>{});useInput((input,key)=>{if(key.escape||key.ctrl&&input==='c')cancel();if(key.ctrl&&input==='q')quit();});
  return <Box borderStyle="single" flexDirection="column"><Text>{safeText(text)}</Text><Text>Esc / Ctrl+C: cancel · Ctrl+Q: quit</Text></Box>;
}
