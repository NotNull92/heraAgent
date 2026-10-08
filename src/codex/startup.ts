import {AsyncLocalStorage} from 'node:async_hooks';

// One startup attempt only: never retain credentials or trust results for later sessions.
const startup=new AsyncLocalStorage<{active:boolean;checks:Map<string,Promise<unknown>>}>();
export async function withStartupChecks<T>(run:()=>Promise<T>):Promise<T>{
  if(startup.getStore()?.active)return run();
  const scope={active:true,checks:new Map<string,Promise<unknown>>()};
  return startup.run(scope,async()=>{try{return await run();}finally{scope.active=false;scope.checks.clear();}});
}
export async function startupCheck<T>(key:string,run:()=>Promise<T>):Promise<T>{
  const scope=startup.getStore();if(!scope?.active)return run();
  let checked=scope.checks.get(key);
  if(!checked){checked=Promise.resolve().then(run);scope.checks.set(key,checked);}
  return checked as Promise<T>;
}
