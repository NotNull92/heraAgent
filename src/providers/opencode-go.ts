import {randomUUID} from 'node:crypto';
import {HeraError} from '../errors.js';
export const GO_URL='https://opencode.ai/zen/go/v1';
export const GO_MODEL='deepseek-v4.1-flash';
export function classifyStatus(status:number){if(status===401)return 'AUTHENTICATION_FAILED';if(status===403)return 'AUTHORIZATION_FAILED';if(status===404)return 'ENDPOINT_OR_MODEL_UNAVAILABLE';if(status===429)return 'RATE_OR_QUOTA_LIMIT';if(status>=500)return 'PROVIDER_SERVICE_ERROR';return 'PROVIDER_REQUEST_FAILED';}
export async function probeGo(key:string|undefined,request:typeof fetch=fetch){
  if(!key)throw new HeraError('BLOCKED_NO_CREDENTIALS','Set HERA_OPENCODE_GO_API_KEY locally; never paste it into logs or chat.',3);
  const session=randomUUID();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await request(`${GO_URL}/chat/completions`,{method:'POST',redirect:'error',signal:controller.signal,headers:{authorization:`Bearer ${key}`,'content-type':'application/json','user-agent':'hera/0.1.0-alpha.1','x-opencode-session':session},body:JSON.stringify({model:GO_MODEL,messages:[{role:'user',content:'Coding compatibility probe: return only a JavaScript expression that adds 1 and 1. Do not call tools.'}],max_tokens:64,stream:false})});
    if(!response.ok){await response.body?.cancel();return {state:'blocked',reason:classifyStatus(response.status),httpStatus:response.status,retryAfter:response.headers.get('retry-after'),externalMode:'blocked'};}
    const reader=response.body?.getReader();if(!reader)throw new HeraError('EMPTY_PROVIDER_RESPONSE','Provider returned no body.',5,false);let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();throw new HeraError('OVERSIZE_PROVIDER_RESPONSE','Probe response exceeds 64 KiB.',5,false);}chunks.push(part.value);}
    const value:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!value||typeof value!=='object'||!('choices'in value)||!Array.isArray(value.choices)||value.choices.length!==1)throw new HeraError('INVALID_PROVIDER_RESPONSE','Unrecognized Go completion; no success inferred.',5,false);
    const choice:unknown=value.choices[0];if(!choice||typeof choice!=='object'||!('finish_reason'in choice)||choice.finish_reason!=='stop')throw new HeraError('INCOMPLETE_PROVIDER_RESPONSE','Probe did not finish normally.',5,false);
    return {state:'pass',scope:'one direct Go text probe only',requestedModel:GO_MODEL,route:GO_URL,sessionHeader:'x-opencode-session',externalMode:'blocked',remaining:['G11','G12','G13','G14','G15']};
  }catch(error){if(error instanceof HeraError)throw error;throw new HeraError('PROBE_UNKNOWN_OUTCOME','Go probe transport/format failed; no retry or billing fallback.',5,false);}finally{clearTimeout(timer);}
}
