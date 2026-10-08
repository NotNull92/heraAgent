import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
export function npm(args,cwd=process.cwd()){
  const cli=[process.env.npm_execpath,join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].find(p=>p&&existsSync(p));
  if(!cli)throw new Error('Cannot resolve npm CLI; invoke through npm run or set npm_execpath to the verified npm CLI file.');
  const result=spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});if(result.status!==0)throw new Error(`npm ${args[0]} failed (${result.status}): ${result.stderr}`);return result.stdout;
}
export function archiveFiles(tgz){
  const tar=gunzipSync(readFileSync(tgz),{maxOutputLength:128*1024*1024});const files=[];
  for(let offset=0;offset+512<=tar.length;){const header=tar.subarray(offset,offset+512);if(header.every(b=>b===0))break;const text=(a,b)=>header.subarray(a,b).toString('utf8').replace(/\0.*$/s,'');const size=parseInt(text(124,136).trim(),8);if(!Number.isSafeInteger(size)||size<0||offset+512+size>tar.length)throw new Error('Invalid tar frame');const name=[text(345,500),text(0,100)].filter(Boolean).join('/');const type=text(156,157);if(type===''||type==='0')files.push({name,mode:parseInt(text(100,108).trim(),8),body:tar.subarray(offset+512,offset+512+size)});else throw new Error(`Unsupported archive entry: ${name}`);offset+=512+Math.ceil(size/512)*512;}return files;
}
export function inspectArchive(tgz){const files=archiveFiles(tgz);const required=['package/package.json','package/npm-shrinkwrap.json','package/bin/hera.mjs','package/dist/cli.js','package/assets/codex/compatibility.json','package/assets/codex/coding-instructions.md','package/assets/codex/research-instructions.md'];for(const name of required)if(!files.some(f=>f.name===name))throw new Error(`Missing package file: ${name}`);for(const file of files){if(!/^package\/(bin\/|dist\/|assets\/|package\.json$|npm-shrinkwrap\.json$|README\.md$|CHANGELOG\.md$|SECURITY\.md$|THIRD_PARTY_NOTICES\.md$)/.test(file.name)||file.name.split('/').includes('..')||/(^|\/)(auth\.json|\.env|\.hera|\.codex|node_modules|\.git)(\/|$)|\.(pem|key|log|exe|dll)$/i.test(file.name))throw new Error(`Unexpected archive path: ${file.name}`);if(/gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{30,}|-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(file.body.toString('utf8')))throw new Error(`Secret pattern in package: ${file.name}`);}
const bin=files.find(f=>f.name==='package/bin/hera.mjs');if(!bin.body.toString().startsWith('#!/usr/bin/env node'))throw new Error('Missing executable shebang');
// Windows npm pack can emit 0644; npm bin-links sets executable permissions at installation.
// The exact artifact must pass direct shebang execution on macOS before release claims.
return {files:files.length,bytes:readFileSync(tgz).length,archiveBinMode:bin.mode.toString(8)};}
