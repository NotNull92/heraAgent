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
node bin/hera.mjs init --model <id> --effort high --worker-model <id> --worker-effort max
# Windows only: official sandbox setup in the isolated Hera profile.
node bin/hera.mjs sandbox setup
node bin/hera.mjs --single-agent
```

Enter inserts a line, Ctrl+S sends, Escape clears, Ctrl+C requests interruption.
Use `/help` for commands. `run --single-agent --prompt-file <file>` supports non-TTY
and multiline input. Paste never executes a slash action. `/apply` stays blocked
until native write/spawn negative tests pass. A Windows sandbox notConfigured result
requires official setup; unrestricted fallback is unavailable.

Inside the TUI, type `/model`, `/effort` or `/workers` and press Enter to open a
selection menu. Use Up/Down and Enter to choose, or Escape to cancel without saving.
`/model` asks for main/worker, then model, then that model's supported effort.
`/effort` asks for main/worker and lists the current model's supported efforts only.
Options come from the native model catalog: `ultra` appears only when advertised.
Current selections are marked; final choices are revalidated before saving.

`/` and `\` prefixes are equivalent. Explicit command arguments also remain supported:

```text
\model main <catalog-id> high
\model worker <catalog-id> max
\effort main high
\effort worker max
\workers 3
```

`/workers` selects the configured limit (1-8, capped by the project), not an observed
running count. Use `default` for
effort to clear its override. Changes are validated against the selected model's
catalog, saved outside the repository, and take effect in a new session. Active
turns reject setting changes; an uncertain shutdown prevents switching sessions.
Pasted commands remain literal text, including pasted Enter keys in menus. Normal
composer Enter still inserts a newline; bare settings commands open menus instead.
These settings do not enable gated workers.

Credentials stay outside this repository in the isolated Hera home/OS keyring. Never
copy tokens into fixtures or logs. See [security](SECURITY.md). Go uses only an explicitly
supplied HERA_OPENCODE_GO_API_KEY and the OpenCode Go subscription route; `doctor external`
does no paid work, while `doctor external --live` explicitly permits one bounded probe.

If another installed tool provides `hera`, use explicit local paths or an isolated
installation prefix until command routing is resolved. No public license or
registry/release publication is authorized.
