import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {mkdir,readFile,writeFile,cp,copyFile,stat,chmod,glob} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'experiments/codex-provider-routing/manifest.json'),'utf8'));
assert.equal(JSON.parse(await readFile(join(root,'assets/codex-provider/manifest.json'),'utf8')).patchSha256,manifest.patchSha256);
const patch=join(root,'experiments/codex-provider-routing/native-v1.patch');
assert.equal(createHash('sha256').update(await readFile(patch)).digest('hex'),manifest.patchSha256);
const platforms={'win32-x64':['x86_64-pc-windows-msvc','codex.exe'],'darwin-arm64':['aarch64-apple-darwin','codex'],'darwin-x64':['x86_64-apple-darwin','codex']};
const platform=process.platform+'-'+process.arch;assert.ok(platforms[platform],'Unsupported qualification platform');
const checkout=join(root,'.artifacts','codex-provider-qualification');
await mkdir(dirname(checkout),{recursive:true});
await mkdir(checkout); // Never replace existing work or reuse a dirty checkout.
function run(command,args,cwd=checkout,capture=false){
  const result=spawnSync(command,args,{cwd,shell:false,windowsHide:true,encoding:'utf8',stdio:capture?'pipe':'inherit',maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`${command} failed (${result.signal??result.status})${capture?'\n'+(result.stderr??'').slice(-4000):''}`);
  return result.stdout?.trim();
}
run('git',['init','--quiet']);
run('git',['config','core.longpaths','true']);run('git',['config','core.autocrlf','false']);
run('git',['remote','add','origin',manifest.source]);
run('git',['fetch','--depth','1','origin',manifest.commit]);
run('git',['checkout','--quiet','--detach','FETCH_HEAD']);
assert.equal(run('git',['rev-parse','HEAD'],checkout,true),manifest.commit);
run('git',['apply','--check',patch]);run('git',['apply',patch]);run('git',['diff','--check']);
const require=createRequire(import.meta.url);
const packageFile=require.resolve(`@openai/codex-${platform}/package.json`);
assert.equal(JSON.parse(await readFile(packageFile,'utf8')).version,`${manifest.version}-${platform}`);
const [triple,executable]=platforms[platform];
// SQLx embeds byte-level checksums. Match the official Windows CRLF / macOS LF build.
const official=await readFile(join(dirname(packageFile),'vendor',triple,'bin',executable));
let migrations=0;
for await(const file of glob('codex-rs/state/*migrations/*.sql',{cwd:checkout})){
  const path=join(checkout,file);const original=await readFile(path,'utf8');
  const lf=original.replaceAll('\r\n','\n');const sql=process.platform==='win32'?lf.replaceAll('\n','\r\n'):lf;
  assert.ok(official.includes(createHash('sha384').update(sql).digest()),`Official migration checksum mismatch: ${file}`);
  if(sql!==original)await writeFile(path,sql);
  migrations++;
}
assert.ok(migrations>0,'No native migrations found');
if(process.argv.includes('--prepare-only')){
  console.log(JSON.stringify({sourcePrepared:true,commit:manifest.commit,patchSha256:manifest.patchSha256,build:'not_run'}));
}else{
  const rust=join(checkout,'codex-rs');
  assert.ok(run('rustc',['--version'],rust,true).startsWith('rustc '+manifest.rustToolchain+' '));
  run('cargo',['build','--locked','-p','codex-app-server','--bin','codex-app-server','--jobs','2',...['age','scrypt','salsa20'].flatMap(name=>['--config',`profile.dev.package.${name}.opt-level=3`])],rust);
  const bundle=join(root,'.artifacts','native-patch-bundle');await mkdir(bundle);
  await cp(join(dirname(packageFile),'vendor',triple),bundle,{recursive:true,errorOnExist:true,force:false});
  const binary=join(bundle,'bin',executable);
  await stat(binary);await copyFile(join(rust,'target','debug',process.platform==='win32'?'codex-app-server.exe':'codex-app-server'),binary);
  if(process.platform!=='win32')await chmod(binary,0o755);
  const smoke=JSON.parse(run(process.execPath,[join(root,'scripts/native-patch-smoke.mjs'),binary],root,true));
  const receipt={sourceCommit:manifest.commit,patchSha256:manifest.patchSha256,rustToolchain:manifest.rustToolchain,...smoke,productDefaultChanged:false,macosLiveManual:'not_run'};
  await writeFile(join(root,'.artifacts','native-patch-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
  const artifact=join(root,'.artifacts','native-runtime');await mkdir(artifact);
  await copyFile(binary,join(artifact,process.platform==='win32'?'codex-app-server.exe':'codex-app-server'));
  await copyFile(join(root,'.artifacts','native-patch-receipt.json'),join(artifact,'receipt.json'));
}
