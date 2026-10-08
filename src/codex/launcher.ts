import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir,realpath} from 'node:fs/promises';
import {dirname,join,isAbsolute,delimiter,resolve} from 'node:path';
import {spawn,spawnSync, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {z} from 'zod';
import {HeraError} from '../errors.js';
export const CODEX_VERSION='0.161.0';
export function runtimeLauncher() {
  const require=createRequire(import.meta.url);
  const file=require.resolve('@openai/codex/package.json');
  const manifest=z.object({version:z.literal(CODEX_VERSION),bin:z.object({codex:z.string()})}).safeParse(JSON.parse(readFileSync(file,'utf8')));
  if(!manifest.success)throw new HeraError('UNSUPPORTED_RUNTIME','Installed Codex differs from the pinned contract.',4);
  const launcher=resolve(dirname(file),manifest.data.bin.codex);
  if(!launcher.startsWith(dirname(file)+ '\\')&&!launcher.startsWith(dirname(file)+'/'))throw new HeraError('UNSAFE_LAUNCHER','Package launcher escapes its package.',4);
  return launcher;
}
export function childEnvironment(home:string,cwd:string,source:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv {
  const env:NodeJS.ProcessEnv={};
  for(const [key,value] of Object.entries(source))if(value!==undefined&&/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|HOME|LOCALAPPDATA|APPDATA|COMSPEC|LANG|LC_ALL|TERM|COLORTERM|NO_COLOR)$/i.test(key))env[process.platform==='win32'?key.toUpperCase():key]=value;
  const pathKey=process.platform==='win32'?'PATH':'PATH';
  env[pathKey]=(env[pathKey]??'').split(delimiter).filter(p=>isAbsolute(p)&&resolve(p).toLowerCase()!==resolve(cwd).toLowerCase()).join(delimiter);
  env.CODEX_HOME=join(home,'codex');return env;
}
export async function launch(home:string,cwd:string,overrides:string[]=[]):Promise<ChildProcessWithoutNullStreams> {
  const env=childEnvironment(home,cwd);await mkdir(env.CODEX_HOME!,{recursive:true,mode:0o700});
  return spawn(process.execPath,[runtimeLauncher(),'app-server','--strict-config','-c','cli_auth_credentials_store="keyring"',...overrides],{cwd:await realpath(cwd),env,shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
}
export async function closeOwned(child:ChildProcessWithoutNullStreams):Promise<boolean> {
  if(child.exitCode!==null||child.signalCode!==null)return true;
  const exited=new Promise<boolean>(resolve=>child.once('exit',()=>resolve(true)));
  child.stdin.end();
  let timer:NodeJS.Timeout|undefined;
  const graceful=await Promise.race([exited,new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),5000);})]);
  clearTimeout(timer);if(graceful)return true;
  if(child.pid!==undefined){if(process.platform==='win32'){
    const root=process.env.SYSTEMROOT??process.env.SystemRoot;
    if(root)spawnSync(join(root,'System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:5000});
  }else{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}}
  await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);clearTimeout(timer);
  return false; // Forced termination cannot establish safe completion of tools.
}
