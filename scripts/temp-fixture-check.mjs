import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tempFixture} from './temp-fixture.mjs';

const root=await tempFixture('hera-temp-fixture-check-');
const helper=new URL('./temp-fixture.mjs',import.meta.url).href;
const env={...process.env,TEMP:root,TMP:root,TMPDIR:root};
const fixture=`
  import {tempFixture} from ${JSON.stringify(helper)};
  import {mkdir,writeFile} from 'node:fs/promises';
  import {join} from 'node:path';
  const directories=[];
  for(let i=0;i<3;i++){
    const directory=await tempFixture('hera-check-');
    await mkdir(join(directory,'nested'));
    await writeFile(join(directory,'nested','fixture.txt'),'fixture');
    directories.push(directory);
  }
  console.log(JSON.stringify(directories));
`;
for(const [ending,expected] of [['',0],['process.exit(0)',0],['process.exitCode=7',7],['process.exit(7)',7],['throw new Error("fixture failure")',1],["process.kill(process.pid,'SIGTERM')",null]]){
  const result=spawnSync(process.execPath,['--input-type=module','-e',fixture+ending],{env,encoding:'utf8',windowsHide:true,timeout:10000});
  assert.ifError(result.error);
  if(expected===null)assert.notEqual(result.status,0);else assert.equal(result.status,expected,result.stderr);
  for(const directory of JSON.parse(result.stdout))assert.equal(existsSync(directory),expected!==0);
}
const failedRemoval=spawnSync(process.execPath,['--input-type=module','-e',fixture+`
  const fs=(await import('node:fs')).default;
  fs.rmSync=()=>{throw new Error('simulated removal failure\\nsecond line');};
  (await import('node:module')).syncBuiltinESMExports();
`],{env,encoding:'utf8',windowsHide:true,timeout:10000});
assert.ifError(failedRemoval.error);assert.equal(failedRemoval.status,0);
const directories=JSON.parse(failedRemoval.stdout);
assert.equal(failedRemoval.stderr.trim().split(/\r?\n/).length,directories.length);
for(const directory of directories)assert(existsSync(directory));
console.log('Temp fixture self-check passed: successful exits clean up; failures and interruption retain fixtures; removal errors preserve exit status.');
