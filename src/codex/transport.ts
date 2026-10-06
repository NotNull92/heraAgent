import {EventEmitter} from 'node:events';
import {TextDecoder} from 'node:util';
import type {Readable,Writable} from 'node:stream';
import {z} from 'zod';
import {HeraError} from '../errors.js';
const idSchema=z.union([z.string(),z.number().int()]);
const envelope=z.object({id:idSchema.optional(),method:z.string().optional(),params:z.unknown().optional(),result:z.unknown().optional(),error:z.object({code:z.number(),message:z.string()}).passthrough().optional()});
export type RpcEvent={method:string;params:unknown};
export type RpcRequest=RpcEvent&{id:string|number};
type Pending={resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout};
export class Transport extends EventEmitter {
  private decoder=new TextDecoder('utf-8',{fatal:true});private buffer='';private nextId=0;private pending=new Map<number,Pending>();private serverIds=new Set<string|number>();private closed=false;
  constructor(readonly input:Readable,readonly output:Writable,readonly maxBytes=16*1024*1024,readonly maxPending=128){
    super();input.on('data',(data:Buffer)=>{try{this.buffer+=this.decoder.decode(data,{stream:true});let n:number;while((n=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,n);this.buffer=this.buffer.slice(n+1);if(Buffer.byteLength(line)>this.maxBytes)throw new Error('Oversize frame');this.dispatch(line);}if(Buffer.byteLength(this.buffer)>this.maxBytes)throw new Error('Oversize frame');}catch{this.fail(new HeraError('INVALID_PROTOCOL','Malformed, duplicate or oversized protocol frame.',5,false));}});
    input.on('end',()=>{try{this.buffer+=this.decoder.decode();}catch{}this.fail(new HeraError('UNEXPECTED_EOF',this.buffer?'Truncated protocol frame; outcome unknown.':'App Server disconnected; reconcile native history.',5,false));});
    input.on('error',()=>this.fail(new HeraError('TRANSPORT_FAILED','App Server input failed.',5,false)));
    output.on('error',()=>this.fail(new HeraError('TRANSPORT_FAILED','App Server output failed.',5,false)));
  }
  get pendingCount(){return this.pending.size;}get requestsPending(){return this.serverIds.size;}
  private dispatch(line:string){
    if(this.closed)return;
    const parsed:unknown=JSON.parse(line);const msg=envelope.parse(parsed);
    if(msg.method){if(msg.id!==undefined){if(this.serverIds.has(msg.id))throw new Error('Duplicate request');this.serverIds.add(msg.id);this.emit('request',{id:msg.id,method:msg.method,params:msg.params});}else this.emit('notification',{method:msg.method,params:msg.params});return;}
    if(typeof msg.id!=='number'||(!Object.hasOwn(msg,'result')&&!msg.error))throw new Error('Invalid response');
    const p=this.pending.get(msg.id);if(!p)throw new Error('Unknown/duplicate response');this.pending.delete(msg.id);clearTimeout(p.timer);
    if(msg.error)p.reject(new HeraError(`RPC_${msg.error.code}`,msg.error.message,5,false));else p.resolve(msg.result);
  }
  private write(value:unknown){if(this.closed)throw new HeraError('TRANSPORT_CLOSED','App Server connection is closed.',5,false);const line=JSON.stringify(value);if(Buffer.byteLength(line)>this.maxBytes)throw new HeraError('OVERSIZE_REQUEST','Request exceeds the frame limit.',2);this.output.write(line+'\n');}
  request(method:string,params:unknown,timeout=30000):Promise<unknown>{
    if(this.closed)return Promise.reject(new HeraError('TRANSPORT_CLOSED','App Server connection is closed.',5,false));
    if(this.pending.size>=this.maxPending)return Promise.reject(new HeraError('PENDING_LIMIT','Too many pending requests.',5));
    const id=++this.nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.fail(new HeraError('RPC_TIMEOUT',`${method} acknowledgment timed out; do not replay uncertain operations.`,5,false)),timeout);this.pending.set(id,{resolve,reject,timer});try{this.write({id,method,params});}catch(e){this.pending.delete(id);clearTimeout(timer);reject(e);}});
  }
  notify(method:string){this.write({method});}
  respond(id:string|number,result:unknown){if(!this.serverIds.has(id))throw new HeraError('STALE_APPROVAL','Request is no longer pending.',5);this.write({id,result});this.serverIds.delete(id);}
  fail(error:HeraError){if(this.closed)return;this.closed=true;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();this.serverIds.clear();this.emit('fault',error);}
  close(){this.fail(new HeraError('TRANSPORT_CLOSED','Connection closed.',5,false));}
}
