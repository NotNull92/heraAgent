import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configSchema,defaults,projectSchema,loadConfig} from '../src/config.js';
import {atomicJson} from '../src/paths.js';
import {safeText} from '../src/errors.js';
describe('trust boundaries',()=>{
  it('rejects unknown fields and invalid limits',()=>{expect(configSchema.safeParse({...defaults,secret:'no'}).success).toBe(false);expect(configSchema.safeParse({...defaults,workers:{...defaults.workers,maxConcurrent:0}}).success).toBe(false);expect(projectSchema.safeParse({baseUrl:'https://example.com'}).success).toBe(false);});
  it('serializes atomic metadata and restricts project ceilings',async()=>{const home=await mkdtemp(join(tmpdir(),'hera-한글 space-'));await Promise.all([atomicJson(join(home,'config.json'),defaults),atomicJson(join(home,'config.json'),{...defaults,language:'en'})]);expect(JSON.parse(await readFile(join(home,'config.json'),'utf8')).language).toBe('en');await atomicJson(join(home,'.hera.json'),{maxConcurrent:8,mode:'external_workers'});const loaded=await loadConfig(home,home);expect(loaded.config.workers.maxConcurrent).toBe(3);expect(loaded.config.mode).toBe('gpt_only');expect(loaded.suggestions).toHaveLength(1);});
  it('removes terminal and credential controls',()=>{expect(safeText('\x1b]52;c;bad\x07hello\x1b[31m')).toBe('hello');expect(safeText('Bearer fake-secret-value')).toBe('[REDACTED]');});
});
