import {z} from 'zod';
import {CodexClient} from '../codex/client.js';
import {startupArgs} from '../codex/config-compiler.js';
import type {Config} from '../config.js';
import {HeraError} from '../errors.js';
import {goCredentialStatus} from './go-credentials.js';

export async function providerStatus(home:string,cwd:string,config:Config){
  const client=await CodexClient.connect(home,cwd,startupArgs(config));
  try{return {openai:await client.account(),go:await goCredentialStatus(home)};}finally{await client.close();}
}
export async function loginOpenAI(home:string,cwd:string,config:Config,show:(text:string)=>void,device=false,signal?:AbortSignal){
  const client=await CodexClient.connect(home,cwd,startupArgs(config));let timer:NodeJS.Timeout|undefined;let loginId:string|undefined;let abort:()=>void=()=>{};
  try{
    const done=new Promise<void>((resolve,reject)=>{
      abort=()=>reject(new HeraError('LOGIN_INTERRUPTED','Official login canceled.',130));
      signal?.addEventListener('abort',abort,{once:true});process.once('SIGINT',abort);process.once('SIGTERM',abort);
      timer=setTimeout(()=>reject(new HeraError('LOGIN_TIMEOUT','Official login expired.',3)),300000);
      client.on('event',e=>{if(e.method==='account/login/completed'){const p=z.object({success:z.boolean()}).safeParse(e.params);if(p.success&&p.data.success)resolve();else reject(new HeraError('LOGIN_FAILED','Official login did not complete.',3));}});client.on('fault',reject);
    });void done.catch(()=>{});
    if(signal?.aborted)throw new HeraError('LOGIN_INTERRUPTED','Official login canceled.',130);
    const reply=z.object({loginId:z.string(),authUrl:z.string().optional(),verificationUrl:z.string().optional(),userCode:z.string().optional()}).parse(await client.rpc.request('account/login/start',{type:device?'chatgptDeviceCode':'chatgpt'}));loginId=reply.loginId;
    show(reply.authUrl??reply.verificationUrl??'');if(reply.userCode)show(`One-time code: ${reply.userCode}`);await done;
    if(!(await client.account()).ready)throw new HeraError('LOGIN_UNCONFIRMED','Official login readiness is unconfirmed.',3);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);if(loginId)await client.rpc.request('account/login/cancel',{loginId}).catch(()=>{});await client.close();}
}
