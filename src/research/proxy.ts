import {createServer} from 'node:http';
import {lookup} from 'node:dns/promises';
import {connect,type Socket} from 'node:net';
import ipaddr from 'ipaddr.js';

export function publicAddress(value:string){
  try{return ipaddr.process(value).range()==='unicast';}catch{return false;}
}
export function publicUrl(value:string){
  const url=new URL(value);
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||!host.includes('.')&&!ipaddr.isValid(host)||/^(localhost|.*\.localhost|.*\.local)$/i.test(host))throw new Error('Only public HTTPS pages on port 443 are allowed.');
  if(ipaddr.isValid(host)&&!publicAddress(host))throw new Error('Private and special network addresses are blocked.');
  url.hash='';return url;
}
// Chromium tunnels every HTTPS connection through this owned proxy. Resolve once,
// validate all answers, then connect to that IP: redirects and DNS rebinding cannot
// turn a public research request into a loopback/LAN request.
export async function startPublicProxy(){
  const sockets=new Set<Socket>();let closed=false;
  const server=createServer((_req,res)=>{res.writeHead(403);res.end();});
  server.on('connection',socket=>{sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));});
  server.on('connect',(req,downstream,head)=>{void(async()=>{
    let timer:NodeJS.Timeout|undefined;
    try{
      const url=publicUrl('https://'+req.url);
      const answers=await Promise.race([lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS timeout')),5000);})]);
      if(closed||downstream.destroyed||!answers.length||answers.some(a=>!publicAddress(a.address)))throw new Error('Blocked address');
      const address=answers.find(a=>a.family===4)??answers[0]!;
      const upstream=connect({host:address.address,family:address.family,port:443});sockets.add(upstream);
      upstream.on('close',()=>sockets.delete(upstream));upstream.on('error',()=>downstream.destroy());downstream.on('error',()=>upstream.destroy());downstream.on('close',()=>upstream.destroy());
      upstream.setTimeout(30000,()=>upstream.destroy());
      upstream.once('connect',()=>{if(downstream.destroyed){upstream.destroy();return;}downstream.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);downstream.pipe(upstream);upstream.pipe(downstream);});
    }catch{downstream.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}finally{clearTimeout(timer);}
  })();});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Proxy did not bind');
  return {url:`http://127.0.0.1:${address.port}`,close:async()=>{closed=true;for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
