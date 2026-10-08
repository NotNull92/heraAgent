// Real Chromium and MCP, intercepted fixture pages only; no search site or model calls.
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setImmediate} from 'node:timers/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {startResearch} from '../dist/research/server.js';
const home=await mkdtemp(join(tmpdir(),'hera-browser-check-'));
const server=await startResearch(home);const client=new Client({name:'hera-fixture',version:'1'});
const timer=setTimeout(()=>{console.error('Browser fixture timed out');process.exitCode=1;void server.close();},60000);
try{
  const page=await server.browser.open(); // Test-only access; no production bypass/config.
  let requests=0;
  await page.route('https://*.example.com/**',async route=>{
    requests++;const url=new URL(route.request().url());
    if(url.hostname==='rate.example.com')return route.fulfill({status:429,headers:{'retry-after':'120'},body:'Slow down'});
    if(url.hostname==='challenge.example.com')return route.fulfill({status:403,contentType:'text/html',body:'<form id="challenge-form">Verify you are human</form>'});
    return route.fulfill({status:200,contentType:'text/html',body:'<title>Fixture</title><nav>Discard navigation</nav><main>Public document evidence.</main><script>throw new Error("must not run")</script>'});
  });
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url)));
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),['load_instructions','web_fetch','web_search']);
  const read=async url=>{const value=await client.callTool({name:'web_fetch',arguments:{url}});assert.notEqual(value.isError,true);return JSON.parse(value.content[0].text);};
  assert.equal((await fetch(server.url,{method:'POST',headers:{origin:'https://example.com'}})).status,403);
  const first=await read('https://document.example.com/a');assert.equal(first.status,'ok');assert.equal(first.text,'Public document evidence.');
  assert.equal((await read('https://document.example.com/a')).cached,true);assert.equal(requests,1);
  const rate=await read('https://rate.example.com/a');assert.equal(rate.status,'rate_limited');assert.ok(Date.parse(rate.retryAt)>Date.now()+110000);
  assert.equal((await read('https://rate.example.com/b')).status,'rate_limited');assert.equal(requests,2);
  assert.equal((await read('https://challenge.example.com/a')).status,'captcha');assert.equal(requests,3);
  assert.equal((await read('https://challenge.example.com/b')).status,'captcha');assert.equal(requests,3);
  const bad=await client.callTool({name:'web_fetch',arguments:{url:'https://127.0.0.1'}});assert.equal(bad.isError,true);
  const invalid=await client.callTool({name:'web_fetch',arguments:{url:'https://document.example.com',maxCharacters:999999}});assert.equal(invalid.isError,true);
  const owned=server.browser.browser;await server.browser.interrupt();assert.equal(owned.isConnected(),false);assert.equal(server.browser.status().queued,0);
  await client.close();await server.close();await assert.rejects(fetch(server.url));
  // Cancel while Chromium is still starting; cleanup must await the owned launch.
  const opening=startResearch(home);const other=await opening;
  const request=other.browser.fetch('https://document.example.com/');const settled=request.catch(()=>null);
  await setImmediate();assert.ok(other.browser.opening);
  await other.close();await settled;assert.equal(other.browser.browser,undefined);
  console.log(JSON.stringify({browserFixtures:'pass',platform:process.platform,mcp:true,cache:true,rateLimit:true,captchaStop:true,privateDenied:true,interruptAndClose:true,liveSearch:'not_run'}));
}finally{clearTimeout(timer);await client.close().catch(()=>{});await server.close();}
