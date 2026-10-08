param([Parameter(Mandatory=$true)][string]$Message)
$ErrorActionPreference = 'Stop'
function Git-Checked { param([string[]]$GitArgs) $result = @(& git @GitArgs); if ($LASTEXITCODE -ne 0) { throw "Git failed: $($GitArgs[0])" }; return $result }
$root = [IO.Path]::GetFullPath((Get-Location).ProviderPath).TrimEnd([char[]]'\/')
$actual = [IO.Path]::GetFullPath([string](Git-Checked @('rev-parse','--show-toplevel'))).TrimEnd([char[]]'\/')
if ($root -ine $actual -or [IO.Path]::GetFileName($root) -cne 'heraAgent') { throw 'Wrong repository root' }
if ([string](Git-Checked @('branch','--show-current')) -cne 'main') { throw 'Expected main' }
$owner = & gh api --hostname github.com user --jq .login
if ($LASTEXITCODE -ne 0 -or $owner -cne 'NotNull92') { throw 'Authenticated owner changed' }
$repo = & gh repo view NotNull92/heraAgent --json name,nameWithOwner,isPrivate,url,defaultBranchRef
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect destination' }
$view = $repo | ConvertFrom-Json
if ($view.name -cne 'heraAgent' -or $view.nameWithOwner -cne 'NotNull92/heraAgent' -or $view.isPrivate -or $view.defaultBranchRef.name -cne 'main') { throw 'Repository identity conflict (expected authorized public repository)' }
foreach ($argsForUrl in @(@('remote','get-url','--all','origin'),@('remote','get-url','--push','--all','origin'))) {
  $urls = @(Git-Checked $argsForUrl)
  if ($urls.Count -ne 1 -or $urls[0] -cne 'https://github.com/NotNull92/heraAgent.git') { throw 'Unexpected origin destination' }
}
Git-Checked @('diff','--cached','--check') | Out-Host
Git-Checked @('diff','--cached','--stat') | Select-Object -Last 5 | Out-Host
node scripts/check-source.mjs
if ($LASTEXITCODE -ne 0) { throw 'Source/history scan failed' }
Git-Checked @('fetch','origin') | Out-Host
Git-Checked @('merge-base','--is-ancestor','origin/main','HEAD') | Out-Host
Git-Checked @('commit','-q','-m',$Message) | Out-Host
Git-Checked @('push','origin','main') | Out-Host
$localSha = [string](Git-Checked @('rev-parse','HEAD'))
$remoteRef = [string](Git-Checked @('ls-remote','--exit-code','origin','refs/heads/main'))
if (($remoteRef -split '\s+')[0] -cne $localSha) { throw 'Remote SHA mismatch' }
if ([string](Git-Checked @('rev-parse','--abbrev-ref','--symbolic-full-name','@{upstream}')) -cne 'origin/main') { throw 'Wrong upstream' }
Write-Output "VERIFIED $localSha $($view.url) public"
