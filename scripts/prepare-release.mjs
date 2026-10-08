import {mkdir,readFile,writeFile,cp,mkdtemp,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {npm,inspectArchive} from './package-utils.mjs';
const root=process.cwd();const manifest=JSON.parse(await readFile('package.json','utf8'));const originalLock=await readFile('package-lock.json');
await mkdir('release-staging',{recursive:true});const stage=await mkdtemp(resolve('release-staging','pack-'));
for(const name of ['bin','dist','assets','README.md','CHANGELOG.md','SECURITY.md','THIRD_PARTY_NOTICES.md'])await cp(name,join(stage,name),{recursive:true});
await writeFile(join(stage,'package.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(stage,'package-lock.json'),originalLock);
// Both lock filenames use the same npm lockfile format. Preserve every reviewed
// field: npm 11.6.2 shrinkwrap drops libc metadata written by npm 11.14.1.
await rename(join(stage,'package-lock.json'),join(stage,'npm-shrinkwrap.json'));
const shrink=JSON.parse(await readFile(join(stage,'npm-shrinkwrap.json'),'utf8'));const source=JSON.parse(originalLock);
if(!isDeepStrictEqual(shrink.packages,source.packages)){
  const changed=[...new Set([...Object.keys(shrink.packages),...Object.keys(source.packages)])].filter(key=>!isDeepStrictEqual(shrink.packages[key],source.packages[key]));
  throw new Error(`Shrinkwrap differs from reviewed source resolution: ${changed.join(', ')}`);
}
for(const platform of ['darwin-arm64','darwin-x64','win32-x64'])if(!shrink.packages[`node_modules/@openai/codex-${platform}`])throw new Error(`Missing optional runtime ${platform}`);
await mkdir('.artifacts',{recursive:true});const target=resolve('.artifacts');
const packed=JSON.parse(npm(['pack','--json','--ignore-scripts','--pack-destination',target],stage))[0];const artifact=join(target,packed.filename);const inspection=inspectArchive(artifact);
const sha=createHash('sha256').update(await readFile(artifact)).digest('hex');
await writeFile(join(target,'SHA256SUMS.txt'),`${sha}  ${packed.filename}\n`);
await writeFile(join(target,'release-notes.md'),`# Hera ${manifest.version}\n\nPrepared privately; not a published release. Native editing/checks need no /apply step. Design/research requests use automatic DRD guidance. Windows/macOS offline and exact-artifact installation must be separately observed. Packaging performs no live qualification: GPT/mixed/adaptive workers require matching per-platform native verification. macOS manual/live remains not run; see repository docs/status.md for actual receipts. No license grant.\n\nSHA-256: ${sha}\n`);
await writeFile(join(target,'compatibility.json'),JSON.stringify({version:manifest.version,codex:'0.160.1',sha256:sha,artifact:packed.filename,buildPlatform:process.platform,buildArch:process.arch,node:process.version,workflow:'native_workspace',research:'native_drd_guidance',externalMode:'requires_local_verification',live:'not_run_by_packaging',macosManual:'not_run',...inspection},null,2)+'\n');
if(!(await readFile(join(root,'package-lock.json'))).equals(originalLock))throw new Error('Source lock changed during packaging');
console.log(JSON.stringify({artifact,sha256:sha,...inspection}));
