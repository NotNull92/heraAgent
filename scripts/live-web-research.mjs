import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Controller} from '../dist/session/controller.js';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {acquireWorkspace} from '../dist/session/workspace-lock.js';
import {verifySearchConfig,SEARCH_SERVER,SEARCH_GUIDANCE} from '../dist/codex/web-research.js';
import {GO_ROLE} from '../dist/codex/external-runtime.js';
import {errorView} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live [--external]. Public Exa queries, one main turn and one worker, 180 seconds; no private query or source upload.');process.exit(4);}
const cwd=await mkdtemp(join(tmpdir(),'hera-web-research-'));const home=await heraHome();const {config}=await loadConfig(home);const external=process.argv.includes('--external');config.mode=external?'external_workers':'gpt_only';
let controller;let client;let expired=false;
const timeout=setTimeout(()=>{expired=true;void controller?.interrupt().catch(()=>{});},180000);
try{
  // Qualification only: the public worker gate remains closed until evidence is reviewed.
  client=await CodexClient.session(home,cwd,config,'read-only',true);
  controller=new Controller(client,home,cwd,config,true);controller.lock=await acquireWorkspace(home,cwd);await controller.start();
  console.error(JSON.stringify({mode:config.mode,main:config.main,deadlineSeconds:180,cwd}));
  await controller.run(`Use exactly one native worker for a public web research check, ${external?`agent_type=${GO_ROLE}, omit model/effort, fork_context=false`:`fork_turns=none, model=${config.workers.gptModel}, reasoning_effort=${config.workers.reasoningEffort}, no custom role`}. Give it the required assignment/result contract and this search policy: ${SEARCH_GUIDANCE} Ask it to call hera_web web_search_exa once with query "Node.js 24 child_process spawn Windows shell false official documentation", objective "Find official Node.js documentation about spawning Windows commands without a shell", numResults=3, and return one official source URL in its final evidence. No shell tools, writes, tests, permissions or child spawns. Wait for completion. You, the main agent, must then call hera_web web_fetch_exa once on that official source with maxCharacters=3000 and explain one supported fact in Korean with its URL. Do not perform additional searches or fetches. If a tool is unavailable report that honestly.`);
  await controller.workers.assertIdle(client,true);assert.equal(controller.workers.count,1);
  const root=controller.metadata.codexThreadId;const child=[...controller.workers.snapshot.values()].find(t=>t.id!==root);
  const calls=thread=>(thread.turns??[]).flatMap(t=>t.items).filter(i=>i.type==='mcpToolCall');
  const search=calls(child).find(i=>i.server===SEARCH_SERVER&&i.tool==='web_search_exa');
  const fetch=calls(await client.read(root)).find(i=>i.server===SEARCH_SERVER&&i.tool==='web_fetch_exa');
  for(const call of [search,fetch]){assert.ok(call,'Expected native MCP call missing');assert.equal(call.status,'completed');assert.equal(call.error,null);assert.ok(call.result);}
  assert.equal(search.arguments.numResults,3);assert.equal(fetch.arguments.maxCharacters,3000);
  assert.ok(fetch.arguments.urls.every(url=>new URL(url).hostname==='nodejs.org'));
  assert.equal(expired,false);console.log(JSON.stringify({webCalls:'pass',mode:config.mode,root,child:child.id}));assert.equal(await controller.close(),true);controller=undefined;
  // No model inference here: check the native disabled catalog and denied tool route.
  client=await CodexClient.session(home,cwd,config,'workspace-write',false);
  const effective=await client.rpc.request('config/read',{cwd,includeLayers:false});verifySearchConfig(effective.config.mcp_servers,false);
  const resumed=await client.resume({threadId:root,cwd,model:config.main.model,modelProvider:'openai',sandbox:'workspace-write',approvalPolicy:'never'});
  assert.equal(resumed.sandbox.type,'workspaceWrite');
  const inventory=await client.rpc.request('mcpServerStatus/list',{threadId:root,limit:100});
  assert.equal(inventory.data.length,1);assert.equal(inventory.nextCursor,null);
  assert.ok(inventory.data.every(server=>server.name===SEARCH_SERVER&&server.runtimeStatus==='disabled'&&Object.keys(server.tools).length===0));
  await assert.rejects(client.rpc.request('mcpServer/tool/call',{threadId:root,server:SEARCH_SERVER,tool:'web_search_exa',arguments:{query:'Node.js',objective:'Official documentation',numResults:1}}),error=>error.errorCode==='RPC_-32603'&&error.message.includes("unknown MCP server 'hera_web'"));
  console.log(JSON.stringify({webResearch:'pass',mode:config.mode,root,child:child.id,workerSearch:search.status,mainFetch:fetch.status,writePhaseSearch:'denied',cwd}));
}catch(error){console.error(JSON.stringify(errorView(error)));process.exitCode=1;}
finally{clearTimeout(timeout);if(controller){if(!await controller.close())process.exitCode=5;}else if(client&&!await client.close())process.exitCode=5;}
