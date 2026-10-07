import {it,expect,vi} from 'vitest';
import {NativeWorkers} from '../src/session/workers.js';
import {defaults} from '../src/config.js';
import type {CodexClient} from '../src/codex/client.js';
import {GO_PROVIDER,GO_EFFORT} from '../src/codex/external-runtime.js';
import {GO_MODEL} from '../src/providers/opencode-go.js';
import {HeraError} from '../src/errors.js';

function fixture(){
  const config=structuredClone(defaults);config.main={model:'main',reasoningEffort:'high'};config.workers.gptModel='worker';config.workers.reasoningEffort='max';
  const make=(id:string,parentThreadId:string|null)=>({id,parentThreadId,cwd:process.cwd(),modelProvider:'openai',model:parentThreadId?'worker':'main',reasoningEffort:parentThreadId?'max':'high',status:{type:'idle'},turns:[{id:id+'-turn',status:'completed',items:[] as Record<string,unknown>[]} ]});
  const rows=new Map([['root',make('root',null)],['child',make('child','root')],['grandchild',make('grandchild','child')],['foreign',make('foreign',null)]]);
  rows.get('root')!.turns[0]!.items.push({type:'subAgentActivity',kind:'started',agentThreadId:'child'});
  rows.get('child')!.turns[0]!.items.push({type:'collabAgentToolCall',tool:'spawnAgent',status:'completed',receiverThreadIds:['grandchild']},{type:'subAgentActivity',kind:'interacted',agentThreadId:'foreign'});
  const loaded=new Set(rows.keys());
  const client={read:vi.fn(async(id:string)=>structuredClone(rows.get(id))),loadedThreads:vi.fn(async()=>loaded),cleanBackgroundTerminals:vi.fn(async()=>{}),rpc:{request:vi.fn(async()=>({data:[],nextCursor:null}))},interrupt:vi.fn(async(id:string)=>{const t=rows.get(id)!;t.status.type='idle';t.turns[0]!.status='interrupted';})} as unknown as CodexClient;
  return {rows,client,tracker:new NativeWorkers('root',process.cwd(),config),loaded,config};
}
it('requires every mixed descendant to stay on Go while the root stays on OpenAI',async()=>{
  const {rows,tracker,client,config}=fixture();config.mode='external_workers';
  for(const id of ['child','grandchild'])Object.assign(rows.get(id)!,{modelProvider:GO_PROVIDER,model:GO_MODEL,reasoningEffort:GO_EFFORT});
  await tracker.assertIdle(client);
  rows.get('grandchild')!.modelProvider='openai';await expect(tracker.refresh(client)).rejects.toMatchObject({errorCode:'WORKER_ROUTING_DRIFT'});
  await tracker.interrupt(client);expect(client.interrupt).not.toHaveBeenCalledWith('foreign',expect.anything());
});
it('routes adaptive routine work to Go and permits only the selected Astra reasoning role',async()=>{const {rows,tracker,client,config}=fixture();config.mode='adaptive';for(const id of ['root','child'])Object.assign(rows.get(id)!,{modelProvider:GO_PROVIDER,model:GO_MODEL,reasoningEffort:GO_EFFORT});Object.assign(rows.get('grandchild')!,{model:'main',reasoningEffort:'high'});await tracker.assertIdle(client);rows.get('grandchild')!.model='worker';await expect(tracker.refresh(client)).rejects.toMatchObject({errorCode:'WORKER_ROUTING_DRIFT'});});
it('recovers recursive V1/V2 children, excludes message recipients, and rejects foreign spawn references and routing drift',async()=>{
  const {rows,tracker,client,loaded}=fixture();await tracker.assertIdle(client,true);expect([...tracker.snapshot.keys()]).toEqual(['root','child','grandchild']);expect(client.cleanBackgroundTerminals).not.toHaveBeenCalledWith('foreign');
  loaded.clear();for(const t of rows.values())t.status.type='notLoaded';await tracker.refresh(client);expect(tracker.count).toBe(2);
  rows.get('child')!.model='wrong';await expect(tracker.refresh(client)).rejects.toMatchObject({errorCode:'WORKER_ROUTING_DRIFT'});rows.get('child')!.model='worker';
  rows.get('child')!.parentThreadId='foreign';await expect(tracker.interrupt(client,0)).rejects.toMatchObject({errorCode:'WORKER_OWNERSHIP_MISMATCH'});expect(client.interrupt).not.toHaveBeenCalled();
});
it('blocks apply for active descendants or background commands and cancels the owned tree without touching another session',async()=>{
  const {rows,tracker,client}=fixture();for(const id of ['root','grandchild']){rows.get(id)!.status.type='active';rows.get(id)!.turns[0]!.status='inProgress';}
  await expect(tracker.assertIdle(client)).rejects.toMatchObject({errorCode:'NOT_QUIESCENT'});await tracker.interrupt(client,0);expect(vi.mocked(client.interrupt).mock.calls.map(c=>c[0])).toEqual(['root','grandchild']);await tracker.assertIdle(client);
  vi.mocked(client.rpc.request).mockResolvedValue({data:[{processId:'running'}],nextCursor:null});await expect(tracker.assertIdle(client)).rejects.toMatchObject({errorCode:'NOT_QUIESCENT'});
});
it('reconciles an already-completed interrupt race but never hides an active or unknown outcome',async()=>{
  const {rows,tracker,client}=fixture();rows.get('root')!.status.type='active';rows.get('root')!.turns[0]!.status='inProgress';rows.get('child')!.status.type='active';rows.get('child')!.turns[0]!.status='inProgress';
  const original=vi.mocked(client.interrupt).getMockImplementation()!;
  vi.mocked(client.interrupt).mockImplementation(async(id,turn)=>{if(id==='root'){rows.get(id)!.status.type='idle';rows.get(id)!.turns[0]!.status='completed';throw new HeraError('RPC_-32600','no active turn to interrupt',5,false);}await original(id,turn);});
  await tracker.interrupt(client);expect(rows.get('child')!.turns[0]!.status).toBe('interrupted');
  rows.get('root')!.status.type='active';rows.get('root')!.turns[0]!.status='inProgress';vi.mocked(client.interrupt).mockRejectedValue(new HeraError('RPC_-32600','no active turn to interrupt',5,false));
  await expect(tracker.interrupt(client)).rejects.toMatchObject({errorCode:'RPC_-32600',outcomeKnown:false});
});
it('requires observable idle state after interruption and discovers a late child before claiming cleanup',async()=>{
  const {rows,tracker,client}=fixture();rows.get('child')!.status.type='active';rows.get('child')!.turns[0]!.status='inProgress';vi.mocked(client.interrupt).mockResolvedValue(undefined);
  await expect(tracker.interrupt(client,0)).rejects.toMatchObject({errorCode:'INTERRUPTED_UNCONFIRMED',outcomeKnown:false});
  rows.get('child')!.status.type='idle';rows.get('child')!.turns[0]!.status='interrupted';rows.get('grandchild')!.parentThreadId='root';rows.get('child')!.turns[0]!.items=[];
  tracker.observe({method:'item/completed',params:{threadId:'root',item:{type:'subAgentActivity',kind:'started',agentThreadId:'grandchild'}}});await tracker.refresh(client);expect(tracker.count).toBe(2);
});
it('uses metadata-only reads strictly before the first turn of a newly created root',async()=>{
  const {rows,client,loaded,config}=fixture();loaded.clear();loaded.add('root');rows.get('root')!.turns=[];
  vi.mocked(client.rpc.request).mockResolvedValue({thread:rows.get('root')});const tracker=new NativeWorkers('root',process.cwd(),config,true);
  await tracker.refresh(client);expect(client.read).not.toHaveBeenCalled();expect(client.rpc.request).toHaveBeenCalledWith('thread/read',{threadId:'root',includeTurns:false});
  tracker.turnStarting();await tracker.refresh(client);expect(client.read).toHaveBeenCalledWith('root');
});
it('accepts only complete current worker contracts and never promotes worker test claims',async()=>{
  const {tracker,client,rows}=fixture();await tracker.refresh(client);
  const assignment={taskId:'task',contractVersion:1,contractHash:'current',goal:'inspect',scope:['sum.cjs'],sharedInterfaces:[],forbiddenChanges:['writes'],baseline:{gitHead:null,relevantFilesHash:'baseline'},output:'analysis' as const,completionCriteria:['read file']};
  const result={taskId:'task',contractHash:'current',outcome:'ready',summary:'read',filesReferenced:['sum.cjs'],proposedChanges:[],interfaceChangeRequests:[],proposedTests:[],testsActuallyRun:[{command:'untrusted test claim',exitCode:0}],unresolvedRisks:[]};
  for(const id of ['child','grandchild'])rows.get(id)!.turns[0]!.items.push({type:'agentMessage',phase:'final_answer',text:JSON.stringify(result)});
  await tracker.refresh(client);const contracts=['child','grandchild'].map(threadId=>({threadId,assignment}));
  expect(tracker.validateResults(contracts,'baseline').every(r=>r.testsActuallyRun.length===0&&r.unverifiedWorkerTestClaims.length===1)).toBe(true);
  expect(()=>tracker.validateResults(contracts.slice(0,1),'baseline')).toThrow(/omitted/);
  expect(()=>tracker.validateResults([...contracts,contracts[0]!],'baseline')).toThrow(/Duplicate or foreign/);
  expect(()=>tracker.validateResults(contracts,'changed')).toThrow(/baseline/);
  expect(()=>tracker.validateResults(contracts.map(c=>({...c,assignment:{...assignment,contractHash:'superseded'}})),'baseline')).toThrow(/superseded/);
  rows.get('child')!.turns[0]!.status='interrupted';await tracker.refresh(client);expect(()=>tracker.validateResults(contracts,'baseline')).toThrow(/did not finish/);
});
