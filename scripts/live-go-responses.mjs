import {randomUUID} from 'node:crypto';
import {heraHome} from '../dist/paths.js';
import {resolveGoCredential} from '../dist/providers/go-credentials.js';
import {GO_URL,GO_MODEL,classifyStatus} from '../dist/providers/opencode-go.js';
import {errorView,HeraError} from '../dist/errors.js';
if(!process.argv.includes('--live')){console.error('Opt-in required: --live. One Go Responses compatibility request, 64 output tokens, 20 seconds. No retry or fallback.');process.exit(4);}
try{
  const {key}=await resolveGoCredential(await heraHome());if(!key)throw new HeraError('BLOCKED_NO_CREDENTIALS','Store the Go key with hera auth login go.',3);
  const response=await fetch(`${GO_URL}/responses`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization:`Bearer ${key}`,'content-type':'application/json','user-agent':'hera/0.1.0-alpha.1','x-opencode-session':randomUUID()},body:JSON.stringify({model:GO_MODEL,input:'Coding compatibility probe: return only the JavaScript expression 1 + 1.',max_output_tokens:64,stream:false})});
  // Report status only: provider bodies can echo credentials or arbitrary request content.
  await response.body?.cancel();
  console.log(JSON.stringify({scope:'one direct Go Responses compatibility request',requestedModel:GO_MODEL,route:`${GO_URL}/responses`,httpStatus:response.status,state:response.ok?'needs_native_verification':'blocked',reason:response.ok?'HTTP acceptance alone does not prove Codex streaming/tools':classifyStatus(response.status),externalMode:'blocked'}));
  if(!response.ok)process.exitCode=4;
}catch(error){console.error(JSON.stringify(errorView(error instanceof HeraError?error:new HeraError('PROBE_UNKNOWN_OUTCOME','Go Responses transport failed; no retry or fallback.',5,false))));process.exitCode=5;}
