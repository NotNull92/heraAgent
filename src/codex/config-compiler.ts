import type {Config} from '../config.js';
import type {JsonValue} from './generated/serde_json/JsonValue.js';
import {HeraError} from '../errors.js';
import type {ModelView} from './client.js';
export function validateModelChoices(config:Config,models:ModelView[]){
  for(const [role,id,effort] of [['main',config.main.model,config.main.reasoningEffort],['worker',config.workers.gptModel,config.workers.reasoningEffort]] as const){
    if(role==='worker'&&config.mode==='external_workers')continue;
    if(!id){if(effort!==null)throw new HeraError('MODEL_NOT_SELECTED',`Select the ${role} model before its effort.`,2);continue;}
    const selected=models.find(m=>m.model===id);
    if(!selected)throw new HeraError('MODEL_UNAVAILABLE',`Selected ${role} model is absent from the native catalog; no fallback.`,2);
    if(effort!==null&&!selected.supportedReasoningEfforts.some(e=>e.reasoningEffort===effort))throw new HeraError('UNSUPPORTED_EFFORT',`Selected ${role} model does not advertise effort ${effort}.`,2);
  }
}
export function nativeSettings(config:Config,mode:'read-only'|'workspace-write'='read-only',workers=false):Record<string,JsonValue> {
  if(workers&&mode!=='read-only')throw new HeraError('INVALID_PHASE','Workers are only available in read-only analysis.',4);
  return {
    model_provider:'openai',sandbox_mode:mode,approval_policy:'never',
    'sandbox_workspace_write.exclude_tmpdir_env_var':true,'sandbox_workspace_write.exclude_slash_tmp':true,
    'sandbox_workspace_write.network_access':false,'sandbox_workspace_write.writable_roots':[],
    'agents.enabled':workers,'features.multi_agent':workers,'features.multi_agent_v2':workers,
    'agents.max_concurrent_threads_per_session':config.workers.maxConcurrent,
    ...(config.workers.gptModel?{'agents.default_subagent_model':config.workers.gptModel}:{}),
    ...(config.main.reasoningEffort?{model_reasoning_effort:config.main.reasoningEffort}:{}),
    ...(config.workers.reasoningEffort?{'agents.default_subagent_reasoning_effort':config.workers.reasoningEffort}:{}),
    'features.apps':false,'features.plugins':false,'features.hooks':false,
    'features.browser_use':false,'features.computer_use':false,'features.image_generation':false,
    // Catalog-selected code_mode_only models need the native host to call sandboxed tools.
    'features.code_mode_host':true,'features.request_permissions_tool':false,
    'features.skill_mcp_dependency_install':false,'features.skill_search':false,
    'features.remote_plugin':false,'features.in_app_local_automation':false,
    'features.unbounded_connection_retries':false,web_search:'disabled',
    allow_login_shell:false,'shell_environment_policy.inherit':'core',
    'shell_environment_policy.exclude':['*KEY*','*TOKEN*','*SECRET*','*PASSWORD*','GH_*','GITHUB_*','AWS_*','AZURE_*'],
    'analytics.enabled':false,check_for_update_on_startup:false
  };
}
export function startupArgs(config:Config,mode:'read-only'|'workspace-write'='read-only',workers=false){return Object.entries(nativeSettings(config,mode,workers)).flatMap(([key,value])=>['-c',`${key}=${JSON.stringify(value)}`]);}
export function requireMode(config:Config,singleAgent:boolean,workersVerified=false){
  if(config.mode==='external_workers'&&(singleAgent||!workersVerified))throw new HeraError('EXTERNAL_MODE_BLOCKED','Mixed runtime and native routing/safety verification are required; no fallback. Use GPT-only for single-agent operation.',4);
  if(!singleAgent&&!workersVerified)throw new HeraError('COLLABORATION_UNVERIFIED','Native worker gates are unverified for these settings. Use hera doctor or explicitly select --single-agent.',4);
  if(!config.main.model)throw new HeraError('MODEL_NOT_SELECTED','Run hera init --list-models, then explicitly select --model and --worker-model.',2);
  if(!singleAgent&&config.mode==='gpt_only'&&!config.workers.gptModel)throw new HeraError('MODEL_NOT_SELECTED','Select a native worker model before starting collaboration.',2);
}
