# Hera

Independent local TypeScript / React / Ink client for the Codex App Server.
Repository: `heraAgent`. Package: `hera-agent`. Command: `hera`.

Development prerelease. Native protocol initialization, catalog discovery, official
isolated login, native workspace sessions, resume, Korean/English Ink UI and offline
checks are implemented. Ask for a change and Hera edits and tests in the same task;
there is no `/apply` step or whole-workspace baseline scan. Native extra permissions
are presented for allow-once/decline; headless requests are declined. `/plan` remains
read-only. Workers inherit native permissions and coordinate file ownership.
**Collaboration requires matching native-workflow verification; mixed/adaptive modes
also require the reviewed local runtime.** A catalog entry is not proof of model entitlement.
No provider fallback. macOS live/manual checks have not been performed.

Public web research uses local Playwright/Chromium through native MCP: no search
API key, paid search service or paid fallback. Run `hera research setup` once to
install Chromium, or choose setup in `/research`. Main and workers share a queue
and ten-minute memory cache. Search returns three links; page reads default to
3,000 characters. Native tasks retain this bounded search/fetch service.
Public queries go to DuckDuckGo and requested pages go to their sites; never send
secrets or private project content. CAPTCHA pauses requests: `/research open` opens
a separate browser for you to solve it, then `/research resume` caches the result.
Send the original research request again to continue. No personal browser profile
is imported or stored. Search availability is not guaranteed, and GPT/Go usage
still costs tokens. See [research, limits and actual tests](docs/web-research.md).

Design, architecture and research requests automatically use DRD: the native root
assigns 3-5 complementary research questions, gathers public sources and synthesizes
findings, disagreements and uncertainties. The configured worker ceiling still
applies; workers can be reused between assignments. Adaptive mode uses Go for
evidence gathering and Astra for difficult synthesis. Routine edits and greetings
do not start DRD, and explicit no-web/no-delegation requests are respected. In
single-agent mode the root covers the questions itself and says so. This is native
model guidance, not a deterministic classifier or a guarantee of research quality.
Use `/plan` for an enforced read-only turn; ordinary requests retain native workspace
permissions. Research does not add an `/apply` or extra confirmation step.

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

Composer keys follow Claude Code. Enter sends; backslash+Enter, Shift+Enter (where the
terminal reports it) or Ctrl+J inserts a line. Escape interrupts active work and,
pressed twice, clears the input. Ctrl+C interrupts active work; when idle it clears
the input and arms exit, and a second Ctrl+C exits after the existing session cleanup.
Up/Down recall sent input. Ctrl+Q exits directly through the same cleanup. Dialogs
retain their cancel behavior.
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

Normal requests use Codex's workspace sandbox and on-request approval policy.
Use `/diff` for actual Git changes and `/resume <ID>` to continue native history.
Failed or interrupted writes are never automatically replayed. The old `/apply`
command only explains that an ordinary edit request is sufficient.

Select `/mode adaptive` for DeepSeek routine execution and native Astra delegation
for deep reasoning, planning and design. `/model main` and `/effort main` configure
the reasoning role in that mode; Go uses its qualified fixed model/effort. No extra
classifier model or second agent loop runs. GPT-only and GPT-main/Go-worker modes
remain explicit choices. Saved schema-1 phase labels are legacy compatibility data;
the native workspace policy above controls normal product sessions.

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
composer Enter sends; bare settings commands open menus instead.
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
Mixed/adaptive children inherit native permissions and coordinate scoped ownership.
The native session handles edits, checks and approval requests without a phase restart.

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
