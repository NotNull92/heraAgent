import React from 'react';
import {it,expect,vi} from 'vitest';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {render} from 'ink-testing-library';
import {reviewProposal,reviewEdits,matchesTestCommand,testResults,observeTestSequence} from '../src/session/apply-review.js';
import {ApplyReview} from '../src/tui/ApplyReview.js';
import {validateProposalPath,baseline} from '../src/session/phase-policy.js';
import {Controller} from '../src/session/controller.js';
import {CodexClient} from '../src/codex/client.js';
import {defaults} from '../src/config.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,70));
it('reconstructs exact compact edits locally and binds approval to unambiguous edits',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'hera-edits-'));const before='한글\r\nconst answer = 1;\r\n';await writeFile(join(cwd,'a.js'),before);
  const proposal={summary:'Fix',changes:[{path:'a.js',edits:[{oldText:'answer = 1',newText:'answer = 2'}]}],tests:[{command:'node check.cjs'}],risks:[]};
  const review=await reviewEdits(cwd,proposal,'baseline');expect(review.proposal.changes[0]?.content).toBe(before.replace('= 1','= 2'));expect(review.text).toContain('BEFORE:\n'+before);expect(review.edits).toEqual(proposal);
  const changed=structuredClone(proposal);changed.changes[0]!.edits=[{oldText:'1',newText:'2'}];expect((await reviewEdits(cwd,changed,'baseline')).id).not.toBe(review.id);
  for(const oldText of ['', 'absent', '\r\n'])await expect(reviewEdits(cwd,{...proposal,changes:[{path:'a.js',edits:[{oldText,newText:'x'}]}]},'baseline')).rejects.toMatchObject({errorCode:'AMBIGUOUS_EDIT'});
  await expect(reviewEdits(cwd,{...proposal,changes:[{path:'a.js',edits:[{oldText:'answer = 1',newText:'answer = 1'}]}]},'baseline')).rejects.toMatchObject({errorCode:'AMBIGUOUS_EDIT'});
  const created=await reviewEdits(cwd,{...proposal,changes:[{path:'new.js',edits:[{oldText:'',newText:'new\n'},{oldText:'new',newText:'created'}]}]},'baseline');expect(created.proposal.changes[0]?.content).toBe('created\n');
  await expect(reviewEdits(cwd,{...proposal,changes:[{path:'../escape',edits:[{oldText:'',newText:'x'}]}]},'baseline')).rejects.toMatchObject({errorCode:'UNSAFE_PATCH_PATH'});
  await writeFile(join(cwd,'a.js'),'external');await expect(reviewEdits(cwd,proposal,'baseline')).rejects.toMatchObject({errorCode:'AMBIGUOUS_EDIT'});
});
it('requires ordered native exit evidence for every batched test and rejects extras or continuation after failure',()=>{
  const tests=[{command:'node a.cjs'},{command:'node b.cjs'}];const item=(command:string,exitCode:number|null)=>({type:'commandExecution',command,exitCode});
  expect(testResults(tests,[item(tests[0]!.command,0),item(tests[1]!.command,0)])).toEqual(tests.map(t=>({...t,exitCode:0})));
  expect(testResults(tests,[])).toEqual([{command:'node a.cjs',exitCode:null}]);
  expect(testResults(tests,[item('node a.cjs',0)])).toEqual([{command:'node a.cjs',exitCode:0},{command:'node b.cjs',exitCode:null}]);
  expect(testResults(tests,[item('node a.cjs',7)])).toEqual([{command:'node a.cjs',exitCode:7}]);
  for(const items of [[item('node b.cjs',0)],[item('node a.cjs; node b.cjs',0)],[item('node a.cjs',1),item('node b.cjs',0)],[item('node a.cjs',null),item('node b.cjs',0)],[item('node a.cjs',0),item('node b.cjs',0),item('echo extra',0)]])expect(()=>testResults(tests,items)).toThrow('approved order');
});
it('detects concurrent tests, foreign commands, file edits and continuing after failure from native events',()=>{
  const tests=[{command:'node a.cjs'},{command:'node b.cjs'}];
  const event=(method:string,id:string,command:string,exitCode:number|null=null)=>({method,params:{threadId:'root',item:{type:'commandExecution',id,command,exitCode}}});
  for(const failed of [false,true]){
    const observe=observeTestSequence(tests,'root');observe(event('item/started','a','node a.cjs'));expect(()=>observe(event('item/started','b','node b.cjs'))).toThrow('sequential');
    observe(event('item/completed','a','node a.cjs',failed?1:0));
    if(failed)expect(()=>observe(event('item/started','b','node b.cjs'))).toThrow('sequential');
    else{observe(event('item/started','b','node b.cjs'));observe(event('item/completed','b','node b.cjs',0));}
  }
  const foreign=event('item/started','a','node a.cjs');foreign.params.threadId='child';expect(()=>observeTestSequence(tests,'root')(foreign)).toThrow('sequential');
  const write=event('item/started','a','node a.cjs');write.params.item.type='fileChange';expect(()=>observeTestSequence(tests,'root')(write)).toThrow('sequential');
});
it('invalidates approval after an external edit and refuses a wrong resume sandbox',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'hera-approval-work-'));const home=await mkdtemp(join(tmpdir(),'hera-approval-home-'));
  await writeFile(join(cwd,'sum.js'),'before');
  const makeClient=async()=>{const client=new CodexClient(spawn(process.execPath,[resolve('tests/fake-app-server.mjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true}));await client.initialize();return client;};
  const client=await makeClient();const controller=new Controller(client,home,cwd,structuredClone(defaults));
  controller.config.main.model='fixture-gpt';controller.model='fixture-gpt';
  controller.metadata={schemaVersion:1,heraSessionId:randomUUID(),codexThreadId:'fixture-thread',codexVersion:'0.160.1',mode:'gpt_only',workspaceRealPath:cwd,phase:'ANALYZE_READ_ONLY',lastKnownTurnId:null,status:'idle',configFingerprint:'fixture',capabilityFingerprint:'fixture',updatedAt:new Date().toISOString()};
  const review=await reviewEdits(cwd,{summary:'fixture',changes:[{path:'sum.js',edits:[{oldText:'before',newText:'after'}]}],tests:[{command:'node check.cjs'}],risks:[]},await baseline(cwd));
  const ready=()=>{controller.phase.analyze();controller.phase.quiesce({workers:0,commands:0,approvals:0,turnActive:false,baselineMatches:true});controller.review=review;};ready();
  const connect=vi.spyOn(CodexClient,'connect').mockImplementation(makeClient);
  try{
    review.proposal.changes[0]!.content='tampered';await expect(controller.applyApproved(review.id)).rejects.toMatchObject({errorCode:'STALE_APPROVAL'});expect(connect).not.toHaveBeenCalled();review.proposal.changes[0]!.content='after';
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
