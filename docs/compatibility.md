# Compatibility and evidence

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

These are configuration observations, NOT successful live write/spawn negative tests.
Parallel collaboration and apply remain unavailable until their runtime gates pass.
Official native keyring login is required; no credential copying or plaintext fallback.

## Provider boundary

OpenCode Go documentation lists deepseek-v4.1-flash at its /chat/completions endpoint,
an identifying User-Agent and stable x-opencode-session. The Codex provider schema
requires Responses. Direct native cross-provider compatibility is UNVERIFIED;
no bridge or external mode is enabled on that basis. No alternative provider is used.
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
