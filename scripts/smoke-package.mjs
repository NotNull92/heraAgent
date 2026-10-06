import {mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir,release} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import {npm,inspectArchive} from './package-utils.mjs';
const directory=resolve(process.env.HERA_ARTIFACT_DIR??'.artifacts');const filename=process.argv[2]??(await readdir(directory)).filter(f=>f.endsWith('.tgz')).sort().at(-1);if(!filename)throw new Error('No prepared tarball');const tgz=process.argv[2]?resolve(filename):join(directory,filename);inspectArchive(tgz);
const sha=createHash('sha256').update(await readFile(tgz)).digest('hex');const sum=await readFile(join(directory,'SHA256SUMS.txt'),'utf8');if(!sum.startsWith(sha+' '))throw new Error('Artifact checksum mismatch');
const root=await mkdtemp(join(tmpdir(),'hera package 한글 '));const prefix=join(root,'prefix');const home=join(root,'profile');
npm(['install','--global','--prefix',prefix,'--ignore-scripts',tgz],root);
const packageRoot=process.platform==='win32'?join(prefix,'node_modules/hera-agent'):join(prefix,'lib/node_modules/hera-agent');const bin=join(packageRoot,'bin/hera.mjs');
const env={...process.env,HERA_HOME:home,NO_COLOR:'1'};for(const key of Object.keys(env))if(/TOKEN|SECRET|PASSWORD|API_KEY|^CODEX_HOME$|^GH_|^GITHUB_/i.test(key))delete env[key];
function run(args,expected=0){const result=spawnSync(process.execPath,[bin,...args],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});if(result.status!==expected)throw new Error(`Installed command ${args[0]??'TUI'} exit ${result.status}, expected ${expected}: ${result.stderr}`);return result.stdout;}
const version=run(['--version']);if(!version.includes('0.1.0-alpha.1'))throw new Error('Wrong installed version');run(['init','--language','en']);const before=await readFile(join(home,'config.json'),'utf8');const doctor=JSON.parse(run(['doctor','--json']));if(doctor.native!=='initialized'||doctor.account.ready!==false)throw new Error('Installed native smoke failed');run([],2);
try{
  env.HERA_OPENCODE_GO_API_KEY='fixture-'+randomUUID();run(['auth','login','go','--from-env']);delete env.HERA_OPENCODE_GO_API_KEY;
  if(JSON.parse(run(['auth','status','go'])).credentialSource!=='keyring')throw new Error('Installed credential lookup failed');
  npm(['install','--global','--prefix',prefix,'--ignore-scripts',tgz],root);if(await readFile(join(home,'config.json'),'utf8')!==before)throw new Error('Reinstall damaged user settings');
  if(!JSON.parse(run(['auth','status','go'])).credentialStored)throw new Error('Reinstall damaged OS credential');
}finally{delete env.HERA_OPENCODE_GO_API_KEY;run(['auth','logout','go']);}
const launcher=process.platform==='win32'?join(prefix,'hera.cmd'):join(prefix,'bin/hera');
if(process.platform==='win32'){
  const content=await readFile(launcher,'utf8');if(!content.includes('hera-agent')||!content.includes('bin\\hera.mjs'))throw new Error('Unexpected Windows npm launcher');
  const script=join(root,'launcher-check.ps1');await writeFile(script,"\uFEFF& '"+launcher.replaceAll("'","''")+"' --version\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\n");
  const shell=join(process.env.SYSTEMROOT??process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const result=spawnSync(shell,['-NoProfile','-File',script],{cwd:root,env,encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error(`Windows launcher failed: ${result.stderr}`);
}else{const result=spawnSync(launcher,['--version'],{cwd:root,env,encoding:'utf8'});if(result.status!==0)throw new Error(`macOS shebang failed: ${result.stderr}`);}
console.log(JSON.stringify({platform:process.platform,arch:process.arch,os:release(),node:process.version,sha256:sha,install:'pass',nativeInitialize:'pass',reinstallPreservedSettings:'pass',osCredentialPersistence:'pass',launcher:'pass',live:'not_run'}));
