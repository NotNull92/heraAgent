import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {CodexClient} from '../dist/codex/client.js';
import {childEnvironment,launch} from '../dist/codex/launcher.js';
import {startupArgs} from '../dist/codex/config-compiler.js';
import {defaults} from '../dist/config.js';
import {installExternalRuntime,externalRuntime} from '../dist/codex/external-runtime.js';

assert.ok(process.argv[2],'Provide the experimental standalone App Server executable');
const binary=resolve(process.argv[2]);
const home=await mkdtemp(join(tmpdir(),'hera-native-patch-smoke-'));
const receipt=await installExternalRuntime(home,binary,createHash('sha256').update(await readFile(binary)).digest('hex'));
const installed=await externalRuntime(home);assert.ok(installed);
async function initializeOfficial(){
  const client=new CodexClient(await launch(home,home,startupArgs(defaults)));client.on('fault',()=>{});
  try{await client.initialize();assert.equal((await client.account()).ready,false);}
  finally{assert.equal(await client.close(),true,'Require graceful official cleanup');}
}
await initializeOfficial();
await mkdir(join(home,'codex'),{recursive:true});
await writeFile(join(home,'codex','probe.config.toml'),'cli_auth_credentials_store = "keyring"\nsubagent_model_provider_allowlist = ["fixture"]\n');
const client=new CodexClient(spawn(installed.binary,['--profile','probe','--strict-config',...startupArgs(defaults)],{cwd:home,env:childEnvironment(home,home),stdio:['pipe','pipe','pipe'],windowsHide:true}));
client.on('fault',()=>{});
try{
  await client.initialize();assert.equal((await client.account()).ready,false);
  const result=await client.rpc.request('config/read',{cwd:home,includeLayers:true});
  assert.deepEqual(result.config.subagent_model_provider_allowlist,['fixture']);
  for(const value of [result.config.agents.enabled,result.config.features.multi_agent,result.config.features.multi_agent_v2])assert.equal(value,false);
  assert.ok(result.layers.some(layer=>layer.name.type==='user'&&layer.name.profile==='probe'));
}finally{assert.equal(await client.close(),true,'Require graceful owned cleanup');}
await initializeOfficial();
console.log(JSON.stringify({platform:process.platform,arch:process.arch,binarySha256:receipt.binarySha256,bundleSha256:receipt.bundleSha256,installedRuntime:'pass',nativeInitialize:'pass',isolatedProfile:'pass',officialRuntimeRoundTrip:'pass',workers:'disabled',inference:'not_run',existingUserHomeOpened:false}));
