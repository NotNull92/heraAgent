import React from 'react';
import {it,expect,vi} from 'vitest';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {render} from 'ink-testing-library';
import {reviewProposal,matchesTestCommand} from '../src/session/apply-review.js';
import {ApplyReview} from '../src/tui/ApplyReview.js';
import {validateProposalPath,baseline} from '../src/session/phase-policy.js';
import {Controller} from '../src/session/controller.js';
import {CodexClient} from '../src/codex/client.js';
import {defaults} from '../src/config.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,70));
it('invalidates approval after an external edit and refuses a wrong resume sandbox',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'hera-approval-work-'));const home=await mkdtemp(join(tmpdir(),'hera-approval-home-'));
  await writeFile(join(cwd,'sum.js'),'before');
  const makeClient=async()=>{const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));await client.initialize();return client;};
  const client=await makeClient();const controller=new Controller(client,home,cwd,structuredClone(defaults));
  controller.config.main.model='fixture-gpt';controller.model='fixture-gpt';
  controller.metadata={schemaVersion:1,heraSessionId:randomUUID(),codexThreadId:'fixture-thread',codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:cwd,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:'fixture',capabilityFingerprint:'fixture',updatedAt:new Date().toISOString()};
  const review=await reviewProposal(cwd,{summary:'fixture',changes:[{path:'sum.js',content:'after'}],tests:[{command:'node check.cjs'}],risks:[]},await baseline(cwd));
  const ready=()=>{controller.phase.analyze();controller.phase.quiesce({workers:0,commands:0,approvals:0,turnActive:false,baselineMatches:true});controller.review=review;};ready();
  const connect=vi.spyOn(CodexClient,'connect').mockImplementation(makeClient);
  try{
    await writeFile(join(cwd,'sum.js'),'external edit');await expect(controller.applyApproved(review.id)).rejects.toMatchObject({errorCode:'BASELINE_CHANGED'});expect(connect).not.toHaveBeenCalled();expect(controller.review).toBeNull();
    await writeFile(join(cwd,'sum.js'),'before');controller.phase.phase='IDLE';ready();await expect(controller.applyApproved(review.id)).rejects.toMatchObject({errorCode:'POLICY_NOT_ENFORCED'});expect(controller.phase.phase).toBe('NEEDS_FIX');expect(controller.metadata.status).toBe('unknown_outcome');
  }finally{connect.mockRestore();await controller.close();}
});
it('recognizes only an exact test or a simple native shell display wrapper',()=>{
  expect(matchesTestCommand('"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoProfile -Command \'node check.cjs\'','node check.cjs')).toBe(true);
  for(const command of ['echo node check.cjs','node check.cjs; exit 0','"C:\\evil.exe" -NoProfile -Command \'node check.cjs\''])expect(matchesTestCommand(command,'node check.cjs')).toBe(false);
});
it('rejects unsafe, hidden, binary and aliased proposals before approval',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'hera-review-'));await writeFile(join(cwd,'sum.js'),'old\n');
  const proposal={summary:'Fix sum',changes:[{path:'sum.js',content:'new\n'}],tests:[{command:'node check.cjs'}],risks:[]};
  const review=await reviewProposal(cwd,proposal,'baseline');expect(review.text).toContain('BEFORE:\nold\n');expect(review.text).toContain('AFTER:\nnew\n');
  for(const path of ['', '../outside', '.GiT/config','file:stream','file.','.env','dir//file','NUL','credentials.json'])await expect(validateProposalPath(cwd,path)).rejects.toThrow();
  await expect(reviewProposal(cwd,{...proposal,changes:[...proposal.changes,{path:'SUM.js',content:'alias'}]},'baseline')).rejects.toThrow('case-aliased');
  await expect(reviewProposal(cwd,{...proposal,summary:'hidden\x1b[2J'},'baseline')).rejects.toThrow('hidden');
  await writeFile(join(cwd,'sum.js'),Buffer.from([0,255]));await expect(reviewProposal(cwd,proposal,'baseline')).rejects.toThrow('UTF-8');
});
it('requires reviewing pages and an explicit approval key; paste and Enter never approve',async()=>{
  let approvals=0,cancels=0;
  const review={id:'fixture',baseline:'fixture',proposal:{summary:'fixture',changes:[],tests:[],risks:[]},text:Array.from({length:12},(_,i)=>`변경 ${i}`).join('\n')};
  const ui=render(<ApplyReview review={review} rows={10} columns={80} language="ko" approve={()=>approvals++} cancel={()=>cancels++}/>);await tick();
  ui.stdin.write('a');await tick();expect(approvals).toBe(0);
  ui.stdin.write('\r');await tick();ui.stdin.write('\r');await tick();expect(approvals).toBe(0);
  ui.stdin.write('\x1b[200~a\x1b[201~');await tick();expect(approvals).toBe(0);
  ui.stdin.write('a');await tick();expect(approvals).toBe(1);ui.stdin.write('\x1b');await tick();expect(cancels).toBe(1);ui.unmount();
});
