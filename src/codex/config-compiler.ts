import type {Config} from '../config.js';
import type {JsonValue} from './generated/serde_json/JsonValue.js';
import {HeraError} from '../errors.js';
export function nativeSettings(config:Config):Record<string,JsonValue> {
  return {
    model_provider:'openai',sandbox_mode:'read-only',approval_policy:'never',
    'agents.enabled':false,'features.multi_agent':false,'features.multi_agent_v2':false,
    'agents.max_concurrent_threads_per_session':config.workers.maxConcurrent,
    ...(config.workers.gptModel?{'agents.default_subagent_model':config.workers.gptModel}:{}),
    'features.apps':false,'features.plugins':false,'features.hooks':false,
    'features.browser_use':false,'features.computer_use':false,'features.image_generation':false,
    'features.code_mode':false,'features.code_mode_host':false,'features.request_permissions_tool':false,
    'features.skill_mcp_dependency_install':false,'features.skill_search':false,
    'features.remote_plugin':false,'features.in_app_local_automation':false,
    'features.unbounded_connection_retries':false,web_search:'disabled',
    allow_login_shell:false,'shell_environment_policy.inherit':'core',
    'shell_environment_policy.exclude':['*KEY*','*TOKEN*','*SECRET*','*PASSWORD*','GH_*','GITHUB_*','AWS_*','AZURE_*'],
    'analytics.enabled':false,check_for_update_on_startup:false
  };
}
export function startupArgs(config:Config){return Object.entries(nativeSettings(config)).flatMap(([key,value])=>['-c',`${key}=${JSON.stringify(value)}`]);}
export function requireMode(config:Config,singleAgent:boolean){
  if(config.mode==='external_workers')throw new HeraError('EXTERNAL_MODE_BLOCKED','Go native routing and collaboration gates G10-G15 have not passed; no fallback.',4);
  if(!singleAgent)throw new HeraError('COLLABORATION_UNVERIFIED','G02-G04 are unverified. Explicitly select --single-agent for a read-only session.',4);
  if(!config.main.model)throw new HeraError('MODEL_NOT_SELECTED','Run hera init --list-models, then explicitly select --model and --worker-model.',2);
}
