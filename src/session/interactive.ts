import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {existsJson} from '../paths.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {CodexClient} from '../codex/client.js';
import type {ModelView} from '../codex/client.js';
import {startupArgs,validateModelChoices} from '../codex/config-compiler.js';
import {Controller} from './controller.js';
import type {Config} from '../config.js';
import {saveConfig,parseEffort,configSchema,projectSchema,goEffortSchema} from '../config.js';
import {listMetadata} from '../metadata.js';
import {safeText,HeraError,errorView} from '../errors.js';
import {capabilityReport} from '../codex/capabilities.js';
import {providerStatus,loginOpenAI} from '../providers/accounts.js';
import {saveGoCredential} from '../providers/go-credentials.js';
import {externalRuntime} from '../codex/external-runtime.js';
import {GO_MODEL} from '../providers/opencode-go.js';
import {parseLimits,mergeLimits} from './limits.js';
import type {LimitSnapshot} from './limits.js';
import {installBrowser} from '../research/browser.js';
const exec=promisify(execFile);
type Role='main'|'worker';
export type SelectionMenu={title:string;options:{value:string;label:string}[];current:string|null;choose:(value:string)=>Promise<void>};
export class InteractiveSession extends EventEmitter {
  controller:Controller|null=null;busy=false;transcript='';status='Ready';approval='';
  selection:SelectionMenu|null=null;
  // undefined: not read yet; null: the runtime returned no usable limit data.
  limits:LimitSnapshot[]|null|undefined=undefined;
  providerSetupRequired=false;providerKeyInput=false;providerLoginText='';private providerAbort:AbortController|null=null;
  constructor(readonly home:string,readonly cwd:string,readonly config:Config,readonly singleAgent:boolean){super();}
  // Running count of appended characters: the transcript is a sliding window, so a view needs this to find new text.
  written=0;
  add(text:string){const safe=safeText(text);this.written+=safe.length;this.transcript=(this.transcript+safe).slice(-128*1024);this.emit('change');}
  private async models(){const client=await CodexClient.connect(this.home,this.cwd,startupArgs(this.config));try{return await client.models();}finally{await client.close();}}
  // Read-only native account call; no inference. A failed refresh keeps the last observed snapshot.
  async refreshLimits(){
    const read=async(client:CodexClient)=>parseLimits(await client.rpc.request('account/rateLimits/read',undefined));
    try{if(this.controller&&this.config.mode!=='adaptive')this.limits=await read(this.controller.client);else{const client=await CodexClient.connect(this.home,this.cwd,startupArgs(this.config));try{this.limits=await read(client);}finally{await client.close();}}}catch{this.limits??=null;}
    this.emit('change');
  }
  cancelSelection(){if(this.busy)return;if(this.providerSetupRequired){this.add('\n먼저 OpenAI와 OpenCode Go를 설정하세요. 종료하려면 Ctrl+Q를 누르세요.\n');return;}this.selection=null;this.emit('change');}
  async initializeProviders(){if(this.busy)return;this.providerSetupRequired=true;this.busy=true;this.status='Checking providers';this.emit('change');try{await this.openProviders(true);this.status='Ready';}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);this.providerMenu(null,null);}finally{this.busy=false;this.emit('change');}}
  private async openProviders(startup=false){const status=await providerStatus(this.home,this.cwd,this.config);this.providerSetupRequired=!status.openai.ready||!status.go.credentialStored;if(startup&&!this.providerSetupRequired){this.selection=null;return;}this.providerMenu(status.openai.ready,status.go.credentialStored);}
  private providerMenu(openai:boolean|null,go:boolean|null){
    const ko=this.config.language==='ko';this.approval=this.providerSetupRequired?(ko?'두 제공자 설정을 완료해 주세요. Ctrl+Q: 종료':'Complete both providers to continue. Ctrl+Q: quit'):'';this.selection={title:ko?'제공자 설정 · OpenAI / OpenCode Go':'Providers · OpenAI / OpenCode Go',current:null,
      options:[{value:'openai',label:`OpenAI · ${openai===null?(ko?'확인 실패 · 다시 로그인':'Status unknown · sign in'):openai?(ko?'로그인됨 · 다시 로그인':'Signed in · sign in again'):(ko?'OAuth 로그인 필요':'OAuth login required')}`},{value:'go',label:`OpenCode Go · ${go===null?(ko?'확인 실패 · 키 설정':'Status unknown · configure key'):go?(ko?'키 저장됨 · 변경':'Key stored · replace'):(ko?'API 키 저장 필요':'API key required')}`},{value:'refresh',label:ko?'상태 새로고침':'Refresh status'},...(openai&&go?[{value:'done',label:ko?'설정 완료 · Hera로 돌아가기':'Done · return to Hera'}]:[]),{value:'quit',label:ko?'종료':'Quit'}],choose:async value=>{
        if(value==='quit'){await this.close();this.emit('quit');return;}
        if(value==='done'){await this.openProviders(true);return;}
        if(value==='refresh'){await this.openProviders();return;}
        await this.newSession();
        if(value==='go'){this.providerKeyInput=true;return;}
        this.providerAbort=new AbortController();this.providerLoginText=ko?'브라우저에서 아래 주소를 열어 OpenAI에 로그인하세요.':'Open the following address in your browser to sign in to OpenAI.';
        try{await loginOpenAI(this.home,this.cwd,this.config,text=>{this.providerLoginText+='\n'+text;this.emit('change');},false,this.providerAbort.signal);}
        finally{this.providerAbort=null;this.providerLoginText='';await this.openProviders();}
      }};
  }
  cancelProviderKey(){if(this.busy)return;this.providerKeyInput=false;void this.initializeProviders();}
  async saveProviderKey(key:string){if(this.busy)return;this.providerKeyInput=false;this.busy=true;this.status='Saving credential';this.emit('change');try{await saveGoCredential(this.home,key);this.add('\nOpenCode Go 키를 OS 자격 증명 저장소에 저장했습니다.\n');await this.openProviders();this.status='Ready';}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);this.providerKeyInput=true;}finally{this.busy=false;this.emit('change');}}
  cancelApply(){if(this.busy)return;this.controller?.cancelApply();this.approval='';this.emit('change');}
  async approveApply(){const review=this.controller?.review;if(this.busy||!review)return;this.busy=true;this.status='Applying';this.emit('change');try{const results=await this.controller!.applyApproved(review.id);this.add('\n'+JSON.stringify(results)+'\n');this.status=this.controller!.phase.phase;}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);}finally{this.busy=false;this.approval='';this.emit('change');}}
  async selectOption(value:string){
    const menu=this.selection;if(this.busy||!menu||!menu.options.some(o=>o.value===value))return;
    this.busy=true;this.selection=null;this.status='Working';this.emit('change');
    try{await menu.choose(value);this.status='Ready';}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);}finally{this.busy=false;this.emit('change');}
  }
  private async saveModelChoice(role:Role,model:string,effort:Config['main']['reasoningEffort'],models:ModelView[]){
    const candidate=structuredClone(this.config);
    // The Go route has one model and its own effort setting; the saved GPT worker choice is left untouched.
    if(role==='worker'&&this.config.mode!=='gpt_only'){const level=goEffortSchema.safeParse(effort);if(model!==GO_MODEL||!level.success)throw new HeraError('UNSUPPORTED_GO_SETTING','Go 워커는 DeepSeek V4.1 Flash 모델과 low, high, max effort만 지원합니다.',2);candidate.workers.goReasoningEffort=level.data;}
    else{if(role==='main')candidate.main={model,reasoningEffort:effort};else{candidate.workers.gptModel=model;candidate.workers.reasoningEffort=effort;}validateModelChoices(candidate,models);}
    await this.newSession();await saveConfig(this.home,candidate);Object.assign(this.config,candidate);
    this.add(this.config.language==='ko'?`\n${role==='main'?(this.config.mode==='adaptive'?'깊은 추론':'메인'):(this.config.mode==='adaptive'?'일상 작업':'워커')} 설정 저장: ${model} / ${effort??'기본값'} · 다음 세션부터 적용됩니다.\n`:`\nSaved ${role}: ${model} / ${effort??'default'}; applies to the next session.\n`);
  }
  private async openSettings(action:'model'|'effort',role?:Role){
    const ko=this.config.language==='ko';
    if(!role){this.selection={title:ko?'설정할 역할 선택':'Choose a role',current:null,options:[{value:'main',label:`${ko?(this.config.mode==='adaptive'?'깊은 추론':'메인'):(this.config.mode==='adaptive'?'Reasoning':'Main')} · ${this.config.main.model??'—'} / ${this.config.main.reasoningEffort??'default'}`},{value:'worker',label:`${ko?(this.config.mode==='adaptive'?'일상 작업':'워커'):(this.config.mode==='adaptive'?'Routine':'Worker')} · ${this.config.mode!=='gpt_only'?GO_MODEL:this.config.workers.gptModel??'—'} / ${this.config.mode!=='gpt_only'?this.config.workers.goReasoningEffort:this.config.workers.reasoningEffort??'default'}`}],choose:async value=>this.openSettings(action,value as Role)};return;}
    if(role==='worker'&&this.config.mode!=='gpt_only'){
      const name=ko?(this.config.mode==='adaptive'?'일상 작업':'워커'):(this.config.mode==='adaptive'?'Routine':'Worker');
      this.selection=action==='model'?{title:ko?`${name} 모델 선택`:`Choose ${name.toLowerCase()} model`,current:GO_MODEL,options:[{value:GO_MODEL,label:GO_MODEL}],choose:async()=>this.openSettings('effort','worker')}
        :{title:`${name} · ${GO_MODEL} · effort`,current:this.config.workers.goReasoningEffort,options:goEffortSchema.options.map(value=>({value,label:value})),choose:async value=>this.saveModelChoice('worker',GO_MODEL,parseEffort(value),[])};
      return;}
    const models=await this.models();const model=role==='main'?this.config.main.model:this.config.workers.gptModel;
    if(action==='model'){
      if(!models.length)throw new HeraError('MODEL_UNAVAILABLE','The native model catalog is empty.',2);
      this.selection={title:ko?`${role==='main'?(this.config.mode==='adaptive'?'깊은 추론':'메인'):(this.config.mode==='adaptive'?'일상 작업':'워커')} 모델 선택`:`Choose ${role} model`,current:model,options:models.map(m=>({value:m.model,label:`${m.displayName} (${m.model})`})),choose:async value=>this.openEfforts(role,value,models)};
    }else{if(!model)throw new HeraError('MODEL_NOT_SELECTED',ko?'먼저 /model에서 모델을 선택하세요.':'Select a model with /model first.',2);this.openEfforts(role,model,models);}
  }
  private openEfforts(role:Role,model:string,models:ModelView[]){
    const selected=models.find(m=>m.model===model);if(!selected)throw new HeraError('MODEL_UNAVAILABLE','Selected model is absent from the native catalog; no fallback.',2);
    const ko=this.config.language==='ko';const current=role==='main'?this.config.main.reasoningEffort:this.config.workers.reasoningEffort;
    this.selection={title:`${role==='main'?(ko?(this.config.mode==='adaptive'?'깊은 추론':'메인'):(this.config.mode==='adaptive'?'Reasoning':'Main')):(ko?(this.config.mode==='adaptive'?'일상 작업':'워커'):(this.config.mode==='adaptive'?'Routine':'Worker'))} · ${model} · effort`,current:current??'default',options:[{value:'default',label:ko?'기본값 (모델 기본 설정)':'Default (model setting)'},...selected.supportedReasoningEfforts.map(e=>({value:e.reasoningEffort,label:e.reasoningEffort}))],choose:async value=>this.saveModelChoice(role,model,parseEffort(value),await this.models())};
  }
  async connect(id?:string){
    if(this.controller)return;
    const ready=await providerStatus(this.home,this.cwd,this.config);this.providerSetupRequired=!ready.openai.ready||!ready.go.credentialStored;
    if(this.providerSetupRequired){this.providerMenu(ready.openai.ready,ready.go.credentialStored);throw new HeraError('PROVIDER_SETUP_REQUIRED','먼저 /providers에서 OpenAI 로그인과 Go 키 저장을 완료하세요.',3);}
    const previous=id?(await listMetadata(this.home,this.cwd)).find(s=>s.heraSessionId===id):undefined;if(id&&!previous)throw new HeraError('SESSION_NOT_FOUND','No matching workspace session.',2);
    this.controller=await Controller.open(this.home,this.cwd,this.config,this.singleAgent,previous);
    this.controller.on('event',event=>{
      if(event.method==='item/agentMessage/delta'){const p=z.object({threadId:z.string(),delta:z.string()}).safeParse(event.params);if(p.success&&p.data.threadId===this.controller?.metadata?.codexThreadId)this.add(p.data.delta);}
      else if(event.method==='item/completed'){const p=z.object({item:z.object({type:z.string(),exitCode:z.number().nullable().optional()})}).safeParse(event.params);if(p.success&&p.data.item.type==='commandExecution')this.add(`\nTool exit: ${p.data.item.exitCode??'unknown'}\n`);}
      else if(event.method==='account/rateLimits/updated'&&this.limits){this.limits=mergeLimits(this.limits,event.params);this.emit('change');}
    });
    this.controller.on('workers',()=>this.emit('change'));
    const shown=new Set<string|number>();this.controller.on('requests',()=>{const request=this.controller!.requests.values().next().value;if(request&&!shown.has(request.id)){shown.add(request.id);this.add(`\n${request.summary}\n`);}for(const id of shown)if(!this.controller!.requests.has(id))shown.delete(id);this.emit('change');});
    this.controller.on('approval',request=>{this.approval=`${request.method}: denied; no permission expansion`;this.add(`\n${this.approval}\n`);});this.controller.on('notice',text=>this.add(`\n${text}\n`));this.controller.on('fault',e=>this.add(`\n${errorView(e).message}\n`));
  }
  async submit(text:string){if(this.busy)throw new HeraError('TURN_ACTIVE','Wait or cancel the active turn.',5);this.busy=true;this.status='Working';this.emit('change');try{if(text.startsWith('/')){
      // Echo the command like any other input; /providers arguments are rejected, so they are never echoed.
      const typed=text.trim();this.add(`\nYou: ${typed.startsWith('/providers')?'/providers':typed}\n`);await this.command(typed);}else{await this.connect();this.add(`\nYou: ${text}\nHera: `);await this.controller!.run(text);this.add('\n');void this.refreshLimits();}this.status='Ready';}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);}finally{this.busy=false;this.emit('change');}}
  private async command(text:string){const [command,...args]=text.split(/\s+/);switch(command){
    case '/research':{
      if(args.length>1)throw new HeraError('INVALID_COMMAND','/research [setup|status|open|resume]',2);
      const browser=this.controller?.client.research?.browser;
      if(!args.length){this.selection={title:'무료 웹 리서치 · 로컬 Playwright',current:null,options:[{value:'status',label:'상태 확인'},{value:'setup',label:'무료 Chromium 설치'},{value:'open',label:'CAPTCHA 해결용 브라우저 열기'},{value:'resume',label:'인증 완료 후 재개'}],choose:async value=>this.command('/research '+value)};break;}
      if(args[0]==='setup'){await installBrowser(this.home);this.add('\n무료 Chromium 설치 완료. 기존 브라우저와 로그인 정보는 사용하지 않습니다.\n');break;}
      if(args[0]==='status'){this.add('\n'+JSON.stringify(browser?.status()??{connected:false},null,2)+'\n');break;}
      if(!browser)throw new HeraError('RESEARCH_UNAVAILABLE','세션의 검색 요청이 있어야 합니다.',4);
      if(args[0]==='open'){await browser.openChallenge();this.add('\n전용 브라우저에서 CAPTCHA만 직접 해결하고 /research resume을 입력하세요. 로그인은 필요하지 않습니다.\n');break;}
      if(args[0]==='resume'){const result=await browser.resume();this.add(`\n인증 후 결과 확인 완료: ${result.url}\n결과를 캐시에 보관했습니다. 원래 조사 요청을 이어서 보내세요.\n`);break;}
      throw new HeraError('INVALID_COMMAND','/research [setup|status|open|resume]',2);
    }
    case '/providers':if(args.length)throw new HeraError('INVALID_COMMAND','/providers에서 선택하세요. 키를 명령 인수에 넣지 마세요.',2);await this.openProviders();break;
    case '/help':this.add('\n/providers /research [setup|status|open|resume] /help /mode [gpt_only|external_workers|adaptive] /model [main|worker] [ID] [effort] /effort [main|worker] level /workers [1-8] /plan TEXT /diff /resume [ID] /doctor /quit\nBare /model, /effort and /workers open selection menus. Effort default clears the override. Enter sends; backslash+Enter, Shift+Enter or Ctrl+J inserts a line. Escape interrupts active work; press it twice to clear input. Ctrl+C interrupts active work, otherwise clears input, and a second Ctrl+C exits; Ctrl+Q exits after cleanup. Up/Down recall sent input.\n');break;
    case '/mode':{if(!args[0]){this.selection={title:'모드 선택 · 다음 세션부터 적용',current:this.config.mode,options:[{value:'gpt_only',label:'GPT 전용 · 공식 엔진'},{value:'external_workers',label:'GPT 메인 + DeepSeek 워커 · 전용 엔진'},{value:'adaptive',label:'DeepSeek 일상 작업 + Astra 깊은 추론 · 전용 엔진'}],choose:async value=>this.command(`/mode ${value}`)};break;}if(args.length!==1||!['gpt_only','external_workers','adaptive'].includes(args[0]))throw new HeraError('INVALID_MODE','Use gpt_only, external_workers or adaptive.',2);if(args[0]!=='gpt_only'&&!await externalRuntime(this.home))throw new HeraError('EXTERNAL_RUNTIME_MISSING','혼합 모드용 검증 엔진을 먼저 설치하세요. GPT로 자동 전환하지 않습니다.',4);const candidate={...this.config,mode:args[0] as Config['mode']};await this.newSession();await saveConfig(this.home,candidate);Object.assign(this.config,candidate);this.add(`\n모드: ${this.config.mode} · 다음 세션부터 적용. /doctor에서 검증 상태를 확인하세요.\n`);break;}
    case '/model':case '/effort':{
      if(!args.length){await this.openSettings(command==='/model'?'model':'effort');break;}
      const role=args[0]==='main'||args[0]==='worker'?args.shift()! as Role:'main';
      if(!args.length){await this.openSettings(command==='/model'?'model':'effort',role);break;}
      if(command==='/effort'&&args.length!==1||command==='/model'&&args.length>2)throw new HeraError('INVALID_COMMAND','Use /model [main|worker] [ID] [effort] or /effort [main|worker] [level].',2);
      const model=command==='/model'?args[0]!:(role==='main'?this.config.main.model:this.config.mode!=='gpt_only'?GO_MODEL:this.config.workers.gptModel);
      if(!model)throw new HeraError('MODEL_NOT_SELECTED','Select a model with /model first.',2);
      const value=command==='/effort'?args[0]:args[1];const effort=value===undefined?(role==='main'?this.config.main.reasoningEffort:this.config.mode!=='gpt_only'?this.config.workers.goReasoningEffort:this.config.workers.reasoningEffort):parseEffort(value);
      await this.saveModelChoice(role,model,effort,await this.models());break;
    }
    case '/workers':{
      if(!args.length){const project=projectSchema.parse(await existsJson(join(this.cwd,'.hera.json'))??{});const ceiling=project.maxConcurrent??8;this.selection={title:this.config.language==='ko'?'워커 수 선택 (변경 후 검증 상태 확인)':'Choose worker limit (check verification after changes)',current:String(this.config.workers.maxConcurrent),options:Array.from({length:ceiling},(_,i)=>({value:String(i+1),label:String(i+1)})),choose:async value=>this.command(`/workers ${value}`)};break;}
      if(args.length){if(args.length!==1||!/^\d+$/.test(args[0]!))throw new HeraError('INVALID_COMMAND','Use /workers [1-8].',2);const limit=configSchema.shape.workers.shape.maxConcurrent.safeParse(Number(args[0]));if(!limit.success)throw new HeraError('INVALID_WORKER_LIMIT','Worker limit must be 1-8.',2);const project=projectSchema.parse(await existsJson(join(this.cwd,'.hera.json'))??{});if(project.maxConcurrent!==undefined&&limit.data>project.maxConcurrent)throw new HeraError('PROJECT_WORKER_LIMIT','Requested worker count exceeds the project ceiling.',2);const candidate=structuredClone(this.config);candidate.workers.maxConcurrent=limit.data;await this.newSession();await saveConfig(this.home,candidate);Object.assign(this.config,candidate);}
      this.add(`\n워커 상한: ${this.config.workers.maxConcurrent} · 모델: ${this.config.mode!=='gpt_only'?GO_MODEL:this.config.workers.gptModel??'미선택'} / ${this.config.mode!=='gpt_only'?this.config.workers.goReasoningEffort:this.config.workers.reasoningEffort??'default'}. /doctor에서 현재 설정의 검증 상태를 확인하세요.\n`);break;
    }
    case '/plan':await this.connect();await this.controller!.run(`Plan only; do not modify files.\n${args.join(' ')}`,undefined,true);break;
    case '/apply':this.add('\n별도 /apply는 필요하지 않습니다. 원하는 수정 작업을 입력하면 수정과 테스트를 이어서 진행합니다.\n');break;
    case '/diff':{const result=await exec('git',['--no-pager','diff','--no-ext-diff','--no-textconv'],{cwd:this.cwd,windowsHide:true,maxBuffer:1024*1024});const status=await exec('git',['status','--short'],{cwd:this.cwd,windowsHide:true,maxBuffer:1024*1024});this.add(`\n${result.stdout||'(No unstaged tracked diff)'}\nStatus (includes staged/untracked):\n${status.stdout||'(clean)'}\n`);break;}
    case '/resume':{const rows=await listMetadata(this.home,this.cwd);if(!args[0]){this.add('\n'+JSON.stringify(rows.map(s=>({id:s.heraSessionId,status:s.status})),null,2)+'\n');break;}await this.newSession();await this.connect(args[0]);this.add('\nNative thread resumed; no prior turn replayed.\n');break;}
    case '/doctor':{const client=await CodexClient.connect(this.home,this.cwd,startupArgs(this.config));try{this.add('\n'+JSON.stringify({account:await client.account(),capabilities:await capabilityReport(this.config,this.home)},null,2)+'\n');}finally{await client.close();}break;}
    case '/quit':await this.close();this.emit('quit');break;
    default:throw new HeraError('UNKNOWN_COMMAND','Unknown slash command. Use /help.',2);
  }}
  async interrupt(){if(this.providerAbort){this.providerAbort.abort();return;}if(this.controller?.busy){await this.controller.interrupt();}else this.add('\nNo model turn is active. Use /quit to exit.\n');}
  private async newSession(){if(this.controller&&!await this.controller.close())throw new HeraError('INTERRUPTED_UNCONFIRMED','Cannot switch sessions until prior execution is reconciled.',5,false);this.controller=null;}
  async close(){this.providerAbort?.abort();this.providerKeyInput=false;if(this.controller&&!await this.controller.close())process.exitCode=5;}
}
