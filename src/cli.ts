import {Command} from 'commander';
import {realpath,readFile} from 'node:fs/promises';
import {z} from 'zod';
import {heraHome} from './paths.js';
import {loadConfig,saveConfig,parseEffort} from './config.js';
import {errorView,HeraError} from './errors.js';
import {CodexClient} from './codex/client.js';
import {CODEX_VERSION} from './codex/launcher.js';
import {startupArgs,validateModelChoices} from './codex/config-compiler.js';
import {Controller} from './session/controller.js';
import {listMetadata} from './metadata.js';
import {capabilityReport} from './codex/capabilities.js';
import {probeGo} from './providers/opencode-go.js';
import {goCredentialStatus,resolveGoCredential,saveGoCredential,deleteGoCredential} from './providers/go-credentials.js';
import {providerStatus,loginOpenAI} from './providers/accounts.js';
import {readSecret} from './secret-input.js';
import {installExternalRuntime} from './codex/external-runtime.js';
import {installBrowser} from './research/browser.js';
export const VERSION='0.1.0-alpha.1';
export async function main(argv=process.argv) {
  const program=new Command().name('hera').description('Hera local coding agent').version(`${VERSION} (api v${CODEX_VERSION})`).option('--cwd <path>','workspace',process.cwd()).option('--single-agent','explicit single-agent operation with native workspace permissions').exitOverride();
  const context=async()=>{const home=await heraHome();const cwd=await realpath(program.opts<{cwd:string}>().cwd);return {home,cwd,...await loadConfig(home,cwd)};};
  program.command('research').command('setup').description('install the pinned free Chromium browser without removing existing versions').action(async()=>{const {home}=await context();await installBrowser(home);console.log('무료 Chromium 설치 완료. CAPTCHA는 Hera의 /research open 및 /research resume으로 직접 해결합니다.');});
  program.command('runtime').command('install <binary>').requiredOption('--sha256 <digest>','explicitly reviewed patched App Server SHA-256').action(async(binary:string,opts:{sha256:string})=>{const {home}=await context();console.log(JSON.stringify(await installExternalRuntime(home,binary,opts.sha256)));});
  program.command('init').option('--list-models').option('--model <id>').option('--worker-model <id>').option('--effort <level>','main reasoning effort, or default').option('--worker-effort <level>','worker reasoning effort, or default').option('--language <language>').action(async(opts:{listModels?:boolean;model?:string;workerModel?:string;effort?:string;workerEffort?:string;language?:string})=>{
    const {home,cwd}=await context();const {config}=await loadConfig(home);
    if(opts.listModels||opts.model||opts.workerModel||opts.effort!==undefined||opts.workerEffort!==undefined){const client=await CodexClient.connect(home,cwd,startupArgs(config));try{const models=await client.models();if(opts.listModels)console.log(JSON.stringify({models,catalogNotEntitlement:true},null,2));if(opts.model)config.main.model=opts.model;if(opts.workerModel)config.workers.gptModel=opts.workerModel;
      for(const [value,target] of [[opts.effort,config.main],[opts.workerEffort,config.workers]] as const)if(value!==undefined)target.reasoningEffort=parseEffort(value);
      if(opts.model||opts.workerModel||opts.effort!==undefined||opts.workerEffort!==undefined)validateModelChoices({...config,mode:'gpt_only'},models);
    }finally{await client.close();}}
    if(opts.language){if(opts.language!=='en'&&opts.language!=='ko')throw new HeraError('INVALID_LANGUAGE','Use en or ko.',2);config.language=opts.language;}
    await saveConfig(home,config);if(!opts.listModels)console.log('Configuration saved. Official isolated OpenAI login is required. Catalog discovery does not verify paid model access.');
  });
  program.command('doctor [target]').option('--json').option('--live','one Go coding probe, at most 64 output tokens; does not grant worker acceptance').action(async(target:string|undefined,opts:{live?:boolean})=>{const {home,cwd,config}=await context();if(target&&target!=='external')throw new HeraError('INVALID_TARGET','Use doctor or doctor external.',2);if(target==='external'){if(opts.live){console.error('Explicit live scope: Go deepseek-v4.1-flash, one request, 20 seconds, at most 64 output tokens. Provider balance overflow may apply.');console.log(JSON.stringify(await probeGo((await resolveGoCredential(home)).key),null,2));}else console.log(JSON.stringify({...await capabilityReport(config,home),...await goCredentialStatus(home)},null,2));return;}if(opts.live)throw new HeraError('INVALID_TARGET','--live requires external.',2);const client=await CodexClient.connect(home,cwd,startupArgs(config));try{console.log(JSON.stringify({hera:VERSION,node:process.version,platform:process.platform,arch:process.arch,codex:CODEX_VERSION,externalMode:(await capabilityReport(config,home)).externalMode,native:'initialized',account:await client.account(),catalogCount:(await client.models()).length,collaboration:await capabilityReport(config,home),execution:'native workspace-write; on-request approvals; no /apply step',windowsSandbox:process.platform==='win32'?await client.rpc.request('windowsSandbox/readiness',undefined):'not_applicable'},null,2));}finally{await client.close();}});
  program.command('config').command('show').action(async()=>console.log(JSON.stringify(await loadConfig(await heraHome(),await realpath(program.opts<{cwd:string}>().cwd)),null,2)));
  program.command('sandbox').command('setup').option('--mode <mode>','official Windows setup: unelevated or elevated','unelevated').action(async(opts:{mode:string})=>{
    if(process.platform!=='win32')throw new HeraError('WINDOWS_ONLY','Windows sandbox setup is only needed on Windows.',2);
    if(opts.mode!=='unelevated'&&opts.mode!=='elevated')throw new HeraError('INVALID_SANDBOX_MODE','Use unelevated or elevated.',2);
    const {home,cwd,config}=await context();const client=await CodexClient.connect(home,cwd,startupArgs(config));
    const abort=new AbortController();const cancel=()=>abort.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
    try{console.error(`공식 Windows 샌드박스 설정을 시작합니다 (${opts.mode}).`);await client.setupWindowsSandbox(opts.mode,cwd,abort.signal);}
    finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);await client.close();}
    const check=await CodexClient.connect(home,cwd,startupArgs(config));
    try{const readiness=await check.windowsSandboxReadiness();console.log(JSON.stringify({windowsSandbox:readiness}));if(readiness.status!=='ready')throw new HeraError('WINDOWS_SANDBOX_NOT_READY','Setup completed but the fresh runtime is not ready; inspect official sandbox configuration.',4);}
    finally{await check.close();}
  });
  const auth=program.command('auth');
  auth.command('status [provider]').action(async(provider?:string)=>{const {home,cwd,config}=await context();if(provider&&provider!=='openai'&&provider!=='go')throw new HeraError('UNSUPPORTED_AUTH','Only openai and go are supported.',2);console.log(JSON.stringify(provider==='go'?await goCredentialStatus(home):await providerStatus(home,cwd,config)));});
  auth.command('login <provider>').option('--device').option('--from-env','save the existing Go environment key in the OS credential store').action(async(provider:string,opts:{device?:boolean;fromEnv?:boolean})=>{
    if(provider!=='openai'&&provider!=='go')throw new HeraError('UNSUPPORTED_AUTH','Only openai and go are supported.',2);
    const {home,cwd,config}=await context();
    if(provider==='go'){
      if(opts.device)throw new HeraError('UNSUPPORTED_AUTH','Go uses an API key; device OAuth is unavailable.',2);
      const key=opts.fromEnv?process.env.HERA_OPENCODE_GO_API_KEY:await readSecret();if(!key)throw new HeraError('BLOCKED_NO_CREDENTIALS','No Go API key supplied.',3);
      await saveGoCredential(home,key);console.log('OpenCode Go 키를 OS 자격 증명 저장소에 저장했습니다. 새 터미널에서도 자동으로 사용합니다.');return;
    }
    if(opts.fromEnv)throw new HeraError('UNSUPPORTED_AUTH','--from-env is only supported for Go.',2);
    await loginOpenAI(home,cwd,config,text=>console.log(text),opts.device);console.log('Official login completed in the Hera keyring profile.');
  });
  auth.command('logout <provider>').action(async(provider:string)=>{if(provider!=='go')throw new HeraError('UNSUPPORTED_AUTH','This command removes only the Hera Go key. OpenAI login is managed by the native runtime.',2);const {home}=await context();await deleteGoCredential(home);console.log(JSON.stringify({storedGoKeyRemoved:true,environmentKeyPresent:!!process.env.HERA_OPENCODE_GO_API_KEY}));});
  program.command('sessions').action(async()=>{const {home,cwd}=await context();console.log(JSON.stringify(await listMetadata(home,cwd),null,2));});
  const headless=async(promptFile:string,singleAgent:boolean,id?:string)=>{const {home,cwd,config}=await context();const previous=id?(await listMetadata(home,cwd)).find(s=>s.heraSessionId===id):undefined;if(id&&!previous)throw new HeraError('SESSION_NOT_FOUND','No matching workspace session reference.',2);const controller=await Controller.open(home,cwd,config,singleAgent,previous);let text='';controller.on('event',e=>{if(e.method==='item/agentMessage/delta'){const p=z.object({delta:z.string()}).safeParse(e.params);if(p.success)text=(text+p.data.delta).slice(-1024*1024);}});const cancel=()=>{void controller.interrupt().catch(()=>{});};process.once('SIGINT',cancel);try{console.log(JSON.stringify({...await controller.run(await readFile(promptFile,'utf8')),text}));}finally{process.removeListener('SIGINT',cancel);await controller.close();}};
  program.command('run').requiredOption('--prompt-file <path>').option('--single-agent').action(async(o:{promptFile:string;singleAgent?:boolean})=>headless(o.promptFile,o.singleAgent??false));
  program.command('resume [id]').requiredOption('--prompt-file <path>').option('--single-agent').action(async(id:string|undefined,o:{promptFile:string;singleAgent?:boolean})=>{const {home,cwd}=await context();const chosen=id??(await listMetadata(home,cwd))[0]?.heraSessionId;if(!chosen)throw new HeraError('SESSION_NOT_FOUND','No saved session in this workspace.',2);await headless(o.promptFile,o.singleAgent??false,chosen);});
  program.action(async()=>{if(!process.stdin.isTTY||!process.stdout.isTTY)throw new HeraError('TTY_REQUIRED','Use hera run --prompt-file <file> --single-agent outside an interactive terminal.',2);const {home,cwd,config}=await context();const [{render},{createElement},{App},{InteractiveSession}]=await Promise.all([import('ink'),import('react'),import('./tui/App.js'),import('./session/interactive.js')]);const session=new InteractiveSession(home,cwd,config,program.opts<{singleAgent?:boolean}>().singleAgent??false);const ui=render(createElement(App,{session}),{exitOnCtrlC:false});const stop=()=>{void session.close().finally(()=>ui.unmount());};process.once('SIGTERM',stop);try{await session.initializeProviders();if(!session.providerSetupRequired)void session.refreshLimits();await ui.waitUntilExit();}finally{process.removeListener('SIGTERM',stop);await session.close();ui.unmount();}});
  try {await program.parseAsync(argv);} catch(e) {if(e && typeof e==='object' && 'code' in e && (e.code==='commander.helpDisplayed'||e.code==='commander.version'))return;const view=errorView(e);if(e && typeof e==='object' && 'code' in e && String(e.code).startsWith('commander.'))view.exitCode=2;console.error(JSON.stringify(view));process.exitCode=view.exitCode;}
}
