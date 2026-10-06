import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const home = mkdtempSync(join(tmpdir(),'hera-discovery-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|HOME|LOCALAPPDATA|APPDATA|COMSPEC)$/i.test(k)));
env.CODEX_HOME=home;
const child=spawn(process.execPath,[resolve('node_modules/@openai/codex/bin/codex.js'),'app-server','-c','cli_auth_credentials_store="keyring"'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
const results={}; let line=''; let id=0; const pending=new Map();
const deadline=setTimeout(()=>{child.kill();process.exitCode=1;},20000);
child.stderr.resume();
child.stdout.setEncoding('utf8');
child.stdout.on('data',chunk=>{line+=chunk;let n;while((n=line.indexOf('\n'))>=0){const msg=JSON.parse(line.slice(0,n));line=line.slice(n+1);if(msg.id!==undefined){pending.get(msg.id)?.(msg);pending.delete(msg.id);}}});
const request=(method,params)=>new Promise(resolve=>{pending.set(++id,resolve);child.stdin.write(JSON.stringify({id,method,params})+'\n');});
try {
 const initialized=await request('initialize',{clientInfo:{name:'hera',title:'Hera',version:'0.1.0-alpha.1'},capabilities:null});
 if(initialized.error) throw new Error('Initialize failed');
 results.initialize={userAgent:initialized.result.userAgent,platformFamily:initialized.result.platformFamily,platformOs:initialized.result.platformOs};
 child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
 const account=await request('account/read',{refreshToken:false});
 results.account={ready:!!account.result?.account,error:account.error?.code??null};
 const models=await request('model/list',{});
 results.models={count:models.result?.data?.length??0,error:models.error?.code??null,catalogNotEntitlement:true};
 const config=await request('config/read',{includeLayers:false});
 results.config={error:config.error?.code??null,keys:Object.keys(config.result?.config??{})};
 results.platform=process.platform;results.arch=process.arch;results.exitCode=0;
 mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/m0-native.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
} finally {clearTimeout(deadline);child.stdin.end();}
