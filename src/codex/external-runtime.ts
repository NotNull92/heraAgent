import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,readdir,copyFile,cp,chmod,realpath,writeFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {z} from 'zod';
import type {Config} from '../config.js';
import {HeraError} from '../errors.js';
import {atomicJson,existsJson,rejectRepositoryHome} from '../paths.js';
import {childEnvironment,CODEX_VERSION} from './launcher.js';
import {nativeSettings} from './config-compiler.js';
import {resolveGoCredential} from '../providers/go-credentials.js';
import {GO_URL,GO_MODEL} from '../providers/opencode-go.js';

export const GO_PROVIDER='hera_opencode_go';
export const GO_ROLE='hera_go';
export const ASTRA_ROLE='hera_astra';
export const GO_EFFORT='low'; // Default Go effort; the selected one is config.workers.goReasoningEffort.
const sha=z.string().regex(/^[a-f0-9]{64}$/);
const receiptSchema=z.strictObject({schemaVersion:z.literal(1),platform:z.string(),patchSha256:sha,binarySha256:sha,bundleSha256:sha});
const pinPath=fileURLToPath(new URL('../../assets/codex-provider/manifest.json',import.meta.url));
async function pin(){return z.object({commit:z.string(),version:z.literal(CODEX_VERSION),patchSha256:sha}).parse(JSON.parse(await readFile(pinPath,'utf8')));}
async function digest(file:string){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function bundleDigest(directory:string):Promise<string>{
  const hash=createHash('sha256');
  async function visit(path:string,prefix=''){for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const name=prefix+entry.name;if(entry.isSymbolicLink())throw new HeraError('UNSAFE_RUNTIME','Runtime symlinks are not supported.',4);if(entry.isDirectory())await visit(join(path,entry.name),name+'/');else if(entry.isFile())hash.update(name).update('\0').update(await digest(join(path,entry.name)));else throw new HeraError('UNSAFE_RUNTIME','Unexpected runtime entry.',4);}}
  await visit(directory);return hash.digest('hex');
}
function platformPaths(){const platform=process.platform+'-'+process.arch;const triples:Record<string,string>={'win32-x64':'x86_64-pc-windows-msvc','darwin-arm64':'aarch64-apple-darwin','darwin-x64':'x86_64-apple-darwin'};const triple=triples[platform];if(!triple)throw new HeraError('UNSUPPORTED_PLATFORM','Patched runtime supports Windows x64 and macOS arm64/x64.',4);return {platform,triple,executable:process.platform==='win32'?'codex.exe':'codex'};}
export async function externalRuntime(home:string){
  const raw=await existsJson(join(home,'runtimes','external-runtime.json'));if(raw===undefined)return null;
  const parsed=receiptSchema.safeParse(raw);const expected=await pin();const platform=platformPaths();
  if(!parsed.success||parsed.data.platform!==platform.platform||parsed.data.patchSha256!==expected.patchSha256)throw new HeraError('EXTERNAL_RUNTIME_MISMATCH','Installed mixed runtime differs from this Hera build; reinstall the reviewed runtime. No fallback.',4);
  const receipt=parsed.data;const directory=join(home,'runtimes','provider-v1',receipt.binarySha256);const binary=join(directory,'bin',platform.executable);
  if(await digest(binary)!==receipt.binarySha256||await bundleDigest(directory)!==receipt.bundleSha256)throw new HeraError('EXTERNAL_RUNTIME_MISMATCH','Mixed runtime or platform helpers changed; no fallback.',4);
  return {binary,receipt};
}
export async function installExternalRuntime(home:string,source:string,expectedSha:string){
  sha.parse(expectedSha);await rejectRepositoryHome(await realpath(home));
  const expected=await pin();const {platform,triple,executable}=platformPaths();
  if(await digest(source)!==expectedSha)throw new HeraError('EXTERNAL_RUNTIME_MISMATCH','Binary SHA-256 differs from the explicitly reviewed value.',4);
  const directory=join(home,'runtimes','provider-v1',expectedSha);
  const require=createRequire(import.meta.url);const packagePath=require.resolve(`@openai/codex-${platform}/package.json`);
  if(JSON.parse(await readFile(packagePath,'utf8')).version!==`${CODEX_VERSION}-${platform}`)throw new HeraError('UNSUPPORTED_RUNTIME','Official helper package version mismatch.',4);
  await mkdir(dirname(directory),{recursive:true,mode:0o700});await mkdir(directory); // Preserve existing installations, including incomplete ones.
  await cp(join(dirname(packagePath),'vendor',triple),directory,{recursive:true,errorOnExist:true,force:false});
  const binary=join(directory,'bin',executable);await copyFile(source,binary);if(process.platform!=='win32')await chmod(binary,0o755);
  if(await digest(binary)!==expectedSha)throw new HeraError('EXTERNAL_RUNTIME_MISMATCH','Copied runtime digest changed.',4);
  const receipt={schemaVersion:1 as const,platform,patchSha256:expected.patchSha256,binarySha256:expectedSha,bundleSha256:await bundleDigest(directory)};
  await atomicJson(join(home,'runtimes','external-runtime.json'),receipt);return receipt;
}

export async function launchExternal(home:string,cwd:string,config:Config,mode:'read-only'|'workspace-write',workers:boolean,searchUrl?:string,nativeFlow=false){
  const runtime=await externalRuntime(home);if(!runtime)throw new HeraError('EXTERNAL_RUNTIME_MISSING','Install the reviewed mixed runtime with hera runtime install before using external_workers. No fallback.',4);
  const needsGo=workers||config.mode==='adaptive';
  const {key}=needsGo?await resolveGoCredential(home):{key:undefined};if(needsGo&&!key)throw new HeraError('PROVIDER_SETUP_REQUIRED','Save the Go key through /providers. No fallback.',3);
  const codexHome=join(home,'codex');await mkdir(codexHome,{recursive:true,mode:0o700});
  // Use the native cached catalog; only the transport version changes. Never invent model metadata.
  const catalog=z.object({models:z.array(z.record(z.string(),z.unknown()))}).parse(JSON.parse(await readFile(join(codexHome,'models_cache.json'),'utf8')));
  if(!catalog.models.some(m=>m.slug===config.main.model))throw new HeraError('MODEL_UNAVAILABLE','Refresh the official main model catalog before mixed mode.',4);
  const profile='hera-mixed-'+randomUUID();const directory=join(home,'runtime-profiles',profile);await mkdir(directory,{recursive:true,mode:0o700});
  const rolePath=join(directory,'go.toml');const catalogPath=join(directory,'models.json');const profilePath=join(codexHome,profile+'.config.toml');
  const role=`model = "${GO_MODEL}"\nmodel_provider = "${GO_PROVIDER}"\nmodel_reasoning_effort = "${config.workers.goReasoningEffort}"\n`;
  const astraPath=join(directory,'astra.toml');
  const profileContents=`cli_auth_credentials_store = "keyring"\nsubagent_model_provider_allowlist = ${JSON.stringify(config.mode==='adaptive'?[GO_PROVIDER,'openai']:[GO_PROVIDER])}\n`+[GO_ROLE,'default','worker','explorer'].map(name=>`[agents.${name}]\ndescription = "Hera DeepSeek routine task worker"\nconfig_file = ${JSON.stringify(rolePath)}\n`).join('')+(config.mode==='adaptive'?`[agents.${ASTRA_ROLE}]\ndescription = "Deep reasoning, product planning, architecture and difficult design decisions"\nconfig_file = ${JSON.stringify(astraPath)}\n`:'');
  const catalogContents=JSON.stringify({models:catalog.models.map(m=>m.slug===config.main.model?{...m,multi_agent_version:'v1'}:m)});
  const owned:[string,string][]=[[rolePath,role],[catalogPath,catalogContents],[profilePath,profileContents]];
  if(config.mode==='adaptive')owned.push([astraPath,`model = ${JSON.stringify(config.main.model)}\nmodel_provider = "openai"\nmodel_catalog_json = ${JSON.stringify(catalogPath)}\n`+(config.main.reasoningEffort?`model_reasoning_effort = ${JSON.stringify(config.main.reasoningEffort)}\n`:'')]);
  for(const [path,contents] of owned)await writeFile(path,contents,{flag:'wx',mode:0o600});
  const settings={...nativeSettings({...config,workers:{...config.workers,gptModel:null,reasoningEffort:null}},mode,workers,searchUrl,nativeFlow),model_catalog_json:catalogPath,
    ...(config.mode==='adaptive'?{model_provider:GO_PROVIDER,model_reasoning_effort:config.workers.goReasoningEffort}:{}),
    'features.multi_agent_v2':false,'agents.max_depth':1,
    [`model_providers.${GO_PROVIDER}`]:{name:'Hera OpenCode Go',base_url:GO_URL,env_key:'HERA_OPENCODE_GO_API_KEY',wire_api:'responses',requires_openai_auth:false,request_max_retries:0,stream_max_retries:0,stream_idle_timeout_ms:20000,supports_websockets:false,http_headers:{'User-Agent':'hera/0.1.0-alpha.1','x-opencode-session':randomUUID()}}};
  function args(values:Record<string,unknown>,prefix=''):string[]{return Object.entries(values).flatMap(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?args(v as Record<string,unknown>,prefix+k+'.'):['-c',`${prefix+k}=${JSON.stringify(v)}`]);}
  const child=spawn(runtime.binary,['--profile',profile,'--strict-config',...args(settings)],{cwd:await realpath(cwd),env:{...childEnvironment(home,cwd),...(key?{HERA_OPENCODE_GO_API_KEY:key}:{})},shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
  const cleanup=async()=>{for(const [path,contents] of owned){if(await readFile(path,'utf8')!==contents)throw new HeraError('RUNTIME_PROFILE_CHANGED','Owned runtime profile changed externally; preserved for review.',4);await unlink(path);}};
  return {child,settings,cleanup};
}
