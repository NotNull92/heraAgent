import {setTimeout as delay} from 'node:timers/promises';

export type ResearchResult={status:'ok'|'captcha'|'rate_limited'|'blocked'|'error';url:string;retrievedAt:string;cached?:boolean;title?:string;text?:string;links?:{title:string;url:string;snippet:string}[];retryAt?:string;message?:string};
export function retryAt(header:string|null,now=Date.now()){
  if(header&&/^\d+$/.test(header.trim()))return now+Math.min(Number(header)*1000,2147483647000);
  const date=header?Date.parse(header):NaN;return Number.isFinite(date)&&date>now?date:now+60000;
}
export class ResearchQueue {
  private tail:Promise<unknown>=Promise.resolve();private pending=new Map<string,Promise<ResearchResult>>();private cache=new Map<string,{until:number;value:ResearchResult}>();
  private next=new Map<string,number>();private pauses=new Map<string,ResearchResult>();private abort=new AbortController();
  // ponytail: one queue per owned Hera runtime tree, 100 cached public results / 10 min.
  // Multiple independent Hera processes need an OS-wide broker if that becomes necessary.
  constructor(private readonly gapMs=2000){}
  status(){return {queued:this.pending.size,paused:[...this.pauses.values()],cached:this.cache.size};}
  clearPause(origin:string){this.pauses.delete(origin);}
  remember(key:string,value:ResearchResult){if(this.cache.size>=100)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,{until:Date.now()+600000,value});}
  async interrupt(){this.abort.abort();await this.tail.catch(()=>{});this.abort=new AbortController();}
  async close(){this.abort.abort();await this.tail.catch(()=>{});this.cache.clear();}
  run(key:string,origin:string,read:()=>Promise<ResearchResult>):Promise<ResearchResult>{
    if(this.abort.signal.aborted)return Promise.reject(new Error('Research closed'));
    const cached=this.cache.get(key);if(cached&&cached.until>Date.now())return Promise.resolve({...cached.value,cached:true});
    const same=this.pending.get(key);if(same)return same.then(value=>({...value,cached:value.status==='ok'}));
    if(this.pending.size>=16)return Promise.reject(new Error('Research queue full; wait for current requests.'));
    const task=this.tail.catch(()=>{}).then(async()=>{
      if(this.abort.signal.aborted)throw new Error('Research closed');
      const pause=this.pauses.get(origin);if(pause){if(pause.status!=='rate_limited'||!pause.retryAt||Date.parse(pause.retryAt)>Date.now())return pause;this.pauses.delete(origin);}
      const wait=Math.max(0,(this.next.get(origin)??0)-Date.now());if(wait)await delay(wait,undefined,{signal:this.abort.signal});
      let result:ResearchResult;try{result=await read();}finally{this.next.set(origin,Date.now()+this.gapMs);}
      if(['captcha','rate_limited','blocked'].includes(result.status))this.pauses.set(origin,result);
      if(result.status==='ok'){if(this.cache.size>=100)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,{until:Date.now()+600000,value:result});}
      return result;
    });this.pending.set(key,task);this.tail=task;
    void task.finally(()=>this.pending.delete(key)).catch(()=>{});return task;
  }
}
