import {readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {inspectArchive} from './package-utils.mjs';
const file=process.argv[2]??readdirSync('.artifacts').filter(f=>f.endsWith('.tgz')).sort().at(-1);
if(!file)throw new Error('Run npm run release:prepare first');
console.log(JSON.stringify(inspectArchive(process.argv[2]?resolve(file):join('.artifacts',file))));
