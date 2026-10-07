# Windows installation, update and rollback

Use native Node 24.x (tested patch 24.12.0) and npm. No WSL, Git Bash, elevated
terminal or global execution-policy change is required. If another installed tool
provides `hera`, inspect `Get-Command hera,hera.cmd -All` first.

Install the reviewed private tarball into a separate user-owned prefix:

```powershell
$prefix = Join-Path $env:LOCALAPPDATA 'HeraCLI'
npm.cmd install -g --prefix $prefix .\hera-agent-0.1.0-alpha.1.tgz
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
& (Join-Path $prefix 'hera.cmd') --version
if ($LASTEXITCODE -ne 0) { throw 'Launcher failed' }
& (Join-Path $prefix 'hera.cmd') init --list-models
```

Verify the tarball SHA-256 using `Get-FileHash -Algorithm SHA256` and SHA256SUMS.txt.
Installation downloads locked npm dependencies; this is not an offline executable.
Use the explicit prefix launcher to avoid collisions. Add that prefix to your own
PATH only after deciding which `hera` command should win.

Run `hera.cmd auth login openai` through that prefix launcher, then explicitly
select main and worker IDs with `init --model <catalog-id> --worker-model <catalog-id>`.
The catalog does not establish entitlement; only a successful authorized turn does.
No Astra/Luna model ID is guessed. `--device` selects the official device-code flow.
Authentication uses a separate OS keyring profile for the default `~/.hera/codex`;
the original Codex home and credentials are not copied. Never place HERA_HOME inside
a repository or send tokens to chat. Keyring failure is a blocker, not file fallback.

`doctor --json` checks native startup, account and Windows sandbox readiness.
If sandbox status is notConfigured, run `hera.cmd sandbox setup`. This calls the
pinned Codex's official unelevated setup in the isolated Hera profile, waits for
completion, and checks readiness in a fresh runtime. It does not request elevation.
`--mode elevated` is an explicit operator choice when administrator setup is desired.
A failure or timeout is not retried automatically; inspect `doctor --json` first.
Do not select unrestricted mode. `hera.cmd auth login go` stores the second required
provider credential in Windows Credential Manager. `/providers` offers both setup flows.
`hera.cmd --single-agent` explicitly chooses analysis without workers; `/apply` then
offers reviewed main-only changes and tests. Plain `hera.cmd` requires a matching local
GPT worker verification record; `doctor` reports readiness. A different runtime,
model/effort, worker limit or OS requires fresh verification. External Go workers are
still blocked; stored credentials and a direct Go response alone do not enable them.

TUI: Enter inserts a newline, Ctrl+S sends, Escape clears the composer, Ctrl+C requests
turn interruption, `/quit` exits. Pasted slash text is literal, not a command.
Use `run --single-agent --prompt-file <file>` for a reliable multiline/non-TTY path.
Physical Korean IME and herdr manual checks are still outstanding.

Close active Hera sessions before update. Reinstall the new checked tarball in the
same prefix. Roll back with the previous checked tarball in that prefix. Neither
operation deletes ~/.hera; a newer unsupported metadata version is rejected intact.
The initial prerelease has only same-version reinstall evidence, not a previous
release upgrade/downgrade test. Preserve the old tarball for future rollback.

An unknown execution outcome retains its workspace lock. Inspect native history,
owned processes and workspace changes before manually recovering a lock; never
blindly delete it, replay a turn, reset or clean the project.
