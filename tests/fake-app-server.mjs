import {createInterface} from 'node:readline';
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const thread={id:'fixture-thread',cwd:process.cwd(),modelProvider:'openai',status:{type:'idle'},turns:[]};
createInterface({input:process.stdin}).on('line',line=>{
  const {id,method,params,result:answer}=JSON.parse(line);if(id===undefined)return;
  if(id==='native-approval'&&!method){send({method:'fixture/decision',params:answer});thread.turns[0].status='completed';send({method:'serverRequest/resolved',params:{threadId:thread.id,requestId:id}});send({method:'turn/completed',params:{threadId:thread.id,turn:{id:'fixture-turn',status:'completed'}}});return;}
  let result;
  switch(method){
    case 'initialize':result={userAgent:'hera/0.161.0 (fixture)',codexHome:process.cwd(),platformOs:'windows'};break;
    case 'account/read':result={account:{type:'chatgpt'},requiresOpenaiAuth:true};break;
    case 'model/list':result={data:[{id:'fixture-gpt',model:'fixture-gpt',displayName:'Fixture only',supportedReasoningEfforts:[{reasoningEffort:'low'}]}],nextCursor:null};break;
    case 'config/read':result={config:{agents:{enabled:false},features:{multi_agent:false,multi_agent_v2:false,apps:false,plugins:false,hooks:false,browser_use:false,computer_use:false,request_permissions_tool:false},shell_environment_policy:{inherit:'core'},web_search:'disabled',mcp_servers:{hera_web:{url:'http://127.0.0.1:0/unavailable',environment_id:'local',enabled:false,required:false,startup_timeout_sec:20,tool_timeout_sec:90,default_tools_approval_mode:'approve',enabled_tools:['web_search','web_fetch'],tools:{web_search:{output_token_limit:1500},web_fetch:{output_token_limit:2000}}}}}};break;
    case 'thread/start':case 'thread/resume':result={thread,model:params.model,modelProvider:'openai',sandbox:{type:'readOnly'}};break;
    case 'thread/read':result={thread};break;
    case 'thread/loaded/list':result={data:['fixture-thread'],nextCursor:process.argv[2]==='loaded-cycle'?'same-cursor':null};break;
    case 'turn/start':{
      if(process.argv[2]==='native-approval'){
        thread.turns=[{id:'fixture-turn',status:'inProgress',items:[]}];
        send({id:'native-approval',method:'item/commandExecution/requestApproval',params:{threadId:thread.id,turnId:'fixture-turn',itemId:'fixture-command',command:'fixture-only',cwd:thread.cwd,reason:'fixture scope'}});
        result={turn:{id:'fixture-turn',status:'inProgress'}};break;
      }
      if(['active-child-command','active-main-command'].includes(process.argv[2]))send({method:'item/started',params:{threadId:process.argv[2]==='active-child-command'?'fixture-child':thread.id,item:{id:'pending-command',type:'commandExecution',status:'inProgress',exitCode:null}}});
      if(process.argv[2]==='interrupt-order'){
        const item={id:'late-command',type:'commandExecution',status:'failed',exitCode:-1};
        send({method:'item/started',params:{threadId:thread.id,item:{...item,status:'inProgress',exitCode:null}}});
        thread.turns=[{id:'fixture-turn',status:'interrupted',items:[item]}];
        send({method:'turn/completed',params:{threadId:thread.id,turn:{id:'fixture-turn',status:'interrupted'}}});
        result={turn:{id:'fixture-turn',status:'inProgress'}};break;
      }
      send({method:'item/agentMessage/delta',params:{threadId:thread.id,turnId:'fixture-turn',itemId:'text',delta:'한글 fixture'}});
      send({method:'turn/completed',params:{threadId:thread.id,turn:{id:'fixture-turn',status:'completed'}}});
      result={turn:{id:'fixture-turn',status:'inProgress'}};break;
    }
    case 'turn/interrupt':result={};break;
    case 'thread/backgroundTerminals/clean':result={};break;
    case 'thread/backgroundTerminals/list':result={data:process.argv[2]==='cleanup-pending'?[{processId:'still-running'}]:[],nextCursor:null};break;
    case 'windowsSandbox/readiness':result={status:'ready'};break;
    case 'windowsSandbox/setupStart':{
      const scenario=process.argv[2];
      if(scenario==='sandbox-silent'){result={started:true};break;}
      send({method:'windowsSandbox/setupCompleted',params:{mode:params.mode,success:scenario!=='sandbox-fail',error:scenario==='sandbox-fail'?'Fixture setup failure':null}});
      result={started:scenario!=='sandbox-not-started'};break;
    }
    default:send({id,error:{code:-32601,message:'Fixture unsupported method'}});return;
  }
  send({id,result});
});
