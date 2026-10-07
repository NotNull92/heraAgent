import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {GO_MODEL} from '../dist/providers/opencode-go.js';
import {GO_PROVIDER,GO_EFFORT,ASTRA_ROLE} from '../dist/codex/external-runtime.js';
if(!process.argv.includes('--live'))throw new Error('Opt-in: --live. One Go parent/Astra child, 180 seconds, read-only.');
const home=await heraHome();const {config}=await loadConfig(home);config.mode='adaptive';
const cwd=await mkdtemp(join(tmpdir(),'hera-adaptive-native-'));const client=await CodexClient.session(home,cwd,config,'read-only',true);
let root,turn,timer;const children=new Set();
try{
  client.on('request',r=>client.rpc.respond(r.id,{decision:'decline'}));
  const session=await client.start({cwd,model:GO_MODEL,modelProvider:GO_PROVIDER,sandbox:'read-only',approvalPolicy:'never',config:client.sessionSettings});root=session.thread.id;
  assert.equal(session.modelProvider,GO_PROVIDER);assert.equal(session.model,GO_MODEL);
  console.log(JSON.stringify({root,mode:'adaptive',rootModel:session.model,planner:config.main.model}));
  const done=new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(new Error('Adaptive native deadline')),180000);
    client.on('fault',reject);client.on('event',e=>{if(e.method==='item/completed'&&e.params.item.type==='collabAgentToolCall')for(const id of e.params.item.receiverThreadIds??[])children.add(id);if(e.method==='turn/completed'&&e.params.threadId===root)resolve(e.params.turn);});
  });void done.catch(()=>{});
  turn=(await client.turn({threadId:root,effort:GO_EFFORT,input:[{type:'text',text_elements:[],text:`This is an authorized routing test. Spawn exactly one native ${ASTRA_ROLE} worker with fork_context=false, no model/effort overrides. Ask it for a two-sentence plan for a to-do app, no tools, files, web or other agents. Wait for its completion, then relay the plan in Korean. Do not do the planning yourself and do not call any shell or web tools.`}]})).id;
  assert.equal((await done).status,'completed');assert.equal(children.size,1);
  const child=await client.read([...children][0]);assert.equal(child.modelProvider,'openai');assert.equal(child.model,config.main.model);assert.equal(child.reasoningEffort,config.main.reasoningEffort);assert.equal(child.turns.at(-1).status,'completed');
  console.log(JSON.stringify({adaptiveNative:'pass',root,child:child.id,parentModel:GO_MODEL,childModel:child.model,childEffort:child.reasoningEffort}));
}finally{clearTimeout(timer);for(const id of [root,...children].filter(Boolean)){const t=await client.read(id).catch(()=>null);for(const turn of t?.turns??[])if(turn.status==='inProgress')await client.interrupt(id,turn.id).catch(()=>{});await client.cleanBackgroundTerminals(id).catch(()=>{});}if(!await client.close())process.exitCode=5;}
