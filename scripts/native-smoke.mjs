import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {startupArgs} from '../dist/codex/config-compiler.js';
import {defaults} from '../dist/config.js';
const home=await mkdtemp(join(tmpdir(),'hera-native-'));
const client=await CodexClient.connect(home,home,startupArgs(defaults));
try{const account=await client.account();const models=await client.models();if(account.ready)throw new Error('Isolated smoke unexpectedly authenticated');const {config}=await client.rpc.request('config/read',{cwd:home,includeLayers:false});for(const value of [config.agents.enabled,config.features.multi_agent,config.features.multi_agent_v2])if(value!==false)throw new Error('Spawn-disable config drift');const sandbox=process.platform==='win32'?await client.rpc.request('windowsSandbox/readiness',undefined):{status:'not_applicable'};console.log(JSON.stringify({platform:process.platform,arch:process.arch,initialize:'pass',accountReady:account.ready,catalogCount:models.length,spawnConfiguration:'disabled (enforcement not live tested)',sandbox,inference:'not_run'}));}finally{if(!await client.close())throw new Error('Native smoke required forced cleanup');}
