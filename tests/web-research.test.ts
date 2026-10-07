import {it,expect} from 'vitest';
import {defaults} from '../src/config.js';
import {nativeSettings} from '../src/codex/config-compiler.js';
import {SEARCH_SERVER,SEARCH_TOOLS,searchProfile,verifySearchConfig,verifySearchInventory,permittedSearchItem} from '../src/codex/web-research.js';

it('restricts analysis to the keyless search profile and disables it for writes',()=>{
  for(const enabled of [true,false]){
    const profile=searchProfile(enabled);verifySearchConfig({[SEARCH_SERVER]:profile},enabled);
    const {required,...defaultRequired}=profile;
    if(!required)verifySearchConfig({[SEARCH_SERVER]:defaultRequired},enabled);
    else expect(()=>verifySearchConfig({[SEARCH_SERVER]:defaultRequired},enabled)).toThrow();
    const settings=nativeSettings(defaults,enabled?'read-only':'workspace-write');
    expect(settings['mcp_servers.hera_web.enabled']).toBe(enabled);
    expect(settings.web_search).toBe('disabled');expect(settings['sandbox_workspace_write.network_access']).toBe(false);
    for(const extra of [{url:'https://other.invalid'},{http_headers:{Authorization:'fixture'}},{command:'fixture'},{enabled:!enabled},{enabled_tools:[...SEARCH_TOOLS,'agent_run']},{tools:{web_search_exa:{output_token_limit:99999}}}])expect(()=>verifySearchConfig({[SEARCH_SERVER]:{...profile,...extra}},enabled)).toThrow();
    expect(()=>verifySearchConfig({[SEARCH_SERVER]:profile,other:{}},enabled)).toThrow();
  }
});
it('requires a connected exact catalog and rejects unexpected tools and write-phase calls',()=>{
  const tools=Object.fromEntries(SEARCH_TOOLS.map(name=>[name,{name,annotations:{readOnlyHint:true,destructiveHint:false}}]));
  const server={name:SEARCH_SERVER,runtimeStatus:'connected',httpOrigin:'https://mcp.exa.ai',toolsError:null,tools};
  verifySearchInventory({data:[server],nextCursor:null});
  for(const change of [{runtimeStatus:'failed'},{toolsError:'offline'},{tools:{}},{tools:{...tools,extra:{name:'agent_run',annotations:{readOnlyHint:true,destructiveHint:false}}}},{httpOrigin:'https://other.invalid'}])expect(()=>verifySearchInventory({data:[{...server,...change}],nextCursor:null})).toThrow();
  expect(()=>verifySearchInventory({data:[server],nextCursor:'more'})).toThrow();
  for(const tool of SEARCH_TOOLS){const item={type:'mcpToolCall',server:SEARCH_SERVER,tool};expect(permittedSearchItem(item,true)).toBe(true);expect(permittedSearchItem(item,false)).toBe(false);}
  for(const item of [{type:'dynamicToolCall'},{type:'mcpToolCall',server:SEARCH_SERVER,tool:'agent_run'},{type:'mcpToolCall',server:'other',tool:'web_search_exa'}])expect(permittedSearchItem(item,true)).toBe(false);
});
