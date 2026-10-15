import {afterEach,it,expect,vi} from 'vitest';
const execute=vi.hoisted(()=>vi.fn());
vi.mock('node:child_process',()=>({execFile:Object.assign(vi.fn(),{[Symbol.for('nodejs.util.promisify.custom')]:execute})}));
import {readProcessIdentity} from '../src/session/process-identity.js';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();execute.mockReset();});
function output(platform:'win32'|'darwin',stdout:string,error:Error|null=null){
  vi.spyOn(process,'platform','get').mockReturnValue(platform);
  if(error)execute.mockRejectedValue(error);else execute.mockResolvedValue({stdout});
}
it('reads Windows UTF-8 identity through the system PowerShell without profiles',async()=>{
  output('win32',JSON.stringify({startedAt:'2026-10-14T00:00:00.1234567Z',executable:'C:\\한글 폴더\\node.exe'}));vi.stubEnv('SYSTEMROOT','C:\\Windows');
  expect(await readProcessIdentity(123)).toEqual({startedAt:'2026-10-14T00:00:00.1234567Z',executable:'C:\\한글 폴더\\node.exe'});
  expect(execute.mock.calls[0]?.[0]).toMatch(/Windows[/\\]System32[/\\]WindowsPowerShell[/\\]v1.0[/\\]powershell.exe$/);
  expect(execute.mock.calls[0]?.[1]).toEqual(['-NoProfile','-NonInteractive','-Command',expect.stringContaining('Get-Process -Id 123')]);
  expect(execute.mock.calls[0]?.[2]).toMatchObject({windowsHide:true,timeout:3000,maxBuffer:16384});
});
it('parses macOS start time independently of user locale and time zone',async()=>{
  output('darwin','Wed Oct  7 08:22:35 2026\n');
  expect(await readProcessIdentity(123)).toEqual({startedAt:'2026-10-07T08:22:35.000Z'});
  expect(execute.mock.calls[0]?.slice(0,2)).toEqual(['/bin/ps',['-p','123','-o','lstart=']]);
  expect(execute.mock.calls[0]?.[2]).toMatchObject({env:{LC_ALL:'C',TZ:'UTC0'}});
});
it.each(['win32','darwin'] as const)('keeps %s lookup errors and malformed output unknown',async platform=>{
  output(platform,'',new Error('access denied or timeout'));expect(await readProcessIdentity(123)).toBeNull();
  output(platform,'not a process identity');expect(await readProcessIdentity(123)).toBeNull();
  output(platform,JSON.stringify({startedAt:'bad date',executable:'node'}));expect(await readProcessIdentity(123)).toBeNull();
});
it.each([0,-1,1.5,NaN,Infinity])('does not execute a query for invalid PID %s',async pid=>{
  expect(await readProcessIdentity(pid)).toBeNull();expect(execute).not.toHaveBeenCalled();
});
