import {z} from 'zod';
import {EventEmitter} from 'node:events';
import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import {launch,closeOwned,CODEX_VERSION} from './launcher.js';
import {Transport,type RpcEvent,type RpcRequest} from './transport.js';
import {HeraError} from '../errors.js';
import {verifyContract} from './capabilities.js';
import type {InitializeParams} from './generated/InitializeParams.js';
import type {ThreadStartParams} from './generated/v2/ThreadStartParams.js';
import type {ThreadResumeParams} from './generated/v2/ThreadResumeParams.js';
import type {TurnStartParams} from './generated/v2/TurnStartParams.js';
import type {WindowsSandboxSetupMode} from './generated/v2/WindowsSandboxSetupMode.js';
import type {ThreadBackgroundTerminalsCleanParams} from './generated/v2/ThreadBackgroundTerminalsCleanParams.js';
import {setTimeout as delay} from 'node:timers/promises';
export const threadSchema=z.object({id:z.string(),cwd:z.string(),modelProvider:z.string(),status:z.object({type:z.string()}),turns:z.array(z.unknown()).optional()}).passthrough();
const sessionSchema=z.object({thread:threadSchema,model:z.string(),modelProvider:z.string(),sandbox:z.object({type:z.string()}).passthrough()}).passthrough();
export const modelSchema=z.object({id:z.string(),model:z.string(),displayName:z.string(),supportedReasoningEfforts:z.array(z.object({reasoningEffort:z.string()}))});
export type ModelView=z.infer<typeof modelSchema>;
export class CodexClient extends EventEmitter {
  readonly rpc:Transport;private closing=false;
  constructor(readonly child:ChildProcessWithoutNullStreams){super();this.rpc=new Transport(child.stdout,child.stdin);child.stderr.resume();child.on('error',()=>this.rpc.fail(new HeraError('SPAWN_FAILED','Could not start the pinned runtime.',4)));child.on('exit',()=>{if(!this.closing)this.rpc.fail(new HeraError('SERVER_EXIT','Runtime exited; outcome unknown.',5,false));});this.rpc.on('notification',(e:RpcEvent)=>this.emit('event',e));this.rpc.on('request',(e:RpcRequest)=>this.emit('request',e));this.rpc.on('fault',(e:HeraError)=>{if(!this.closing)this.emit('fault',e);});}
  static async connect(home:string,cwd:string,overrides:string[]=[]){await verifyContract();const client=new CodexClient(await launch(home,cwd,overrides));try{await client.initialize();return client;}catch(e){await client.close();throw e;}}
  async initialize(){const params:InitializeParams={clientInfo:{name:'hera',title:'Hera',version:'0.1.0-alpha.1'},capabilities:{experimentalApi:true,requestAttestation:false}};const result=z.object({userAgent:z.string(),codexHome:z.string(),platformOs:z.string()}).parse(await this.rpc.request('initialize',params,20000));if(!result.userAgent.includes(`/${CODEX_VERSION} `))throw new HeraError('UNSUPPORTED_RUNTIME','Native runtime version mismatch.',4);this.rpc.notify('initialized');return result;}
  async account(){const result=z.object({account:z.object({type:z.string()}).passthrough().nullable(),requiresOpenaiAuth:z.boolean()}).parse(await this.rpc.request('account/read',{refreshToken:false}));return {ready:result.account!==null,category:result.account?.type??'none'};}
  async models(){const models:ModelView[]=[];let cursor:string|null=null;const seen=new Set<string>();do{const page=z.object({data:z.array(modelSchema),nextCursor:z.string().nullable()}).parse(await this.rpc.request('model/list',{cursor}));models.push(...page.data);cursor=page.nextCursor;if(cursor){if(seen.has(cursor)||models.length>2000)throw new HeraError('INVALID_PAGINATION','Model catalog pagination did not terminate.',4);seen.add(cursor);}}while(cursor);return models;}
  async start(params:ThreadStartParams){return sessionSchema.parse(await this.rpc.request('thread/start',params));}
  async resume(params:ThreadResumeParams){return sessionSchema.parse(await this.rpc.request('thread/resume',params));}
  async read(threadId:string){return z.object({thread:threadSchema}).parse(await this.rpc.request('thread/read',{threadId,includeTurns:true})).thread;}
  async turn(params:TurnStartParams){return z.object({turn:z.object({id:z.string(),status:z.string()})}).parse(await this.rpc.request('turn/start',params)).turn;}
  async interrupt(threadId:string,turnId:string){await this.rpc.request('turn/interrupt',{threadId,turnId});}
  async cleanBackgroundTerminals(threadId:string,timeoutMs=2000){
    const params:ThreadBackgroundTerminalsCleanParams={threadId};
    z.object({}).parse(await this.rpc.request('thread/backgroundTerminals/clean',params));
    const deadline=performance.now()+timeoutMs;
    for(;;){
      const remaining=z.object({data:z.array(z.unknown()),nextCursor:z.string().nullable()}).parse(await this.rpc.request('thread/backgroundTerminals/list',params));
      if(!remaining.data.length&&remaining.nextCursor===null)return;
      if(performance.now()>=deadline)throw new HeraError('INTERRUPTED_UNCONFIRMED','Native background commands remain after cleanup.',5,false);
      await delay(50);
    }
  }
  async windowsSandboxReadiness(){return z.object({status:z.enum(['ready','notConfigured','updateRequired'])}).parse(await this.rpc.request('windowsSandbox/readiness',undefined));}
  async setupWindowsSandbox(mode:WindowsSandboxSetupMode,cwd:string,signal?:AbortSignal,timeoutMs=300000){
    if(mode!=='unelevated'&&mode!=='elevated')throw new HeraError('INVALID_SANDBOX_MODE','Use unelevated or elevated.',2);
    let timer:NodeJS.Timeout|undefined;
    let event:(e:RpcEvent)=>void=()=>{};
    let fault:(e:Error)=>void=()=>{};
    let abort:()=>void=()=>{};
    try{
      await new Promise<void>((resolve,reject)=>{
        let acknowledged=false,completed=false;
        const finish=()=>{if(acknowledged&&completed)resolve();};
        fault=reject;
        abort=()=>reject(new HeraError('SANDBOX_SETUP_INTERRUPTED','Sandbox setup interrupted; inspect readiness before retrying.',130,false));
        event=e=>{if(e.method!=='windowsSandbox/setupCompleted')return;
          const result=z.object({mode:z.enum(['elevated','unelevated']),success:z.boolean(),error:z.string().nullable()}).safeParse(e.params);
          if(!result.success){reject(new HeraError('INVALID_SANDBOX_EVENT','Invalid native sandbox completion event.',5,false));return;}
          if(result.data.mode!==mode)return;
          if(!result.data.success){reject(new HeraError('SANDBOX_SETUP_FAILED',result.data.error??'Official sandbox setup failed.',4));return;}
          completed=true;finish();
        };
        this.on('event',event);this.on('fault',fault);signal?.addEventListener('abort',abort,{once:true});
        if(signal?.aborted){abort();return;}
        timer=setTimeout(()=>reject(new HeraError('SANDBOX_SETUP_TIMEOUT','Sandbox setup completion timed out; inspect readiness before retrying.',5,false)),timeoutMs);
        void this.rpc.request('windowsSandbox/setupStart',{mode,cwd}).then(value=>{
          if(!z.object({started:z.boolean()}).parse(value).started)throw new HeraError('SANDBOX_SETUP_NOT_STARTED','Native sandbox setup did not start.',4);
          acknowledged=true;finish();
        }).catch(reject);
      });
    }finally{clearTimeout(timer);this.off('event',event);this.off('fault',fault);signal?.removeEventListener('abort',abort);}
  }
  async close(){this.closing=true;this.rpc.close();return closeOwned(this.child);}
}
