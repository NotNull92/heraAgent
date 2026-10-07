import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {atomicJson,readJson} from './paths.js';
import {HeraError} from './errors.js';
export const metadataSchema=z.strictObject({schemaVersion:z.literal(1),heraSessionId:z.uuid(),codexThreadId:z.string(),codexVersion:z.literal('0.160.1'),mode:z.enum(['gpt_only','external_workers','adaptive']),workspaceRealPath:z.string(),phase:z.string(),lastKnownTurnId:z.string().nullable(),status:z.enum(['idle','running','unknown_outcome','interrupted','complete']),configFingerprint:z.string(),capabilityFingerprint:z.string(),updatedAt:z.string()});
export type Metadata=z.infer<typeof metadataSchema>;
export async function saveMetadata(home:string,metadata:Metadata){await atomicJson(join(home,'metadata','sessions',`${metadataSchema.parse(metadata).heraSessionId}.json`),metadata);}
export async function listMetadata(home:string,cwd:string):Promise<Metadata[]>{let files:string[];try{files=await readdir(join(home,'metadata','sessions'));}catch(e){if(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT')return [];throw e;}const rows:Metadata[]=[];for(const file of files.filter(f=>f.endsWith('.json'))){const parsed=metadataSchema.safeParse(await readJson(join(home,'metadata','sessions',file)));if(!parsed.success)throw new HeraError('INVALID_METADATA',`Preserve and repair incompatible metadata: ${file}`,2);if(parsed.data.workspaceRealPath===cwd)rows.push(parsed.data);}return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
