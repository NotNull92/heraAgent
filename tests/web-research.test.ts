import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {startResearch} from '../src/research/server.js';
import {defaults} from '../src/config.js';
import {nativeSettings} from '../src/codex/config-compiler.js';
import {SEARCH_SERVER,SEARCH_TOOLS,searchProfile,verifySearchConfig,verifySearchInventory,permittedSearchItem} from '../src/codex/web-research.js';

it('loads complete UTF-8 packaged handbooks locally and rejects arbitrary paths',async()=>{
  const server=await startResearch(await mkdtemp(join(tmpdir(),'hera-guides-')));
  const client=new Client({name:'guide-fixture',version:'1'});
  const search=vi.spyOn(server.browser,'search');const fetch=vi.spyOn(server.browser,'fetch');
  try{
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url)) as Transport);
    expect((await client.listTools()).tools.map(t=>t.name).sort()).toEqual([...SEARCH_TOOLS].sort());
    for(const topic of ['coding','research']){
      const result=await client.callTool({name:'load_instructions',arguments:{topic}});
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([{type:'text',text:await readFile(new URL(`../assets/codex/${topic}-instructions.md`,import.meta.url),'utf8')}]);
    }
    expect((await client.callTool({name:'load_instructions',arguments:{topic:'../../config'}})).isError).toBe(true);
    expect(search).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
    expect(searchProfile(true).tools.load_instructions.output_token_limit).toBe(8000);
  }finally{await client.close();await server.close();}
});

it('exposes only the research handbook in Design and rejects coding loads',async()=>{
  const server=await startResearch(await mkdtemp(join(tmpdir(),'hera-design-guides-')),false);
  const client=new Client({name:'design-fixture',version:'1'});
  try{
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url)) as Transport);
    const tool=(await client.listTools()).tools.find(t=>t.name==='load_instructions')!;
    expect(JSON.stringify(tool)).not.toContain('coding');
    expect((await client.callTool({name:'load_instructions',arguments:{topic:'coding'}})).isError).toBe(true);
    const result=await client.callTool({name:'load_instructions',arguments:{topic:'research'}});
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.content)).not.toMatch(/coding handbook|continue authorized edits|routine edits/);
  }finally{await client.close();await server.close();}
});

it('restricts analysis to the owned local search profile and disables it for writes',()=>{
  for(const enabled of [true,false]){
    const profile=searchProfile(enabled);verifySearchConfig({[SEARCH_SERVER]:profile},enabled);
    const {required,...defaultRequired}=profile;
    if(!required)verifySearchConfig({[SEARCH_SERVER]:defaultRequired},enabled);
    else expect(()=>verifySearchConfig({[SEARCH_SERVER]:defaultRequired},enabled)).toThrow();
    const settings=nativeSettings(defaults,enabled?'read-only':'workspace-write',false,enabled?'http://127.0.0.1:1234':undefined);
    expect(settings['mcp_servers.hera_web.enabled']).toBe(enabled);
    expect(settings.web_search).toBe('disabled');expect(settings['sandbox_workspace_write.network_access']).toBe(false);
    for(const extra of [{url:'https://other.invalid'},{http_headers:{Authorization:'fixture'}},{command:'fixture'},{enabled:!enabled},{enabled_tools:[...SEARCH_TOOLS,'agent_run']},{tools:{web_search:{output_token_limit:99999}}}])expect(()=>verifySearchConfig({[SEARCH_SERVER]:{...profile,...extra}},enabled)).toThrow();
    expect(()=>verifySearchConfig({[SEARCH_SERVER]:profile,other:{}},enabled)).toThrow();
  }
});
it('requires a connected exact catalog and rejects unexpected tools and write-phase calls',()=>{
  const tools=Object.fromEntries(SEARCH_TOOLS.map(name=>[name,{name,annotations:{readOnlyHint:true,destructiveHint:false}}]));
  const server={name:SEARCH_SERVER,runtimeStatus:'connected',httpOrigin:'http://127.0.0.1:1234',toolsError:null,tools};
  verifySearchInventory({data:[server],nextCursor:null},'http://127.0.0.1:1234');
  for(const change of [{runtimeStatus:'failed'},{toolsError:'offline'},{tools:{}},{tools:{...tools,extra:{name:'agent_run',annotations:{readOnlyHint:true,destructiveHint:false}}}},{httpOrigin:'https://other.invalid'}])expect(()=>verifySearchInventory({data:[{...server,...change}],nextCursor:null},'http://127.0.0.1:1234')).toThrow();
  expect(()=>verifySearchInventory({data:[server],nextCursor:'more'},'http://127.0.0.1:1234')).toThrow();
  for(const tool of SEARCH_TOOLS){const item={type:'mcpToolCall',server:SEARCH_SERVER,tool};expect(permittedSearchItem(item,true)).toBe(true);expect(permittedSearchItem(item,false)).toBe(false);}
  for(const item of [{type:'dynamicToolCall'},{type:'mcpToolCall',server:SEARCH_SERVER,tool:'agent_run'},{type:'mcpToolCall',server:'other',tool:'web_search'}])expect(permittedSearchItem(item,true)).toBe(false);
});
