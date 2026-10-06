import {execFileSync,spawnSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64*1024*1024});
const forbidden=/(^|\/)(node_modules|\.hera|\.codex|\.env(?:\..*)?|auth\.json)(\/|$)|\.(pem|key|tgz|log)$/i;
const secret='gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{30,}|-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----';
const files=git('ls-files','-z').split('\0').filter(Boolean);
const commits=git('rev-list','--all').trim().split('\n').filter(Boolean);
const historical=git('log','--all','--pretty=format:','--name-only','-z').split(/[\0\n]/).filter(Boolean);
for(const file of [...files,...historical])if(forbidden.test(file))throw new Error(`Sensitive tracked path: ${file}`);
for(const args of [['--cached'],...commits.map(c=>[c])]){
  const result=spawnSync('git',['grep','-I','-l','-E',...args.filter(a=>a.startsWith('--')),'-e',secret,...args.filter(a=>!a.startsWith('--')),'--'],{encoding:'utf8'});
  if(result.status===0)throw new Error(`Secret pattern in: ${result.stdout}`);
  if(result.status!==1)throw new Error('Secret scan failed');
}
console.log(`Source/history pattern scan passed (${files.length} tracked files). Review remains required.`);
