import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {validateProposalPath} from './phase-policy.js';
import {HeraError,safeText} from '../errors.js';
import type {RpcEvent} from '../codex/transport.js';

export const proposalSchema=z.strictObject({
  summary:z.string().min(1).max(4000),
  changes:z.array(z.strictObject({path:z.string().min(1),content:z.string().max(256*1024)})).max(30),
  tests:z.array(z.strictObject({command:z.string().min(1).max(4000)})).max(10),
  risks:z.array(z.string().max(4000)).max(20)
});
export type Proposal=z.infer<typeof proposalSchema>;
export const editProposalSchema=proposalSchema.extend({changes:z.array(z.strictObject({path:z.string().min(1),edits:z.array(z.strictObject({oldText:z.string().max(256*1024),newText:z.string().max(256*1024)})).min(1).max(50)})).max(30)});
export type ApplyReview={id:string;proposal:Proposal;baseline:string;text:string;edits?:z.infer<typeof editProposalSchema>};
async function readText(path:string){
  let before:Buffer;try{before=await readFile(path);}catch(e){if(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT')return null;throw e;}
  if(before.length>256*1024||before.includes(0)||!Buffer.from(before.toString('utf8')).equals(before))throw new HeraError('UNSUPPORTED_PATCH','Only bounded UTF-8 text replacements are supported.',4);
  return before.toString('utf8');
}
export async function reviewEdits(cwd:string,value:unknown,baseline:string):Promise<ApplyReview>{
  const edits=editProposalSchema.parse(value);const changes:Proposal['changes']=[];
  for(const change of edits.changes){
    let content=await readText(await validateProposalPath(cwd,change.path))??'';
    for(const edit of change.edits){
      const index=content.indexOf(edit.oldText);
      if(edit.oldText===edit.newText||edit.oldText===''&&content!==''||index<0||edit.oldText!==''&&content.indexOf(edit.oldText,index+1)!==-1)throw new HeraError('AMBIGUOUS_EDIT','Each oldText must match exactly once; empty oldText is only for a new or empty file. No fuzzy matching.',4);
      content=content.slice(0,index)+edit.newText+content.slice(index+edit.oldText.length);
      if(Buffer.byteLength(content)>256*1024)throw new HeraError('UNSUPPORTED_PATCH','Edited file exceeds 256 KiB.',4);
    }
    changes.push({path:change.path,content});
  }
  const review=await reviewProposal(cwd,{...edits,changes},baseline);
  return {...review,edits,id:createHash('sha256').update(review.id).update(JSON.stringify(edits)).digest('hex')};
}
export function matchesTestCommand(observed:string,approved:string){
  if(observed===approved)return true;
  // Decode only the pinned runtime's simple display wrapper, never shell syntax.
  const shell=/^(?:"[^"\r\n]*(?:pwsh|powershell)\.exe"|(?:\/[\w.-]+)*\/(?:bash|zsh|sh)) (?:-NoProfile -Command|-c) '([^']*)'$/i.exec(observed);
  return shell?.[1]===approved;
}
export function testResults(tests:Proposal['tests'],items:unknown[]){
  const commands=items.filter(i=>i&&typeof i==='object'&&'type'in i&&i.type==='commandExecution').map(i=>z.object({command:z.string(),exitCode:z.number().int().nullable()}).parse(i));
  const results:{command:string;exitCode:number|null}[]=[];
  for(const [index,observed] of commands.entries()){
    const approved=tests[index];
    if(!approved||!matchesTestCommand(observed.command,approved.command)||results.some(r=>r.exitCode!==0))throw new HeraError('TEST_SEQUENCE_MISMATCH','Native commands differ from the approved order or continued after a failed/unknown result.',5,false);
    results.push({command:approved.command,exitCode:observed.exitCode});
  }
  if(results.every(r=>r.exitCode===0)&&results.length<tests.length)results.push({command:tests[results.length]!.command,exitCode:null});
  return results;
}
export function observeTestSequence(tests:Proposal['tests'],threadId:string){
  let next=0,pending:string|null=null,stopped=false;
  return (event:RpcEvent)=>{
    if(event.method!=='item/started'&&event.method!=='item/completed')return;
    const p=z.object({threadId:z.string(),item:z.object({id:z.string(),type:z.string(),command:z.string().optional(),exitCode:z.number().int().nullable().optional()})}).parse(event.params);
    if(p.item.type!=='commandExecution'&&p.item.type!=='fileChange')return;
    const invalid=()=>new HeraError('TEST_SEQUENCE_MISMATCH','Test execution departed from the approved sequential commands; outcome is unconfirmed.',5,false);
    if(p.threadId!==threadId||p.item.type==='fileChange')throw invalid();
    if(event.method==='item/started'){
      if(stopped||pending!==null||!tests[next]||!p.item.command||!matchesTestCommand(p.item.command,tests[next]!.command))throw invalid();
      pending=p.item.id;
    }else{
      if(pending!==p.item.id)throw invalid();
      pending=null;next++;stopped=p.item.exitCode!==0;
    }
  };
}
export async function reviewProposal(cwd:string,value:unknown,baseline:string):Promise<ApplyReview>{
  const proposal=proposalSchema.parse(value);const paths=new Set<string>();const sections=[proposal.summary];
  if(!proposal.changes.length||!proposal.tests.length)throw new HeraError('NO_APPLICABLE_PLAN',`No complete change/test proposal: ${safeText(proposal.summary)}`,4);
  for(const change of proposal.changes){
    const path=await validateProposalPath(cwd,change.path);const key=path.toLowerCase();
    if(paths.has(key))throw new HeraError('DUPLICATE_PATCH_PATH','Duplicate or case-aliased proposal path.',4);paths.add(key);
    const before=await readText(path);
    if(change.content.includes('\0')||Buffer.byteLength(change.content)>256*1024)throw new HeraError('UNSUPPORTED_PATCH','Only bounded UTF-8 text replacements are supported.',4);
    sections.push(`FILE: ${change.path}\nBEFORE:\n${before??'(new file)'}\nAFTER:\n${change.content}`);
  }
  sections.push('TEST COMMANDS (workspace-write):\n'+proposal.tests.map(t=>t.command).join('\n'),'RISKS:\n'+(proposal.risks.join('\n')||'(none reported by model)'));
  const text=sections.join('\n\n');if(Buffer.byteLength(text)>1024*1024)throw new HeraError('REVIEW_TOO_LARGE','Review exceeds 1 MiB; split the task.',4);
  if(safeText(text.replaceAll('\r\n','\n'))!==text.replaceAll('\r\n','\n'))throw new HeraError('UNSAFE_REVIEW_TEXT','Review contains hidden controls or possible secrets; narrow the proposal.',4);
  const id=createHash('sha256').update(baseline).update(JSON.stringify(proposal)).digest('hex');
  return {id,proposal,baseline,text};
}
