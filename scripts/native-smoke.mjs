import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
const home=await mkdtemp(join(tmpdir(),'hera-native-'));
const client=await CodexClient.connect(home,home);
try{const account=await client.account();const models=await client.models();if(account.ready)throw new Error('Isolated smoke unexpectedly authenticated');console.log(JSON.stringify({platform:process.platform,arch:process.arch,initialize:'pass',accountReady:account.ready,catalogCount:models.length,inference:'not_run'}));}finally{if(!await client.close())throw new Error('Native smoke required forced cleanup');}
