import {it,expect} from 'vitest';
import {setTimeout as delay} from 'node:timers/promises';
import {connect} from 'node:net';
import {ResearchQueue,retryAt,type ResearchResult} from '../src/research/queue.js';
import {publicAddress,publicUrl,startPublicProxy} from '../src/research/proxy.js';
import {challengeText} from '../src/research/browser.js';

const ok=(url='https://example.com'):ResearchResult=>({status:'ok',url,retrievedAt:new Date().toISOString(),text:'fixture'});
it('serializes different work, merges duplicate work and reuses only successful evidence',async()=>{
  const queue=new ResearchQueue(0);let active=0,peak=0,reads=0;
  const read=async()=>{reads++;peak=Math.max(peak,++active);await delay(10);active--;return ok();};
  const results=await Promise.all([queue.run('one','https://example.com',read),queue.run('one','https://example.com',read),queue.run('two','https://example.com',read)]);
  expect(peak).toBe(1);expect(reads).toBe(2);expect(results[1]!.cached).toBe(true);
  expect((await queue.run('one','https://example.com',read)).cached).toBe(true);expect(reads).toBe(2);
  expect(queue.status().queued).toBe(0);await queue.close();await expect(queue.run('new','https://example.com',read)).rejects.toThrow('closed');
});
it('honors Retry-After and requires explicit CAPTCHA resolution without retry storms',async()=>{
  const queue=new ResearchQueue(0);let calls=0;const origin='https://example.com';
  const captcha:ResearchResult={...ok(),status:'captcha'};
  const read=async()=>{calls++;return captcha;};
  await queue.run('a',origin,read);expect((await queue.run('b',origin,read)).status).toBe('captcha');expect(calls).toBe(1);
  queue.clearPause(origin);queue.remember('a',ok());expect((await queue.run('a',origin,read)).cached).toBe(true);
  const rate:ResearchResult={...ok(),status:'rate_limited',retryAt:new Date(Date.now()+60000).toISOString()};
  await queue.run('c',origin,async()=>rate);expect((await queue.run('d',origin,read)).status).toBe('rate_limited');expect(calls).toBe(1);
  expect(retryAt('120',1000)).toBe(121000);expect(retryAt('Thu, 01 Jan 1970 00:02:00 GMT',1000)).toBe(120000);expect(retryAt('invalid',1000)).toBe(61000);
  await queue.close();
});
it('cancels queued waits and admits new requests after interruption',async()=>{
  const queue=new ResearchQueue(10000);await queue.run('a','origin',async()=>ok());
  const waiting=queue.run('b','origin',async()=>ok());const rejected=expect(waiting).rejects.toThrow();await queue.interrupt();await rejected;
  expect((await queue.run('c','other',async()=>ok())).status).toBe('ok');await queue.close();
});
it('blocks private, mapped, numeric, credentialed and non-HTTPS destinations',()=>{
  for(const address of ['127.0.0.1','10.1.2.3','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])expect(publicAddress(address),address).toBe(false);
  expect(publicAddress('8.8.8.8')).toBe(true);expect(publicAddress('2606:4700:4700::1111')).toBe(true);
  for(const url of ['file:///C:/secret','http://example.com','https://localhost','https://127.1','https://2130706433','https://[::1]','https://user:pass@example.com','https://example.com:8443'])expect(()=>publicUrl(url),url).toThrow();
  expect(publicUrl('https://example.com/a#fragment').href).toBe('https://example.com/a');
  expect(challengeText('Unfortunately, bots use DuckDuckGo too.')).toBe(true);expect(challengeText('Node.js documentation')).toBe(false);
});
it('the actual CONNECT proxy rejects loopback instead of reaching a local service',async()=>{
  const proxy=await startPublicProxy();try{
    const result=await new Promise<string>((resolve,reject)=>{let text='';const socket=connect(Number(new URL(proxy.url).port),'127.0.0.1',()=>socket.write('CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n'));socket.on('error',reject);socket.on('data',chunk=>text+=chunk);socket.on('end',()=>resolve(text));socket.setTimeout(2000,()=>socket.destroy(new Error('Proxy test timeout')));});
    expect(result).toContain('403 Forbidden');
  }finally{await proxy.close();}
});
