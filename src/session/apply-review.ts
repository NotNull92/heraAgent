import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {validateProposalPath} from './phase-policy.js';
import {HeraError,safeText} from '../errors.js';

export const proposalSchema=z.strictObject({
  summary:z.string().min(1).max(4000),
  changes:z.array(z.strictObject({path:z.string().min(1),content:z.string().max(256*1024)})).max(30),
  tests:z.array(z.strictObject({command:z.string().min(1).max(4000)})).max(10),
  risks:z.array(z.string().max(4000)).max(20)
});
export type Proposal=z.infer<typeof proposalSchema>;
export type ApplyReview={id:string;proposal:Proposal;baseline:string;text:string};
export function matchesTestCommand(observed:string,approved:string){
  if(observed===approved)return true;
  // Decode only the pinned runtime's simple display wrapper, never shell syntax.
  const shell=/^(?:"[^"\r\n]*(?:pwsh|powershell)\.exe"|(?:\/[\w.-]+)*\/(?:bash|zsh|sh)) (?:-NoProfile -Command|-c) '([^']*)'$/i.exec(observed);
  return shell?.[1]===approved;
}
export async function reviewProposal(cwd:string,value:unknown,baseline:string):Promise<ApplyReview>{
  const proposal=proposalSchema.parse(value);const paths=new Set<string>();const sections=[proposal.summary];
  if(!proposal.changes.length||!proposal.tests.length)throw new HeraError('NO_APPLICABLE_PLAN',`No complete change/test proposal: ${safeText(proposal.summary)}`,4);
  for(const change of proposal.changes){
    const path=await validateProposalPath(cwd,change.path);const key=path.toLowerCase();
    if(paths.has(key))throw new HeraError('DUPLICATE_PATCH_PATH','Duplicate or case-aliased proposal path.',4);paths.add(key);
    let before:Buffer|null=null;try{before=await readFile(path);}catch(e){if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e;}
    if(change.content.includes('\0')||before&&(before.length>256*1024||before.includes(0)||!Buffer.from(before.toString('utf8')).equals(before)))throw new HeraError('UNSUPPORTED_PATCH','Only bounded UTF-8 text replacements are supported.',4);
    sections.push(`FILE: ${change.path}\nBEFORE:\n${before?.toString('utf8')??'(new file)'}\nAFTER:\n${change.content}`);
  }
  sections.push('TEST COMMANDS (workspace-write):\n'+proposal.tests.map(t=>t.command).join('\n'),'RISKS:\n'+(proposal.risks.join('\n')||'(none reported by model)'));
  const text=sections.join('\n\n');if(Buffer.byteLength(text)>1024*1024)throw new HeraError('REVIEW_TOO_LARGE','Review exceeds 1 MiB; split the task.',4);
  if(safeText(text.replaceAll('\r\n','\n'))!==text.replaceAll('\r\n','\n'))throw new HeraError('UNSAFE_REVIEW_TEXT','Review contains hidden controls or possible secrets; narrow the proposal.',4);
  const id=createHash('sha256').update(baseline).update(JSON.stringify(proposal)).digest('hex');
  return {id,proposal,baseline,text};
}
