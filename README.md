# Hera

Independent local TypeScript / React / Ink client for the Codex App Server.
Repository: `heraAgent`. Package: `hera-agent`. Command: `hera`.

Development prerelease. Native protocol initialization, catalog discovery, official
isolated login, read-only sessions, resume, Korean/English Ink UI and offline checks
are implemented. **Live GPT collaboration, apply and Go workers are not verified and
remain gated.** A catalog entry is not proof of model entitlement. No provider fallback.

See [status](docs/status.md), [compatibility](docs/compatibility.md) and the full
[specification](docs/implementation-spec.md). Windows x64 and macOS Apple Silicon
are product targets; automated CI and physical terminal/live checks are distinct.

Install/update/rollback: [Windows](docs/install-windows.md), [macOS](docs/install-macos.md).
Node 24.x is required; installation downloads pinned npm dependencies. Prepared private
tarballs and SHA256SUMS.txt are local/CI artifacts, not an npm or GitHub release.

```powershell
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
node bin/hera.mjs doctor --json
node bin/hera.mjs init --list-models
node bin/hera.mjs auth login openai
# Choose exact returned IDs; no model is silently selected.
node bin/hera.mjs init --model <id> --worker-model <id>
node bin/hera.mjs --single-agent
```

Enter inserts a line, Ctrl+S sends, Escape clears, Ctrl+C requests interruption.
Use `/help` for commands. `run --single-agent --prompt-file <file>` supports non-TTY
and multiline input. Paste never executes a slash action. `/apply` stays blocked
until native write/spawn negative tests pass. A Windows sandbox notConfigured result
requires official setup; unrestricted fallback is unavailable.

Credentials stay outside this repository in the isolated Hera home/OS keyring. Never
copy tokens into fixtures or logs. See [security](SECURITY.md). Go uses only an explicitly
supplied HERA_OPENCODE_GO_API_KEY and the OpenCode Go subscription route; `doctor external`
does no paid work, while `doctor external --live` explicitly permits one bounded probe.

An existing `hera` command was detected on the development PC. All development
checks use explicit local paths or isolated installation prefixes; do not overwrite
that command. No public license or registry/release publication is authorized.
