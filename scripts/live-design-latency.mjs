import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Controller} from '../dist/session/controller.js';
import {CodexClient} from '../dist/codex/client.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig,designEffort} from '../dist/config.js';

assert(process.argv.includes('--live'),'Opt-in --live required: three fresh Design sessions and one Astra consultation.');
const home=await heraHome();const {config}=await loadConfig(home);config.mode='adaptive';
const measurements=[];
for(let sample=1;sample<=3;sample++){
  const cwd=await mkdtemp(join(tmpdir(),'hera-design-latency-'));
  const client=await CodexClient.session(home,cwd,config,'workspace-write',true,true);
  const controller=new Controller(client,home,cwd,config,true,true);
  let timer;
  try{
    controller.lock=await acquireWorkspace(home,cwd);await controller.start();
    const prompts=[['greeting','안녕?'],['factual','HTTP/2와 HTTP/1.1 차이 설명해줘'],['identity','지금 답변하고 있는건 딥시크지?']];
    if(sample===3)prompts.push(['design','오프라인 우선 할 일 앱의 동기화 설계안을 추천해줘']);
    for(const [name,prompt] of prompts){
      const events=[];let firstTextMs=null;let firstText='';const started=performance.now();
      const observe=e=>{events.push(e);if(e.method==='item/agentMessage/delta'&&e.params.threadId===controller.metadata.codexThreadId&&e.params.delta){firstTextMs??=Math.round(performance.now()-started);if(firstText.length<160)firstText+=e.params.delta;}};
      controller.on('event',observe);
      try{
        const result=await Promise.race([controller.run(prompt),new Promise((_,reject)=>{timer=setTimeout(()=>{void controller.interrupt().catch(()=>{});reject(new Error(`${name} exceeded 180 seconds`));},180000);})]);
        const elapsedMs=Math.round(performance.now()-started);const thread=await client.read(result.threadId);const items=thread.turns.at(-1).items;
        assert(firstTextMs!==null,'Expected streamed root text');
        assert(!items.some(i=>i.type==='mcpToolCall'&&i.tool==='load_instructions'&&i.arguments.topic==='coding'),'Design must never load the coding handbook');
        if(name==='greeting'){
          const handbook=await readFile(new URL('../assets/codex/research-instructions.md',import.meta.url),'utf8');
          const trace=(await readFile(thread.path,'utf8')).trim().split('\n').map(JSON.parse);
          assert(trace.some(e=>e.type==='response_item'&&e.payload.type==='message'&&e.payload.role==='developer'&&e.payload.content.some(c=>c.text?.includes(handbook.trimEnd()))),'Full research handbook must be in native developer instructions');
        }
        if(name!=='design'){
          assert(items.every(i=>['userMessage','agentMessage','reasoning'].includes(i.type)),'Direct answers must not load handbooks, execute commands or spawn workers');
          if(name==='factual')assert.match(firstText,/HTTP/,'First text must contain an answer, not a waiting notice');
          if(name==='identity')assert(items.some(i=>i.type==='agentMessage'&&/딥시크|DeepSeek/i.test(i.text)));
        }else{
          const spawns=items.filter(i=>i.type==='collabAgentToolCall'&&i.tool==='spawnAgent');assert.equal(spawns.length,1);
          const spawnIndex=items.indexOf(spawns[0]);
          const announcement=items.slice(0,spawnIndex).find(i=>i.type==='agentMessage'&&/Astra|아스트라/i.test(i.text)&&/[가-힣]/u.test(i.text));assert(announcement);
          const delta=events.findIndex(e=>e.method==='item/agentMessage/delta'&&e.params.itemId===announcement.id);
          assert(delta>=0&&delta<events.findIndex(e=>e.method==='item/started'&&e.params.item.id===spawns[0].id));
          assert(items.slice(spawnIndex+1).some(i=>i.type==='collabAgentToolCall'&&i.tool==='wait'));
          await controller.workers.assertIdle(client,true);
          assert(spawns[0].receiverThreadIds.some(id=>{const worker=controller.workers.snapshot.get(id);return worker?.modelProvider==='openai'&&worker.model===config.main.model&&worker.reasoningEffort===config.main.reasoningEffort;}));
          const trace=(await readFile(thread.path,'utf8')).trim().split('\n').map(JSON.parse);
          const calls=trace.filter(row=>row.type==='response_item'&&row.payload.type==='function_call'&&row.payload.name==='spawn_agent');assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].payload.arguments).agent_type,'hera_astra');
        }
        const usage=events.findLast(e=>e.method==='thread/tokenUsage/updated'&&e.params.threadId===result.threadId)?.params.tokenUsage.last;
        if(name!=='design'&&designEffort(config)==='none')assert.equal(usage?.reasoningOutputTokens,0,'Direct root must not spend hidden reasoning tokens');
        const measurement={sample,name,firstTextMs,elapsedMs,effort:designEffort(config),threadId:result.threadId,usage,firstText:firstText.slice(0,160)};
        measurements.push(measurement);console.log(JSON.stringify(measurement));
      }finally{clearTimeout(timer);controller.off('event',observe);}
    }
  }finally{clearTimeout(timer);assert(await controller.close(),'Fixture cleanup must complete');}
}
const slow=measurements.filter(m=>m.name!=='design'&&m.firstTextMs>5000);
assert.equal(slow.length,0,`Direct first-text target is 5 seconds: ${JSON.stringify(slow.map(({sample,name,firstTextMs})=>({sample,name,firstTextMs})))}`);
console.log(JSON.stringify({designLatency:'pass',directSamples:9,firstTextBudgetMs:5000,designDeadlineMs:180000}));
