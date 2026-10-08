import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configSchema,defaults,projectSchema,loadConfig} from '../src/config.js';
import {atomicJson,rejectRepositoryHome} from '../src/paths.js';
import {safeText} from '../src/errors.js';
import {listMetadata,saveMetadata,metadataSchema} from '../src/metadata.js';
import {CODEX_VERSION} from '../src/codex/launcher.js';
import {randomUUID} from 'node:crypto';
describe('trust boundaries',()=>{
  it('keeps previous-runtime session references readable without rewriting their history',async()=>{
    const home=await mkdtemp(join(tmpdir(),'hera-runtime-upgrade-'));
    const previous={schemaVersion:1 as const,heraSessionId:randomUUID(),codexThreadId:'saved-thread',codexVersion:'0.160.1' as const,mode:'gpt_only' as const,workspaceRealPath:home,phase:'NATIVE',lastKnownTurnId:null,status:'idle' as const,configFingerprint:'old-config',capabilityFingerprint:'old-evidence',updatedAt:new Date().toISOString()};
    await saveMetadata(home,previous);
    const file=join(home,'metadata','sessions',previous.heraSessionId+'.json');const before=await readFile(file,'utf8');
    expect(await listMetadata(home,home)).toEqual([previous]);expect(await readFile(file,'utf8')).toBe(before);
    expect(metadataSchema.safeParse({...previous,codexVersion:CODEX_VERSION}).success).toBe(true);
    expect(metadataSchema.safeParse({...previous,codexVersion:'999.0.0'}).success).toBe(false);
  });
  it('rejects unknown fields and invalid limits',()=>{expect(configSchema.safeParse({...defaults,secret:'no'}).success).toBe(false);expect(configSchema.safeParse({...defaults,workers:{...defaults.workers,maxConcurrent:0}}).success).toBe(false);expect(projectSchema.safeParse({baseUrl:'https://example.com'}).success).toBe(false);});
  it('serializes atomic metadata and restricts project ceilings',async()=>{const home=await mkdtemp(join(tmpdir(),'hera-한글 space-'));await Promise.all([atomicJson(join(home,'config.json'),defaults),atomicJson(join(home,'config.json'),{...defaults,language:'en'})]);expect(JSON.parse(await readFile(join(home,'config.json'),'utf8')).language).toBe('en');await atomicJson(join(home,'.hera.json'),{maxConcurrent:8,mode:'external_workers'});const loaded=await loadConfig(home,home);expect(loaded.config.workers.maxConcurrent).toBe(3);expect(loaded.config.mode).toBe('adaptive');expect(loaded.suggestions).toHaveLength(1);});
  it('removes terminal and credential controls',()=>{expect(safeText('\x1b]52;c;bad\x07hello\x1b[31m')).toBe('hello');expect(safeText('Bearer fake-secret-value')).toBe('[REDACTED]');});
  it('rejects authentication homes inside this repository',async()=>{await expect(rejectRepositoryHome(join(process.cwd(),'.hera'))).rejects.toMatchObject({errorCode:'UNSAFE_AUTH_HOME'});});
});
