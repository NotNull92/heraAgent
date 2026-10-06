import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
import {HeraError} from './errors.js';

export async function readSecret(){
  if(!process.stdin.isTTY||!process.stderr.isTTY)throw new HeraError('TTY_REQUIRED','Run hera auth login go in a terminal, or explicitly import the existing environment key with --from-env.',2);
  process.stderr.write('OpenCode Go API 키 (화면에 표시되지 않음): ');
  const muted=new Writable({write(_chunk,_encoding,done){done();}});
  const rl=createInterface({input:process.stdin,output:muted,terminal:true,historySize:0});
  let abort:()=>void=()=>{};
  try{return await new Promise<string>((resolve,reject)=>{
    abort=()=>{reject(new HeraError('LOGIN_INTERRUPTED','Key input canceled; no credential saved.',130));rl.close();};
    rl.once('SIGINT',abort);rl.once('close',()=>reject(new HeraError('LOGIN_INTERRUPTED','Key input closed; no credential saved.',130)));
    process.once('SIGTERM',abort);rl.question('',value=>resolve(value.trim()));
  });}finally{process.removeListener('SIGTERM',abort);rl.close();muted.destroy();process.stderr.write('\n');}
}
