import {it,expect,vi} from 'vitest';
import {mkdtemp,writeFile,symlink,mkdir,readFile,readdir,stat,unlink,realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {acquireWorkspace} from '../src/session/workspace-lock.js';
import * as processIdentity from '../src/session/process-identity.js';
import {PhasePolicy,baseline,validateProposalPath} from '../src/session/phase-policy.js';
import {Controller} from '../src/session/controller.js';
import type {CodexClient} from '../src/codex/client.js';
import {defaults} from '../src/config.js';
import type {Metadata} from '../src/metadata.js';
async function withOtherProcess(run:(pid:number)=>Promise<void>){
  const child=spawn(process.execPath,['-e','process.stdin.resume()'],{windowsHide:true,stdio:['pipe','ignore','ignore']});
  await once(child,'spawn');
  try{await run(child.pid!);}finally{const exit=once(child,'exit');child.stdin.end();await exit;}
}
async function acquireAs(pid:number,home:string){
  const original=process.pid;
  try{Object.defineProperty(process,'pid',{value:pid});return await acquireWorkspace(home,home);}
  finally{Object.defineProperty(process,'pid',{value:original});}
}
it('allows two process presences in a canonical workspace and releases only the caller record',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,join(home,'.'));
  expect(first.others).toEqual([]);
  await withOtherProcess(async pid=>{
    const second=await acquireAs(pid,home);expect(second.directory).toBe(first.directory);expect(second.others).toEqual([process.pid]);
    expect(await readdir(first.directory)).toHaveLength(2);
    await first.release();expect(await readdir(second.directory)).toEqual([pid+'.json']);
    expect(JSON.parse(await readFile(join(second.directory,pid+'.json'),'utf8'))).toMatchObject({pid,workspace:await realpath(home)});
    await first.release();await second.release();await second.release();await expect(stat(first.directory)).rejects.toMatchObject({code:'ENOENT'});
  });
});
it('removes records for an exited child, including legacy owner.json, without reporting another session',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,home);
  const child=spawn(process.execPath,['-e',''],{windowsHide:true});const pid=child.pid!;expect((await once(child,'exit'))[0]).toBe(0);
  const id=randomUUID();const record={...JSON.parse(await readFile(join(first.directory,process.pid+'.json'),'utf8')),pid,heraSessionId:id};
  await writeFile(join(first.directory,pid+'.json'),JSON.stringify(record));await writeFile(join(first.directory,'owner.json'),JSON.stringify(record));
  await first.release();const next=await acquireWorkspace(home,home);expect(next.others).toEqual([]);
  expect(await readdir(next.directory)).toEqual([process.pid+'.json']);await expect(next.setSessionId(id)).resolves.toBeUndefined();await next.release();
});
it.each(process.platform==='win32'?['start time','executable']:['start time'])('ignores a reused live PID with a different %s and permits saved-session resume',async difference=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,home);const id=randomUUID();
  await withOtherProcess(async pid=>{
    const actual=await processIdentity.readProcessIdentity(pid);expect(actual).not.toBeNull();
    const record={...JSON.parse(await readFile(join(first.directory,process.pid+'.json'),'utf8')),pid,heraSessionId:id,
      processStartedAt:difference==='start time'?'2000-01-01T00:00:00.000Z':actual!.startedAt,
      executable:difference==='executable'?join(home,'old-node.exe'):process.execPath};
    await writeFile(join(first.directory,pid+'.json'),JSON.stringify(record));await first.release();
    const next=await acquireWorkspace(home,home);
    try{
      expect(next.others).toEqual([]);await expect(next.setSessionId(id)).resolves.toBeUndefined();
      await expect(stat(join(next.directory,pid+'.json'))).rejects.toMatchObject({code:'ENOENT'});
      expect(()=>process.kill(pid,0)).not.toThrow();
    }finally{await next.release();}
  });
  await first.release();
});
it('preserves a live record and blocks duplicate resume when identity cannot be read',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,home);const id=randomUUID();await first.setSessionId(id);
  const lookup=vi.spyOn(processIdentity,'readProcessIdentity').mockResolvedValue(null);
  try{await withOtherProcess(async pid=>{
    const second=await acquireAs(pid,home);
    try{expect(second.others).toEqual([process.pid]);await expect(second.setSessionId(id)).rejects.toMatchObject({errorCode:'SESSION_IN_USE'});}
    finally{await second.release();}
    expect(await readdir(first.directory)).toEqual([process.pid+'.json']);
  });}finally{lookup.mockRestore();await first.release();}
});
it('counts EPERM as live while ignoring malformed live records and legacy owners',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,home);
  const id=randomUUID();const record={...JSON.parse(await readFile(join(first.directory,process.pid+'.json'),'utf8')),heraSessionId:id};
  await writeFile(join(first.directory,'123.json'),JSON.stringify({...record,pid:123}));
  await writeFile(join(first.directory,'124.json'),JSON.stringify({pid:124}));
  await writeFile(join(first.directory,'owner.json'),JSON.stringify({...record,pid:125}));
  await first.release();
  const kill=vi.spyOn(process,'kill').mockImplementation(()=>{throw Object.assign(new Error('denied'),{code:'EPERM'});});
  try{const next=await acquireWorkspace(home,home);expect(next.others).toEqual([123]);expect(kill).toHaveBeenCalledWith(123,0);await expect(next.setSessionId(id)).rejects.toMatchObject({errorCode:'SESSION_IN_USE'});await next.release();expect(await readdir(first.directory)).toHaveLength(3);}
  finally{kill.mockRestore();}
});
it.each(['{','{}','null','{"pid":"123"}','{"pid":0}','{"pid":-1}'])('ignores and removes records with unreadable or missing PIDs: %s',async content=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,home);
  await writeFile(join(first.directory,'broken.json'),content);await writeFile(join(first.directory,'owner.json'),content);await first.release();
  const next=await acquireWorkspace(home,home);expect(next.others).toEqual([]);expect(await readdir(next.directory)).toEqual([process.pid+'.json']);
  await unlink(join(next.directory,process.pid+'.json'));await next.release();await next.release();
});
it('rejects a live saved-session resume before native startup and preserves the existing presence',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,home);const id=randomUUID();await first.setSessionId(id);
  await withOtherProcess(async pid=>{
    const second=await acquireAs(pid,home);const client={on:vi.fn(),resume:vi.fn(),close:vi.fn().mockResolvedValue(true)} as unknown as CodexClient;
    const controller=new Controller(client,home,home,structuredClone(defaults),false,true);Reflect.set(controller,'lock',second);
    await expect(Reflect.apply(Reflect.get(controller,'start'),controller,[{heraSessionId:id}])).rejects.toMatchObject({errorCode:'SESSION_IN_USE',exitCode:6,message:expect.stringContaining(String(process.pid))});
    expect(client.resume).not.toHaveBeenCalled();await controller.close();
    expect(await readdir(first.directory)).toEqual([process.pid+'.json']);
  });
  await first.release();const next=await acquireWorkspace(home,home);await expect(next.setSessionId(id)).resolves.toBeUndefined();await next.release();
});
it('never admits both simultaneous claims of the same saved session',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const first=await acquireWorkspace(home,home);
  await withOtherProcess(async pid=>{
    const second=await acquireAs(pid,home);const id=randomUUID();
    const results=await Promise.allSettled([first.setSessionId(id),second.setSessionId(id)]);
    expect(results.filter(result=>result.status==='fulfilled').length).toBeLessThanOrEqual(1);
    for(const result of results)if(result.status==='rejected')expect(result.reason).toMatchObject({errorCode:'SESSION_IN_USE'});
    await first.release();await second.release();
  });
});
it.each(['graceful','forced','failed'] as const)('releases presence on %s shutdown while preserving unknown-outcome metadata',async result=>{
  const home=await mkdtemp(join(tmpdir(),'hera-presence-'));const presence=await acquireWorkspace(home,home);
  const close=result==='failed'?vi.fn().mockRejectedValue(new Error('close failed')):vi.fn().mockResolvedValue(result==='graceful');
  const client={on:vi.fn(),close} as unknown as CodexClient;const controller=new Controller(client,home,home,structuredClone(defaults),false,true);Reflect.set(controller,'lock',presence);
  controller.metadata={schemaVersion:1,heraSessionId:randomUUID(),codexThreadId:'fixture',codexVersion:'0.161.0',mode:'adaptive',workspaceRealPath:home,phase:'NATIVE',lastKnownTurnId:null,status:'unknown_outcome',configFingerprint:'fixture',capabilityFingerprint:'fixture',updatedAt:new Date().toISOString()} satisfies Metadata;
  if(result==='failed')await expect(controller.close()).rejects.toThrow('close failed');else await expect(controller.close()).resolves.toBe(false);
  expect(controller.metadata.status).toBe('unknown_outcome');await expect(stat(presence.directory)).rejects.toMatchObject({code:'ENOENT'});
  if(result!=='failed')expect(JSON.parse(await readFile(join(home,'metadata','sessions',controller.metadata.heraSessionId+'.json'),'utf8')).status).toBe('unknown_outcome');
});
it('rejects pending workers, changed baseline and missing native safety evidence',()=>{for(const state of [{workers:1},{approvals:1},{commands:1},{turnActive:true},{baselineMatches:false}]){const policy=new PhasePolicy();policy.analyze();expect(()=>policy.quiesce({workers:0,commands:0,approvals:0,turnActive:false,baselineMatches:true,...state})).toThrow();}const policy=new PhasePolicy();policy.analyze();policy.quiesce({workers:0,commands:0,approvals:0,turnActive:false,baselineMatches:true});expect(()=>policy.apply(true,{readOnly:false,spawnDisabled:false,resumePolicy:false})).toThrow('verified');});
it('detects external edits and rejects traversal/junction patches',async()=>{const cwd=await mkdtemp(join(tmpdir(),'hera-baseline-'));await writeFile(join(cwd,'file.txt'),'a');const before=await baseline(cwd);await writeFile(join(cwd,'file.txt'),'b');expect(await baseline(cwd)).not.toBe(before);await expect(validateProposalPath(cwd,'../escape')).rejects.toThrow();const outside=await mkdtemp(join(tmpdir(),'hera-outside-'));await symlink(outside,join(cwd,'link'),process.platform==='win32'?'junction':'dir');await expect(validateProposalPath(cwd,'link/change')).rejects.toThrow('Symlink');});
it('detects unlisted file edits while allowing a reviewed new file in a new directory',async()=>{const cwd=await mkdtemp(join(tmpdir(),'hera-scope-'));const allowed=join(cwd,'new','file.txt');const excluded=new Set([allowed.toLowerCase()]);const before=await baseline(cwd,excluded);await mkdir(join(cwd,'new'));await writeFile(allowed,'approved');expect(await baseline(cwd,excluded)).toBe(before);await writeFile(join(cwd,'new','unexpected.txt'),'unapproved');expect(await baseline(cwd,excluded)).not.toBe(before);});
