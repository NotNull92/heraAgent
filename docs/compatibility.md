# Compatibility and evidence

## Current behavior (2026-10-08)

Normal sessions use native workspace-write/on-request, with read-only `/plan` and
no mandatory `/apply` or phase restart. GPT-only, GPT-root/Go-worker and adaptive
Go-root/Astra modes have separate Windows live evidence and require matching local
fingerprints. Design/research requests use native DRD assignment and synthesis
guidance. See the newest [status](status.md) for the exact source and test receipts.
macOS automated CI does not qualify live modes; macOS manual/live remains NOT_RUN.

The sections below preserve historical discovery and qualification evidence.
Their old missing-authentication, apply-phase and blocked-provider statements do
not describe current Windows behavior.

## Historical Windows live checkpoint

See the current checkpoint in [status](status.md) for observed GPT read/resume,
interruption, read-only writes, native worker communication/recovery and isolated
main-only apply checks. Older missing-login/sandbox entries below are historical.
The native code-mode host is enabled for catalog-selected code_mode_only models.
Only background-terminal cleanup/list experimental types are additionally generated
from the same pinned binary; no Codex upgrade or independent execution engine is used.
GPT worker/apply integration passed on Windows for Astra/high + Luna/max, configured
limit 3; the local acceptance fingerprint gates that exact profile. Go direct coding
and a standalone native Responses tool turn passed. Cross-provider collaboration is
still blocked; current details are in status.md. macOS live/manual checks remain NOT_RUN.

## M0 contract discovery (2026-10-06)

Windows 11 Pro build 26200, x64 Intel i7-12700; PowerShell Core 7.6.6;
Node 24.12.0; npm 11.14.1; Git 2.52.0.windows.1. Terminal/herdr version
was not exposed by the automation host. Existing global Codex 0.160.1 is unchanged.
The pre-existing global hera command is not used or overwritten.

Installed @openai/codex 0.160.1 (Apache-2.0), exact registry integrity and generated
schema hash are in assets/codex/compatibility.json. Its published bin is a Node
launcher which selects the platform optional dependency. No Windows binary is
embedded in Hera's package. Generated TS imports receive only a .js extension
transform for NodeNext. Upstream source commit:
`d27764b82f7118f674371e6d6e76271d9d606edb` (rust-v0.160.1).

Native initialization, account/read, model/list and config/read passed in an isolated
temporary home without inference. Account ready=false; eight catalog entries are
not evidence of entitlement. Main and worker models remain unselected.

## Verified mapping, unverified enforcement

The installed schema and matching upstream config.schema.json expose:

- agents.max_concurrent_threads_per_session (minimum 1; excludes main per docs).
- agents.default_subagent_model (an explicit spawn override can win).
- agents.enabled; features.multi_agent; features.multi_agent_v2. V2 takes precedence
  over agents.enabled. Disable all three for single-agent/apply operations.
- sandbox_mode, approval_policy, shell_environment_policy and keyring auth storage.
- Generated initialize, model/list, account/read, thread/start/read/resume,
  turn/start/interrupt and command/file approval contracts.

These initial mappings were configuration observations. Later Windows live write/spawn
negative tests and product transitions are recorded separately in status.md.
Official native keyring login is required; no credential copying or plaintext fallback.

## Provider boundary

OpenCode Go documentation lists deepseek-v4.1-flash at its /chat/completions endpoint,
an identifying User-Agent and stable x-opencode-session. The Codex provider schema
requires Responses. Actual 2026-10-07 requests also reached Go via Responses: a native
DeepSeek tool read passed. This removes the earlier wire-format-only blocker but does
not establish cross-provider child routing/messages. No bridge or external mode is
enabled on that basis. No alternative provider is used.
Provider balance overflow settings are independent of Hera's no-fallback policy.

## Dependency and CI selection

Exact package versions were resolved from npm metadata and installed with exit 0;
initial npm audit reported zero vulnerabilities. Node 24 remains the tested major.
Direct dependencies and all transitive integrities are in package-lock.json.

Official GitHub tag-to-commit resolution:

| Action | Version | Commit |
|---|---|---|
| checkout | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| setup-node | v7.0.0 | 820762786026740c76f36085b0efc47a31fe5020 |
| upload-artifact | v7.0.1 | 043fb46d1a93c77aae656e7c1c64a875d1fc6a0a |
| download-artifact | v8.0.1 | 3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c |

Windows-2025 x64 and macos-15 arm64 are documented private-repository runner
targets; workflows must assert actual process.arch. Private Actions minutes may
consume the account allowance and incur charges. Runtime results are recorded
separately from documented runner availability.

## Sources inspected

- https://developers.openai.com/codex/app-server
- https://developers.openai.com/codex/config-reference/
- https://raw.githubusercontent.com/openai/codex/rust-v0.160.1/codex-rs/core/config.schema.json
- https://opencode.ai/docs/go/
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://nodejs.org/en/about/previous-releases
- https://cli.github.com/manual/gh_repo_create

macOS local/manual/live: MANUAL_NOT_RUN / LIVE_NOT_RUN. No local Mac required.

## Verified distribution matrix (2026-10-06)

Code: `fcbdd69cc26a16a4c6ec7786fc539ad24c73cdaf`.
[CI evidence](https://github.com/NotNull92/heraAgent/actions/runs/37425015641).

| Environment | Actual platform | Result |
|---|---|---|
| Windows local | Windows 11 10.0.26200 x64, Node 24.12.0 | 25 offline tests, typecheck, build, native smoke, downloaded CI archive install/reinstall/launcher PASS |
| Windows CI | Windows 10.0.26100 x64, Node 24.12.0 | Offline/native checks and identical archive installation PASS |
| macOS CI | Darwin 24.6.0 arm64, Node 24.12.0 | Offline/native checks and identical archive installation/direct shebang launcher PASS |
| Windows physical terminal | Korean IME/herdr | MANUAL_NOT_RUN |
| macOS manual/live | No local Mac used | MANUAL_NOT_RUN / LIVE_NOT_RUN |

Both CI installation jobs and local Windows consumed the archive with SHA-256
`7d0ea3bcb85c1b48afcf2a6a4839b2a22b08f698c4fd7fd78901ca48348c9790`.
Live model entitlement, worker safety, apply and native Go integration remain unverified;
worker/apply/external paths remain unavailable. Readiness is blocked by missing Hera
login/model selections and Windows sandbox setup. See status.md for remaining work.
