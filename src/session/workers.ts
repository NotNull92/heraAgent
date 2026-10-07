import {z} from 'zod';
import {setTimeout as delay} from 'node:timers/promises';
import type {CodexClient} from '../codex/client.js';
import type {Config} from '../config.js';
import type {RpcEvent} from '../codex/transport.js';
import {HeraError} from '../errors.js';
import {assignmentSchema,validateResult} from './phase-policy.js';
import {GO_PROVIDER,GO_EFFORT} from '../codex/external-runtime.js';
import {GO_MODEL} from '../providers/opencode-go.js';

export const workerContractsSchema=z.array(z.strictObject({threadId:z.string(),assignment:assignmentSchema})).max(511);

const thread=z.object({id:z.string(),parentThreadId:z.string().nullable(),cwd:z.string(),modelProvider:z.string(),model:z.string().nullable(),reasoningEffort:z.string().nullable(),source:z.unknown().optional(),status:z.object({type:z.enum(['active','idle','notLoaded','systemError'])}),turns:z.array(z.object({id:z.string(),status:z.enum(['completed','failed','interrupted','inProgress']),items:z.array(z.object({type:z.string()}).passthrough())}))});
type NativeThread=z.infer<typeof thread>;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
export function spawnedChildren(items:NativeThread['turns'][number]['items']){
  const ids=new Set<string>();
  for(const item of items){
    if(item.type==='subAgentActivity'&&item.kind==='started')ids.add(z.string().parse(item.agentThreadId));
    if(item.type==='collabAgentToolCall'&&item.tool==='spawnAgent'&&item.status==='completed')for(const id of z.array(z.string()).parse(item.receiverThreadIds))ids.add(id);
  }
  return ids;
}
export function threadBusy(t:NativeThread){return t.status.type==='active'||t.turns.some(turn=>turn.status==='inProgress');}

// Native histories remain the source of truth; only IDs and the current snapshot live here.
export class NativeWorkers {
  private born=new Map<string,string>();
  snapshot=new Map<string,NativeThread>();
  constructor(readonly root:string,readonly cwd:string,readonly config:Config,private freshRoot=false){}
  turnStarting(){this.freshRoot=false;}
  observe(event:RpcEvent){
    if(event.method!=='item/started'&&event.method!=='item/completed')return;
    const p=z.object({threadId:z.string(),item:z.object({type:z.string()}).passthrough()}).safeParse(event.params);if(!p.success)return;
    for(const id of spawnedChildren([p.data.item])){if(!this.born.has(id)&&this.born.size>=512)throw new HeraError('THREAD_INVENTORY_LIMIT','Native worker event inventory exceeds the safety bound.',4,false);this.born.set(id,p.data.threadId);}
  }
  get activeCount(){return [...this.snapshot.values()].filter(t=>t.id!==this.root&&threadBusy(t)).length;}
  get count(){return Math.max(0,this.snapshot.size-1);}
  contractReferences(){return [...this.snapshot.values()].filter(t=>t.id!==this.root).map(t=>{const source=z.object({subAgent:z.object({thread_spawn:z.object({agent_path:z.string()})})}).safeParse(t.source);return {threadId:t.id,nativePath:source.success?source.data.subAgent.thread_spawn.agent_path:null};});}
  validateResults(contracts:z.infer<typeof workerContractsSchema>,baselineHash:string){
    const expected=new Set([...this.snapshot.keys()].filter(id=>id!==this.root));const results=[];
    for(const {threadId,assignment} of contracts){
      if(!expected.delete(threadId))throw new HeraError('WORKER_CONTRACT_MISMATCH','Duplicate or foreign worker contract in the main proposal.',4);
      if(assignment.baseline.relevantFilesHash!==baselineHash)throw new HeraError('WORKER_BASELINE_MISMATCH','Worker assignment uses another workspace baseline.',4);
      const child=this.snapshot.get(threadId)!;const final=child.turns.at(-1);
      if(!final||final.status!=='completed')throw new HeraError('WORKER_RESULT_INCOMPLETE','A referenced worker did not finish its latest task.',4);
      const message=final.items.findLast(i=>i.type==='agentMessage'&&i.phase==='final_answer')??final.items.findLast(i=>i.type==='agentMessage');
      let result;try{result=validateResult(assignment,JSON.parse(z.string().parse(message?.text)));}catch{throw new HeraError('WORKER_CONTRACT_MISMATCH','Worker result is invalid or belongs to a superseded task contract. Request native follow-up; do not apply it.',4);}
      if(result.outcome!=='ready')throw new HeraError('WORKER_RESULT_BLOCKED','Resolve the native worker coordination/blocker before applying.',4);
      results.push(result);
    }
    if(expected.size)throw new HeraError('WORKER_CONTRACT_MISSING','The main proposal omitted a worker task contract.',4);
    return results;
  }
  async refresh(client:CodexClient,checkRouting=true){
    // ponytail: bounded full native hydration (512 threads / 32 MiB); use paginated native items for larger trees.
    let bytes=0;const inventory=new Map<string,NativeThread>();const read=async(id:string)=>{if(inventory.has(id))return inventory.get(id)!;if(inventory.size>=512)throw new HeraError('THREAD_INVENTORY_LIMIT','Native worker tree exceeds 512 retained threads; no phase transition.',4);const value=id===this.root&&this.freshRoot?z.object({thread:z.unknown()}).parse(await client.rpc.request('thread/read',{threadId:id,includeTurns:false})).thread:await client.read(id);const t=thread.parse(value);bytes+=Buffer.byteLength(JSON.stringify(t));if(bytes>32*1024*1024)throw new HeraError('THREAD_INVENTORY_LIMIT','Native worker history exceeds 32 MiB; no phase transition.',4);if(t.id!==id)throw new HeraError('THREAD_ID_MISMATCH','Native read returned another thread.',4,false);if(id===this.root&&this.freshRoot&&threadBusy(t))throw new HeraError('UNEXPECTED_TURN','A new native root became active before Hera submitted a turn.',4,false);inventory.set(id,t);return t;};
    const root=await read(this.root);if(root.parentThreadId!==null||!samePath(root.cwd,this.cwd))throw new HeraError('WORKSPACE_MISMATCH','Expected a root thread in this workspace.',4);
    // V2 children may be absent from thread/list and have their own sessionId.
    // Follow native spawn records, parentThreadId and loaded threads, never sessionId equality.
    const loaded=await client.loadedThreads();for(const id of loaded)await read(id);
    const owned=new Map<string,NativeThread>([[root.id,root]]);const queue=[root.id];
    for(let i=0;i<queue.length;i++){
      const parent=owned.get(queue[i]!)!;const ids=spawnedChildren(parent.turns.flatMap(t=>t.items));
      for(const [id,p] of this.born)if(p===parent.id)ids.add(id);
      for(const t of inventory.values())if(t.parentThreadId===parent.id)ids.add(t.id);
      for(const id of ids){const child=await read(id);if(child.parentThreadId!==parent.id||!samePath(child.cwd,this.cwd)||id===this.root)throw new HeraError('WORKER_OWNERSHIP_MISMATCH','Worker reference is outside the owned native tree; no foreign interruption.',4,false);if(!owned.has(id)){owned.set(id,child);queue.push(id);}}
    }
    this.snapshot=owned;
    if([...owned.values()].some(t=>t.status.type==='systemError'))throw new HeraError('WORKER_STATE_UNKNOWN','A native thread reports a system error.',5,false);
    if(checkRouting)for(const t of owned.values()){
      const main=t.id===this.root;const external=!main&&this.config.mode==='external_workers';const model=main?this.config.main.model:external?GO_MODEL:this.config.workers.gptModel;const effort=main?this.config.main.reasoningEffort:external?GO_EFFORT:this.config.workers.reasoningEffort;
      if(t.modelProvider!==(external?GO_PROVIDER:'openai')||t.model!==model||effort!==null&&t.reasoningEffort!==effort)throw new HeraError('WORKER_ROUTING_DRIFT','Observed native model/provider/effort differs from the selected role. Defaults are not preventive override enforcement.',4,false);
    }
    if(this.activeCount>this.config.workers.maxConcurrent)throw new HeraError('WORKER_LIMIT_DRIFT','Observed active workers exceed the configured limit.',4,false);
    return owned;
  }
  async assertIdle(client:CodexClient,clean=false){
    const before=await this.refresh(client);
    if([...before.values()].some(threadBusy))throw new HeraError('NOT_QUIESCENT','Main or child turns are still active; wait or cancel before applying.',4);
    for(const t of before.values())if(t.status.type!=='notLoaded'){
      if(clean)await client.cleanBackgroundTerminals(t.id);
      const terminals=z.object({data:z.array(z.unknown()),nextCursor:z.string().nullable()}).parse(await client.rpc.request('thread/backgroundTerminals/list',{threadId:t.id}));
      if(terminals.data.length||terminals.nextCursor!==null)throw new HeraError('NOT_QUIESCENT','Native background commands remain in the session tree.',4,false);
    }
    const after=await this.refresh(client);
    if([...after.values()].some(threadBusy)||after.size!==before.size)throw new HeraError('NOT_QUIESCENT','Native tree changed during the quiescence check.',4,false);
  }
  async interrupt(client:CodexClient,timeoutMs=10000){
    const deadline=performance.now()+timeoutMs;const sent=new Set<string>();
    for(;;){
      const tree=await this.refresh(client,false);
      // Stop the parent first so it cannot deliberately start more work during cancellation.
      for(const t of tree.values())for(const turn of t.turns)if(turn.status==='inProgress'&&!sent.has(t.id+':'+turn.id)){
        sent.add(t.id+':'+turn.id);
        try{await client.interrupt(t.id,turn.id);}catch(error){
          // A turn can complete between the snapshot and interrupt RPC. Ignore only
          // that exact native race, and only after a fresh read proves it is idle.
          if(!(error instanceof HeraError)||error.errorCode!=='RPC_-32600'||!error.message.includes('no active turn to interrupt'))throw error;
          const current=thread.parse(await client.read(t.id));
          if(current.id!==t.id||current.status.type==='systemError'||threadBusy(current))throw error;
        }
      }
      for(const t of tree.values())if(t.status.type!=='notLoaded')await client.cleanBackgroundTerminals(t.id);
      const after=await this.refresh(client,false);
      if(![...after.values()].some(threadBusy)&&after.size===tree.size)return;
      if(performance.now()>=deadline)throw new HeraError('INTERRUPTED_UNCONFIRMED','The owned native tree did not become idle; preserve workspace ownership.',5,false);
      await delay(50);
    }
  }
}
