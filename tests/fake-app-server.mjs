import {createInterface} from 'node:readline';
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const thread={id:'fixture-thread',cwd:process.cwd(),modelProvider:'openai',status:{type:'idle'},turns:[]};
createInterface({input:process.stdin}).on('line',line=>{
  const {id,method,params}=JSON.parse(line);if(id===undefined)return;
  let result;
  switch(method){
    case 'initialize':result={userAgent:'hera/0.160.1 (fixture)',codexHome:process.cwd(),platformOs:'windows'};break;
    case 'account/read':result={account:{type:'chatgpt'},requiresOpenaiAuth:true};break;
    case 'model/list':result={data:[{id:'fixture-gpt',model:'fixture-gpt',displayName:'Fixture only',supportedReasoningEfforts:[{reasoningEffort:'low'}]}],nextCursor:null};break;
    case 'thread/start':case 'thread/resume':result={thread,model:params.model,modelProvider:'openai',sandbox:{type:'readOnly'}};break;
    case 'thread/read':result={thread};break;
    case 'turn/start':{
      send({method:'item/agentMessage/delta',params:{threadId:thread.id,turnId:'fixture-turn',itemId:'text',delta:'한글 fixture'}});
      send({method:'turn/completed',params:{threadId:thread.id,turn:{id:'fixture-turn',status:'completed'}}});
      result={turn:{id:'fixture-turn',status:'inProgress'}};break;
    }
    case 'turn/interrupt':result={};break;
    default:send({id,error:{code:-32601,message:'Fixture unsupported method'}});return;
  }
  send({id,result});
});
