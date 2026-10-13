import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tempFixture} from './temp-fixture.mjs';
import {Controller} from '../dist/session/controller.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {nativeCapability} from '../dist/codex/capabilities.js';

assert(process.argv.includes('--live'),'Opt-in --live required: three bounded Development question turns, selected answer and headless run/resume.');
const home=await heraHome();const {config}=await loadConfig(home);config.mode='external_workers';
const qualification=await nativeCapability(home,config);assert(qualification.ready,qualification.reason);
const cwd=await tempFixture('hera-native-questions-');
await writeFile(join(cwd,'values.json'),'[-12,7,3]\n');
let controller;let timer;let previous;
try{
  for(const stage of ['selected','headless-run','headless-resume']){
    controller=await Controller.open(home,cwd,config,false,stage==='headless-resume'?previous:undefined);
    if(stage==='headless-resume')assert.equal(controller.metadata.codexThreadId,previous.codexThreadId);
    const effective=await controller.client.rpc.request('config/read',{cwd,includeLayers:false});
    assert.equal(effective.config.features.default_mode_request_user_input,true);
    const requests=[];const responses=[];const pending=new Set();
    controller.client.on('request',request=>{
      if(request.method==='item/tool/requestUserInput'){
        requests.push(request);pending.add(request.id);
      }
    });
    const respond=controller.client.rpc.respond.bind(controller.client.rpc);
    controller.client.rpc.respond=(id,value)=>{if(pending.has(id))responses.push(value);return respond(id,value);};
    let chosen;
    if(stage==='selected')controller.on('requests',()=>{
      for(const request of controller.requests.values()){
        if(!request.questions){controller.answerRequest(request.id,'decline');continue;}
        const answers={};
        for(const question of request.questions){
          const option=question.options?.find(o=>/절댓값|절대값|absolute/i.test(o.label+' '+o.description));
          assert(option,'Expected an absolute-magnitude interpretation among the options');chosen=option.label;
          answers[question.id]={answers:[option.label]};
        }
        controller.answerRequest(request.id,answers);
      }
    });
    console.log(JSON.stringify({stage,threadId:controller.metadata.codexThreadId,deadlineSeconds:180}));
    const output=stage+'.txt';
    const prompt=`values.json에서 '가장 큰 값'을 골라 ${output}에 숫자 하나로 저장해줘. 대수적 최댓값이면 7이고, 절댓값이 가장 큰 원래 값이면 -12라 결과가 달라. 어느 기준인지는 아직 정하지 않았어. ${stage==='headless-resume'?'이것은 앞선 작업과 독립적인 결정이므로 이전 가정을 재사용하지 말고 기준을 새로 질문해줘. ':''}이 작은 작업은 직접 처리하고 워커나 웹은 쓰지 마. values.json은 바꾸지 마.`;
    const result=await Promise.race([controller.run(prompt),new Promise((_,reject)=>{timer=setTimeout(()=>{void controller.interrupt().catch(()=>{});reject(new Error(stage+' exceeded 180 seconds'));},180000);})]);
    clearTimeout(timer);assert.equal(result.status,'completed');assert.equal(controller.workers.count,0);
    assert.equal(requests.length,1,'One native question request, without a retry after empty answers');
    assert.equal(responses.length,1);
    const request=requests[0];assert.equal(request.params.threadId,result.threadId);assert.equal(request.params.isBlocking,false);
    assert(request.params.questions.length>=1&&request.params.questions.length<=3);
    for(const question of request.params.questions){assert(question.options.length>=2&&question.options.length<=3);assert.equal(question.isOther,true);}
    const thread=await controller.client.read(result.threadId);
    const trace=(await readFile(thread.path,'utf8')).trim().split('\n').map(JSON.parse);
    assert(trace.some(row=>row.type==='turn_context'&&row.payload.collaboration_mode?.mode==='default'),'Question must run in Default collaboration mode');
    const value=(await readFile(join(cwd,output),'utf8')).trim();
    if(stage==='selected')assert.equal(value,'-12','Output must follow the selected absolute-magnitude answer');
    else{
      assert.deepEqual(responses[0],{answers:{}});assert(['7','-12'].includes(value));
      const final=thread.turns.at(-1).items.filter(item=>item.type==='agentMessage').at(-1)?.text??'';
      assert.match(final,/가정|전제|assum(?:e|ed|ption)/i,'Empty answers must lead to a stated assumption');
    }
    assert.equal(await readFile(join(cwd,'values.json'),'utf8'),'[-12,7,3]\n');
    previous=structuredClone(controller.metadata);
    console.log(JSON.stringify({stage,questions:'pass',requestMethod:request.method,questionCount:request.params.questions.length,chosen,output:value,defaultMode:true,emptyAnswers:stage!=='selected',threadId:result.threadId,fingerprint:qualification.fingerprint}));
    assert(await controller.close());controller=undefined;
  }
}finally{clearTimeout(timer);if(controller&&!await controller.close())process.exitCode=5;}
