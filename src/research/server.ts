import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {z} from 'zod';
import {ResearchBrowser} from './browser.js';

export async function startResearch(home:string,coding=true){
  const browser=new ResearchBrowser(home);const path='/mcp/'+randomUUID();const connections=new Set<McpServer>();
  const http=createServer((req,res)=>{void(async()=>{
    if(req.url!==path||req.method!=='POST'||req.headers.origin||req.headers.host!==new URL(url).host){res.writeHead(403);res.end();return;}
    const mcp=new McpServer({name:'hera-local-research',version:'1.0.0'});connections.add(mcp);
    const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};
    mcp.registerTool('load_instructions',{description:coding?'Load the full trusted Hera handbook before coding/workspace work or design/research. Local packaged text only, no web access. Skip for casual conversation; reuse loaded instructions from history.':'Load the trusted Hera design/research handbook locally, without web access. Skip for casual conversation; reuse it from history.',inputSchema:{topic:coding?z.enum(['coding','research']):z.enum(['research'])},annotations:{...annotations,openWorldHint:false}},async({topic})=>({content:[{type:'text',text:await readFile(new URL(`../../assets/codex/${topic}-instructions.md`,import.meta.url),'utf8')}]}));
    mcp.registerTool('web_search',{description:'Search public web pages in a local browser. Three compact results; shared queue/cache. Stop on CAPTCHA or blocking; no paid API.',inputSchema:{query:z.string().trim().min(1).max(500)},annotations},async({query})=>({content:[{type:'text',text:JSON.stringify(await browser.search(query))}]}));
    mcp.registerTool('web_fetch',{description:'Read a public HTTPS document. Reuse its URL and request only needed text; no private/local addresses.',inputSchema:{url:z.string().url().max(4096),offset:z.number().int().min(0).max(100000).default(0),maxCharacters:z.number().int().min(100).max(6000).default(3000)},annotations},async({url,offset,maxCharacters})=>({content:[{type:'text',text:JSON.stringify(await browser.fetch(url,offset,maxCharacters))}]}));
    const transport=new StreamableHTTPServerTransport({enableJsonResponse:true});
    res.on('close',()=>{connections.delete(mcp);void mcp.close();});
    // SDK 1.32.1's implementation declares optional callbacks as |undefined;
    // its Transport interface does not under exactOptionalPropertyTypes.
    try{await mcp.connect(transport as Transport);await transport.handleRequest(req,res);}catch{if(!res.headersSent)res.writeHead(500);res.end();}
  })().catch(()=>res.destroy());});
  let url='';await new Promise<void>((resolve,reject)=>{http.once('error',reject);http.listen(0,'127.0.0.1',resolve);});
  const address=http.address();if(!address||typeof address==='string')throw new Error('Research server did not bind');url=`http://127.0.0.1:${address.port}${path}`;
  return {url,browser,close:async()=>{await browser.close();await Promise.all([...connections].map(mcp=>mcp.close()));http.closeAllConnections();await new Promise<void>(resolve=>http.close(()=>resolve()));}};
}
