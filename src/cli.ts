import {Command} from 'commander';
import {realpath} from 'node:fs/promises';
import {heraHome} from './paths.js';
import {loadConfig,saveConfig} from './config.js';
import {errorView,HeraError} from './errors.js';
export const VERSION='0.1.0-alpha.1';
export async function main(argv=process.argv) {
  const program=new Command().name('hera').description('Hera local coding agent').version(`${VERSION} (Codex 0.160.1)`).option('--cwd <path>','workspace',process.cwd()).exitOverride();
  program.command('init').action(async()=>{const home=await heraHome();const {config}=await loadConfig(home);await saveConfig(home,config);console.log('Configuration ready. Models are unselected; official OpenAI login is required.');});
  program.command('doctor').option('--json').action(async()=>{const home=await heraHome();await loadConfig(home,await realpath(program.opts<{cwd:string}>().cwd));console.log(JSON.stringify({hera:VERSION,node:process.version,platform:process.platform,arch:process.arch,codex:'0.160.1',externalMode:'blocked',native:'not_run'},null,2));});
  program.command('config').command('show').action(async()=>console.log(JSON.stringify(await loadConfig(await heraHome(),await realpath(program.opts<{cwd:string}>().cwd)),null,2)));
  program.action(()=>{throw new HeraError('TUI_NOT_READY','TUI is under implementation. Use hera doctor.',4);});
  try {await program.parseAsync(argv);} catch(e) {if(e && typeof e==='object' && 'code' in e && (e.code==='commander.helpDisplayed'||e.code==='commander.version'))return;const view=errorView(e);if(e && typeof e==='object' && 'code' in e && String(e.code).startsWith('commander.'))view.exitCode=2;console.error(JSON.stringify(view));process.exitCode=view.exitCode;}
}
