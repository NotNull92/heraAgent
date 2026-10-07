import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {release} from 'node:os';
import {z} from 'zod';
import type {Config} from '../config.js';
import {HeraError} from '../errors.js';
import {existsJson} from '../paths.js';
import {externalRuntime} from './external-runtime.js';
const assets=fileURLToPath(new URL('../../assets/codex/',import.meta.url));
export async function verifyContract(){const expected=z.object({codexVersion:z.literal('0.160.1'),schemaSha256:z.string()}).parse(JSON.parse(await readFile(join(assets,'compatibility.json'),'utf8')));const hash=createHash('sha256');async function files(dir:string):Promise<string[]>{const entries=await readdir(dir,{withFileTypes:true});const lists=await Promise.all(entries.map(e=>e.isDirectory()?files(join(dir,e.name)):Promise.resolve([join(dir,e.name)])));return lists.flat().sort();}for(const file of await files(join(assets,'schema')))hash.update(relative(join(assets,'schema'),file).replaceAll('\\','/')).update('\0').update(await readFile(file));if(hash.digest('hex')!==expected.schemaSha256)throw new HeraError('SCHEMA_MISMATCH','Bundled protocol schema differs from the pinned contract.',4);return expected;}
const workerChecks=['readOnly','concurrency','communication','resume','cancel','approvalDenial','applySpawn','singleWriter'] as const;
const externalChecks=['routing','authSeparation','plaintext','providerFailures','noFallback'] as const;
const workerEvidence=z.strictObject({schemaVersion:z.literal(1),fingerprint:z.string(),checkedAt:z.iso.datetime(),checks:z.record(z.enum(workerChecks),z.literal('pass')),externalChecks:z.record(z.enum(externalChecks),z.literal('pass')).optional(),nativeThreadIds:z.array(z.string()).min(1)});
export async function workerCapability(home:string|undefined,config:Config){
  const contract=await verifyContract();const hash=createHash('sha256').update(JSON.stringify({contract,config:{mode:config.mode,main:config.main,workers:config.workers,safety:config.safety},os:process.platform,arch:process.arch}));
  const ext=import.meta.url.endsWith('.ts')?'.ts':'.js';
  for(const path of ['capabilities','client','config-compiler','launcher','transport','external-runtime','../providers/opencode-go','../providers/go-credentials','../session/controller','../session/workers','../session/phase-policy','../session/apply-review','../config'])hash.update(path).update(await readFile(new URL(path+ext,import.meta.url)));
  const external=config.mode==='external_workers';const runtime=external&&home?await externalRuntime(home):null;if(external)hash.update(JSON.stringify(runtime?.receipt??null));
  const fingerprint=hash.digest('hex');const raw=home?await existsJson(join(home,'metadata',external?'external-worker-verification.json':'worker-verification.json')):undefined;const evidence=workerEvidence.safeParse(raw);
  const ready=evidence.success&&evidence.data.fingerprint===fingerprint&&(!external||runtime!==null&&evidence.data.externalChecks!==undefined);
  return {ready,fingerprint,checkedAt:ready?evidence.data.checkedAt:null,reason:ready?'Native local verification matches this runtime, code and selected configuration.':'Native worker verification is missing or stale for this runtime, code, platform or selected configuration.'};
}
export async function capabilityReport(config:Config,home?:string){const contract=await verifyContract();const workers=await workerCapability(home,config);return {schemaVersion:1,fingerprint:workers.fingerprint,...contract,platform:{os:process.platform,arch:process.arch,release:release()},checkedAt:new Date().toISOString(),externalMode:config.mode==='external_workers'&&workers.ready?'verified_local':'blocked',workers,checks:Object.fromEntries(['G02','G03','G04','G10','G11','G12','G13','G14','G15'].map(gate=>{const covered=['G02','G03','G04','G14'].includes(gate)||config.mode==='external_workers';return [gate,{state:workers.ready&&covered?'pass':'not_run',reason:covered?workers.reason:'Live external routing evidence is required; no mock promotion.'}];}))};}
