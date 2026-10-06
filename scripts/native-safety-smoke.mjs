import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {heraHome} from '../dist/paths.js';
import {loadConfig} from '../dist/config.js';
import {startupArgs} from '../dist/codex/config-compiler.js';
import {errorView} from '../dist/errors.js';

// Native sandbox checks, no model inference. All write targets are disposable fixtures.
const home=await heraHome();const {config}=await loadConfig(home);
const cwd=await mkdtemp(join(tmpdir(),'hera-native-safety-'));
const sentinel=join(cwd,'sentinel.txt');await writeFile(sentinel,'unchanged');
const client=await CodexClient.connect(home,cwd,startupArgs(config));
try{
  if(process.platform==='win32')assert.equal((await client.windowsSandboxReadiness()).status,'ready');
  const run=code=>client.rpc.request('command/exec',{command:[process.execPath,'-e',code],cwd,timeoutMs:10000,sandboxPolicy:{type:'readOnly',networkAccess:false}});
  const read=await run("console.log(require('node:fs').readFileSync('sentinel.txt','utf8'))");
  assert.equal(read.exitCode,0);assert.match(read.stdout,/unchanged/);
  async function denied(code){
    try{const result=await run(code);assert.notEqual(result.exitCode,0,'Read-only sandbox must reject an actual write');assert.match(result.stderr,/EPERM|EACCES|Operation not permitted|Permission denied/i);}
    catch(error){if(error.errorCode!=='RPC_-32603'||!/sandbox denied exec error/.test(error.message)||!/EPERM|EACCES|Operation not permitted|Permission denied/i.test(error.message))throw error;}
  }
  await denied("require('node:fs').writeFileSync('sentinel.txt','changed')");
  assert.equal(await readFile(sentinel,'utf8'),'unchanged');
  await denied("require('node:fs').writeFileSync('new.txt','changed')");
  await assert.rejects(access(join(cwd,'new.txt')));
  console.log(JSON.stringify({platform:process.platform,nativeSandbox:{read:'pass',overwriteDenied:'pass',createDenied:'pass'},workerSafety:'not_run',modelInference:false}));
}catch(error){console.error(JSON.stringify(errorView(error)));process.exitCode=1;}
finally{if(!await client.close())process.exitCode=5;}
