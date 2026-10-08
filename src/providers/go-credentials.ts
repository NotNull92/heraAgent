import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {z} from 'zod';
import {HeraError} from '../errors.js';
import {childEnvironment} from '../codex/launcher.js';
import {rejectRepositoryHome} from '../paths.js';
import {startupCheck} from '../codex/startup.js';

export function validateGoKey(key:string){if(!/^[\x21-\x7e]{1,2048}$/.test(key))throw new HeraError('INVALID_GO_KEY','Go key must be 1-2048 printable ASCII characters without spaces.',2);return key;}
async function target(home:string){const canonical=await realpath(home);await rejectRepositoryHome(canonical);return 'hera-agent/opencode-go/'+createHash('sha256').update(process.platform==='win32'?canonical.toLowerCase():canonical).digest('hex');}
function run(home:string,file:string,args:string[],input=''):Promise<{code:number;stdout:string}>{
  return new Promise((resolve,reject)=>{
    const child=execFile(file,args,{cwd:home,env:childEnvironment(home,home),encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:16384},(error,stdout)=>{
      if(error&&(typeof error.code!=='number'||error.killed)){reject(new HeraError('CREDENTIAL_STORE_UNAVAILABLE','OS credential storage is unavailable or timed out; no plaintext fallback.',3));return;}
      resolve({code:error?.code as number??0,stdout});
    });
    child.stdin?.on('error',()=>{});child.stdin?.end(input);
  });
}
async function stored(home:string,action:'read'|'write'|'delete',value?:string):Promise<string|null>{
  return action==='read'?startupCheck('go-key:'+home,()=>storedOnce(home,action,value)):storedOnce(home,action,value);
}
async function storedOnce(home:string,action:'read'|'write'|'delete',value?:string):Promise<string|null>{
  const id=await target(home);
  if(process.platform==='win32'){
    const root=process.env.SYSTEMROOT??process.env.SystemRoot;if(!root)throw new HeraError('CREDENTIAL_STORE_UNAVAILABLE','Windows system directory is unavailable.',3);
    const result=await run(home,join(root,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('../../assets/auth/go-credential.ps1',import.meta.url))],JSON.stringify({target:id,action,value}));
    if(result.code!==0)throw new HeraError('CREDENTIAL_STORE_UNAVAILABLE','Windows Credential Manager operation failed; no plaintext fallback.',3);
    try{return z.object({value:z.string().nullable()}).parse(JSON.parse(result.stdout)).value;}catch{throw new HeraError('INVALID_STORED_CREDENTIAL','OS credential response was invalid; details omitted to protect secrets.',3);}
  }
  if(process.platform==='darwin'){
    // Send the secret through stdin, never argv. Base64 avoids security -i command parsing ambiguity.
    const args=action==='write'?['-i','-q']:[action==='read'?'find-generic-password':'delete-generic-password','-s',id,'-a','hera-opencode-go',...(action==='read'?['-w']:[])];
    const input=action==='write'?`add-generic-password -U -s ${id} -a hera-opencode-go -w ${Buffer.from(value!,'utf8').toString('base64')}\n`:'';
    const result=await run(home,'/usr/bin/security',args,input);
    if(result.code===44&&action!=='write')return null;
    if(result.code!==0)throw new HeraError('CREDENTIAL_STORE_UNAVAILABLE','macOS Keychain operation failed; unlock the login keychain. No plaintext fallback.',3);
    if(action!=='read')return null;
    const encoded=result.stdout.trim();const decoded=Buffer.from(encoded,'base64');if(decoded.toString('base64')!==encoded)throw new HeraError('INVALID_STORED_CREDENTIAL','Stored Go credential has an invalid format.',3);return decoded.toString('utf8');
  }
  throw new HeraError('UNSUPPORTED_PLATFORM','Credential storage supports Windows and macOS.',3);
}
export async function resolveGoCredential(home:string){const env=process.env.HERA_OPENCODE_GO_API_KEY;if(env)return {key:validateGoKey(env),source:'environment' as const};const key=await stored(home,'read');return key===null?{key:undefined,source:'none' as const}:{key:validateGoKey(key),source:'keyring' as const};}
export async function goCredentialStatus(home:string){const saved=await stored(home,'read');if(saved!==null)validateGoKey(saved);const env=process.env.HERA_OPENCODE_GO_API_KEY;if(env)validateGoKey(env);return {credentialReady:!!(env||saved),credentialStored:saved!==null,credentialSource:env?'environment':saved!==null?'keyring':'none'};}
export async function saveGoCredential(home:string,key:string){validateGoKey(key);await stored(home,'write',key);if(await stored(home,'read')!==key)throw new HeraError('CREDENTIAL_SAVE_UNCONFIRMED','OS credential readback did not match; storage is unconfirmed.',3,false);}
export async function deleteGoCredential(home:string){await stored(home,'delete');if(await stored(home,'read')!==null)throw new HeraError('CREDENTIAL_DELETE_UNCONFIRMED','OS credential removal is unconfirmed.',3,false);}
