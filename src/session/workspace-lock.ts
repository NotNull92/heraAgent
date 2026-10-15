import {readFile,readdir,unlink,rmdir,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {atomicJson} from '../paths.js';
import {HeraError} from '../errors.js';
import {readProcessIdentity} from './process-identity.js';
const presenceSchema=z.object({pid:z.number().int().positive(),executable:z.string(),processStartedAt:z.string(),acquiredAt:z.string(),workspace:z.string(),heraSessionId:z.string().optional()});
export async function acquireWorkspace(home:string,cwd:string){
  const canonical=await realpath(cwd);const identity=process.platform==='win32'?canonical.toLowerCase():canonical;
  const dir=join(home,'locks',createHash('sha256').update(identity).digest('hex'));
  const file=join(dir,`${process.pid}.json`);
  const self=await readProcessIdentity(process.pid);
  const record={pid:process.pid,executable:self?.executable??process.execPath,processStartedAt:self?.startedAt??new Date(Date.now()-process.uptime()*1000).toISOString(),acquiredAt:new Date().toISOString(),workspace:canonical};
  // Windows refuses to replace a record while another session is reading it (EPERM/EBUSY/EACCES); ENOENT is a directory removed by a concurrent release.
  async function write(value:unknown){for(let attempt=1;;attempt++){try{await atomicJson(file,value);return;}catch(error){if(attempt===5||!error||typeof error!=='object'||!('code'in error)||!['ENOENT','EPERM','EBUSY','EACCES'].includes(String(error.code)))throw error;await new Promise(resolve=>setTimeout(resolve,50*attempt));}}}
  async function liveRecords(){
    const live:z.infer<typeof presenceSchema>[]=[];
    for(const entry of await readdir(dir,{withFileTypes:true})){
      if(!entry.isFile()||entry.name.endsWith('.tmp')||join(dir,entry.name)===file)continue;
      const path=join(dir,entry.name);let value:unknown;
      try{value=JSON.parse(await readFile(path,'utf8'));}catch{}
      // A record that cannot be read right now (being replaced) still names its pid; never delete a live session's record for that.
      const pid=value&&typeof value==='object'&&'pid'in value?value.pid:Number(/^(\d+)\.json$/.exec(entry.name)?.[1]);
      let dead=typeof pid!=='number'||!Number.isSafeInteger(pid)||pid<=0;
      const parsed=presenceSchema.safeParse(value);
      if(!dead)try{
        process.kill(pid as number,0);
        if(parsed.success){
          const actual=await readProcessIdentity(parsed.data.pid);
          // shortcut: allow 2s for legacy uptime estimates and macOS ps precision; use a native birth token if rapid PID reuse matters.
          if(actual)dead=Math.abs(Date.parse(actual.startedAt)-Date.parse(parsed.data.processStartedAt))>2000||
            (actual.executable!==undefined&&actual.executable.toLowerCase()!==parsed.data.executable.toLowerCase());
        }
      }catch(error){dead=!!error&&typeof error==='object'&&'code'in error&&error.code==='ESRCH';}
      if(dead){await unlink(path).catch(()=>{});continue;}
      if(entry.name!=='owner.json'&&parsed.success)live.push(parsed.data);
    }
    return live;
  }
  await write(record);
  const others=[...new Set((await liveRecords()).map(owner=>owner.pid))];
  let released=false;
  return {directory:dir,others,async setSessionId(heraSessionId:string){
    await write({...record,heraSessionId});
    const owner=(await liveRecords()).find(owner=>owner.heraSessionId===heraSessionId);
    if(owner)throw new HeraError('SESSION_IN_USE',`This saved Hera session is already open in another process (pid ${owner.pid}). Close that session before resuming it. Presence directory: ${dir}`,6);
  },async release(){
    if(released)return;
    try{await unlink(file);}catch(error){if(!error||typeof error!=='object'||!('code'in error)||error.code!=='ENOENT')throw error;}
    try{await rmdir(dir);}catch(error){if(!error||typeof error!=='object'||!('code'in error)||!['ENOENT','ENOTEMPTY'].includes(String(error.code)))throw error;}
    released=true;
  }};
}
