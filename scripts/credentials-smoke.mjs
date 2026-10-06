import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {saveGoCredential,resolveGoCredential,deleteGoCredential,goCredentialStatus} from '../dist/providers/go-credentials.js';
const home=await mkdtemp(join(tmpdir(),'hera-credential-fixture-'));const key='fixture-'+randomUUID();
const original=process.env.HERA_OPENCODE_GO_API_KEY;delete process.env.HERA_OPENCODE_GO_API_KEY;
try{
  assert.equal((await goCredentialStatus(home)).credentialStored,false);
  await saveGoCredential(home,key);assert.equal((await resolveGoCredential(home)).key,key);
  const status=spawnSync(process.execPath,['bin/hera.mjs','auth','status','go'],{encoding:'utf8',windowsHide:true,env:{...process.env,HERA_HOME:home},timeout:30000});
  assert.equal(status.status,0);assert.equal(status.stdout.includes(key),false);assert.equal(status.stderr.includes(key),false);assert.deepEqual(JSON.parse(status.stdout),{credentialReady:true,credentialStored:true,credentialSource:'keyring'});
  process.env.HERA_OPENCODE_GO_API_KEY='fixture-environment';assert.equal((await resolveGoCredential(home)).key,'fixture-environment');delete process.env.HERA_OPENCODE_GO_API_KEY;
  const replacement='fixture-'+randomUUID();await saveGoCredential(home,replacement);assert.equal((await resolveGoCredential(home)).key,replacement);
  await deleteGoCredential(home);assert.equal((await resolveGoCredential(home)).key,undefined);assert.deepEqual(await readdir(home),[]);
  console.log(JSON.stringify({platform:process.platform,osCredentialStore:'pass',freshProcessLookup:'pass',replaceAndDelete:'pass',plaintextFiles:0,providerCalls:0}));
}finally{await deleteGoCredential(home);if(original===undefined)delete process.env.HERA_OPENCODE_GO_API_KEY;else process.env.HERA_OPENCODE_GO_API_KEY=original;}
