import {mkdir,realpath,readFile,open,rename,unlink,lstat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {HeraError} from './errors.js';
export async function heraHome() {
  const requested=resolve(process.env.HERA_HOME ?? join(homedir(),'.hera'));
  await rejectRepositoryHome(requested);
  await mkdir(requested,{recursive:true,mode:0o700});
  const canonical=await realpath(requested);await rejectRepositoryHome(canonical);return canonical;
}
export async function rejectRepositoryHome(home:string){
  let current=resolve(home);
  for(;;){try{await lstat(join(current,'.git'));throw new HeraError('UNSAFE_AUTH_HOME','HERA_HOME must be outside Git repositories so credentials cannot enter source history.',2);}catch(e){if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e;}const parent=dirname(current);if(parent===current)break;current=parent;}
}
export async function readJson(file:string):Promise<unknown> {return JSON.parse(await readFile(file,'utf8')) as unknown;}
export async function existsJson(file:string):Promise<unknown | undefined> {
  try {return await readJson(file);} catch(e) {if(e && typeof e==='object' && 'code' in e && e.code==='ENOENT') return undefined; throw new HeraError('INVALID_FILE',`Cannot read ${file}; preserve and repair it.`,2);}
}
const writes=new Map<string,Promise<void>>();
export function atomicJson(file:string,value:unknown):Promise<void> {
  const previous=writes.get(file)??Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
    await mkdir(dirname(file),{recursive:true,mode:0o700});
    const temp=`${file}.${randomUUID()}.tmp`;
    try {const handle=await open(temp,'wx',0o600);try {await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally {await handle.close();}await rename(temp,file);}
    finally {await unlink(temp).catch(()=>{});}
  });
  writes.set(file,next);void next.finally(()=>{if(writes.get(file)===next)writes.delete(file);}).catch(()=>{});return next;
}
