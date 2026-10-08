import {EventEmitter} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import type {JsonValue} from '../codex/generated/serde_json/JsonValue.js';
import type {Config} from '../config.js';
import {CodexClient} from '../codex/client.js';
import {CODEX_VERSION} from '../codex/launcher.js';
import {nativeSettings,startupArgs,requireMode,validateModelChoices} from '../codex/config-compiler.js';
import type {RpcEvent,RpcRequest} from '../codex/transport.js';
import {HeraError,safeText} from '../errors.js';
import {saveMetadata,type Metadata} from '../metadata.js';
import {acquireWorkspace} from './workspace-lock.js';
import {baseline,PhasePolicy,validateProposalPath,assignmentSchema,resultSchema} from './phase-policy.js';
import {editProposalSchema,reviewEdits,reviewProposal,testResults,observeTestSequence,type ApplyReview} from './apply-review.js';
import {goCredentialStatus} from '../providers/go-credentials.js';
import {NativeWorkers,workerContractsSchema,threadBusy} from './workers.js';
import {workerCapability,nativeCapability} from '../codex/capabilities.js';
import {GO_PROVIDER,GO_ROLE,ASTRA_ROLE} from '../codex/external-runtime.js';
import {GO_MODEL} from '../providers/opencode-go.js';
import {SEARCH_GUIDANCE,verifySearchConfig,verifySearchInventory,permittedSearchItem} from '../codex/web-research.js';
const completed=z.object({threadId:z.string(),turn:z.object({id:z.string(),status:z.enum(['completed','interrupted','failed','inProgress']),error:z.unknown().optional()})});
const requestOwner=z.object({threadId:z.string(),turnId:z.string(),itemId:z.string()});
const questions=z.array(z.object({id:z.string(),header:z.string(),question:z.string(),isSecret:z.boolean(),options:z.array(z.object({label:z.string(),description:z.string()})).nullable().optional()})).min(1).max(3);
export type NativeRequest={id:string|number;threadId:string;turnId:string;itemId:string;summary:string;questions?:z.infer<typeof questions>};
export class Controller extends EventEmitter {
  readonly phase=new PhasePolicy();private lock:Awaited<ReturnType<typeof acquireWorkspace>>|null=null;private baselineHash='';private closeResult:Promise<boolean>|null=null;private commands=new Map<string,string>();
  metadata:Metadata|null=null;model='';provider='';private active=false;private early=new Map<string,z.infer<typeof completed>>();private waiter:((e:z.infer<typeof completed>)=>void)|null=null;private failure:((e:Error)=>void)|null=null;private fault:HeraError|null=null;private turnId:string|null=null;
  review:ApplyReview|null=null;
  private applying=false;private applyCanceled=false;
  private testObserver:((event:RpcEvent)=>void)|null=null;
  workers:NativeWorkers|null=null;private workerChecks:Promise<void>=Promise.resolve();private workerDirty=false;private checkingWorkers=false;private stopping:Promise<void>|null=null;
  readonly requests=new Map<string|number,NativeRequest>();
  constructor(public client:CodexClient,readonly home:string,readonly cwd:string,readonly config:Config,private workerAnalysis=false,readonly nativeFlow=false){super();this.bindClient();}
  private bindClient(){this.client.on('event',(e:RpcEvent)=>this.event(e));this.client.on('request',(r:RpcRequest)=>this.deny(r));this.client.on('fault',(e:HeraError)=>{this.fault=e;this.failure?.(e);this.emit('fault',e);});}
  static async open(home:string,cwd:string,config:Config,singleAgent:boolean,previous?:Metadata){requireMode(config,singleAgent,singleAgent?false:(await nativeCapability(home,config)).ready);const lock=await acquireWorkspace(home,cwd);let client:CodexClient|undefined;try{client=await CodexClient.session(home,cwd,config,'workspace-write',!singleAgent,true);const controller=new Controller(client,home,cwd,config,!singleAgent,true);controller.lock=lock;await controller.start(previous);return controller;}catch(e){if(!client||await client.close())await lock.release();throw e;}}
  get busy(){return this.active||this.applying||(this.workers?.activeCount??0)>0;}
  get collaborationEnabled(){return this.workerAnalysis;}
  private async start(previous?:Metadata){
    // A Go-root runtime reports no OpenAI account. Discover OpenAI readiness and
    // supported reasoning levels through the official OpenAI runtime instead.
    const discovery=this.config.mode==='adaptive'?await CodexClient.connect(this.home,this.cwd,startupArgs(this.config)):this.client;
    try{const account=await discovery.account();if(!account.ready)throw new HeraError('PROVIDER_SETUP_REQUIRED','OpenAI login is required: /providers or hera auth login openai.',3);validateModelChoices(this.config,await discovery.models());}finally{if(discovery!==this.client)await discovery.close();}
    if(!(await goCredentialStatus(this.home)).credentialStored)throw new HeraError('PROVIDER_SETUP_REQUIRED','Save the Go key in the OS store first: /providers or hera auth login go.',3);
    await this.verifyRuntime();
    if(this.nativeFlow){await this.startNative(previous);return;}
    this.baselineHash=await baseline(this.cwd);
    const developerInstructions=this.workerAnalysis?`Hera: native read-only collaboration only. Handle small tasks yourself; spawn only for separable work worth its coordination cost. The worker limit is a ceiling, not a target. ${this.config.mode==='external_workers'?`Every worker must use agent_type=${GO_ROLE}, omit model/reasoning overrides, use fork_context=false, and receive a fresh plaintext task. Use the native V1 spawn_agent/send_input/wait/resume_agent tools. After a cold restart, resume an unloaded saved Go child with resume_agent before sending it work. The user selected Go ${GO_MODEL}/${this.config.workers.goReasoningEffort}; never fall back to GPT workers.`:`Every worker must use model ${this.config.workers.gptModel}, effort ${this.config.workers.reasoningEffort??'the configured model default'}, fork_turns=none, and no custom agent role.`} Analysis: read/propose only; no writes, tests, permission expansion or external side effects. Apply/tests require reviewed main-only mode. Worker assignments: ${JSON.stringify(z.toJSONSchema(assignmentSchema))}. Keep taskId/hash stable until the contract changes; then version/hash the update. Every worker final must match ${JSON.stringify(z.toJSONSchema(resultSchema))}. Main owns interfaces and latest per-thread contracts; reject stale results. Never claim unrun tests. Correct invalid results via native follow-up at most twice, then report blocked. Follow-ups send only changes; reuse unchanged schema/context. No independent agents or conversation store.`:undefined;
    const params={model:this.config.main.model,modelProvider:'openai',cwd:this.cwd,approvalPolicy:'never' as const,sandbox:'read-only' as const,config:this.client.sessionSettings??nativeSettings(this.config,'read-only',this.workerAnalysis),developerInstructions:SEARCH_GUIDANCE+(developerInstructions?' '+developerInstructions+` All assignments use baseline.relevantFilesHash=${this.baselineHash}. Include the result schema, web research guidance and these restrictions in each native worker task message; do not assume shared conversation with fork_turns=none.`:'')};
    if(previous&&previous.mode!==this.config.mode)throw new HeraError('SESSION_MODE_MISMATCH','Resume the session in its saved provider mode; no silent route change.',4);
    if(previous&&previous.workspaceRealPath!==this.cwd)throw new HeraError('WORKSPACE_MISMATCH','Session belongs to a different workspace.',2);
    if(previous){this.workers=new NativeWorkers(previous.codexThreadId,this.cwd,this.config);await this.workers.assertIdle(this.client);}
    const started=previous?await this.client.resume({...params,threadId:previous.codexThreadId}):await this.client.start(params);
    verifySearchInventory(await this.client.rpc.request('mcpServerStatus/list',{threadId:started.thread.id,limit:100}),this.client.research!.url);
    if(started.model!==this.config.main.model||started.modelProvider!=='openai'||started.sandbox.type!=='readOnly'||started.sandbox.networkAccess!==false||started.approvalPolicy!=='never')throw new HeraError('ROUTING_OR_POLICY_DRIFT','Effective model/provider/sandbox differs from the requested safe session.',4);
    this.workers??=new NativeWorkers(started.thread.id,this.cwd,this.config,!previous);
    await this.workers.refresh(this.client);
    if(!this.workerAnalysis&&this.workers.count)throw new HeraError('COLLABORATION_UNVERIFIED','Choose a verified worker session to resume a native child tree.',4);
    for(const child of this.workers.snapshot.values())if(child.id!==started.thread.id){
      // Native resume_agent restores Go routing and reapplies the parent's current
      // read-only policy. Do not inject the OpenAI catalog into a Go thread/resume.
      if(this.config.mode==='external_workers')continue;
      const resumed=await this.client.resume({...params,threadId:child.id,model:this.config.workers.gptModel,config:{...params.config,model_reasoning_effort:this.config.workers.reasoningEffort}});
      if(resumed.model!==this.config.workers.gptModel||resumed.modelProvider!=='openai'||resumed.sandbox.type!=='readOnly'||resumed.sandbox.networkAccess!==false||resumed.approvalPolicy!=='never')throw new HeraError('WORKER_POLICY_DRIFT','Saved worker policy did not resume read-only.',4,false);
    }
    this.model=started.model;this.provider=started.modelProvider;if(await baseline(this.cwd)!==this.baselineHash)throw new HeraError('BASELINE_CHANGED','Workspace changed during session startup.',4);this.phase.analyze();
    this.metadata={schemaVersion:1,heraSessionId:previous?.heraSessionId??randomUUID(),codexThreadId:started.thread.id,codexVersion:CODEX_VERSION,mode:this.config.mode,workspaceRealPath:this.cwd,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:createHash('sha256').update(JSON.stringify(this.config)).digest('hex'),capabilityFingerprint:this.workerAnalysis?(await workerCapability(this.home,this.config)).fingerprint:'single-agent-live-unverified',updatedAt:new Date().toISOString()};await this.persist();
  }
  private async startNative(previous?:Metadata){
    if(previous&&previous.mode!==this.config.mode)throw new HeraError('SESSION_MODE_MISMATCH','Resume in the saved provider mode; no silent route change.',4);
    if(previous&&previous.workspaceRealPath!==this.cwd)throw new HeraError('WORKSPACE_MISMATCH','Session belongs to a different workspace.',2);
    const adaptive=this.config.mode==='adaptive';const model=adaptive?GO_MODEL:this.config.main.model;const provider=adaptive?GO_PROVIDER:'openai';
    const routing=!this.workerAnalysis?'Do the work yourself; native workers are disabled.':adaptive?`Handle conversation and routine coding yourself. For planning, architecture, design or difficult reasoning, delegate that part to agent_type=${ASTRA_ROLE}; use its answer to finish the task. For separable routine parallel work use agent_type=${GO_ROLE}.`:this.config.mode==='external_workers'?`Delegate separable routine work to agent_type=${GO_ROLE}.`:`Use native GPT workers only when separable work warrants it, model=${this.config.workers.gptModel}, effort=${this.config.workers.reasoningEffort??'default'}, fork_turns=none.`;
    const research=`As the root coordinator, for design, architecture or research requests automatically start DRD research using the same native turn, unless the user explicitly excludes web research or delegation. Do not do this for greetings, simple explanations or routine edits. Define 3-5 complementary assignments (default 3 only when the user gives no count). Preserve an explicit count and each requested perspective: five requested perspectives means five separate DRD assignments, never collapse them to match worker slots. Typical aspects: primary documentation and constraints; alternatives and tradeoffs; risks and validation. List all numbered questions as DRD-1, DRD-2, etc. before spawning. Each delegated worker receives its own number and must report that number. ${this.workerAnalysis?`The root assigns these to native workers using the configured routes, including the numbered question, public-only context and source/findings/uncertainty requirements. At most ${this.config.workers.maxConcurrent} workers may be open at once, not 3-5 at once. Reuse native follow-up or close completed workers before spawning replacements; no descendants. Wait for all assignments. In adaptive mode, use routine Go workers to gather evidence, then ask Astra for difficult synthesis after releasing completed routine workers.`:'Workers are disabled: cover the assignments yourself and label single-agent research; never claim delegation.'} Require actual hera_web evidence for every assignment: search when sources are unknown, otherwise fetch known relevant official URLs. Pass the search policy to each worker, respect explicit per-assignment read budgets including parent rereads on its behalf, reuse shared findings/cache, cite source URLs and distinguish facts from inference. Do not edit files or run shell/tests during research. If a source is blocked, stop the affected work and mark it blocked/unperformed; never invent results or retry automatically. Report each DRD number with findings, sources and uncertainties, then disagreements and a recommendation. If implementation was also requested, continue authorized edits and checks afterward in this same task; no /apply, extra proposal turn or mandatory approval phase.`;
    const developerInstructions=`Hera: answer conversationally. For an implementation request, edit files, run appropriate checks and report observed results in the same task. No separate /apply, JSON proposal or whole-workspace baseline. Preserve user changes. Ask only for missing decisions or native extra permissions. ${routing} Use small scoped tasks; workers inherit native permissions, so assign disjoint file ownership and wait before editing their files. Do not overwrite others' changes. Mixed-provider tasks use fork_context=false, fresh plaintext instructions, no model/effort override; resume_agent before messaging unloaded children. Never copy full history across providers or fall back after errors. ${research} ${SEARCH_GUIDANCE}`;
    const params={model,modelProvider:provider,cwd:this.cwd,approvalPolicy:'on-request' as const,sandbox:'workspace-write' as const,config:this.client.sessionSettings!,developerInstructions};
    if(previous){this.workers=new NativeWorkers(previous.codexThreadId,this.cwd,this.config);await this.workers.assertIdle(this.client);}
    const started=previous?await this.client.resume({...params,threadId:previous.codexThreadId}):await this.client.start(params);
    const sandbox=z.object({type:z.literal('workspaceWrite'),networkAccess:z.literal(false),excludeTmpdirEnvVar:z.literal(true),excludeSlashTmp:z.literal(true),writableRoots:z.array(z.string()).max(0)}).safeParse(started.sandbox);
    if(!sandbox.success||started.model!==model||started.modelProvider!==provider||started.approvalPolicy!=='on-request')throw new HeraError('ROUTING_OR_POLICY_DRIFT','Native workspace sandbox, approvals or selected route differ.',4);
    verifySearchInventory(await this.client.rpc.request('mcpServerStatus/list',{threadId:started.thread.id,limit:100}),this.client.research!.url);
    this.workers??=new NativeWorkers(started.thread.id,this.cwd,this.config,!previous);await this.workers.refresh(this.client);
    if(!this.workerAnalysis&&this.workers.count)throw new HeraError('COLLABORATION_UNVERIFIED','Saved children require a worker-enabled session.',4);
    this.model=started.model;this.provider=started.modelProvider;this.phase.phase='NATIVE';
    this.metadata={schemaVersion:1,heraSessionId:previous?.heraSessionId??randomUUID(),codexThreadId:started.thread.id,codexVersion:CODEX_VERSION,mode:this.config.mode,workspaceRealPath:this.cwd,phase:'NATIVE',lastKnownTurnId:null,status:'idle',configFingerprint:createHash('sha256').update(JSON.stringify(this.config)).digest('hex'),capabilityFingerprint:this.workerAnalysis?(await nativeCapability(this.home,this.config)).fingerprint:'native-single-agent',updatedAt:new Date().toISOString()};await this.persist();
  }
  private async verifyRuntime(){
    const effective=z.object({config:z.record(z.string(),z.unknown())}).parse(await this.client.rpc.request('config/read',{cwd:this.cwd,includeLayers:true})).config;
    const get=(key:string):unknown=>key.split('.').reduce<unknown>((value,part)=>value&&typeof value==='object'&&part in value?Reflect.get(value,part):undefined,effective);
    for(const key of ['agents.enabled','features.multi_agent','features.multi_agent_v2'])if(get(key)!==(key==='features.multi_agent_v2'&&this.config.mode!=='gpt_only'?false:this.workerAnalysis))throw new HeraError('POLICY_NOT_ENFORCED',`Effective ${key} differs from the phase policy.`,4);
    for(const key of ['features.apps','features.plugins','features.hooks','features.browser_use','features.computer_use','features.request_permissions_tool'])if(get(key)!==false)throw new HeraError('POLICY_NOT_ENFORCED',`Effective ${key} must be false.`,4);
    if(this.workerAnalysis){
      if(get('agents.max_concurrent_threads_per_session')!==this.config.workers.maxConcurrent||this.config.mode==='gpt_only'&&(get('agents.default_subagent_model')!==this.config.workers.gptModel||this.config.workers.reasoningEffort!==null&&get('agents.default_subagent_reasoning_effort')!==this.config.workers.reasoningEffort))throw new HeraError('WORKER_CONFIG_DRIFT','Native worker defaults/limit differ from the selected configuration.',4);
      const agents=get('agents');if(this.config.mode==='gpt_only'&&agents&&typeof agents==='object'&&Object.values(agents).some(value=>value&&typeof value==='object'))throw new HeraError('WORKER_ROLE_OVERRIDE','Custom agent role layers require separate safety verification.',4);
      if(this.config.mode!=='gpt_only'){
        const roles=Object.entries(agents as Record<string,unknown>).filter(([,value])=>value&&typeof value==='object').map(([key])=>key).sort();
        if(JSON.stringify(roles)!==JSON.stringify([GO_ROLE,'default','worker','explorer',...(this.config.mode==='adaptive'?[ASTRA_ROLE]:[])].sort())||get('agents.max_depth')!==1||get('agents.default_subagent_model')!=null)throw new HeraError('WORKER_CONFIG_DRIFT','Mixed role inventory or depth/defaults changed.',4);
        const provider=`model_providers.${GO_PROVIDER}`;
        if(get(provider+'.base_url')!==this.config.providers.opencode_go_deepseek.baseUrl||get(provider+'.requires_openai_auth')!==false||get(provider+'.env_key')!=='HERA_OPENCODE_GO_API_KEY'||get(provider+'.request_max_retries')!==0||get(provider+'.stream_max_retries')!==0)throw new HeraError('WORKER_CONFIG_DRIFT','Go endpoint/auth/retry policy changed.',4);
      }
    }
    verifySearchConfig(get('mcp_servers'),!this.applying,this.client.research?.url);
    if(get('web_search')!=='disabled')throw new HeraError('SEARCH_CONFIG_DRIFT','Native web search must remain disabled; use local Playwright research.',4);
    for(const key of ['hooks']){const value=get(key);if(value&&typeof value==='object'&&Object.keys(value).length)throw new HeraError('EXTERNAL_TOOLS_BLOCKED',`Configured ${key} requires a separately verified read-only profile.`,4);}
    if(get('notify')||get('shell_environment_policy.inherit')!=='core')throw new HeraError('UNSAFE_RUNTIME_CONFIG','Startup hooks or shell policy differ from the safe profile.',4);
    if(process.platform==='win32'){const readiness=await this.client.windowsSandboxReadiness();if(readiness.status!=='ready')throw new HeraError('WINDOWS_SANDBOX_NOT_READY','Run hera sandbox setup in the isolated Hera profile; no unrestricted fallback.',4);}
  }
  private async assertThreadIdle(id:string){if(this.workers){await this.workerChecks;await this.workers.assertIdle(this.client,true);return this.workers.snapshot.get(id)!;}const thread=await this.client.read(id);const turns=z.array(z.object({status:z.string(),items:z.array(z.object({type:z.string()}).passthrough())})).parse(thread.turns??[]);if(turns.some(t=>t.status==='inProgress')||thread.status.type==='active')throw new HeraError('NOT_QUIESCENT','Native thread is still active.',4);if(turns.some(t=>t.items.some(i=>['subAgentActivity','collabAgentToolCall'].includes(i.type))))throw new HeraError('COLLABORATION_UNVERIFIED','Worker histories require child reconciliation before product resume/apply.',4);return thread;}
  private checkWorkers(){
    this.workerDirty=true;if(this.checkingWorkers)return;this.checkingWorkers=true;
    this.workerChecks=(async()=>{do{this.workerDirty=false;await this.workers!.refresh(this.client);this.emit('workers');}while(this.workerDirty);})().catch(async error=>{const fault=error instanceof HeraError?error:new HeraError('WORKER_STATE_UNKNOWN','Native worker reconciliation failed.',5,false);this.fault=fault;this.failure?.(fault);this.emit('fault',fault);await this.interrupt().catch(()=>{});}).finally(()=>{this.checkingWorkers=false;if(this.workerDirty&&!this.fault)this.checkWorkers();});
  }
  private event(event:RpcEvent){
    if(event.method==='serverRequest/resolved'){const p=z.object({requestId:z.union([z.string(),z.number()])}).parse(event.params);this.requests.delete(p.requestId);this.emit('requests');}
    try{this.testObserver?.(event);}catch(error){this.client.rpc.fail(error instanceof HeraError?error:new HeraError('INVALID_TEST_EVENT','Malformed native test event; outcome is unconfirmed.',5,false));void this.close();return;}
    this.workers?.observe(event);
    if(event.method==='item/started'||event.method==='item/completed'){
      const item=z.object({item:z.object({id:z.string(),type:z.string()}).passthrough()}).safeParse(event.params);
      if(item.success){const collaboration=['collabAgentToolCall','subAgentActivity'].includes(item.data.item.type);const allowed=this.nativeFlow||this.phase.phase==='ANALYZE_READ_ONLY';const search=permittedSearchItem(item.data.item,allowed)||this.nativeFlow&&z.object({type:z.literal('mcpToolCall'),server:z.literal('codex'),tool:z.enum(['list_mcp_resources','list_mcp_resource_templates'])}).safeParse(item.data.item).success;if(['mcpToolCall','dynamicToolCall'].includes(item.data.item.type)&&!search||collaboration&&(!this.workerAnalysis||!allowed)){this.client.rpc.fail(new HeraError('UNEXPECTED_TOOL_ACTIVITY','A disabled worker/external tool was observed; safety gate invalidated.',4,false));void this.close();return;}if(collaboration&&this.workers&&event.method==='item/completed')this.checkWorkers();if(item.data.item.type==='commandExecution'){const owner=z.object({threadId:z.string()}).safeParse(event.params);if(!owner.success){this.client.rpc.fail(new HeraError('INVALID_EVENT','Command event has no native owner.',5,false));return;}if(event.method==='item/started')this.commands.set(item.data.item.id,owner.data.threadId);else this.commands.delete(item.data.item.id);}}
    }
    if(event.method==='turn/completed'){const p=completed.safeParse(event.params);if(!p.success){this.client.rpc.fail(new HeraError('INVALID_EVENT','Invalid completion event.',5,false));return;}if(p.data.threadId===this.metadata?.codexThreadId){if(this.waiter&&p.data.turn.id===this.turnId)this.waiter(p.data);else {if(this.early.size>=128)this.early.delete(this.early.keys().next().value!);this.early.set(p.data.turn.id,p.data);}}}
    this.emit('event',event);
  }
  private deny(request:RpcRequest){
    if(this.nativeFlow){void this.receiveRequest(request).catch(error=>{this.client.rpc.fail(error instanceof HeraError?error:new HeraError('INVALID_SERVER_REQUEST','Invalid native request; no permission granted.',4,false));});return;}
    this.emit('approval',{...request,decision:'denied: permission expansion is unavailable'});
    if(request.method==='item/commandExecution/requestApproval'||request.method==='item/fileChange/requestApproval'){this.client.rpc.respond(request.id,{decision:'decline'});return;}
    this.client.rpc.fail(new HeraError('UNSUPPORTED_SERVER_REQUEST',`Unsupported interactive request ${safeText(request.method)}; disconnected without granting it.`,4,false));void this.client.close();
  }
  private async receiveRequest(request:RpcRequest){
    const approval=['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(request.method);const input=request.method==='item/tool/requestUserInput';
    if(!approval&&!input)throw new HeraError('UNSUPPORTED_SERVER_REQUEST',`Unsupported request ${safeText(request.method)}; no permission granted.`,4,false);
    const owner=requestOwner.parse(request.params);
    // A child can request approval before its spawn-completed notification.
    if(owner.threadId!==this.metadata?.codexThreadId)await this.workers?.refresh(this.client);
    if(!this.metadata||owner.threadId!==this.metadata.codexThreadId&&!this.workers?.snapshot.has(owner.threadId))throw new HeraError('REQUEST_OWNERSHIP_MISMATCH','Request is outside this native tree.',4,false);
    const thread=await this.client.read(owner.threadId);const turns=z.array(z.object({id:z.string(),status:z.string()})).parse(thread.turns??[]);
    if(!this.client.rpc.hasServerRequest(request.id))return;
    if(!turns.some(t=>t.id===owner.turnId&&t.status==='inProgress')){this.client.rpc.respond(request.id,input?{answers:{}}:{decision:'decline'});return;}
    if(!this.listenerCount('requests')){this.client.rpc.respond(request.id,input?{answers:{}}:{decision:'decline'});this.emit('notice','Interactive request declined: no interactive client is attached.');return;}
    const data=z.object({reason:z.string().nullable().optional(),command:z.string().nullable().optional(),cwd:z.string().nullable().optional(),grantRoot:z.string().nullable().optional()}).parse(request.params);
    const route=this.workers?.snapshot.get(owner.threadId);
    const items=z.array(z.object({id:z.string(),items:z.array(z.unknown())})).parse(thread.turns??[]).find(t=>t.id===owner.turnId)?.items??[];
    const change=request.method==='item/fileChange/requestApproval'?items.find(item=>z.object({id:z.literal(owner.itemId)}).safeParse(item).success):undefined;
    if(request.method==='item/fileChange/requestApproval'&&!change){this.client.rpc.respond(request.id,{decision:'decline'});this.emit('notice','File change details are unavailable; declined.');return;}
    const detail={method:request.method,provider:route?.modelProvider??this.provider,model:route?.model??this.model,workspace:this.cwd,request:request.params,...(change?{change}:{})};
    // A grantRoot changes session scope; this UI deliberately offers no persistent grants.
    if(data.grantRoot){this.client.rpc.respond(request.id,{decision:'decline'});this.emit('notice','Persistent write-root grants are unsupported; request one scoped command instead.');return;}
    const summary=safeText(JSON.stringify(detail,null,2));if(summary.length>32768){this.client.rpc.respond(request.id,input?{answers:{}}:{decision:'decline'});this.emit('notice','Request details exceed the review display limit; split the action.');return;}
    this.requests.set(request.id,{id:request.id,...owner,summary,...(input?{questions:questions.parse(Reflect.get(request.params as object,'questions'))}:{})});this.emit('requests');
  }
  answerRequest(id:string|number,answer:'accept'|'decline'|Record<string,{answers:string[]}>){
    const request=this.requests.get(id);if(!request)throw new HeraError('STALE_APPROVAL','Request is no longer pending.',4);
    if(request.questions){if(typeof answer==='string')throw new HeraError('INVALID_ANSWER','Expected question answers.',2);const parsed=z.record(z.string(),z.object({answers:z.array(z.string().max(10000)).max(8)})).parse(answer);if(Object.keys(parsed).some(key=>!request.questions!.some(q=>q.id===key)))throw new HeraError('INVALID_ANSWER','Unknown question.',2);this.client.rpc.respond(id,{answers:parsed});}
    else{if(answer!=='accept'&&answer!=='decline')throw new HeraError('INVALID_ANSWER','Choose allow once or decline.',2);this.client.rpc.respond(id,{decision:answer});}
    this.requests.delete(id);this.emit('requests');
  }
  private async persist(){if(this.metadata){this.metadata.phase=this.phase.phase;this.metadata.updatedAt=new Date().toISOString();await saveMetadata(this.home,this.metadata);}}
  async run(prompt:string,outputSchema?:JsonValue,plan=false){
    if(this.applying)throw new HeraError('TURN_ACTIVE','Application or verification is active.',5);
    return this.execute(prompt,outputSchema,plan);
  }
  private async reconcileCommands(){
    if(!this.commands.size||!this.metadata)return;
    const histories=this.workers?[...(await this.workers.refresh(this.client)).values()]:[await this.client.read(this.metadata.codexThreadId)];
    for(const history of histories)for(const recorded of z.object({id:z.string(),status:z.string(),items:z.array(z.unknown())}).array().parse(history.turns??[]))if(recorded.status!=='inProgress')for(const value of recorded.items){
      const item=z.object({id:z.string(),type:z.literal('commandExecution'),status:z.enum(['completed','failed','declined']),exitCode:z.number()}).safeParse(value);if(item.success)this.commands.delete(item.data.id);
    }
  }
  private async execute(prompt:string,outputSchema?:JsonValue,plan=false){
    if(this.closeResult||this.applyCanceled)throw new HeraError('INTERRUPTED','Session shutdown or application cancellation requested.',130);
    if(this.active||!this.metadata)throw new HeraError('TURN_ACTIVE','Wait for the current turn.',5);
    if(!prompt.trim()||Buffer.byteLength(prompt)>1024*1024)throw new HeraError('INVALID_PROMPT','Prompt must be nonempty and at most 1 MiB.',2);
    if(this.fault)throw this.fault;
    if(this.phase.phase==='READY_TO_APPLY')this.cancelApply();
    if(['COMPLETE','NEEDS_FIX'].includes(this.phase.phase))throw new HeraError('RESUME_REQUIRED','Resume this session read-only before another task.',4);
    this.active=true;this.metadata.status='running';
    try{if(this.nativeFlow)await this.workers?.assertIdle(this.client,true);await this.persist();this.workers?.turnStarting();const turn=await this.client.turn({threadId:this.metadata.codexThreadId,input:[{type:'text',text:prompt,text_elements:[]}],effort:this.config.mode==='adaptive'?this.config.workers.goReasoningEffort:this.config.main.reasoningEffort,...(this.nativeFlow?{approvalPolicy:plan?'never' as const:'on-request' as const,sandboxPolicy:plan?{type:'readOnly' as const,networkAccess:false}:{type:'workspaceWrite' as const,writableRoots:[],networkAccess:false,excludeTmpdirEnvVar:true,excludeSlashTmp:true}}:{}),...(outputSchema?{outputSchema}:{})});this.turnId=turn.id;this.metadata.lastKnownTurnId=turn.id;await this.persist();
      const done=await new Promise<z.infer<typeof completed>>((resolve,reject)=>{this.waiter=resolve;this.failure=reject;if(this.fault){reject(this.fault);return;}const early=this.early.get(turn.id);if(early){this.early.delete(turn.id);resolve(early);}});
      this.metadata.status=done.turn.status==='completed'?'complete':done.turn.status==='interrupted'?'interrupted':'unknown_outcome';await this.persist();
      if(done.turn.status==='interrupted')await this.client.cleanBackgroundTerminals(this.metadata.codexThreadId);
      await this.workerChecks;if(this.fault)throw this.fault;
      // Parent completion can race child cancellation; await native cleanup before
      // deciding whether the child's final command outcome is still unknown.
      if(this.stopping)await this.stopping;
      // A native turn may finish before its final command notification is delivered.
      await this.reconcileCommands();
      const unresolved=[...this.commands.values()].some(id=>{const child=this.workers?.snapshot.get(id);return id===this.metadata!.codexThreadId||!this.workerAnalysis||!this.nativeFlow&&this.phase.phase!=='ANALYZE_READ_ONLY'||!child||!threadBusy(child);});
      if(unresolved||this.client.rpc.requestsPending)throw new HeraError('INTERRUPTED_UNCONFIRMED','Native turn ended while its commands or approval requests remain unresolved.',5,false);
      if(this.phase.phase==='ANALYZE_READ_ONLY'&&await baseline(this.cwd)!==this.baselineHash)throw new HeraError('BASELINE_CHANGED','Workspace changed during read-only analysis; do not apply proposals.',4,false);
      if(done.turn.status!=='completed')throw new HeraError(done.turn.status==='interrupted'?'INTERRUPTED':'TURN_FAILED','Native turn did not complete successfully.',done.turn.status==='interrupted'?130:5,done.turn.status==='interrupted');
      return {sessionId:this.metadata.heraSessionId,threadId:this.metadata.codexThreadId,turnId:turn.id,status:'completed',model:this.model,provider:this.provider};
    }catch(e){if(this.metadata.status==='running'||e instanceof HeraError&&!e.outcomeKnown)this.metadata.status='unknown_outcome';await this.persist();throw e;}
    finally{this.waiter=null;this.failure=null;this.active=false;this.turnId=null;}
  }
  async interrupt(){for(const request of [...this.requests.values()])this.answerRequest(request.id,request.questions?{}:'decline');if(this.applying)this.applyCanceled=true;if(this.stopping)return this.stopping;if(this.workers){this.stopping=Promise.all([this.workers.interrupt(this.client),this.client.research?.browser.interrupt()]).then(()=>{});try{await this.stopping;await this.reconcileCommands();if(this.commands.size)throw new HeraError('INTERRUPTED_UNCONFIRMED','Native command outcomes remain unresolved after interruption.',5,false);this.emit('notice','Owned native main/worker turns and background terminals are idle.');}finally{this.stopping=null;}return;}if(this.turnId&&this.metadata){await this.client.interrupt(this.metadata.codexThreadId,this.turnId);this.emit('notice','Interrupt requested; waiting for native completion.');}else if(this.active)throw new HeraError('INTERRUPTED_UNCONFIRMED','Turn acknowledgment is pending; do not replay.',5,false);}
  cancelApply(){this.review=null;this.phase.cancelReview();}
  async requestApply(){
    if(this.active||!this.metadata||this.phase.phase!=='ANALYZE_READ_ONLY')throw new HeraError('APPLY_GATE_BLOCKED','Finish read-only analysis before requesting a review.',4);
    await this.assertThreadIdle(this.metadata.codexThreadId);
    const withWorkers=(this.workers?.count??0)>0;const schema=withWorkers?editProposalSchema.extend({workerContracts:workerContractsSchema}):editProposalSchema;
    const result=await this.run('Prepare a compact change proposal for review: each file has ordered edits {oldText,newText}. Each oldText must match exactly once in the current text after preceding edits. Use empty oldText only for a new or empty file. Return the smallest unique snippets, preserving UTF-8 and line endings, not whole existing files. Hera reconstructs full before/after text locally. Include exact test commands for this OS and risks. No deletions, secrets, writes or tests yet. Report a blocker instead of inventing edits.'+(withWorkers?' Include workerContracts: the exact latest main-authorized assignment and native threadId for every descendant. Ensure each worker latest final answer is matching WorkerResult JSON; request native follow-up at most twice for corrections, then stop on a blocker. Worker test claims are unverified; only the main will execute approved tests. Native identity mapping: '+JSON.stringify(this.workers!.contractReferences()):''),z.toJSONSchema(schema) as JsonValue);
    const history=await this.client.read(result.threadId);const turn=z.array(z.object({id:z.string(),items:z.array(z.unknown())})).parse(history.turns).find(t=>t.id===result.turnId);
    const messages=(turn?.items??[]).map(i=>z.object({type:z.literal('agentMessage'),text:z.string(),phase:z.string().nullable().optional()}).safeParse(i)).filter(p=>p.success).map(p=>p.data!);
    const final=messages.findLast(m=>m.phase==='final_answer')??messages.at(-1);if(!final)throw new HeraError('MISSING_PROPOSAL','No native final proposal was recorded.',4);
    const parsed=schema.parse(JSON.parse(final.text));if(withWorkers){await this.workers!.refresh(this.client);this.workers!.validateResults(workerContractsSchema.parse(Reflect.get(parsed,'workerContracts')),this.baselineHash);}
    const proposal=withWorkers?Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='workerContracts')):parsed;
    const review=await reviewEdits(this.cwd,proposal,this.baselineHash);
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
    const checked=review.edits?await reviewEdits(this.cwd,review.edits,review.baseline):await reviewProposal(this.cwd,review.proposal,review.baseline);
    if(checked.id!==id||JSON.stringify(checked.proposal)!==JSON.stringify(review.proposal))throw new HeraError('STALE_APPROVAL','Proposal changed after review.',4);
    await this.assertThreadIdle(this.metadata.codexThreadId);await this.client.cleanBackgroundTerminals(this.metadata.codexThreadId);
    this.review=null;this.metadata.status='running';await this.persist();
    try{
      const paths=new Set(await Promise.all(review.proposal.changes.map(async c=>(await validateProposalPath(this.cwd,c.path)).toLowerCase())));const otherFiles=await baseline(this.cwd,paths);
      if(!await this.client.close())throw new HeraError('INTERRUPTED_UNCONFIRMED','Old native runtime did not close cleanly.',5,false);
      this.workerAnalysis=false;
      this.client=await CodexClient.session(this.home,this.cwd,this.config,'workspace-write',false);
      if(this.closeResult||this.applyCanceled){await this.client.close();throw new HeraError('INTERRUPTED','Application canceled during policy transition.',130);}
      this.bindClient();await this.verifyRuntime();
      const resumed=await this.client.resume({threadId:this.metadata.codexThreadId,model:this.config.main.model,modelProvider:'openai',cwd:this.cwd,sandbox:'workspace-write',approvalPolicy:'never',config:this.client.sessionSettings??nativeSettings(this.config,'workspace-write')});
      const sandbox=z.object({type:z.literal('workspaceWrite'),networkAccess:z.literal(false),excludeTmpdirEnvVar:z.literal(true),excludeSlashTmp:z.literal(true),writableRoots:z.array(z.string()).max(0)}).safeParse(resumed.sandbox);
      if(!sandbox.success||resumed.model!==this.model||resumed.modelProvider!=='openai'||resumed.approvalPolicy!=='never')throw new HeraError('POLICY_NOT_ENFORCED','Apply resume did not preserve the approved model and workspace sandbox.',4);
      if(this.workers){await this.workers.assertIdle(this.client);const loaded=await this.client.loadedThreads();if([...this.workers.snapshot.keys()].some(id=>id!==this.metadata!.codexThreadId&&loaded.has(id)))throw new HeraError('WORKER_SURVIVED_TRANSITION','A child was loaded in the single-writer runtime.',4,false);}
      if(await baseline(this.cwd)!==review.baseline)throw new HeraError('BASELINE_CHANGED','Workspace changed during native policy transition.',4);
      this.phase.apply(true,{readOnly:true,spawnDisabled:true,resumePolicy:true});
      await this.execute('Apply ONLY these approved changes through native tools. For edits, replace each unique oldText with newText in order; empty oldText means a new or empty file. Do not echo full files. Do not run tests, spawn workers, delete files, expand permissions or change other files. Stop on mismatch; no fuzzy matching. Preserve UTF-8 and exact line endings. On Windows use native apply_patch or PowerShell cmdlets; static .NET file methods are unavailable.\n'+JSON.stringify(review.edits?.changes??review.proposal.changes));
      for(const change of review.proposal.changes){const actual=await readFile(await validateProposalPath(this.cwd,change.path),'utf8');if(actual!==change.content)throw new HeraError('APPLY_MISMATCH','Applied file content differs from the reviewed proposal; no automatic retry.',4);}
      if(await baseline(this.cwd,paths)!==otherFiles)throw new HeraError('APPLY_SCOPE_CHANGED','Unlisted files changed during apply; preserve changes for review.',4);
      this.phase.verify();await this.persist();
      this.testObserver=observeTestSequence(review.proposal.tests,this.metadata.codexThreadId);
      const run=await this.execute('Run these approved test commands sequentially in this exact order, each as a separate native command execution. Wait for each final exit code before starting the next; stop at the first nonzero or unknown exit. No combined commands, wrappers, extra commands, file edits or fixes. Report only observed results.\n'+JSON.stringify(review.proposal.tests));
      this.testObserver=null;
      const history=await this.client.read(run.threadId);const turn=z.array(z.object({id:z.string(),items:z.array(z.unknown())})).parse(history.turns).find(t=>t.id===run.turnId);
      const results=testResults(review.proposal.tests,turn?.items??[]);
      this.emit('notice',JSON.stringify({approvedTests:review.proposal.tests,observedResults:results}));
      await this.client.cleanBackgroundTerminals(this.metadata.codexThreadId);
      this.phase.complete(results.length===review.proposal.tests.length&&results.every(r=>r.exitCode===0)?0:null);this.metadata.status='complete';await this.persist();return results;
    }catch(e){this.phase.phase='NEEDS_FIX';this.metadata.status='unknown_outcome';await this.persist();throw e;}
    }finally{this.testObserver=null;this.applying=false;}
  }
  close():Promise<boolean>{if(!this.closeResult)this.closeResult=this.shutdown();return this.closeResult;}
  private async shutdown(){let uncertain=this.active||this.applying||this.commands.size>0||this.fault!==null||this.metadata?.status==='unknown_outcome';if(this.workers){try{await this.interrupt();}catch{uncertain=true;}}else if(this.busy){try{await this.interrupt();}catch{}if(this.metadata)this.metadata.status='unknown_outcome';}if(uncertain&&this.metadata)this.metadata.status='unknown_outcome';const graceful=await this.client.close();await this.persist();if(graceful&&!uncertain)await this.lock?.release();return graceful&&!uncertain;}
}
