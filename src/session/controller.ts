import {EventEmitter} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import type {Config} from '../config.js';
import {CodexClient} from '../codex/client.js';
import {nativeSettings,startupArgs,requireMode} from '../codex/config-compiler.js';
import type {RpcEvent,RpcRequest} from '../codex/transport.js';
import {HeraError,safeText} from '../errors.js';
import {saveMetadata,type Metadata} from '../metadata.js';
const completed=z.object({threadId:z.string(),turn:z.object({id:z.string(),status:z.enum(['completed','interrupted','failed','inProgress']),error:z.unknown().optional()})});
export class Controller extends EventEmitter {
  metadata:Metadata|null=null;model='';provider='';private active=false;private early=new Map<string,z.infer<typeof completed>>();private waiter:((e:z.infer<typeof completed>)=>void)|null=null;private failure:((e:Error)=>void)|null=null;private fault:HeraError|null=null;private turnId:string|null=null;
  constructor(readonly client:CodexClient,readonly home:string,readonly cwd:string,readonly config:Config){super();client.on('event',(e:RpcEvent)=>this.event(e));client.on('request',(r:RpcRequest)=>this.deny(r));client.on('fault',(e:HeraError)=>{this.fault=e;this.failure?.(e);this.emit('fault',e);});}
  static async open(home:string,cwd:string,config:Config,singleAgent:boolean,previous?:Metadata){requireMode(config,singleAgent);const client=await CodexClient.connect(home,cwd,startupArgs(config));const controller=new Controller(client,home,cwd,config);try{await controller.start(previous);return controller;}catch(e){await client.close();throw e;}}
  get busy(){return this.active;}
  private async start(previous?:Metadata){
    const account=await this.client.account();if(!account.ready)throw new HeraError('BLOCKED_NO_CREDENTIALS','Use hera auth login openai in the isolated Hera home.',3);
    const models=await this.client.models();const selected=models.find(m=>m.model===this.config.main.model);if(!selected)throw new HeraError('MODEL_UNAVAILABLE','Selected model is absent from the native catalog; no fallback.',2);
    if(this.config.main.reasoningEffort&&!selected.supportedReasoningEfforts.some(e=>e.reasoningEffort===this.config.main.reasoningEffort))throw new HeraError('UNSUPPORTED_EFFORT','Selected model does not advertise that reasoning effort.',2);
    const params={model:this.config.main.model,modelProvider:'openai',cwd:this.cwd,approvalPolicy:'never' as const,sandbox:'read-only' as const,config:nativeSettings(this.config)};
    if(previous&&previous.workspaceRealPath!==this.cwd)throw new HeraError('WORKSPACE_MISMATCH','Session belongs to a different workspace.',2);
    if(previous)await this.client.read(previous.codexThreadId);
    const started=previous?await this.client.resume({...params,threadId:previous.codexThreadId}):await this.client.start(params);
    if(started.model!==this.config.main.model||started.modelProvider!=='openai'||started.sandbox.type!=='readOnly')throw new HeraError('ROUTING_OR_POLICY_DRIFT','Effective model/provider/sandbox differs from the requested safe session.',4);
    this.model=started.model;this.provider=started.modelProvider;
    this.metadata={schemaVersion:1,heraSessionId:previous?.heraSessionId??randomUUID(),codexThreadId:started.thread.id,codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:this.cwd,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:createHash('sha256').update(JSON.stringify(this.config)).digest('hex'),capabilityFingerprint:'single-agent-live-unverified',updatedAt:new Date().toISOString()};await this.persist();
  }
  private event(event:RpcEvent){
    if(event.method==='turn/completed'){const p=completed.safeParse(event.params);if(!p.success){this.client.rpc.fail(new HeraError('INVALID_EVENT','Invalid completion event.',5,false));return;}if(p.data.threadId===this.metadata?.codexThreadId){if(this.waiter&&p.data.turn.id===this.turnId)this.waiter(p.data);else {if(this.early.size>=128)this.early.delete(this.early.keys().next().value!);this.early.set(p.data.turn.id,p.data);}}}
    this.emit('event',event);
  }
  private deny(request:RpcRequest){
    this.emit('approval',{...request,decision:'denied: read-only session'});
    if(request.method==='item/commandExecution/requestApproval'||request.method==='item/fileChange/requestApproval'){this.client.rpc.respond(request.id,{decision:'decline'});return;}
    this.client.rpc.fail(new HeraError('UNSUPPORTED_SERVER_REQUEST',`Unsupported interactive request ${safeText(request.method)}; disconnected without granting it.`,4,false));void this.client.close();
  }
  private async persist(){if(this.metadata){this.metadata.updatedAt=new Date().toISOString();await saveMetadata(this.home,this.metadata);}}
  async run(prompt:string){
    if(this.active||!this.metadata)throw new HeraError('TURN_ACTIVE','Wait for the current turn.',5);
    if(!prompt.trim()||Buffer.byteLength(prompt)>1024*1024)throw new HeraError('INVALID_PROMPT','Prompt must be nonempty and at most 1 MiB.',2);
    if(this.fault)throw this.fault;
    this.active=true;this.metadata.status='running';await this.persist();
    try{const turn=await this.client.turn({threadId:this.metadata.codexThreadId,input:[{type:'text',text:prompt,text_elements:[]}],effort:this.config.main.reasoningEffort});this.turnId=turn.id;this.metadata.lastKnownTurnId=turn.id;await this.persist();
      const done=await new Promise<z.infer<typeof completed>>((resolve,reject)=>{this.waiter=resolve;this.failure=reject;if(this.fault){reject(this.fault);return;}const early=this.early.get(turn.id);if(early){this.early.delete(turn.id);resolve(early);}});
      this.metadata.status=done.turn.status==='completed'?'complete':done.turn.status==='interrupted'?'interrupted':'unknown_outcome';await this.persist();
      if(done.turn.status!=='completed')throw new HeraError(done.turn.status==='interrupted'?'INTERRUPTED':'TURN_FAILED','Native turn did not complete successfully.',done.turn.status==='interrupted'?130:5,done.turn.status==='interrupted');
      return {sessionId:this.metadata.heraSessionId,threadId:this.metadata.codexThreadId,turnId:turn.id,status:'completed',model:this.model,provider:this.provider};
    }catch(e){if(this.metadata.status==='running')this.metadata.status='unknown_outcome';await this.persist();throw e;}
    finally{this.waiter=null;this.failure=null;this.active=false;this.turnId=null;}
  }
  async interrupt(){if(this.turnId&&this.metadata){await this.client.interrupt(this.metadata.codexThreadId,this.turnId);this.emit('notice','Interrupt requested; waiting for native completion.');}else if(this.active)throw new HeraError('INTERRUPTED_UNCONFIRMED','Turn acknowledgment is pending; do not replay.',5,false);}
  async close(){if(this.active){try{await this.interrupt();}catch{}if(this.metadata)this.metadata.status='unknown_outcome';}const graceful=await this.client.close();await this.persist();return graceful;}
}
