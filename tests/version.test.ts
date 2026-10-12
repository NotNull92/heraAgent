import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {VERSION} from '../src/version.js';
it('uses the package version for CLI and provider client identity',()=>{
  expect(VERSION).toBe(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);
});
