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
import {saveConfig,parseEffort,configSchema,projectSchema} from '../config.js';
import {listMetadata} from '../metadata.js';
import {safeText,HeraError,errorView} from '../errors.js';
import {capabilityReport} from '../codex/capabilities.js';
const exec=promisify(execFile);
type Role='main'|'worker';
export type SelectionMenu={title:string;options:{value:string;label:string}[];current:string|null;choose:(value:string)=>Promise<void>};
export class InteractiveSession extends EventEmitter {
  controller:Controller|null=null;busy=false;transcript='';status='Ready';approval='';
  selection:SelectionMenu|null=null;
  constructor(readonly home:string,readonly cwd:string,readonly config:Config,readonly singleAgent:boolean){super();}
  add(text:string){this.transcript=(this.transcript+safeText(text)).slice(-128*1024);this.emit('change');}
  private async models(){const client=await CodexClient.connect(this.home,this.cwd,startupArgs(this.config));try{return await client.models();}finally{await client.close();}}
  cancelSelection(){if(this.busy)return;this.selection=null;this.emit('change');}
  async selectOption(value:string){
    const menu=this.selection;if(this.busy||!menu||!menu.options.some(o=>o.value===value))return;
    this.busy=true;this.selection=null;this.status='Working';this.emit('change');
    try{await menu.choose(value);this.status='Ready';}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);}finally{this.busy=false;this.emit('change');}
  }
  private async saveModelChoice(role:Role,model:string,effort:Config['main']['reasoningEffort'],models:ModelView[]){
    const candidate=structuredClone(this.config);if(role==='main')candidate.main={model,reasoningEffort:effort};else{candidate.workers.gptModel=model;candidate.workers.reasoningEffort=effort;}
    validateModelChoices(candidate,models);await this.newSession();await saveConfig(this.home,candidate);Object.assign(this.config,candidate);
    this.add(this.config.language==='ko'?`\n${role==='main'?'메인':'워커'} 설정 저장: ${model} / ${effort??'기본값'} · 다음 세션부터 적용됩니다.\n`:`\nSaved ${role}: ${model} / ${effort??'default'}; applies to the next session.\n`);
  }
  private async openSettings(action:'model'|'effort',role?:Role){
    const ko=this.config.language==='ko';
    if(!role){this.selection={title:ko?'설정할 역할 선택':'Choose a role',current:null,options:[{value:'main',label:`${ko?'메인':'Main'} · ${this.config.main.model??'—'} / ${this.config.main.reasoningEffort??'default'}`},{value:'worker',label:`${ko?'워커':'Worker'} · ${this.config.workers.gptModel??'—'} / ${this.config.workers.reasoningEffort??'default'}`}],choose:async value=>this.openSettings(action,value as Role)};return;}
    const models=await this.models();const model=role==='main'?this.config.main.model:this.config.workers.gptModel;
    if(action==='model'){
      if(!models.length)throw new HeraError('MODEL_UNAVAILABLE','The native model catalog is empty.',2);
      this.selection={title:ko?`${role==='main'?'메인':'워커'} 모델 선택`:`Choose ${role} model`,current:model,options:models.map(m=>({value:m.model,label:`${m.displayName} (${m.model})`})),choose:async value=>this.openEfforts(role,value,models)};
    }else{if(!model)throw new HeraError('MODEL_NOT_SELECTED',ko?'먼저 /model에서 모델을 선택하세요.':'Select a model with /model first.',2);this.openEfforts(role,model,models);}
  }
  private openEfforts(role:Role,model:string,models:ModelView[]){
    const selected=models.find(m=>m.model===model);if(!selected)throw new HeraError('MODEL_UNAVAILABLE','Selected model is absent from the native catalog; no fallback.',2);
    const ko=this.config.language==='ko';const current=role==='main'?this.config.main.reasoningEffort:this.config.workers.reasoningEffort;
    this.selection={title:`${role==='main'?(ko?'메인':'Main'):(ko?'워커':'Worker')} · ${model} · effort`,current:current??'default',options:[{value:'default',label:ko?'기본값 (모델 기본 설정)':'Default (model setting)'},...selected.supportedReasoningEfforts.map(e=>({value:e.reasoningEffort,label:e.reasoningEffort}))],choose:async value=>this.saveModelChoice(role,model,parseEffort(value),await this.models())};
  }
  async connect(id?:string){if(this.controller)return;const previous=id?(await listMetadata(this.home,this.cwd)).find(s=>s.heraSessionId===id):undefined;if(id&&!previous)throw new HeraError('SESSION_NOT_FOUND','No matching workspace session.',2);this.controller=await Controller.open(this.home,this.cwd,this.config,this.singleAgent,previous);this.controller.on('event',event=>{if(event.method==='item/agentMessage/delta'){const p=z.object({delta:z.string()}).safeParse(event.params);if(p.success)this.add(p.data.delta);}else if(event.method==='item/completed'){const p=z.object({item:z.object({type:z.string(),exitCode:z.number().nullable().optional()})}).safeParse(event.params);if(p.success&&p.data.item.type==='commandExecution')this.add(`\nTool exit: ${p.data.item.exitCode??'unknown'}\n`);}else if(event.method==='item/started'){const p=z.object({item:z.object({type:z.string()})}).safeParse(event.params);if(p.success&&['collabAgentToolCall','subAgentActivity'].includes(p.data.item.type)){this.add('\nUnexpected worker activity: safety gate invalidated.\n');void this.controller?.close();}}});this.controller.on('approval',request=>{this.approval=`${request.method}: denied (read-only); no permission grant`;this.add(`\n${this.approval}\n`);});this.controller.on('fault',e=>this.add(`\n${errorView(e).message}\n`));}
  async submit(text:string){if(this.busy)throw new HeraError('TURN_ACTIVE','Wait or cancel the active turn.',5);this.busy=true;this.status='Working';this.emit('change');try{if(/^[\\/]/.test(text))await this.command('/'+text.trim().slice(1));else{await this.connect();this.add(`\nYou: ${text}\nHera: `);await this.controller!.run(text);this.add('\n');}this.status='Ready';}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);}finally{this.busy=false;this.emit('change');}}
  private async command(text:string){const [command,...args]=text.split(/\s+/);switch(command){
    case '/help':this.add('\n/help /mode [gpt_only|external_workers] /model [main|worker] [ID] [effort] /effort [main|worker] level /workers [1-8] /plan TEXT /apply /diff /resume [ID] /doctor /quit\nBare /model, /effort and /workers open selection menus. Commands accept / or backslash. Effort default clears the override. Enter inserts a line; Ctrl+S sends. Escape clears input. Ctrl+C requests turn interruption.\n');break;
    case '/mode':if(!args[0]){this.add(`\nMode: ${this.config.mode}. external_workers: blocked G10-G15.\n`);break;}if(args[0]!=='gpt_only')throw new HeraError('EXTERNAL_MODE_BLOCKED','external_workers is unavailable; no provider fallback.',4);await this.newSession();this.config.mode='gpt_only';await saveConfig(this.home,this.config);this.add('\nNew GPT-only session selected.\n');break;
    case '/model':case '/effort':{
      if(!args.length){await this.openSettings(command==='/model'?'model':'effort');break;}
      const role=args[0]==='main'||args[0]==='worker'?args.shift()! as Role:'main';
      if(!args.length){await this.openSettings(command==='/model'?'model':'effort',role);break;}
      if(command==='/effort'&&args.length!==1||command==='/model'&&args.length>2)throw new HeraError('INVALID_COMMAND','Use /model [main|worker] [ID] [effort] or /effort [main|worker] [level].',2);
      const model=command==='/model'?args[0]!:(role==='main'?this.config.main.model:this.config.workers.gptModel);
      if(!model)throw new HeraError('MODEL_NOT_SELECTED','Select a model with /model first.',2);
      const value=command==='/effort'?args[0]:args[1];const effort=value===undefined?(role==='main'?this.config.main.reasoningEffort:this.config.workers.reasoningEffort):parseEffort(value);
      await this.saveModelChoice(role,model,effort,await this.models());break;
    }
    case '/workers':{
      if(!args.length){const project=projectSchema.parse(await existsJson(join(this.cwd,'.hera.json'))??{});const ceiling=project.maxConcurrent??8;this.selection={title:this.config.language==='ko'?'워커 수 선택 (실행은 검증 전 비활성)':'Choose worker limit (workers remain disabled)',current:String(this.config.workers.maxConcurrent),options:Array.from({length:ceiling},(_,i)=>({value:String(i+1),label:String(i+1)})),choose:async value=>this.command(`/workers ${value}`)};break;}
      if(args.length){if(args.length!==1||!/^\d+$/.test(args[0]!))throw new HeraError('INVALID_COMMAND','Use /workers [1-8].',2);const limit=configSchema.shape.workers.shape.maxConcurrent.safeParse(Number(args[0]));if(!limit.success)throw new HeraError('INVALID_WORKER_LIMIT','Worker limit must be 1-8.',2);const project=projectSchema.parse(await existsJson(join(this.cwd,'.hera.json'))??{});if(project.maxConcurrent!==undefined&&limit.data>project.maxConcurrent)throw new HeraError('PROJECT_WORKER_LIMIT','Requested worker count exceeds the project ceiling.',2);const candidate=structuredClone(this.config);candidate.workers.maxConcurrent=limit.data;await this.newSession();await saveConfig(this.home,candidate);Object.assign(this.config,candidate);}
      this.add(`\nWorkers disabled: G02-G04 not verified. Configured future limit: ${this.config.workers.maxConcurrent}; worker model: ${this.config.workers.gptModel??'unselected'} / ${this.config.workers.reasoningEffort??'default'}. No live count claimed.\n`);break;
    }
    case '/plan':await this.connect();await this.controller!.run(`Read-only plan and patch proposal; do not apply changes.\n${args.join(' ')}`);break;
    case '/apply':if(!this.controller)throw new HeraError('APPLY_GATE_BLOCKED','No verified quiescent analysis. Apply is blocked pending G02/G03/G14.',4);await this.controller.requestApply();break;
    case '/diff':{const result=await exec('git',['--no-pager','diff','--no-ext-diff','--no-textconv'],{cwd:this.cwd,windowsHide:true,maxBuffer:1024*1024});const status=await exec('git',['status','--short'],{cwd:this.cwd,windowsHide:true,maxBuffer:1024*1024});this.add(`\n${result.stdout||'(No unstaged tracked diff)'}\nStatus (includes staged/untracked):\n${status.stdout||'(clean)'}\n`);break;}
    case '/resume':{const rows=await listMetadata(this.home,this.cwd);if(!args[0]){this.add('\n'+JSON.stringify(rows.map(s=>({id:s.heraSessionId,status:s.status})),null,2)+'\n');break;}await this.newSession();await this.connect(args[0]);this.add('\nNative thread resumed read-only; no prior turn replayed.\n');break;}
    case '/doctor':{const client=await CodexClient.connect(this.home,this.cwd,startupArgs(this.config));try{this.add('\n'+JSON.stringify({account:await client.account(),capabilities:await capabilityReport(this.config)},null,2)+'\n');}finally{await client.close();}break;}
    case '/quit':await this.close();this.emit('quit');break;
    default:throw new HeraError('UNKNOWN_COMMAND','Unknown slash command. Use /help.',2);
  }}
  async interrupt(){if(this.controller?.busy){await this.controller.interrupt();this.add('\nInterruption requested; completion unconfirmed.\n');}else this.add('\nNo model turn is active. Use /quit to exit.\n');}
  private async newSession(){if(this.controller&&!await this.controller.close())throw new HeraError('INTERRUPTED_UNCONFIRMED','Cannot switch sessions until prior execution is reconciled.',5,false);this.controller=null;}
  async close(){if(this.controller&&!await this.controller.close())process.exitCode=5;}
}
