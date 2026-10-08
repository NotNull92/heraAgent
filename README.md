<p align="center">
  <img src="assets/branding/hera-hero.png" alt="Hera, an original anime coding partner in an office suit, presenting a terminal against a city skyline" width="960">
</p>

<h1 align="center">Hera</h1>
<p align="center"><strong>Your coding partner, right in your terminal.</strong></p>
<p align="center"><strong>English</strong> · <a href="README.ko.md">한국어</a> · <a href="README.jp.md">日本語</a></p>
<p align="center"><a href="https://github.com/NotNull92/heraAgent/actions/workflows/ci.yml"><img src="https://github.com/NotNull92/heraAgent/actions/workflows/ci.yml/badge.svg" alt="Windows and macOS CI"></a></p>

Hera is a local CLI/TUI coding agent for **Windows and macOS**. Describe a change,
and Hera reads your project, edits files, runs checks and reports the result in the
same conversation. It uses the **Codex App Server** for native tools, sessions and
collaboration, with explicit GPT and OpenCode Go modes.

**Development preview · 0.1.0-alpha.1 · pinned Codex API runtime 0.161.0.**
Source is public; no npm package or GitHub release has been published.
Start from source below. Hera runs locally; model inference uses your provider
accounts. It is not an offline model runner.

## What Hera does

- **Edits and checks in one task:** no separate `/apply` step.
- **Read-only planning:** `/plan` plans before editing; `/diff` shows actual Git changes.
- **Explicit model routing:** HERA Design for design/research; HERA Development for coding.
- **Public web research:** local Playwright/Chromium search and page reads without a paid search API.
- **Native session continuity:** resume conversations without a second Hera conversation database.
- **Terminal interaction:** slash-command suggestions, model/effort menus, Korean input and Korean/English presentation.

## Quick start

You need **Git**, **Node.js 24.x with npm**, a terminal, OpenAI access through the
official login flow, and an OpenCode Go key. **Both modes require both providers.** Use your own accounts; credentials are not included.
Model availability depends on your account.

Windows x64 and macOS Apple Silicon are the CI targets. Intel macOS is unverified.
The interface supports Korean and English; the Japanese README is a translation,
not a Japanese UI option.

### 1. Clone and build

**Windows — native PowerShell:**

```powershell
git clone https://github.com/NotNull92/heraAgent.git
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location heraAgent
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
node bin/hera.mjs --version
```

**macOS — Terminal:**

```sh
git clone https://github.com/NotNull92/heraAgent.git
cd heraAgent
npm ci
npm run build
node bin/hera.mjs --version
```

Explicit launch paths avoid collisions with other tools named `hera`.
Hera's project-local runtime does not replace your global Codex installation.

### 2. Sign in and choose a model

Run from the cloned directory on either platform:

```text
node bin/hera.mjs auth login openai
node bin/hera.mjs auth login go
node bin/hera.mjs init --list-models
node bin/hera.mjs init --model "YOUR_MODEL_ID" --language en
```

Replace `YOUR_MODEL_ID` with an exact returned catalog ID. Efforts must be
supported by the selected model. Catalog listing does not prove entitlement.
OpenAI login supports `--device`; Go key entry is masked and saved in the OS keyring.

**Windows only:** configure the official sandbox in Hera's isolated profile:

```text
node bin/hera.mjs sandbox setup
```

### 3. Check and start

```text
node bin/hera.mjs doctor --json
node bin/hera.mjs --cwd "PATH_TO_YOUR_PROJECT" --single-agent
```

Replace the project path with an existing directory. The default HERA Design
mode can run with workers explicitly disabled by `--single-agent`. Missing provider setup
opens the setup menu. Edits use the native workspace sandbox; additional permissions
are presented for allow-once or decline. Unrestricted fallback is unavailable.

For multiline/non-interactive input:

```text
node bin/hera.mjs --cwd "PATH_TO_YOUR_PROJECT" run --single-agent --prompt-file "request.txt"
```

Use an absolute prompt-file path when it is outside the launcher directory.
Headless execution declines interactive permission requests.

## Choose a mode

| Mode | Main work | Delegated work |
| --- | --- | --- |
| HERA Development (`external_workers`) | Your selected GPT model | OpenCode Go · DeepSeek V4.1 Flash |
| HERA Design (`adaptive`, default) | OpenCode Go · DeepSeek V4.1 Flash | Selected GPT/Astra role for difficult reasoning, planning and design |

Use `/mode` to choose. **Workers need local verification** matching runtime, relevant
code, platform, models, providers, permissions and concurrency. Changing these invalidates the record.
Both modes require a reviewed native runtime installed in
your Hera home. A key alone does not enable them. There is no automatic provider fallback.

In adaptive mode, `/model main` and `/effort main` configure the GPT reasoning role.
Fresh conversations carry compact instructions. Only HERA Development loads the
full coding handbook on demand. HERA Design loads only research guidance; its
local handbook tool rejects the coding topic. This instruction split does not
change native sandbox permissions. Guides are read locally, without web access.
Loaded guidance and existing native history remain in context. Start a new
session for the new scope; old history is preserved rather than scrubbed.

GPT Balance is retired. Existing `gpt_only` settings remain readable but cannot
start tasks. Select `/mode` or use `hera init --mode adaptive` (Design) /
`hera init --mode external_workers` (Development); routes never migrate silently.

The development checkout exposes Go efforts `low`, `high` and `max` through
`/effort worker`; valid effort changes preserve native v2 qualification. GPT options come
from the model catalog. `/workers` sets a ceiling of 1–8, capped by the project,
not a measured running count. Settings apply to a new native session on the next input;
Hera does not need restarting. Active turns reject changes. Old v1 records need fresh qualification.

See [native runtime installation and qualification](experiments/codex-provider-routing/README.md)
and [compatibility](docs/compatibility.md). Maintainer verification does not unlock
other machines. Never copy credentials or acceptance records to bypass a gate.

## Commands and keys

Type `/` for suggestions. Type to filter, Up/Down to choose, Tab to complete,
Enter to select and Escape to dismiss. **Only `/` starts a command.** A leading
backslash is ordinary text; pasted commands remain literal text.

| Command | Purpose |
| --- | --- |
| `/help` | Command help |
| `/model`, `/effort`, `/workers` | Model, reasoning effort and worker-limit menus |
| `/mode`, `/providers` | Agent mode and provider sign-in |
| `/research` | Research setup, status and CAPTCHA controls |
| `/plan <request>` | Read-only planning |
| `/diff`, `/resume <ID>` | Git changes and session continuation |
| `/doctor`, `/quit` | Readiness and exit |

Menus use Up/Down, Enter and Escape. Explicit arguments such as
`/model main <catalog-id> high` and `/workers 3` are also supported.

| Key | Action |
| --- | --- |
| Enter | Send input |
| Backslash + Enter / Ctrl+J | Insert a newline |
| Shift/Alt + Enter | Newline when reported by the terminal |
| Up / Down | Recall sent input; navigate an open menu |
| Escape | Interrupt work; press twice to clear input |
| Ctrl+C | Interrupt work; when idle, clear/arm exit, then press again to quit |
| Ctrl+Q | Quit after session cleanup |

## Public web research

Run `node bin/hera.mjs research setup` once to install Chromium, or use `/research`.
Search uses DuckDuckGo; page reads visit the requested public sites. No search API
key or paid search fallback is used. Model usage still consumes provider quota.
Requests share a bounded queue and ten-minute cache.

For CAPTCHA, use `/research open`, solve it yourself, then `/research resume` and
resend the original request. Your personal browser profile is not imported.
Never put secrets or private project content in public queries.

Design/research tasks use DRD guidance: complementary assignments, public evidence
and synthesis in the native task. Worker limits and explicit no-web/no-delegation
requests are respected; single-agent operation handles the work without workers.
This is model guidance, not a guarantee of research quality.
[Details and limits](docs/web-research.md).

## Updates and troubleshooting

Close Hera and preserve local changes before updating a source checkout:

```text
git pull --ff-only
npm ci
npm run build
```

Use `npm.cmd` on Windows. **There is no `hera update` command.** `codex update`
changes the separate global CLI, not Hera's pinned runtime. Mixed runtimes and
verification must match the new version. For checked `.tgz` installs and rollback,
see [Windows](docs/install-windows.md) / [macOS](docs/install-macos.md).
CI artifacts are not published releases.

| Situation | What to do |
| --- | --- |
| Missing login/key | Use `/providers` or `auth login openai` / `auth login go` |
| Blocked workers | Inspect `doctor`; use HERA Design `--single-agent` when appropriate |
| Windows sandbox not ready | Run `sandbox setup`, then `doctor --json` |
| Existing `hera` command | Use the explicit local launcher or a separate install prefix |
| Interrupted/uncertain write | Inspect Git changes and native history; do not blindly replay or delete locks |

Settings and native sessions use the isolated Hera home (default `~/.hera`).
Keep `HERA_HOME` outside your project. OpenAI uses its isolated native login;
Go uses Windows Credential Manager or macOS Keychain.
`HERA_OPENCODE_GO_API_KEY` overrides the saved Go key for that process.
`auth status go` reports presence/source; `auth logout go` removes the saved entry,
not an environment override. See [security](SECURITY.md).

## Verification and development

[Public CI evidence](docs/public-transition-2026-10-08.md) records Windows x64 and
macOS arm64 offline checks (86 tests each) and installation of the same package on
both systems. It names the tested commit and does not cover later uncommitted work.
Windows live results are separate. **macOS manual terminal and live-model checks
remain unperformed.**

Development checks: `npm run typecheck`, `npm test`, `npm run build`.
Live checks are opt-in and can consume provider quota.
See [status](docs/status.md) and the [specification](docs/implementation-spec.md).

## The Hera family

This project is the terminal coding agent; its siblings provide live editor tools:

- [hera-agent-unity](https://github.com/NotNull92/hera-agent-unity) — Unity editor control.
- [hera-agent-godot](https://github.com/NotNull92/hera-agent-godot) — Godot editor control.
- [hebe-agent-unity](https://github.com/NotNull92/hebe-agent-unity) — lightweight Unity execution.

Hera's original adult office-wear character shares the family's gold-star motif
with a new identity. [Artwork notes](docs/branding.md).

## License

Currently **UNLICENSED**. Public visibility does not grant an open-source license.
See [third-party notices](THIRD_PARTY_NOTICES.md) for dependency terms.
