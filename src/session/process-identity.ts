import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {z} from 'zod';

const exec=promisify(execFile);
const identitySchema=z.object({startedAt:z.string().refine(value=>Number.isFinite(Date.parse(value))),executable:z.string().min(1).optional()});
export async function readProcessIdentity(pid:number){
  if(!Number.isSafeInteger(pid)||pid<=0)return null;
  try{
    const options={encoding:'utf8' as const,windowsHide:true,timeout:3000,maxBuffer:16384};
    if(process.platform==='win32'){
      const root=process.env.SYSTEMROOT??process.env.SystemRoot;if(!root)return null;
      const command=`$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $p=Get-Process -Id ${pid}; @{startedAt=$p.StartTime.ToUniversalTime().ToString('o'); executable=$p.Path} | ConvertTo-Json -Compress`;
      const {stdout}=await exec(join(root,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],options);
      return identitySchema.parse(JSON.parse(stdout));
    }
    if(process.platform==='darwin'){
      // ps comm is argv[0], which a process can change; only its OS start time is stable.
      const {stdout}=await exec('/bin/ps',['-p',String(pid),'-o','lstart='],{...options,env:{...process.env,LC_ALL:'C',TZ:'UTC0'}});
      if(!/^\w{3} +\w{3} +\d{1,2} +\d{2}:\d{2}:\d{2} +\d{4}$/.test(stdout.trim()))return null;
      return identitySchema.parse({startedAt:new Date(stdout.trim()+' UTC').toISOString()});
    }
  }catch{/* Unavailable identity is not evidence that a live session has exited. */}
  return null;
}
