import {mkdtemp} from 'node:fs/promises';
import {rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export async function tempFixture(prefix){
  const directory=await mkdtemp(join(tmpdir(),prefix));
  process.on('exit',code=>{
    if(code!==0)return;
    try{rmSync(directory,{recursive:true,force:true,maxRetries:5});}
    catch(error){console.error('Temp cleanup failed: '+JSON.stringify(error.message));}
  });
  return directory;
}
