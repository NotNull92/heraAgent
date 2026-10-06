import {EventEmitter} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {CodexClient} from '../codex/client.js';
import {startupArgs} from '../codex/config-compiler.js';
import {Controller} from './controller.js';
import type {Config} from '../config.js';
import {saveConfig} from '../config.js';
import {listMetadata} from '../metadata.js';
import {safeText,HeraError,errorView} from '../errors.js';
import {capabilityReport} from '../codex/capabilities.js';
const exec=promisify(execFile);
export class InteractiveSession extends EventEmitter {
  controller:Controller|null=null;busy=false;transcript='';status='Ready';approval='';
  constructor(readonly home:string,readonly cwd:string,readonly config:Config,readonly singleAgent:boolean){super();}
  add(text:string){this.transcript=(this.transcript+safeText(text)).slice(-128*1024);this.emit('change');}
  async connect(id?:string){if(this.controller)return;const previous=id?(await listMetadata(this.home,this.cwd)).find(s=>s.heraSessionId===id):undefined;if(id&&!previous)throw new HeraError('SESSION_NOT_FOUND','No matching workspace session.',2);this.controller=await Controller.open(this.home,this.cwd,this.config,this.singleAgent,previous);this.controller.on('event',event=>{if(event.method==='item/agentMessage/delta'){const p=z.object({delta:z.string()}).safeParse(event.params);if(p.success)this.add(p.data.delta);}else if(event.method==='item/completed'){const p=z.object({item:z.object({type:z.string(),exitCode:z.number().nullable().optional()})}).safeParse(event.params);if(p.success&&p.data.item.type==='commandExecution')this.add(`\nTool exit: ${p.data.item.exitCode??'unknown'}\n`);}else if(event.method==='item/started'){const p=z.object({item:z.object({type:z.string()})}).safeParse(event.params);if(p.success&&['collabAgentToolCall','subAgentActivity'].includes(p.data.item.type)){this.add('\nUnexpected worker activity: safety gate invalidated.\n');void this.controller?.close();}}});this.controller.on('approval',request=>{this.approval=`${request.method}: denied (read-only); no permission grant`;this.add(`\n${this.approval}\n`);});this.controller.on('fault',e=>this.add(`\n${errorView(e).message}\n`));}
  async submit(text:string){if(this.busy)throw new HeraError('TURN_ACTIVE','Wait or cancel the active turn.',5);this.busy=true;this.status='Working';this.emit('change');try{if(text.startsWith('/'))await this.command(text.trim());else{await this.connect();this.add(`\nYou: ${text}\nHera: `);await this.controller!.run(text);this.add('\n');}this.status='Ready';}catch(e){this.status=errorView(e).errorCode;this.add(`\n${errorView(e).message}\n`);}finally{this.busy=false;this.emit('change');}}
  private async command(text:string){const [command,...args]=text.split(/\s+/);switch(command){
    case '/help':this.add('\n/help /mode [gpt_only|external_workers] /model [ID] /workers /plan TEXT /apply /diff /resume [ID] /doctor /quit\nEnter inserts a line; Ctrl+S sends. Escape clears input. Ctrl+C requests turn interruption.\n');break;
    case '/mode':if(!args[0]){this.add(`\nMode: ${this.config.mode}. external_workers: blocked G10-G15.\n`);break;}if(args[0]!=='gpt_only')throw new HeraError('EXTERNAL_MODE_BLOCKED','external_workers is unavailable; no provider fallback.',4);await this.newSession();this.config.mode='gpt_only';await saveConfig(this.home,this.config);this.add('\nNew GPT-only session selected.\n');break;
    case '/model':{const client=await CodexClient.connect(this.home,this.cwd,startupArgs(this.config));try{const models=await client.models();if(!args[0]){this.add('\nCatalog (access unverified):\n'+models.map(m=>`${m.model}: ${m.displayName}`).join('\n')+'\n');break;}if(!models.some(m=>m.model===args[0]))throw new HeraError('MODEL_UNAVAILABLE','Choose an exact catalog model ID.',2);await this.newSession();this.config.main.model=args[0];await saveConfig(this.home,this.config);this.add(`\nRequested main model: ${args[0]}; next session.\n`);}finally{await client.close();}break;}
    case '/workers':this.add(`\nWorkers disabled: G02-G04 not verified. Configured future limit: ${this.config.workers.maxConcurrent}; worker model: ${this.config.workers.gptModel??'unselected'}. No live count claimed.\n`);break;
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
  async close(){if(this.controller)await this.controller.close();}
}
