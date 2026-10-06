$ErrorActionPreference = 'Stop'
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ($request.target -cnotmatch '^hera-agent/opencode-go/[a-f0-9]{64}$' -or $request.action -cnotmatch '^(read|write|delete)$') { throw 'Invalid request' }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class HeraGoCredential {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct Credential {
    public uint Flags, Type; public string TargetName, Comment; public long LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist, AttributeCount;
    public IntPtr Attributes; public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool ReadNative(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool WriteNative(ref Credential credential, uint flags);
  [DllImport("advapi32.dll", EntryPoint="CredDeleteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool DeleteNative(string target, uint type, uint flags);
  [DllImport("advapi32.dll")] static extern void CredFree(IntPtr credential);
  public static string Read(string target) {
    IntPtr ptr;
    if (!ReadNative(target, 1, 0, out ptr)) {
      if (Marshal.GetLastWin32Error() == 1168) return null;
      throw new Exception("Credential read failed");
    }
    try {
      var c = (Credential)Marshal.PtrToStructure(ptr, typeof(Credential));
      if (c.CredentialBlobSize > 2048) throw new Exception("Invalid credential size");
      byte[] bytes = new byte[c.CredentialBlobSize];
      try { Marshal.Copy(c.CredentialBlob, bytes, 0, bytes.Length); return Encoding.UTF8.GetString(bytes); }
      finally { Array.Clear(bytes, 0, bytes.Length); }
    } finally { CredFree(ptr); }
  }
  public static void Write(string target, string value) {
    byte[] bytes = Encoding.UTF8.GetBytes(value);
    if (bytes.Length == 0 || bytes.Length > 2048) throw new Exception("Invalid credential size");
    IntPtr blob = Marshal.AllocCoTaskMem(bytes.Length);
    try {
      Marshal.Copy(bytes, 0, blob, bytes.Length);
      var c = new Credential { Type=1, TargetName=target, UserName="hera-opencode-go",
        CredentialBlob=blob, CredentialBlobSize=(uint)bytes.Length, Persist=2 };
      if (!WriteNative(ref c, 0)) throw new Exception("Credential write failed");
    } finally { Array.Clear(bytes, 0, bytes.Length); Marshal.Copy(bytes, 0, blob, bytes.Length); Marshal.FreeCoTaskMem(blob); }
  }
  public static void Delete(string target) {
    if (!DeleteNative(target, 1, 0) && Marshal.GetLastWin32Error() != 1168) throw new Exception("Credential delete failed");
  }
}
'@
  $value = $null
  switch ($request.action) {
    'read' { $value = [HeraGoCredential]::Read($request.target) }
    'write' { [HeraGoCredential]::Write($request.target, $request.value) }
    'delete' { [HeraGoCredential]::Delete($request.target) }
  }
  [Console]::Out.Write((@{ value=$value } | ConvertTo-Json -Compress))
} catch {
  [Console]::Error.WriteLine('Hera OS credential operation failed; no plaintext fallback.')
  exit 1
}
