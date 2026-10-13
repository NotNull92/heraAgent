import {tempFixture} from './temp-fixture.mjs';
import {mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {CodexClient} from '../dist/codex/client.js';
import {startupArgs} from '../dist/codex/config-compiler.js';
import assert from 'node:assert/strict';
import {bundledSkillsRoot} from '../dist/codex/skills.js';
import {defaults} from '../dist/config.js';
const home=await realpath(await tempFixture('hera-native-'));
const userSkill=join(home,'codex/skills/smoke-user/SKILL.md');const userText='---\nname: smoke-user\ndescription: User-owned native smoke fixture.\n---\nPreserve this file.\n';await mkdir(join(home,'codex/skills/smoke-user'),{recursive:true});await writeFile(userSkill,userText);
const client=await CodexClient.connect(home,home,startupArgs(defaults));
try{const {data}=await client.rpc.request('skills/list',{cwds:[home],forceReload:true});const skills=data.flatMap(row=>row.skills);for(const name of ['grilling','grill-me','handoff'])assert(skills.some(skill=>skill.name===name&&skill.enabled&&skill.path===join(bundledSkillsRoot,name,'SKILL.md')));assert(skills.some(skill=>skill.name==='smoke-user'&&skill.path===userSkill));assert.equal(await readFile(userSkill,'utf8'),userText);console.log(JSON.stringify({bundledSkills:'pass',userSkillPreserved:true}));const account=await client.account();const models=await client.models();if(account.ready)throw new Error('Isolated smoke unexpectedly authenticated');const {config}=await client.rpc.request('config/read',{cwd:home,includeLayers:false});for(const value of [config.agents.enabled,config.features.multi_agent,config.features.multi_agent_v2])if(value!==false)throw new Error('Spawn-disable config drift');const sandbox=process.platform==='win32'?await client.rpc.request('windowsSandbox/readiness',undefined):{status:'not_applicable'};console.log(JSON.stringify({platform:process.platform,arch:process.arch,initialize:'pass',accountReady:account.ready,catalogCount:models.length,spawnConfiguration:'disabled (enforcement not live tested)',sandbox,inference:'not_run'}));}finally{if(!await client.close())throw new Error('Native smoke required forced cleanup');}
