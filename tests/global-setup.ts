import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Tests create temp fixtures (one is 129 MB) without deleting them; route them all into one directory removed after the run.
export default async function setup(){
  const dir=await mkdtemp(join(tmpdir(),'hera-test-run-'));
  for(const key of ['TEMP','TMP','TMPDIR'])process.env[key]=dir;
  return()=>rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
