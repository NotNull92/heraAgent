import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, mkdtempSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const require = createRequire(import.meta.url);
const manifestPath = require.resolve('@openai/codex/package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const launcher = join(dirname(manifestPath), manifest.bin.codex);
for (const [command, out] of [['generate-ts', 'src/codex/generated'], ['generate-json-schema', 'assets/codex/schema']]) {
  mkdirSync(out, {recursive: true});
  const result = spawnSync(process.execPath, [launcher, 'app-server', command, '--out', out], {encoding: 'utf8', windowsHide: true});
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
}
// Opt in only to the native background-command cleanup contract used by Hera.
const backgroundTypes=['ThreadBackgroundTerminal','ThreadBackgroundTerminalsCleanParams','ThreadBackgroundTerminalsCleanResponse','ThreadBackgroundTerminalsListParams','ThreadBackgroundTerminalsListResponse'];
const scratch=mkdtempSync(join(tmpdir(),'hera-protocol-'));
for(const [command,extension,destination] of [['generate-ts','ts','src/codex/generated'],['generate-json-schema','json','assets/codex/schema']]){
  const out=join(scratch,extension);
  const result=spawnSync(process.execPath,[launcher,'app-server',command,'--experimental','--out',out],{encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw new Error(`${command} experimental generation failed: ${result.stderr}`);
  for(const name of backgroundTypes){if(extension==='json'&&name==='ThreadBackgroundTerminal')continue;copyFileSync(join(out,'v2',`${name}.${extension}`),join(destination,'v2',`${name}.${extension}`));}
}
function files(dir) {return readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]).sort();}
// Generated imports are extensionless; NodeNext requires explicit .js specifiers.
for (const file of files('src/codex/generated')) {
  if (file.endsWith('.ts')) writeFileSync(file, readFileSync(file,'utf8').replace(/from "(\.[^"]+?)(?<!\.js)"/g, 'from "$1.js"').replace('from "./v2.js"','from "./v2/index.js"'));
}
const hash = createHash('sha256');
for (const file of files('assets/codex/schema')) hash.update(relative('assets/codex/schema',file).replaceAll('\\','/')).update('\0').update(readFileSync(file));
const lock = JSON.parse(readFileSync('package-lock.json','utf8'));
writeFileSync('assets/codex/compatibility.json', JSON.stringify({codexVersion:manifest.version, schemaSha256:hash.digest('hex'), integrity:lock.packages['node_modules/@openai/codex'].integrity, node:process.version, generatedImportTransform:'relative .js extensions only'},null,2)+'\n');
console.log(readFileSync('assets/codex/compatibility.json','utf8'));
