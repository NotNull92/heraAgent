import {z} from 'zod';
import {join} from 'node:path';
import {existsJson,atomicJson} from './paths.js';
import {HeraError} from './errors.js';
const model=z.string().min(1).max(200).nullable();
export const configSchema=z.strictObject({
  schemaVersion:z.literal(1),language:z.enum(['ko','en']),mode:z.enum(['gpt_only','external_workers']),backend:z.literal('codex_app_server'),
  main:z.strictObject({model,reasoningEffort:z.enum(['none','minimal','low','medium','high','xhigh','max']).nullable()}),
  workers:z.strictObject({gptModel:model,externalProfile:z.literal('opencode_go_deepseek'),maxConcurrent:z.number().int().min(1).max(8),implementationStyle:z.literal('patch_proposals')}),
  providers:z.strictObject({opencode_go_deepseek:z.strictObject({baseUrl:z.literal('https://opencode.ai/zen/go/v1'),model:z.literal('deepseek-v4.1-flash'),apiKeyEnv:z.literal('HERA_OPENCODE_GO_API_KEY'),transport:z.literal('auto_probe'),billingPolicy:z.literal('subscription_preferred_no_client_fallback')})}),
  safety:z.strictObject({strategy:z.literal('phased_single_writer'),approvalPolicy:z.literal('on-request'),automaticProviderFallback:z.literal(false),allowUnverifiedExternalMode:z.literal(false)}),
  ui:z.strictObject({color:z.enum(['auto','never']),reducedMotion:z.boolean()})
});
export type Config=z.infer<typeof configSchema>;
export const defaults:Config={schemaVersion:1,language:'ko',mode:'gpt_only',backend:'codex_app_server',main:{model:null,reasoningEffort:null},workers:{gptModel:null,externalProfile:'opencode_go_deepseek',maxConcurrent:3,implementationStyle:'patch_proposals'},providers:{opencode_go_deepseek:{baseUrl:'https://opencode.ai/zen/go/v1',model:'deepseek-v4.1-flash',apiKeyEnv:'HERA_OPENCODE_GO_API_KEY',transport:'auto_probe',billingPolicy:'subscription_preferred_no_client_fallback'}},safety:{strategy:'phased_single_writer',approvalPolicy:'on-request',automaticProviderFallback:false,allowUnverifiedExternalMode:false},ui:{color:'auto',reducedMotion:false}};
export const projectSchema=z.strictObject({language:z.enum(['ko','en']).optional(),ui:configSchema.shape.ui.partial().optional(),mode:z.enum(['gpt_only','external_workers']).optional(),modelProfile:z.string().optional(),maxConcurrent:z.number().int().min(1).max(8).optional(),testCommands:z.array(z.string()).optional()});
export async function loadConfig(home:string,cwd?:string) {
  const stored=await existsJson(join(home,'config.json'));
  const parsed=configSchema.safeParse(stored??structuredClone(defaults));
  if(!parsed.success)throw new HeraError('INVALID_CONFIG','Invalid or unknown Hera settings; preserve the file and correct its schema.',2);
  const config=parsed.data;const origins:Record<string,string>={base:stored?'user':'defaults'};const suggestions:unknown[]=[];
  if(cwd){const raw=await existsJson(join(cwd,'.hera.json'));if(raw!==undefined){const result=projectSchema.safeParse(raw);if(!result.success)throw new HeraError('UNSAFE_PROJECT_CONFIG','Unsupported project settings; provider and permission overrides are forbidden.',2);const p=result.data;if(p.maxConcurrent!==undefined)config.workers.maxConcurrent=Math.min(config.workers.maxConcurrent,p.maxConcurrent);if(p.language)config.language=p.language;if(p.ui?.color)config.ui.color=p.ui.color;if(p.ui?.reducedMotion!==undefined)config.ui.reducedMotion=p.ui.reducedMotion;if(p.mode||p.modelProfile||p.testCommands)suggestions.push(p);origins.project='restricted suggestions; model/mode not applied';}}
  return {config,origins,suggestions};
}
export async function saveConfig(home:string,config:Config) {await atomicJson(join(home,'config.json'),configSchema.parse(config));}
