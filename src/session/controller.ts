import {EventEmitter} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import type {JsonValue} from '../codex/generated/serde_json/JsonValue.js';
import type {Config} from '../config.js';
import {CodexClient} from '../codex/client.js';
import {nativeSettings,startupArgs,requireMode,validateModelChoices} from '../codex/config-compiler.js';
import type {RpcEvent,RpcRequest} from '../codex/transport.js';
import {HeraError,safeText} from '../errors.js';
import {saveMetadata,type Metadata} from '../metadata.js';
import {acquireWorkspace} from './workspace-lock.js';
import {baseline,PhasePolicy,validateProposalPath,assignmentSchema,resultSchema} from './phase-policy.js';
import {proposalSchema,reviewProposal,matchesTestCommand,type ApplyReview} from './apply-review.js';
import {goCredentialStatus} from '../providers/go-credentials.js';
import {NativeWorkers,workerContractsSchema} from './workers.js';
import {workerCapability} from '../codex/capabilities.js';
const completed=z.object({threadId:z.string(),turn:z.object({id:z.string(),status:z.enum(['completed','interrupted','failed','inProgress']),error:z.unknown().optional()})});
export class Controller extends EventEmitter {
  readonly phase=new PhasePolicy();private lock:Awaited<ReturnType<typeof acquireWorkspace>>|null=null;private baselineHash='';private closeResult:Promise<boolean>|null=null;private commands=new Set<string>();
  metadata:Metadata|null=null;model='';provider='';private active=false;private early=new Map<string,z.infer<typeof completed>>();private waiter:((e:z.infer<typeof completed>)=>void)|null=null;private failure:((e:Error)=>void)|null=null;private fault:HeraError|null=null;private turnId:string|null=null;
  review:ApplyReview|null=null;
  private applying=false;private applyCanceled=false;
  workers:NativeWorkers|null=null;private workerChecks:Promise<void>=Promise.resolve();private workerDirty=false;private checkingWorkers=false;private stopping:Promise<void>|null=null;
  constructor(public client:CodexClient,readonly home:string,readonly cwd:string,readonly config:Config,private workerAnalysis=false){super();this.bindClient();}
  private bindClient(){this.client.on('event',(e:RpcEvent)=>this.event(e));this.client.on('request',(r:RpcRequest)=>this.deny(r));this.client.on('fault',(e:HeraError)=>{this.fault=e;this.failure?.(e);this.emit('fault',e);});}
  static async open(home:string,cwd:string,config:Config,singleAgent:boolean,previous?:Metadata){requireMode(config,singleAgent,singleAgent?false:(await workerCapability(home,config)).ready);const lock=await acquireWorkspace(home,cwd);let client:CodexClient|undefined;try{client=await CodexClient.connect(home,cwd,startupArgs(config,'read-only',!singleAgent));const controller=new Controller(client,home,cwd,config,!singleAgent);controller.lock=lock;await controller.start(previous);return controller;}catch(e){if(!client||await client.close())await lock.release();throw e;}}
  get busy(){return this.active||this.applying||(this.workers?.activeCount??0)>0;}
  get collaborationEnabled(){return this.workerAnalysis;}
  private async start(previous?:Metadata){
    const account=await this.client.account();if(!account.ready)throw new HeraError('PROVIDER_SETUP_REQUIRED','OpenAI login is required: /providers or hera auth login openai.',3);
    if(!(await goCredentialStatus(this.home)).credentialStored)throw new HeraError('PROVIDER_SETUP_REQUIRED','Save the Go key in the OS store first: /providers or hera auth login go.',3);
    await this.verifyRuntime();
    validateModelChoices(this.config,await this.client.models());
    this.baselineHash=await baseline(this.cwd);
    const developerInstructions=this.workerAnalysis?`Hera uses native read-only collaboration. The root owns task contracts and shared interfaces; use native spawn/followup/message/wait tools, never independent agent processes. Every worker must use model ${this.config.workers.gptModel}, effort ${this.config.workers.reasoningEffort??'the configured model default'}, fork_turns=none, and no custom agent role. Main and workers may read and propose code, but must not write, run tests, expand permissions or use external side effects during analysis. Only the reviewed main-only phase may apply and test. Send every worker an assignment matching ${JSON.stringify(z.toJSONSchema(assignmentSchema))}. Keep taskId and contractHash stable until the task/interface contract changes; then issue a new version/hash through native follow-up. Every worker final answer, including follow-ups, must be JSON matching ${JSON.stringify(z.toJSONSchema(resultSchema))}. Never claim unexecuted tests as run. The root must preserve the latest assignment for each native thread, coordinate interface changes, and reject stale results. If a result needs correction use native follow-up at most twice, then report the blocker. No separate execution or conversation store.`:undefined;
    const params={model:this.config.main.model,modelProvider:'openai',cwd:this.cwd,approvalPolicy:'never' as const,sandbox:'read-only' as const,config:nativeSettings(this.config,'read-only',this.workerAnalysis),...(developerInstructions?{developerInstructions:developerInstructions+` All assignments use baseline.relevantFilesHash=${this.baselineHash}. Include the result schema and these restrictions in each native worker task message; do not assume shared conversation with fork_turns=none.`}:{})};
    if(previous&&previous.workspaceRealPath!==this.cwd)throw new HeraError('WORKSPACE_MISMATCH','Session belongs to a different workspace.',2);
    if(previous){this.workers=new NativeWorkers(previous.codexThreadId,this.cwd,this.config);await this.workers.assertIdle(this.client);}
    const started=previous?await this.client.resume({...params,threadId:previous.codexThreadId}):await this.client.start(params);
    if(started.model!==this.config.main.model||started.modelProvider!=='openai'||started.sandbox.type!=='readOnly'||started.sandbox.networkAccess!==false||started.approvalPolicy!=='never')throw new HeraError('ROUTING_OR_POLICY_DRIFT','Effective model/provider/sandbox differs from the requested safe session.',4);
    this.workers??=new NativeWorkers(started.thread.id,this.cwd,this.config,!previous);
    await this.workers.refresh(this.client);
    if(!this.workerAnalysis&&this.workers.count)throw new HeraError('COLLABORATION_UNVERIFIED','Choose a verified worker session to resume a native child tree.',4);
    for(const child of this.workers.snapshot.values())if(child.id!==started.thread.id){
      const resumed=await this.client.resume({...params,threadId:child.id,model:this.config.workers.gptModel,config:{...params.config,model_reasoning_effort:this.config.workers.reasoningEffort}});
      if(resumed.model!==this.config.workers.gptModel||resumed.modelProvider!=='openai'||resumed.sandbox.type!=='readOnly'||resumed.sandbox.networkAccess!==false||resumed.approvalPolicy!=='never')throw new HeraError('WORKER_POLICY_DRIFT','Saved worker policy did not resume read-only.',4,false);
    }
    this.model=started.model;this.provider=started.modelProvider;if(await baseline(this.cwd)!==this.baselineHash)throw new HeraError('BASELINE_CHANGED','Workspace changed during session startup.',4);this.phase.analyze();
    this.metadata={schemaVersion:1,heraSessionId:previous?.heraSessionId??randomUUID(),codexThreadId:started.thread.id,codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:this.cwd,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:createHash('sha256').update(JSON.stringify(this.config)).digest('hex'),capabilityFingerprint:'single-agent-live-unverified',updatedAt:new Date().toISOString()};await this.persist();
  }
  private async verifyRuntime(){
    const effective=z.object({config:z.record(z.string(),z.unknown())}).parse(await this.client.rpc.request('config/read',{cwd:this.cwd,includeLayers:true})).config;
    const get=(key:string):unknown=>key.split('.').reduce<unknown>((value,part)=>value&&typeof value==='object'&&part in value?Reflect.get(value,part):undefined,effective);
    for(const key of ['agents.enabled','features.multi_agent','features.multi_agent_v2'])if(get(key)!==this.workerAnalysis)throw new HeraError('POLICY_NOT_ENFORCED',`Effective ${key} differs from the phase policy.`,4);
    for(const key of ['features.apps','features.plugins','features.hooks','features.browser_use','features.computer_use','features.request_permissions_tool'])if(get(key)!==false)throw new HeraError('POLICY_NOT_ENFORCED',`Effective ${key} must be false.`,4);
    if(this.workerAnalysis){
      if(get('agents.max_concurrent_threads_per_session')!==this.config.workers.maxConcurrent||get('agents.default_subagent_model')!==this.config.workers.gptModel||this.config.workers.reasoningEffort!==null&&get('agents.default_subagent_reasoning_effort')!==this.config.workers.reasoningEffort)throw new HeraError('WORKER_CONFIG_DRIFT','Native worker defaults/limit differ from the selected configuration.',4);
      const agents=get('agents');if(agents&&typeof agents==='object'&&Object.values(agents).some(value=>value&&typeof value==='object'))throw new HeraError('WORKER_ROLE_OVERRIDE','Custom agent role layers require separate safety verification.',4);
    }
    for(const key of ['mcp_servers','hooks']){const value=get(key);if(value&&typeof value==='object'&&Object.keys(value).length)throw new HeraError('EXTERNAL_TOOLS_BLOCKED',`Configured ${key} requires a separately verified read-only profile.`,4);}
    if(get('notify')||get('shell_environment_policy.inherit')!=='core')throw new HeraError('UNSAFE_RUNTIME_CONFIG','Startup hooks or shell policy differ from the safe profile.',4);
    if(process.platform==='win32'){const readiness=await this.client.windowsSandboxReadiness();if(readiness.status!=='ready')throw new HeraError('WINDOWS_SANDBOX_NOT_READY','Run hera sandbox setup in the isolated Hera profile; no unrestricted fallback.',4);}
  }
  private async assertThreadIdle(id:string){if(this.workers){await this.workerChecks;await this.workers.assertIdle(this.client,true);return this.workers.snapshot.get(id)!;}const thread=await this.client.read(id);const turns=z.array(z.object({status:z.string(),items:z.array(z.object({type:z.string()}).passthrough())})).parse(thread.turns??[]);if(turns.some(t=>t.status==='inProgress')||thread.status.type==='active')throw new HeraError('NOT_QUIESCENT','Native thread is still active.',4);if(turns.some(t=>t.items.some(i=>['subAgentActivity','collabAgentToolCall'].includes(i.type))))throw new HeraError('COLLABORATION_UNVERIFIED','Worker histories require child reconciliation before product resume/apply.',4);return thread;}
  private checkWorkers(){
    this.workerDirty=true;if(this.checkingWorkers)return;this.checkingWorkers=true;
    this.workerChecks=(async()=>{do{this.workerDirty=false;await this.workers!.refresh(this.client);this.emit('workers');}while(this.workerDirty);})().catch(async error=>{const fault=error instanceof HeraError?error:new HeraError('WORKER_STATE_UNKNOWN','Native worker reconciliation failed.',5,false);this.fault=fault;this.failure?.(fault);this.emit('fault',fault);await this.interrupt().catch(()=>{});}).finally(()=>{this.checkingWorkers=false;if(this.workerDirty&&!this.fault)this.checkWorkers();});
  }
  private event(event:RpcEvent){
    this.workers?.observe(event);
    if(event.method==='item/started'||event.method==='item/completed'){
      const item=z.object({item:z.object({id:z.string(),type:z.string()})}).safeParse(event.params);
      if(item.success){const collaboration=['collabAgentToolCall','subAgentActivity'].includes(item.data.item.type);if(['mcpToolCall','dynamicToolCall'].includes(item.data.item.type)||collaboration&&(!this.workerAnalysis||this.phase.phase!=='ANALYZE_READ_ONLY')){this.client.rpc.fail(new HeraError('UNEXPECTED_TOOL_ACTIVITY','A disabled worker/external tool was observed; safety gate invalidated.',4,false));void this.close();return;}if(collaboration&&this.workers&&event.method==='item/completed')this.checkWorkers();if(item.data.item.type==='commandExecution'){if(event.method==='item/started')this.commands.add(item.data.item.id);else this.commands.delete(item.data.item.id);}}
    }
    if(event.method==='turn/completed'){const p=completed.safeParse(event.params);if(!p.success){this.client.rpc.fail(new HeraError('INVALID_EVENT','Invalid completion event.',5,false));return;}if(p.data.threadId===this.metadata?.codexThreadId){if(this.waiter&&p.data.turn.id===this.turnId)this.waiter(p.data);else {if(this.early.size>=128)this.early.delete(this.early.keys().next().value!);this.early.set(p.data.turn.id,p.data);}}}
    this.emit('event',event);
  }
  private deny(request:RpcRequest){
    this.emit('approval',{...request,decision:'denied: permission expansion is unavailable'});
    if(request.method==='item/commandExecution/requestApproval'||request.method==='item/fileChange/requestApproval'){this.client.rpc.respond(request.id,{decision:'decline'});return;}
    this.client.rpc.fail(new HeraError('UNSUPPORTED_SERVER_REQUEST',`Unsupported interactive request ${safeText(request.method)}; disconnected without granting it.`,4,false));void this.client.close();
  }
  private async persist(){if(this.metadata){this.metadata.phase=this.phase.phase;this.metadata.updatedAt=new Date().toISOString();await saveMetadata(this.home,this.metadata);}}
  async run(prompt:string,outputSchema?:JsonValue){
    if(this.applying)throw new HeraError('TURN_ACTIVE','Application or verification is active.',5);
    return this.execute(prompt,outputSchema);
  }
  private async reconcileCommands(){
    if(!this.commands.size||!this.metadata)return;
    const histories=this.workers?[...(await this.workers.refresh(this.client)).values()]:[await this.client.read(this.metadata.codexThreadId)];
    for(const history of histories)for(const recorded of z.object({id:z.string(),status:z.string(),items:z.array(z.unknown())}).array().parse(history.turns??[]))if(recorded.status!=='inProgress')for(const value of recorded.items){
      const item=z.object({id:z.string(),type:z.literal('commandExecution'),status:z.enum(['completed','failed','declined']),exitCode:z.number()}).safeParse(value);if(item.success)this.commands.delete(item.data.id);
    }
  }
  private async execute(prompt:string,outputSchema?:JsonValue){
    if(this.closeResult||this.applyCanceled)throw new HeraError('INTERRUPTED','Session shutdown or application cancellation requested.',130);
    if(this.active||!this.metadata)throw new HeraError('TURN_ACTIVE','Wait for the current turn.',5);
    if(!prompt.trim()||Buffer.byteLength(prompt)>1024*1024)throw new HeraError('INVALID_PROMPT','Prompt must be nonempty and at most 1 MiB.',2);
    if(this.fault)throw this.fault;
    if(this.phase.phase==='READY_TO_APPLY')this.cancelApply();
    if(['COMPLETE','NEEDS_FIX'].includes(this.phase.phase))throw new HeraError('RESUME_REQUIRED','Resume this session read-only before another task.',4);
    this.active=true;this.metadata.status='running';
    try{await this.persist();this.workers?.turnStarting();const turn=await this.client.turn({threadId:this.metadata.codexThreadId,input:[{type:'text',text:prompt,text_elements:[]}],effort:this.config.main.reasoningEffort,...(outputSchema?{outputSchema}:{})});this.turnId=turn.id;this.metadata.lastKnownTurnId=turn.id;await this.persist();
      const done=await new Promise<z.infer<typeof completed>>((resolve,reject)=>{this.waiter=resolve;this.failure=reject;if(this.fault){reject(this.fault);return;}const early=this.early.get(turn.id);if(early){this.early.delete(turn.id);resolve(early);}});
      this.metadata.status=done.turn.status==='completed'?'complete':done.turn.status==='interrupted'?'interrupted':'unknown_outcome';await this.persist();
      if(done.turn.status==='interrupted')await this.client.cleanBackgroundTerminals(this.metadata.codexThreadId);
      await this.workerChecks;if(this.fault)throw this.fault;
      // A native turn may finish before its final command notification is delivered.
      await this.reconcileCommands();
      if(this.commands.size||this.client.rpc.requestsPending)throw new HeraError('INTERRUPTED_UNCONFIRMED','Native turn ended while commands or approval requests remain unresolved.',5,false);
      if(this.phase.phase==='ANALYZE_READ_ONLY'&&await baseline(this.cwd)!==this.baselineHash)throw new HeraError('BASELINE_CHANGED','Workspace changed during read-only analysis; do not apply proposals.',4,false);
      if(done.turn.status!=='completed')throw new HeraError(done.turn.status==='interrupted'?'INTERRUPTED':'TURN_FAILED','Native turn did not complete successfully.',done.turn.status==='interrupted'?130:5,done.turn.status==='interrupted');
      return {sessionId:this.metadata.heraSessionId,threadId:this.metadata.codexThreadId,turnId:turn.id,status:'completed',model:this.model,provider:this.provider};
    }catch(e){if(this.metadata.status==='running'||e instanceof HeraError&&!e.outcomeKnown)this.metadata.status='unknown_outcome';await this.persist();throw e;}
    finally{this.waiter=null;this.failure=null;this.active=false;this.turnId=null;}
  }
  async interrupt(){if(this.applying)this.applyCanceled=true;if(this.stopping)return this.stopping;if(this.workers){this.stopping=this.workers.interrupt(this.client);try{await this.stopping;await this.reconcileCommands();if(this.commands.size)throw new HeraError('INTERRUPTED_UNCONFIRMED','Native command outcomes remain unresolved after interruption.',5,false);this.emit('notice','Owned native main/worker turns and background terminals are idle.');}finally{this.stopping=null;}return;}if(this.turnId&&this.metadata){await this.client.interrupt(this.metadata.codexThreadId,this.turnId);this.emit('notice','Interrupt requested; waiting for native completion.');}else if(this.active)throw new HeraError('INTERRUPTED_UNCONFIRMED','Turn acknowledgment is pending; do not replay.',5,false);}
  cancelApply(){this.review=null;this.phase.cancelReview();}
  async requestApply(){
    if(this.active||!this.metadata||this.phase.phase!=='ANALYZE_READ_ONLY')throw new HeraError('APPLY_GATE_BLOCKED','Finish read-only analysis before requesting a review.',4);
    await this.assertThreadIdle(this.metadata.codexThreadId);
    const withWorkers=(this.workers?.count??0)>0;const schema=withWorkers?proposalSchema.extend({workerContracts:workerContractsSchema}):proposalSchema;
    const result=await this.run('Prepare the concrete change proposal from our analysis for user review. Return complete UTF-8 replacement contents for each file, exact test commands for this operating system, and risks. No deletions, binaries, secrets or permission changes. Do not write or execute tests. If no supported proposal exists, explain the blocker instead of inventing a change.'+(withWorkers?' Include workerContracts: the exact latest main-authorized assignment and native threadId for every descendant. Ensure each worker latest final answer is matching WorkerResult JSON; request native follow-up at most twice for corrections, then stop on a blocker. Worker test claims are unverified; only the main will execute approved tests. Native identity mapping: '+JSON.stringify(this.workers!.contractReferences()):''),z.toJSONSchema(schema) as JsonValue);
    const history=await this.client.read(result.threadId);const turn=z.array(z.object({id:z.string(),items:z.array(z.unknown())})).parse(history.turns).find(t=>t.id===result.turnId);
    const messages=(turn?.items??[]).map(i=>z.object({type:z.literal('agentMessage'),text:z.string(),phase:z.string().nullable().optional()}).safeParse(i)).filter(p=>p.success).map(p=>p.data!);
    const final=messages.findLast(m=>m.phase==='final_answer')??messages.at(-1);if(!final)throw new HeraError('MISSING_PROPOSAL','No native final proposal was recorded.',4);
    const parsed=schema.parse(JSON.parse(final.text));if(withWorkers){await this.workers!.refresh(this.client);this.workers!.validateResults(workerContractsSchema.parse(Reflect.get(parsed,'workerContracts')),this.baselineHash);}
    const proposal=withWorkers?Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='workerContracts')):parsed;
    const review=await reviewProposal(this.cwd,proposal,this.baselineHash);
    await this.client.cleanBackgroundTerminals(this.metadata.codexThreadId);
    await this.assertThreadIdle(this.metadata.codexThreadId);
    this.phase.quiesce({workers:this.workers?.activeCount??0,commands:this.commands.size,approvals:this.client.rpc.requestsPending,turnActive:this.active,baselineMatches:await baseline(this.cwd)===this.baselineHash});
    this.review=review;await this.persist();return review;
  }
  async applyApproved(id:string){
    const review=this.review;if(!review||review.id!==id||this.busy||this.closeResult||!this.metadata||this.phase.phase!=='READY_TO_APPLY')throw new HeraError('STALE_APPROVAL','No matching current review.',4);
    this.applying=true;
    try{
    if(await baseline(this.cwd)!==review.baseline){this.cancelApply();throw new HeraError('BASELINE_CHANGED','Workspace changed after review; generate a new proposal.',4);}
    if((await reviewProposal(this.cwd,review.proposal,review.baseline)).id!==id)throw new HeraError('STALE_APPROVAL','Proposal changed after review.',4);
    await this.assertThreadIdle(this.metadata.codexThreadId);await this.client.cleanBackgroundTerminals(this.metadata.codexThreadId);
    this.review=null;this.metadata.status='running';await this.persist();
    try{
      const paths=new Set(await Promise.all(review.proposal.changes.map(async c=>(await validateProposalPath(this.cwd,c.path)).toLowerCase())));const otherFiles=await baseline(this.cwd,paths);
      if(!await this.client.close())throw new HeraError('INTERRUPTED_UNCONFIRMED','Old native runtime did not close cleanly.',5,false);
      this.workerAnalysis=false;
      this.client=await CodexClient.connect(this.home,this.cwd,startupArgs(this.config,'workspace-write'));
      if(this.closeResult||this.applyCanceled){await this.client.close();throw new HeraError('INTERRUPTED','Application canceled during policy transition.',130);}
      this.bindClient();await this.verifyRuntime();
      const resumed=await this.client.resume({threadId:this.metadata.codexThreadId,model:this.config.main.model,modelProvider:'openai',cwd:this.cwd,sandbox:'workspace-write',approvalPolicy:'never',config:nativeSettings(this.config,'workspace-write')});
      const sandbox=z.object({type:z.literal('workspaceWrite'),networkAccess:z.literal(false),excludeTmpdirEnvVar:z.literal(true),excludeSlashTmp:z.literal(true),writableRoots:z.array(z.string()).max(0)}).safeParse(resumed.sandbox);
      if(!sandbox.success||resumed.model!==this.model||resumed.modelProvider!=='openai'||resumed.approvalPolicy!=='never')throw new HeraError('POLICY_NOT_ENFORCED','Apply resume did not preserve the approved model and workspace sandbox.',4);
      if(this.workers){await this.workers.assertIdle(this.client);const loaded=await this.client.loadedThreads();if([...this.workers.snapshot.keys()].some(id=>id!==this.metadata!.codexThreadId&&loaded.has(id)))throw new HeraError('WORKER_SURVIVED_TRANSITION','A child was loaded in the single-writer runtime.',4,false);}
      if(await baseline(this.cwd)!==review.baseline)throw new HeraError('BASELINE_CHANGED','Workspace changed during native policy transition.',4);
      this.phase.apply(true,{readOnly:true,spawnDisabled:true,resumePolicy:true});
      await this.execute('The user approved these exact text replacements. Apply ONLY the listed file contents through native tools. Do not run tests yet, spawn workers, delete files, expand permissions, or change any other files. Stop on any mismatch. Windows sandbox PowerShell uses ConstrainedLanguage: prefer native apply_patch or Get-Content/Set-Content cmdlets; static .NET file methods are unavailable. Preserve the exact reviewed encoding and line endings.\n'+JSON.stringify(review.proposal.changes));
      for(const change of review.proposal.changes){const actual=await readFile(await validateProposalPath(this.cwd,change.path),'utf8');if(actual!==change.content)throw new HeraError('APPLY_MISMATCH','Applied file content differs from the reviewed proposal; no automatic retry.',4);}
      if(await baseline(this.cwd,paths)!==otherFiles)throw new HeraError('APPLY_SCOPE_CHANGED','Unlisted files changed during apply; preserve changes for review.',4);
      this.phase.verify();await this.persist();const results:{command:string;exitCode:number|null}[]=[];
      for(const test of review.proposal.tests){
        const run=await this.execute(`Run this one approved test command exactly, without wrappers, extra commands or file edits. Report its actual result; do not fix failures.\n${test.command}`);
        const history=await this.client.read(run.threadId);const turn=z.array(z.object({id:z.string(),items:z.array(z.unknown())})).parse(history.turns).find(t=>t.id===run.turnId);
        const commands=(turn?.items??[]).map(i=>z.object({type:z.literal('commandExecution'),command:z.string(),exitCode:z.number().nullable()}).safeParse(i)).filter(p=>p.success).map(p=>p.data!);
        const actual=commands.find(c=>matchesTestCommand(c.command,test.command));results.push({command:test.command,exitCode:commands.some(c=>c.exitCode!==0)?null:actual?.exitCode??null});
        this.emit('notice',JSON.stringify({approvedTest:test.command,observedCommands:commands}));
        if(!actual||actual.exitCode!==0||commands.some(c=>c.exitCode!==0))break;
      }
      await this.client.cleanBackgroundTerminals(this.metadata.codexThreadId);
      this.phase.complete(results.length===review.proposal.tests.length&&results.every(r=>r.exitCode===0)?0:null);this.metadata.status='complete';await this.persist();return results;
    }catch(e){this.phase.phase='NEEDS_FIX';this.metadata.status='unknown_outcome';await this.persist();throw e;}
    }finally{this.applying=false;}
  }
  close():Promise<boolean>{if(!this.closeResult)this.closeResult=this.shutdown();return this.closeResult;}
  private async shutdown(){let uncertain=this.active||this.applying||this.commands.size>0||this.fault!==null||this.metadata?.status==='unknown_outcome';if(this.workers){try{await this.interrupt();}catch{uncertain=true;}}else if(this.busy){try{await this.interrupt();}catch{}if(this.metadata)this.metadata.status='unknown_outcome';}if(uncertain&&this.metadata)this.metadata.status='unknown_outcome';const graceful=await this.client.close();await this.persist();if(graceful&&!uncertain)await this.lock?.release();return graceful&&!uncertain;}
}
