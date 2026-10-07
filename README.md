# Hera

Independent local TypeScript / React / Ink client for the Codex App Server.
Repository: `heraAgent`. Package: `hera-agent`. Command: `hera`.

Development prerelease. Native protocol initialization, catalog discovery, official
isolated login, read-only sessions, resume, Korean/English Ink UI and offline checks
are implemented. GPT workers use native thread history, task/result contracts and
recursive cancellation; `/apply` requires the entire tree to be idle before reviewed
main-only writes and tests. Windows integration fixtures passed. **GPT collaboration
requires matching local verification; Go workers remain blocked.** A catalog entry is not proof of model entitlement.
No provider fallback. macOS live/manual checks have not been performed.

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
node bin/hera.mjs auth login go
# Choose exact returned IDs; no model is silently selected.
node bin/hera.mjs init --model <id> --effort high --worker-model <id> --worker-effort max
# Windows only: official sandbox setup in the isolated Hera profile.
node bin/hera.mjs sandbox setup
node bin/hera.mjs --single-agent
```

Enter inserts a line, Ctrl+S sends and Escape clears. In the composer, Ctrl+C
interrupts active work or exits when idle, after the existing session cleanup.
Ctrl+Q exits directly through the same cleanup. Dialogs retain their cancel behavior.
Use `/help` for commands. `run --single-agent --prompt-file <file>` supports non-TTY
and multiline input. Paste never executes a slash action. A Windows sandbox notConfigured result
requires official setup; unrestricted fallback is unavailable.

On entry, Hera checks both OpenAI login and a stored OpenCode Go key. Missing setup
opens the provider menu before agent work. Use `/providers` or `\providers` at any
time to sign in again or replace the Go key. Only OpenAI and OpenCode Go are supported.
Go key input is masked, is not added to the conversation, and is saved in Windows
Credential Manager or macOS Keychain. New terminals load it automatically for the
same user and HERA_HOME. Saving a key does not verify provider access or enable the
still-gated external worker mode. No inference is performed during setup/status.

After read-only analysis, `/apply` prepares a proposal without writing. Page through
the complete before/after text, test commands and risks with Down/Enter; Up goes back.
Only `a` on the final page approves workspace writes and the displayed tests. Escape
cancels. This grants workspace-level native permissions, not a per-file OS lock.
During application, all worker paths, external tools and network remain disabled. Hera rechecks the
baseline, resumes the same thread in a fresh runtime, compares applied contents and
checks for unlisted file changes before running the tests. Tests may create build
artifacts inside the approved workspace. Unsupported command-display formats produce
an unknown test result rather than a pass. Use `/resume <ID>` to continue read-only
after completion. Failed or interrupted writes are never automatically replayed.
The initial review supports bounded UTF-8 replacements/new files; binary changes,
deletions, symlink targets and credential/configuration paths require separate work.
Existing files use compact, uniquely matched edits; Hera reconstructs the full review
locally and checks the exact final contents. Approved tests run sequentially in one
model turn, with native command/exit evidence checked individually. See
[token-efficiency measurements and limits](docs/token-efficiency.md).

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

`hera doctor` reports the worker verification state for the selected configuration.
Acceptance is scoped to runtime/code, OS/architecture, models/efforts and worker limit.
Changing these invalidates the local record; it is never copied from Windows to macOS
or inferred from CI/mocks. A verified profile can use plain `hera`; other profiles can
explicitly use `--single-agent`. See [verification evidence](docs/status.md) for the
maintainer live fixtures and current gaps. Native histories remain the source of truth;
there is no Hera conversation database. Worker test claims never count as executed tests.

Mixed mode uses a separately installed, reviewed native App Server patch. GPT-only
continues using the official pinned package. Build instructions and the pinned source
are in [native runtime qualification](experiments/codex-provider-routing/README.md).
Install the resulting executable with `hera runtime install <binary> --sha256 <reviewed-hash>`.
This copies the binary and matching official helpers into the Hera user home; it never
changes global Codex, imports credentials or enables inference. Existing runtime slots
are preserved. Binary/helper integrity is checked before launch, and mismatched or
missing local acceptance blocks the mode without fallback. `/mode` selects a new
GPT-only or mixed session. `/model worker` and `/effort worker` in mixed mode show only
the qualified DeepSeek V4.1 Flash / low setting, preserving the saved GPT worker choice.
Mixed analysis uses read-only native Go children; reviewed application restarts only
the GPT root with all spawn paths disabled and without the Go key in its environment.

Credentials stay outside this repository in the isolated Hera home/OS keyring. Never
copy tokens into fixtures or logs. See [security](SECURITY.md). Go uses its OS-stored
key by default. An explicitly supplied HERA_OPENCODE_GO_API_KEY overrides it for that
process; `hera auth login go --from-env` imports that value into the OS store.
`hera auth status go` prints presence/source only; `hera auth logout go` removes only
the saved Hera Go entry (it does not remove an environment override). All Go requests
use the OpenCode Go subscription route; `doctor external`
does no paid work, while `doctor external --live` explicitly permits one bounded probe.

If another installed tool provides `hera`, use explicit local paths or an isolated
installation prefix until command routing is resolved. No public license or
registry/release publication is authorized.
