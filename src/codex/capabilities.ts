import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {release} from 'node:os';
import {z} from 'zod';
import type {Config} from '../config.js';
import {HeraError} from '../errors.js';
const assets=fileURLToPath(new URL('../../assets/codex/',import.meta.url));
export async function verifyContract(){const expected=z.object({codexVersion:z.literal('0.160.1'),schemaSha256:z.string()}).parse(JSON.parse(await readFile(join(assets,'compatibility.json'),'utf8')));const hash=createHash('sha256');async function files(dir:string):Promise<string[]>{const entries=await readdir(dir,{withFileTypes:true});const lists=await Promise.all(entries.map(e=>e.isDirectory()?files(join(dir,e.name)):Promise.resolve([join(dir,e.name)])));return lists.flat().sort();}for(const file of await files(join(assets,'schema')))hash.update(relative(join(assets,'schema'),file).replaceAll('\\','/')).update('\0').update(await readFile(file));if(hash.digest('hex')!==expected.schemaSha256)throw new HeraError('SCHEMA_MISMATCH','Bundled protocol schema differs from the pinned contract.',4);return expected;}
export async function capabilityReport(config:Config){const contract=await verifyContract();return {schemaVersion:1,fingerprint:createHash('sha256').update(JSON.stringify({contract,config,os:process.platform,arch:process.arch})).digest('hex'),...contract,platform:{os:process.platform,arch:process.arch,release:release()},checkedAt:new Date().toISOString(),externalMode:'blocked',checks:Object.fromEntries(['G02','G03','G04','G10','G11','G12','G13','G14','G15'].map(gate=>[gate,{state:'not_run',reason:'Live enforcement and routing evidence is required; no mock promotion.'}]))};}
