import {it,expect} from 'vitest';
import {PassThrough} from 'node:stream';
import {Transport} from '../src/codex/transport.js';
it('preserves split UTF-8, pre-ack events, out of order replies and approvals',async()=>{
  const input=new PassThrough(),output=new PassThrough();const rpc=new Transport(input,output);const events:unknown[]=[];rpc.on('notification',e=>events.push(e));rpc.on('request',r=>rpc.respond(r.id,{decision:'decline'}));
  const first=rpc.request('one',{}),second=rpc.request('two',{});const frames=Buffer.from('{"method":"delta","params":"한글"}\n{"id":"approval","method":"approval"}\n{"id":2,"result":"two"}\n{"id":1,"result":"one"}\n');
  for(let i=0;i<frames.length;i++)input.write(frames.subarray(i,i+1));expect(await first).toBe('one');expect(await second).toBe('two');expect(events).toEqual([{method:'delta',params:'한글'}]);expect(rpc.requestsPending).toBe(0);rpc.close();
});
it('rejects truncated, oversized and duplicate responses without retry',async()=>{
  for(const frame of ['{"id":1','x'.repeat(100),'invalid\n']){const input=new PassThrough();const rpc=new Transport(input,new PassThrough(),64);const pending=rpc.request('turn/start',{});const rejected=expect(pending).rejects.toMatchObject({outcomeKnown:false});input.end(frame);await rejected;expect(rpc.pendingCount).toBe(0);}
  const input=new PassThrough();const rpc=new Transport(input,new PassThrough());let fault=false;rpc.on('fault',()=>{fault=true;});const request=rpc.request('one',{});input.write('{"id":1,"result":1}\n{"id":1,"result":1}\n');expect(await request).toBe(1);expect(fault).toBe(true);
});
it('bounds pending work and timeout rejects every uncertain operation',async()=>{const rpc=new Transport(new PassThrough(),new PassThrough(),1024,1);const p=rpc.request('turn/start',{},10);await expect(rpc.request('two',{})).rejects.toMatchObject({errorCode:'PENDING_LIMIT'});await expect(p).rejects.toMatchObject({errorCode:'RPC_TIMEOUT',outcomeKnown:false});});
it('bounds unhandled server approval requests',()=>{const input=new PassThrough();const rpc=new Transport(input,new PassThrough(),1024,1);let failed=false;rpc.on('fault',()=>{failed=true;});input.write('{"id":"a","method":"unknownApproval"}\n{"id":"b","method":"unknownApproval"}\n');expect(failed).toBe(true);expect(rpc.requestsPending).toBe(0);});
