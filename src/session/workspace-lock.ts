import {mkdir,readFile,writeFile,unlink,rmdir,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {HeraError} from '../errors.js';
export async function acquireWorkspace(home:string,cwd:string){
  const canonical=await realpath(cwd);const identity=process.platform==='win32'?canonical.toLowerCase():canonical;
  const dir=join(home,'locks',createHash('sha256').update(identity).digest('hex'));await mkdir(join(home,'locks'),{recursive:true,mode:0o700});
  try{await mkdir(dir,{mode:0o700});}catch(e){if(e&&typeof e==='object'&&'code'in e&&e.code==='EEXIST')throw new HeraError('WORKSPACE_LOCKED','Another or interrupted Hera session owns this workspace. Inspect the lock; no automatic stale takeover.',6);throw e;}
  const nonce=randomUUID();const file=join(dir,'owner.json');
  await writeFile(file,JSON.stringify({pid:process.pid,executable:process.execPath,processStartedAt:new Date(Date.now()-process.uptime()*1000).toISOString(),acquiredAt:new Date().toISOString(),nonce,workspace:canonical}),{flag:'wx',mode:0o600});
  let released=false;
  return {directory:dir,async release(){if(released)return;const owner:unknown=JSON.parse(await readFile(file,'utf8'));if(!owner||typeof owner!=='object'||!('nonce'in owner)||owner.nonce!==nonce)throw new HeraError('LOCK_OWNERSHIP_CHANGED','Lock ownership changed; preserve it for recovery.',6);await unlink(file);await rmdir(dir);released=true;}};
}
