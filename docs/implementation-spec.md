# Hera Agent: Detailed Implementation Specification

> Document version: 1.2.0 (Windows development revision)  
> Revision date: 2026-10-06  
> Product: **Hera** | Git repository and local directory: **`heraAgent`**  
> CLI command: **`hera`** | npm package identifier: **`hera-agent`**  
> Implementation environment: a native Windows PC running Codex and PowerShell  
> Local development and hands-on testing: **Windows**  
> Distribution targets: native Windows and macOS  
> Status: implementation handoff, not a claim that Hera, live model integration, CI, a GitHub repository, or a release already exists.

This English revision supersedes earlier handoffs that assumed macOS as the development host. Windows is now the development and local-test environment; Windows and macOS remain product targets. Read it as a standalone handoff; previous chat messages are not required. The repository name is exactly `heraAgent`, including its lowercase initial `h` and uppercase `A`. Do not silently normalize it to another spelling.

## Revision summary

- The implementation host and all current hands-on/local tests are **native Windows**, using the installed PowerShell environment. A local Mac, WSL, Bash, Git Bash, Homebrew, or a remote development server is not required.
- Windows and macOS remain required product targets. Keep both CI targets; use macOS CI for available automated checks and explicitly record unperformed macOS terminal/live-model checks. Do not infer macOS success from Windows tests or stop all implementation because no local Mac is available.
- Repository bootstrap, GitHub authentication/create/push examples, and upload verification are now written for Windows PowerShell. Native command exit codes must be checked explicitly.
- This is a requirements and workflow revision, not a fresh external-API verification or a report of Windows/macOS execution. The source notes and unresolved integration gates remain subject to M0 verification.
- All implementation instructions, comments, examples, and acceptance criteria are written in English. This does not change the product's Korean-language input and localization requirements.
- Local Git initialization, creation of the GitHub remote, and pushing reviewed source are now explicitly in scope. The earlier prohibition on those operations is superseded for this project only.
- The GitHub owner must be resolved from the active authenticated account, not inferred from a previous conversation. A new remote defaults to **private** because public visibility was not requested.
- The intended Git identity is `OWNER/heraAgent`, the local root is `heraAgent/`, and the terminal command remains `hera`.
- The npm identifier remains lowercase `hera-agent`; a Git repository name and an npm identifier need not match. New npm package names cannot contain uppercase letters. [S08]
- Hard-coded claims about a latest Codex patch, Node patch, GitHub Action major, or runner architecture have been replaced with implementation-time discovery and exact-version evidence. Do not copy old candidate versions as verified facts.
- The architecture remains a local Codex App Server client. OpenCode Go remains the subscription model provider, not a second mandatory coding harness.

## Reading map

| Sections | Purpose |
|---|---|
| 0-4 | Non-negotiable requirements, evidence policy, architecture |
| 5-11 | Toolchain, repository layout, configuration, protocol, authentication |
| 12-16 | Collaboration safety, external model integration, recovery, UI, platform behavior |
| 17-19 | Tests, milestones, package and release process |
| 20 | Windows PowerShell bootstrap, Git initialization, GitHub creation, push and verification |
| 21-23 | Acceptance criteria, forbidden patterns, official references |
| Appendix A | Exact implementation prompt, also provided as a separate text file |

Do not skip Sections 0, 2, 9, 12, 18, 20, or 21 even when working in a short implementation session.

---

## 0. Instructions for the implementing Codex agent

1. Read applicable `AGENTS.md` files and this entire document. Inspect the selected workspace, existing files, Git root, working tree, and remotes before changing anything. Preserve unrelated changes.
2. Build a **new, independent CLI/TUI coding agent**, not a modification of `hera-agent-unity`, `hera-agent-godot`, WorkForge, or herdr. Do not inspect unrelated projects or account files without authorization.
3. Use the exact repository name **`heraAgent`**. Initialize its local Git repository and create/push its GitHub remote according to Section 20. This handoff authorizes those operations for reviewed Hera source; it does not authorize public disclosure, remote deletion, force pushes, or uploading personal data.
4. Run repository bootstrap first, then implement M0 through M7 in order. Keep coherent, reviewable commits. Push completed milestones to the verified remote; do not leave the entire implementation only on the Windows development PC.
5. Verify external fields, events, settings, and authentication against official documentation and the **installed, pinned Codex binary's generated schemas**. Never invent an API field because it appeared in a design example.
6. Reuse Codex's agent loop, thread history, context management, native tools, and supported subagent controls. Do not add a Hera conversation database, SQLite dependency, ORM, or general-purpose agent execution loop.
7. OpenCode Go is the user's chosen **subscription API provider for DeepSeek V4.1 Flash**. Do not replace it with the direct DeepSeek API, Command Code, or a different billing route. Do not add OpenCode CLI, SDK, or headless server as a mandatory runtime.
8. Use official authentication only. Do not extract browser cookies, copy another application's credential files, bypass subscription restrictions, or implement unofficial login workarounds.
9. `gpt_only` is the default. `external_workers` must remain blocked until its specific route, native collaboration, permission, cancellation, and recovery gates pass. Do not silently substitute GPT for a failed DeepSeek worker.
10. Missing model credentials block only the affected live tests. Record `BLOCKED_NO_CREDENTIALS`; continue offline implementation, mock tests, package checks, and documentation. A mock pass is never a live pass.
11. Protect secrets and user code in logs, Git history, packages, diagnostics, and CI. Scan the intended upload scope before the first push and before releases.
12. Do not replace the global Codex installation that is implementing this project. Use a project-local, pinned runtime dependency for Hera and an isolated Hera runtime home.
13. English wording is not evidence. Label requirements, design choices, documentation observations, and unverified runtime behavior separately.
14. If native cross-provider integration is unsupported, document the exact blocker and keep that feature unavailable. Continue the GPT path. Propose an architectural change in an ADR instead of silently adding a second harness.
15. Public visibility, a new organization owner, registry publication, a license grant, and publication of a GitHub release require separate explicit approval. Local commits and the authorized private remote push do not require repeated confirmation once their prerequisites are satisfied.
16. Develop and perform hands-on/local tests on native Windows. Use the actual installed PowerShell version, Windows paths, and verified executable entry points. Keep macOS source/package support and CI; lack of local Mac hardware is an evidence gap for Mac-only checks, not a reason to require a Mac or drop that target.

**Success means:** a user installs a release package on each Windows or macOS PC, opens herdr or a normal terminal on that PC, enters a project directory, and runs `hera`. No home-PC relay, remote Hera service, SSH, Linux, or WSL is required.

---

## 1. Product requirements and scope

### 1.1 Confirmed requirements

| ID | Requirement | Acceptance condition |
|---|---|---|
| R01 | Independent `hera` command | Displays Hera's own UI, not a scraped or reprinted Codex TUI |
| R02 | Install on Windows and macOS | Works against each PC's local files with the same user workflow |
| R03 | Run inside herdr | Behaves as a normal TTY application; does not implement terminal/session management |
| R04 | Shared TypeScript implementation | Node.js runtime, React/Ink UI, small platform-specific adapters |
| R05 | Reuse the Codex harness | Uses the documented App Server interface; no default harness fork |
| R06 | GPT-only mode | User-selected GPT main agent and GPT workers |
| R07 | External-worker mode | GPT main agent plus DeepSeek V4.1 Flash through **OpenCode Go** |
| R08 | Role-specific model configuration | Independent main/worker models and only verified reasoning options |
| R09 | Worker concurrency setting | Observed simultaneous worker count respects the configured limit |
| R10 | Agent collaboration | Task assignment, follow-up, result return, waiting, and cancellation work end to end |
| R11 | Conflict prevention | Writes are controlled by execution policy, not a prompt masquerading as a lock |
| R12 | Minimal persistence | Native history is reused; Hera stores only configuration and reference metadata |
| R13 | Git and release lifecycle | Local `heraAgent` repository, verified GitHub remote, commits, push, CI and installable artifacts |
| R14 | Develop and test locally on native Windows | Windows PowerShell workflow and actual Windows tests; retain Windows/macOS CI and separately report macOS manual/live gaps |
| R15 | Evidence-based UI | No fabricated progress percentages, costs, routing claims, or test results |
| R16 | English engineering handoff | Specification, architecture notes, code comments, and maintainer instructions are English |

### 1.2 Out of scope for v0.1

- Terminal emulation, multiplexing, or a herdr replacement.
- A cloud Hera service, Hera account server, remote desktop, or cross-PC session synchronization.
- A second LLM loop, conversation database, memory-search service, or general DAG/workflow framework.
- A fork of the Codex TUI, a default Rust harness fork, or mandatory OpenCode runtime.
  User-authorized exception (2026-10-07): mixed mode alone may use the reviewed,
  pinned project-specific native provider-routing patch. GPT-only mode keeps the
  official runtime. Keep the same native tools/history/worker controls, separate
  Windows/macOS qualification, runtime integrity checks and fresh capability
  fingerprints. No global Codex replacement or automatic provider fallback.
- Linux support, WSL requirements, mobile apps, GUI installers, or automatic update daemons.
- Reimplementation or automatic installation of Unity/Godot connectors.
- Silent model/provider switching based on guessed prices, quality, or quota.
- A general-purpose proxy implementing every Responses API feature.
- Multiple workers writing the original workspace simultaneously.
- Automatic publication to npm or automatic public release of the repository.

### 1.3 Meaning of parallel implementation in v0.1

Read-only workers may produce **real implementation code, unified-diff proposals, and test code**. They are not limited to summaries. Only the main agent applies modifications to disk in the initial design.

The sequence is:

```text
Parallel analysis and implementation proposals
    -> confirm every worker is quiescent
    -> one main agent applies changes
    -> one main agent runs integration checks
```

Direct parallel writing in isolated workspaces is a later, explicitly approved extension. Do not quietly reinterpret the initial safety policy as permission to run several writers in one checkout.

---

## 2. Evidence policy and unverified boundaries

### 2.1 Separate four kinds of statement

| Label | Meaning |
|---|---|
| `REQUIREMENT` | A behavior or constraint requested for Hera |
| `DESIGN` | A proposed implementation choice, subject to an explicit ADR if changed |
| `DOCUMENTED` | Described by a referenced official source; not automatically a successful live test |
| `UNVERIFIED` | Must be checked against the installed binary, account, provider, and OS |

The dated reference checks for this revision cover the App Server integration entry point, provider configuration, OpenCode Go, npm naming, and Git/GitHub CLI publishing commands. They do **not** constitute an exhaustive retest of every API surface in the previous document. Section 23 distinguishes checked entry points from additional verification references.

### 2.2 Load-bearing external boundaries

| Status | Observation or question | Required response |
|---|---|---|
| DOCUMENTED | App Server supports a local client integration and version-specific schema generation. [S01] | Generate types from the exact selected runtime |
| DOCUMENTED | The provider configuration currently lists `responses` for `wire_api`. [S02] | Do not assume Chat Completions is directly usable |
| DOCUMENTED | OpenCode Go lists `deepseek-v4.1-flash` at its Chat Completions endpoint. [S03] | Test the exact subscription route, not the direct DeepSeek service |
| DOCUMENTED | Go describes API-key access, client identification and stable conversation/session information. [S03] | Preserve identity and session headers without exposing credentials |
| UNVERIFIED | GPT parent plus a native Go/DeepSeek child: routing, authentication, messages, resume | Block external mode until all relevant gates pass |
| UNVERIFIED | Read-only permission inheritance and disabling every native spawn path | Verify negative tests; do not guess a feature flag |
| UNVERIFIED | Current Codex release, dependency patches, Action commits and runner architecture | Resolve during M0, pin and record evidence |
| UNVERIFIED | Actual availability of the user's intended main and worker GPT models | Query supported account/model metadata; require an explicit selection |
| UNVERIFIED | Full live behavior on Windows and macOS | Record separate OS, account, and test results |

A provider claiming Codex client compatibility does not prove that **every** model behind that provider speaks the required protocol. A working direct DeepSeek endpoint also does not prove that the OpenCode Go subscription endpoint supports the same features.

### 2.3 Do not hard-code speculative model or version identifiers

The user discussed the labels **Astra**, **Luna**, and **DeepSeek V4.1 Flash**. Treat Astra/Luna as desired role labels until the current account exposes concrete supported identifiers. Do not manufacture an API ID from a display name.

The Go model identifier in Section 8 is a documented candidate to verify, not proof that the account can invoke it. Store unselected GPT model IDs as `null`; complete selection using official metadata. Do not make a fresh setup silently choose a different paid model.

Resolve the actual runtime versions during M0. Record the result, source, package integrity and schema hash. This document deliberately does not prescribe an allegedly latest Codex patch, Node patch, or GitHub Action major.

---

## 3. Architecture decisions

### ADR-001: One local backend for v0.1

Implement only `backend = codex_app_server` initially. Hera owns a local Codex child process and communicates over stdio.

A hosted Agents API, an Agents SDK, the Codex SDK, and the local Codex App Server are not interchangeable names. This specification selects the local interface because the product is installed independently on each PC. A hosted backend requires a separate ADR and is not an implicit part of this implementation.

### ADR-002: Harness type is not process topology

The target is **native Codex parent/child collaboration**, with a different model provider for selected children when verified.

- Prefer the native path first.
- Evaluate a narrowly scoped, explicitly enabled protocol bridge only when the Go endpoint requires it.
- A bridge translates requests and responses. It must not become an agent loop or execute tools.
- Independent Codex worker processes linked by Hera are a different topology, even if both use Codex.
- Do not silently add that topology or an OpenCode worker pool. Write an ADR with its added permissions, recovery, billing, and maintenance costs before changing the scope.
- When a native route is unsupported, keep external mode blocked and continue the GPT implementation.

### ADR-003: Codex owns conversation history

Hera stores configuration, native-thread references, capability reports, and a small amount of application recovery metadata. It does not parse or modify Codex's private database schema.

Codex may internally create SQLite or JSONL files. That is allowed. The prohibition is against a **duplicate Hera conversation database**, not against the runtime's own implementation.

### ADR-004: One package, small boundaries

Start with one npm package and one TypeScript project. Avoid a monorepo, dependency-injection framework, message-bus server, or speculative provider hierarchy.

Use small integration boundaries such as `CodexClient`, `ProviderProbe`, and `ProcessAdapter`. Create modules only when their implementation is needed.

### ADR-005: Pin tested versions

Pin exact direct dependencies and the supported Codex runtime. Capture Node/npm versions and OS details. Review any version/schema/capability change with tests before release.

Do not automatically replace a user's global Codex or automatically install an untested latest version. Do not provide an unsafe "ignore compatibility" switch in v0.1.

### ADR-006: Safe initial repository publication

The requested repository is `heraAgent`. A newly created GitHub remote is private unless the user explicitly specifies otherwise. Resolve the active personal account rather than guessing an organization. Create the remote and push reviewed source as part of implementation, not as an optional future suggestion.

Existing remotes, histories and visibility settings must be inspected and preserved. Destructive reconciliation or changing an existing repository's visibility is not authorized by this handoff.

---

## 4. System structure

```text
Each Windows or macOS PC
└── herdr or a normal terminal
    └── hera                              [TypeScript / Node.js]
        ├── CLI and React/Ink TUI
        ├── configuration, mode and phase policy
        ├── App Server transport and event presentation
        ├── minimal reference metadata
        └── local Codex App Server        [existing harness]
            ├── GPT main agent
            │   └── official OpenAI authentication
            ├── gpt_only
            │   └── native GPT workers
            └── external_workers          [verification required]
                └── native DeepSeek workers
                    ├── verified direct Go Responses route, or
                    └── verified restricted local bridge
                        └── OpenCode Go subscription API
                            └── DeepSeek V4.1 Flash
```

| Responsibility | Owner |
|---|---|
| Model/tool execution loop | Codex |
| Context, compaction, history and thread resume | Codex |
| Supported native worker creation, messaging and waiting | Codex |
| Native file/shell tools and sandbox execution | Codex |
| Hera UI, commands, mode selection and approval presentation | Hera |
| Compile Hera settings into verified native settings | Hera |
| Verify safe transitions between analysis and single-writer phases | Hera |
| Platform launch, packaging, support diagnostics | Hera |
| Optional limited API translation | Hera bridge, only after feasibility validation |
| General-purpose independent agent engine | Do not implement |

---

## 5. Toolchain and dependency policy

All exact package versions must be selected and recorded in M0. The following is the proposed stack, not a list of verified installed versions.

| Area | Selection | Constraint |
|---|---|---|
| Runtime | Node.js 24 LTS target | Verify current support and an exact compatible patch in M0 |
| Language | TypeScript, strict ESM | Share code across Windows and macOS |
| TUI | React + Ink | Presentation only; no direct protocol calls in components |
| CLI parser | Commander | One parser, not several competing CLI frameworks |
| Validation | Zod | Hera configuration and external data boundaries only |
| Tests | Vitest plus an appropriate Ink test utility | Protocol fakes, state, rendering and negative cases |
| Build | TypeScript compiler | No initial bundler unless a measured need requires one |
| Package manager | npm | One committed source lockfile and `.tgz` distribution |
| Harness | Package-local `@openai/codex`, exact version | Do not mutate the implementing Codex installation |
| Process management | Node `child_process.spawn` | Command/arguments separated; avoid shell interpolation |
| Optional HTTP/SSE | Node built-ins | Add only when a provider probe or bridge needs them |
| Database | None | No Hera SQLite/ORM dependency |
| Repository publishing | Git and GitHub CLI on the Windows development PC | Development tools, not end-user Hera requirements |

### Build and package rules

- Start with `engines.node = ">=24 <25"` if M0 confirms that target. Expand only after testing another major; document any necessary change.
- Use `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module = NodeNext`, `moduleResolution = NodeNext`, and `jsx = react-jsx`.
- Treat untrusted protocol input as `unknown`. Avoid broad `any` and unchecked type assertions.
- Commit `package-lock.json`; pin direct dependency versions exactly.
- Prepare `npm-shrinkwrap.json` in a separate release staging directory when freezing consumer installation dependencies. Verify cross-platform optional dependencies and compare it to the source lock inputs. Do not mutate the source lock during packaging. [S13]
- Do not copy an entire `node_modules` tree or arbitrary native binaries into the tarball. Prefer the supported npm dependency distribution path, with license and integrity checks.
- Audit dependency findings; do not run `npm audit fix --force` automatically.
- Installing the package may require downloading dependencies. Do not advertise a `.tgz` as an offline, self-contained executable.
- Use cross-platform Node `.mjs` helpers for build, copy, clean, hashing, packaging and test automation. Do not make normal scripts depend on `rm`, `cp`, `chmod`, `sed`, `awk`, POSIX environment assignment or a developer-installed Unix shell.
- Windows local instructions use PowerShell; keep end-user macOS examples separately labeled. An npm script's command syntax is not an instruction to paste shell-specific operators into Windows PowerShell.

---

## 6. Development environment and platform support

### 6.1 Current implementation and local-test host

**REQUIREMENT:** Implement Hera with Codex on the user's native Windows PC. Perform all currently requested hands-on/local tests on that Windows PC. Use the installed PowerShell environment and record its edition/version; do not assume PowerShell 7 or require a global shell upgrade. Section 20 examples are intended to remain compatible with Windows PowerShell 5.1 and PowerShell 7, but must be checked on the actual host before being reported as tested.

Do not move development to a Mac, Linux, WSL, a container, or a home-PC relay to avoid Windows issues. Git for Windows can be used without making Git Bash the required shell. If an actual Windows runtime capability is unavailable, report the precise blocker and continue independent work; do not label an emulated or remote Linux run as native Windows evidence.

### 6.2 Distribution targets remain cross-platform

| Platform | v0.1 target | Required evidence |
|---|---|---|
| Native Windows x64 | Required; primary development and local-test host | Actual Windows local tests, clean-prefix package test and real terminal checks, plus Windows CI |
| macOS Apple Silicon | Required distribution target | Suitable macOS arm64 CI for automated checks; real terminal/live checks recorded separately when actually performed |
| macOS Intel | Compatibility target | Test only when runtime and runner support are available |
| Windows ARM64 | Later scope | Detect the current host architecture; do not mark ARM64 supported based on x64 results |
| Linux / WSL | Out of scope | WSL is not a development, testing, installation or runtime prerequisite |

Record tested OS builds instead of inventing minimum versions. A Windows Server CI result is not evidence of desktop Windows IME or real herdr behavior. Runner names do not prove CPU architecture; record `process.platform`, `process.arch`, OS metadata, terminal and shell versions.

**Windows-first development does not mean Windows-only code or a Windows-only release.** Keep both platforms in package metadata, installation/rollback documentation, native dependency resolution and CI. Do not copy Windows-selected native binaries into a nominally cross-platform tarball.

### 6.3 Evidence without a local Mac

Use macOS CI for automated installation, build, offline tests, native initialization and package smoke where the account and runner permit. A MacBook or other local Mac is not required for this implementation session, and production credentials must not be uploaded to CI just to imitate local tests.

If a real macOS terminal or live-model run has not occurred, record `MANUAL_NOT_RUN` or `LIVE_NOT_RUN`. If macOS CI is unavailable, record `CI_NOT_RUN` and the blocker, keep the target and workflow intact, and continue Windows work. These are report labels, not invented native API fields. Fix observed macOS CI failures; do not turn them into skips to obtain a green check.

Do not claim full macOS verification from Windows results, a Linux mock, or a generic green CI badge. A Windows-tested build can be delivered as a clearly scoped prerelease while macOS evidence is incomplete. Full cross-platform release claims require the applicable platform gates in Sections 17, 19 and 21. Record Windows local results, each OS's CI results, and outstanding macOS manual/live checks independently.

---

## 7. Repository and source layout

### 7.1 Naming contract

| Item | Exact value or rule |
|---|---|
| GitHub repository name | `heraAgent` |
| New local root directory | `heraAgent/` |
| Product name | Hera |
| Terminal executable | `hera` |
| npm package name | `hera-agent` (lowercase; no claim of registry ownership) |
| Default branch for a new repository | `main` |
| Remote name | `origin` |
| New remote owner | Authenticated personal GitHub account resolved in Section 20 |
| New remote visibility | Private unless explicitly instructed otherwise |
| Public registry publishing | Not authorized by this handoff |

### 7.2 Incremental source layout

```text
heraAgent/
├── AGENTS.md
├── README.md
├── CODEX_START_PROMPT.txt
├── CHANGELOG.md
├── SECURITY.md
├── THIRD_PARTY_NOTICES.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.test.json
├── vitest.config.ts
├── vitest.live.config.ts
├── .node-version
├── .gitignore
├── .gitattributes
├── bin/
│   └── hera.mjs
├── assets/
│   ├── codex/                    # verified runtime/schema metadata
│   └── roles/                    # verified role templates
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── paths.ts
│   ├── metadata.ts
│   ├── errors.ts
│   ├── codex/
│   │   ├── launcher.ts
│   │   ├── transport.ts
│   │   ├── client.ts
│   │   ├── config-compiler.ts
│   │   ├── capabilities.ts
│   │   └── generated/
│   ├── session/
│   │   ├── controller.ts
│   │   ├── phase-policy.ts
│   │   ├── workspace-lock.ts
│   │   └── events.ts
│   ├── providers/
│   │   ├── opencode-go.ts
│   │   └── probe.ts
│   ├── bridge/                   # only if needed and feasible
│   ├── platform/
│   │   └── process.ts
│   └── tui/
│       ├── App.tsx
│       ├── Composer.tsx
│       ├── Transcript.tsx
│       ├── Workers.tsx
│       ├── Approval.tsx
│       └── StatusBar.tsx
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── live/
│   ├── fixtures/
│   └── fake-app-server.mjs
├── scripts/
│   ├── collect-toolchain.mjs
│   ├── generate-protocol.mjs
│   ├── check-package.mjs
│   ├── smoke-package.mjs
│   └── prepare-release.mjs
├── docs/
│   ├── implementation-spec.md
│   ├── status.md
│   ├── repository-setup.md
│   ├── compatibility.md
│   ├── install-macos.md
│   ├── install-windows.md
│   ├── release-checklist.md
│   ├── adr/
│   └── evidence/                 # sanitized summaries only
└── .github/workflows/
    ├── ci.yml
    └── release.yml
```

Create directories when needed, not as empty architecture decoration. Preserve an existing repository layout when adapting it is safer than replacing it. Section 20 governs repository creation and upload; this tree is not evidence that a remote already exists.

---

## 8. Hera configuration contract

### 8.1 User configuration

The following JSON is a **Hera-owned configuration example**, not an OpenAI API request. Values such as safety policy labels are compiled into verified backend settings. Unknown native fields must never be forwarded speculatively.

```json
{
  "schemaVersion": 1,
  "language": "ko",
  "mode": "gpt_only",
  "backend": "codex_app_server",
  "main": {
    "model": null,
    "reasoningEffort": null
  },
  "workers": {
    "gptModel": null,
    "externalProfile": "opencode_go_deepseek",
    "maxConcurrent": 3,
    "implementationStyle": "patch_proposals"
  },
  "providers": {
    "opencode_go_deepseek": {
      "baseUrl": "https://opencode.ai/zen/go/v1",
      "model": "deepseek-v4.1-flash",
      "apiKeyEnv": "HERA_OPENCODE_GO_API_KEY",
      "transport": "auto_probe",
      "billingPolicy": "subscription_preferred_no_client_fallback"
    }
  },
  "safety": {
    "strategy": "phased_single_writer",
    "approvalPolicy": "on-request",
    "automaticProviderFallback": false,
    "allowUnverifiedExternalMode": false
  },
  "ui": {
    "color": "auto",
    "reducedMotion": false
  }
}
```

Configuration semantics:

- `main.model` and `workers.gptModel` remain unset until an available model is selected. Never invent a model ID from "Astra" or "Luna". An unavailable model is a setup issue, not permission for a silent replacement.
- `reasoningEffort = null` means the verified model default. Do not assume every model accepts the same effort levels.
- `workers.maxConcurrent` defaults to 3. The initial product range is 1-8, excluding the main agent. Verify the backend's actual counting semantics, including nested children. This is a simultaneous limit, not a total task count or an instruction to always create N workers.
- A single-agent path disables worker creation explicitly; do not assume setting a numeric limit to zero has that meaning.
- `implementationStyle = patch_proposals` means workers return proposed code/diffs. The main agent applies them later.
- `auto_probe` means an explicit probe selects one verified transport for subsequent sessions. It does not authorize per-request endpoint guessing or repeated paid calls.
- `automaticProviderFallback = false` forbids Hera from retrying through another provider, model, or billing path. It does not control server-side account billing options.
- Unknown configuration fields are errors. Migrations require a backup and an explicit schema version.
- The English handoff does not change the user's Korean UI preference. Provide English strings as well; localize presentation without translating protocol keys or model IDs.

### 8.2 Runtime paths

Default to `HERA_HOME = path.join(os.homedir(), '.hera')`.

Use `CODEX_HOME = <HERA_HOME>/codex` only in the environment of the child processes Hera owns. Resolve the user's home through `os.homedir()` on each OS; `~` in the following tree is explanatory notation, not a literal path. Do not modify the user's existing default Codex home, copy its credentials, or symlink it into Hera. This isolation may require a separate official login during setup. On Windows, do not change the implementing Codex session's environment or home globally.

```text
~/.hera/
├── config.json
├── codex/                         # private implementation owned by Codex
├── metadata/
│   ├── sessions/<heraSessionId>.json
│   └── capabilities/<fingerprint>.json
├── locks/<workspaceHash>/
└── diagnostics/<runId>.json        # optional sanitized summary
```

Allow an explicit `HERA_HOME` override and canonicalize it. Do not use project-relative secret storage by default. Do not commit this runtime directory to `heraAgent`.

### 8.3 Precedence and trust

Use this precedence for supported settings:

```text
Product defaults -> user configuration -> restricted project suggestions -> explicit CLI options
```

Security ceilings and managed requirements cannot be weakened by a lower-trust source.

A project `.hera.json` may contain only:

- UI language and presentation preferences.
- Suggested mode/model-profile names, requiring user confirmation before a new session uses them.
- A worker limit no greater than the user-level limit.
- Suggested test commands, with execution authorization handled separately.

It must not set provider URLs, secrets, authentication homes, binary paths, permission escalation, automatic fallback, or startup commands. `AGENTS.md` contains task instructions, not authority to change security or billing configuration. Preserve native project-trust and managed-policy behavior.

---

## 9. Modes and capability gates

### 9.1 Modes

| Mode | Main | Workers | Initial state |
|---|---|---|---|
| `gpt_only` | Selected GPT | Selected GPT | Default, subject to basic readiness |
| `external_workers` | Same selected GPT | Go DeepSeek | Blocked until verified |

Mode selection and backend selection are independent concepts. A mode switch must not silently change a local runtime into a hosted API service.

### 9.2 Mode-switch rules

1. `/mode external_workers` prepares a **new session**, not a live mutation of a running thread.
2. Existing turns, workers, commands and approval requests must finish or be safely canceled first.
3. Show the proposed main model, worker model, provider, authentication/billing category, and verification state.
4. Explain that the external worker receives task context and relevant project data.
5. Start a new native thread. Do not automatically send the entire previous conversation to a different provider.
6. Phase transitions within one session follow Section 12; they are not model-provider switches.

### 9.3 Capability evidence

The following are Hera-owned types, not official protocol definitions.

```ts
type ProbeState = 'pass' | 'fail' | 'not_run' | 'blocked';

interface CapabilityReport {
  schemaVersion: 1;
  fingerprint: string;
  codexVersion: string;
  protocolSchemaSha256: string;
  platform: {
    os: 'darwin' | 'win32';
    arch: string;
    release: string;
  };
  checkedAt: string;
  providerProfileHash: string;
  checks: Record<string, {
    state: ProbeState;
    evidence?: string;
    reason?: string;
  }>;
  externalMode: 'blocked' | 'native_direct' | 'native_bridge';
}
```

Fingerprint the runtime version, generated schema, platform, selected configuration, non-secret provider URL/model, bridge version and collaboration settings. Never include a secret value **or a hash of a secret**. Record credential readiness separately without disclosing credentials.

### 9.4 Gates

| Gate | Test | Failure behavior |
|---|---|---|
| G00 | Installed package, runtime version and schema agree | Block incompatible runtime |
| G01 | Initialize, account/model discovery, thread lifecycle, streaming and resume | GPT session unavailable; show diagnostic |
| G02 | Read-only really prevents modifications and permission escalation | Disable parallel collaboration |
| G03 | Worker concurrency and complete spawn-disable behavior | Block unsafe phase or offer explicitly selected single-agent operation |
| G04 | Parent/child messages, follow-up, result return and cancellation | Native collaboration unavailable |
| G10 | Go model/account route and required client/session identity | External mode unavailable |
| G11 | Direct Responses compatibility or a verified bridge contract | External mode unavailable |
| G12 | Root actually uses OpenAI; child actually uses Go/DeepSeek | External mode unavailable |
| G13 | Cross-provider collaboration, opaque items, context and resume | External mode unavailable |
| G14 | No child creation or concurrent writer survives into apply | Block apply phase |
| G15 | EOF, 401, 429, quota, cancellation and uncertain outcomes | Release lacks external-mode stability |

`not_run` is not `pass`. Invalidate reports when the runtime/schema/configuration fingerprint or relevant account capabilities change. Do not run paid probes merely because time passed; show the timestamp and request an explicit live check.

A successful routing probe is not proof that every possible future model instruction is physically unable to choose a different model. Inspect available roles, defaults, overrides and effective routing. Stop further work when drift is detected, and disclose whether the pinned runtime offers preventive enforcement or only observation.

---

## 10. Codex process and protocol integration

### 10.1 Launch strategy

Resolve the executable declared by the installed package rather than guessing a global PATH entry or hard-coding a source repository path. Inspect whether the installed entry point is a JavaScript launcher or a native executable. Use the corresponding safe launch path; do not assume an unpublished source manifest is identical to the npm package.

Conceptual JavaScript-launcher example:

```ts
spawn(process.execPath, [resolvedCodexLauncher, 'app-server'], {
  cwd: workspaceRealPath,
  env: childEnvironment,
  shell: false,
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe']
});
```

This illustrates process ownership, not a complete launcher implementation.

- Resolve package entry points through package metadata and tested package resolution.
- Do not invoke a Windows `.cmd` launcher as if it were a native executable with `shell: false`.
- Preserve necessary OS variables such as PATH, PATHEXT, SYSTEMROOT, WINDIR, TEMP and TMP. Normalize Windows environment-key case to avoid duplicate effective values.
- Do not automatically execute a fake `codex`, `node`, or helper script found in the target project.
- Track PID, start time and verified executable identity. Terminate only processes owned by this Hera instance, never all processes named Codex.
- Reserve the parent terminal for the TUI. Buffer and redact child stderr separately; strip unsafe terminal control sequences.

### 10.2 Generate the contract from the installed binary

The documented generation entry points are version-specific. [S01]

```text
codex --version
codex app-server --help
codex app-server generate-ts --out <generated-ts-directory>
codex app-server generate-json-schema --out <generated-schema-directory>
```

Invoke them through the same verified launcher resolver used by the product. Record the binary version and schema hash. Check command availability in that installed version before relying on it. Generated code, fixtures and bundled compatibility metadata must refer to the same version.

### 10.3 Internal client boundary

Hera should expose a small internal client interface. Supporting types below are to be defined by the implementation, not imported from an imagined SDK.

```ts
interface CodexClient {
  initialize(): Promise<void>;
  account(): Promise<AccountView>;
  listModels(): Promise<ModelView[]>;
  startSession(input: SessionStart): Promise<SessionRef>;
  resumeSession(input: SessionResume): Promise<SessionRef>;
  startTurn(input: TurnInput): Promise<TurnRef>;
  interrupt(ref: TurnRef): Promise<void>;
  respondToServerRequest(id: string | number, result: unknown): Promise<void>;
  listChildren(rootThreadId: string): Promise<ChildView[]>;
  events(): AsyncIterable<HeraEvent>;
  close(): Promise<void>;
}
```

Map these methods to actual generated request/response types. `listChildren` may need to combine supported notifications and thread queries; it is **not** a claim that a public method with that name exists.

Expected discovery targets include initialization, authentication status, model listing, thread start/read/list/resume, turn start/interrupt, and approval/event handling. Treat familiar names such as `thread/start` as verification targets, not permission to fabricate related methods or parameters.

### 10.4 Transport requirements

These are implementation requirements for the client:

- Parse the version's documented stdio framing. Handle multiple messages per chunk, fragmented UTF-8, partial lines, and EOF.
- Match the actual wire envelope. Do not add a `jsonrpc` field when that version's schema/examples omit it.
- Keep client request IDs, server request IDs, thread IDs, turn IDs, item IDs and worker IDs distinct.
- Maintain a bounded pending-request map. Responses may arrive out of order.
- Install event handling before sending requests. Events may precede a request acknowledgment.
- Keep approval and user-input server requests responsive while streams are active. Do not block dispatch while awaiting model completion or UI rendering.
- Safely ignore unknown notifications while recording their type. Never auto-approve an unknown side-effect request.
- If the schema provides no valid denial for an unknown request, safely interrupt/disconnect and report the unsupported contract rather than inventing a response.
- Treat malformed framing, duplicate request IDs, oversize messages and unexpected EOF as errors. Do not resend a writing turn merely because the transport failed.
- Initial defensive product limits: 16 MiB per framed message and 128 pending RPCs. These are tunable Hera limits, not claimed API limits.

### 10.5 Timeouts

| Operation | Initial design value | Meaning |
|---|---:|---|
| Process start and initialize | 20 seconds | Detect startup failure |
| Short control/query RPC | 30 seconds | Not a total model execution deadline |
| Entire turn | No implicit deadline | User cancellation remains available |
| No events observed | Status notice after 120 seconds | Do not infer failure or switch models |
| Graceful shutdown | 5 seconds before escalation | Process cleanup, not proof of rollback |

A method documented as long-lived must not receive a short query timeout. Request acknowledgment, model completion and child-shell exit are separate facts.

### 10.6 Cancellation and shutdown

1. Interrupt the active turn using supported native controls.
2. Check the main thread and all children. Main interruption does not by itself prove every worker or command stopped.
3. Terminate any remaining owned execution through supported controls or the verified platform process-tree mechanism.
4. Close the App Server transport after cleanup.
5. Record `INTERRUPTED_UNCONFIRMED` when quiescence cannot be established. Keep the workspace blocked or require manual recovery.
6. Restore terminal input, cursor and rendering state on normal exit, Ctrl+C, render failure and OS termination signals where possible.

Never display "canceled" as a completed fact merely because the user pressed a key or the server acknowledged an interrupt.

---

## 11. Authentication, provider identity and billing boundaries

### 11.1 OpenAI authentication

Prefer the pinned Codex runtime's official native login flow. Verify supported App Server login methods; alternatively invoke the official login command with the same isolated `CODEX_HOME`. Do not duplicate token refresh in Hera when native authentication already owns it. Verify credential-store behavior against the selected runtime. [S14]

- Implement `hera auth login openai` using only supported native flows.
- Expose browser/device-code/API-key choices only when verified for that runtime and account.
- Do not implement external token injection, a new OAuth application, a refresh server, or another application's credential sharing in v0.1.
- Prefer the supported OS credential store. If a plaintext fallback is possible, disclose it and obtain user consent rather than silently downgrading storage.
- Present account readiness and billing category without displaying secrets.
- Do not infer account access or model availability from the user's subscription name alone.

### 11.2 OpenCode Go provider

Documented integration candidates to recheck at implementation time: [S03]

```text
Base URL: https://opencode.ai/zen/go/v1
Requested model: deepseek-v4.1-flash
Documented model endpoint: /chat/completions
Authentication: provider API key, not OAuth
Hera-owned key variable: HERA_OPENCODE_GO_API_KEY
Client identity: User-Agent: hera/<version>
Conversation identity: stable session header accepted by Go
```

Use `x-opencode-session` where appropriate, or preserve the native session header that Go explicitly accepts. Do not add contradictory IDs. Use a stable random identifier per worker conversation, not a credential, project path or user email. Reuse it when resuming the same worker conversation.

Metadata discovery is not an inference test. Verify one small authorized task through the actual subscription route. Provider URL changes require explicit user-level consent; project content and model output may not redirect the client.

### 11.3 Secret isolation

Initially accept Go credentials through an environment variable or masked terminal input retained in process memory. Do not build a general-purpose secret vault.

- Do not put credentials in arguments, Git, examples, logs, fixtures, screenshots or issues.
- Do not automatically load a target project's `.env`.
- For a bridge, retain the upstream Go key only in the bridge's trusted memory/environment. Give Codex a scoped bridge token, not the upstream key.
- For a direct route, verify how the native shell/tool environment excludes authentication variables. Do not claim complete secret isolation if the runtime requires a key in an environment visible to tools.
- Remove unrelated deployment/GitHub credentials from runtime tool environments. Preserve required OS variables.
- Do not forward authentication headers across redirects to unapproved hosts.
- Never send OpenAI tokens, account headers or opaque internal model state to the Go provider.
- Exclude the user runtime home from Git and package contents.

### 11.4 Quota and usage

Show only usage values actually returned by the provider/runtime. Missing quota or cost data is `unknown`, with a reference to the provider's account console.

Go account-level overflow options may spend a balance beyond the subscription limit. Check the current provider guidance and disclose the account setting; a Hera-side fallback prohibition is not proof of a provider-side hard spending cap. [S03]

Do not hard-code prices or compute currency by default in v0.1. When displaying estimates later, include the dated pricing basis and caveats. Observe `Retry-After` or reset metadata when available. Do not create new sessions to evade rate limits or run unbounded retries.

Only retry an uncertain request when its actual semantics make that retry safe. Never retry through a different provider or model without a new explicit user decision.

---

## 12. Collaboration and write-conflict control

### 12.1 Communication is not locking

Do not assume GPT workers share memory or file changes automatically. Cross-provider workers additionally require proof of message and context compatibility.

Reuse verified native parent/child communication. The main agent is the authority for task contracts and shared interfaces. Do not add a new all-to-all worker chat system, and do not depend on sharing private reasoning across providers.

### 12.2 Initial phase state machine

```text
IDLE
  -> ANALYZE_READ_ONLY
       main: read-only
       workers: up to N native workers, read-only
       outputs: analysis, implementation code, patch and test proposals
       no permission escalation or external side effects
  -> QUIESCING
       verify all children, commands and pending approvals are finished
       verify the workspace baseline has not unexpectedly changed
  -> READY_TO_APPLY
       display proposed changes, tests and risks
       obtain user approval
  -> APPLY_SINGLE_WRITER
       main only: approved workspace-write
       all native subagent creation paths disabled
  -> VERIFY_SINGLE_WRITER
       main only: tests/builds, treated as writes where applicable
       collect actual exit codes and repository differences
  -> COMPLETE or NEEDS_FIX
```

A question may end after read-only analysis. A follow-up fix may stay in single-writer mode or return to analysis only after all work is quiescent.

### 12.3 Enforce, do not merely instruct

- Verify read-only restrictions through actual sandbox behavior, not text in a prompt.
- In analysis, deny filesystem/network privilege expansion and tools with external side effects, including MCP/editor actions outside the filesystem sandbox.
- User-authorized public web research is a narrow exception: use the native MCP client with the bundled keyless Exa HTTPS profile, exposing only `web_search_exa` and `web_fetch_exa` during read-only analysis. Verify the effective profile and connected read-only catalog; reject other servers/tools or widened configuration. Apply/tests must start with this server disabled. Keep native web search and shell network disabled. Do not add an independent search/model loop, forward credentials/private project content, or switch to another billing route on failure. See `docs/web-research.md` for token budgets, external-service limits and observed evidence. A remote read-only annotation is not an OS sandbox guarantee.
- Inspect user/project/managed configuration layers for permission widening. Disable unsupported surfaces instead of claiming they are safe.
- In apply, disable **every** native subagent path supported by the pinned version. Discover the real feature flags and precedence. Do not assume an old `agents.enabled` flag controls a newer collaboration implementation.
- Attempt to spawn a worker in an apply-phase negative test. No child may be created.
- Approval events are not guaranteed pre-execution hooks for every operation. A UI approval policy alone is not a per-file lock.
- Do not expose out-of-sandbox command APIs as a convenience route around the phase policy.

### 12.4 Phase-transition implementation

Choose one tested method:

1. A verified native resume/configuration override updates the required policies while all work is quiescent.
2. Otherwise stop Hera's owned App Server cleanly and resume the same saved native thread in a new owned process with the phase policy fixed at startup.
3. Verify that saved settings or old runtime overrides do not restore permissions or worker spawning.
4. If neither method enforces the policy, block apply and offer an explicitly selected fresh single-agent session. Do not pretend the transition succeeded.

Restarting an owned process and resuming a native thread is not rebuilding the harness. Moving the root conversation to another provider is not part of this transition.

### 12.5 Task and result contracts

These are Hera data contracts carried by native worker instructions/results, not a separate execution framework.

```ts
interface WorkerAssignment {
  taskId: string;
  contractVersion: number;
  contractHash: string;
  goal: string;
  scope: string[];
  sharedInterfaces: string[];
  forbiddenChanges: string[];
  baseline: { gitHead: string | null; relevantFilesHash: string };
  output: 'analysis' | 'patch_proposal' | 'review';
  completionCriteria: string[];
}

interface WorkerResult {
  taskId: string;
  contractHash: string;
  outcome: 'ready' | 'blocked' | 'needs_coordination';
  summary: string;
  filesReferenced: string[];
  proposedChanges: string[];
  interfaceChangeRequests: string[];
  proposedTests: string[];
  testsActuallyRun: Array<{ command: string; exitCode: number | null }>;
  unresolvedRisks: string[];
  patchItemRef?: string;
}
```

- Format validation does not establish factual correctness. Ask for correction through native follow-up at most twice; then report blocked. Do not add a separate LLM "repair" loop.
- Put tests that were not executed in `proposedTests`, not in the actual-results array.
- Refer to large native items instead of duplicating their contents in Hera metadata.
- Shared-interface changes require main-agent coordination and a new contract version/hash.
- Do not auto-apply an output produced against a superseded contract.
- Treat proposed patches and commands as untrusted. Check path traversal, symlink targets, binary changes, scope expansion and secrets before applying through the approved native tools.

### 12.6 Collaboration example

The main agent fixes `InventoryStore.save(input): Promise<void>` as the contract. Worker A proposes persistence code, worker B proposes caller changes, and worker C proposes tests. A worker requests any necessary interface change rather than deciding it unilaterally. The main agent publishes the revised contract and obtains updated proposals. Once all workers have finished, the main agent applies and tests the integrated code.

Workers may read overlapping files. In the analysis phase, none writes the original workspace.

### 12.7 Multiple Hera instances

Acquire an atomic lock directory derived from the canonical workspace path. Initially allow only one active work session per workspace. A second Hera may offer history inspection or report a lock conflict, not silently launch another writer.

Record owner PID, executable identity, start time and a random ownership nonce. Handle PID reuse, permission denial and stale metadata conservatively. Delete a stale lock only after ownership/liveness checks or an explicit recovery decision.

This lock coordinates Hera instances only. It does not prevent an IDE or unrelated process from changing files. Recheck baseline hashes before apply. Never automatically stash, reset, clean or discard existing user changes.

### 12.8 Later worktree extension

Isolated worktrees may support parallel direct implementation in a future version. They are separate checkouts, not a security sandbox or a solution to semantic merge conflicts. Verify shared Git metadata and external side effects separately. [S21]

Do not add a worktree scheduler or automatic cherry-pick engine to v0.1 without scope approval.

---

## 13. OpenCode Go external-worker integration

### 13.1 Verification sequence

```text
A. Recheck official model/endpoint metadata
B. Run one small, authorized Go/DeepSeek coding request
C. Verify direct Responses compatibility
   -> supported: continue
   -> unsupported: evaluate the limited bridge, then continue only if verified
D. Run an independent read-only Codex/DeepSeek turn as a test fixture
E. Spawn a native Go/DeepSeek child from a GPT parent
F. Verify assignment, messages, follow-up, limits, cancel, resume and integration
G. Enable external_workers only when all gates pass
```

The independent turn in D is a **test**, not permission to ship an independent worker-pool architecture.

Distinguish authentication errors, authorization errors, unknown endpoints, unsupported models/protocols, throttling and service errors. A single status code does not prove the whole provider is unusable.

### 13.2 Native role mapping

Compile this intent into the actual custom-agent schema of the pinned runtime:

- Root: explicitly selected GPT with OpenAI authentication.
- Custom role: `hera_external_worker`.
- Child model: verified Go identifier for DeepSeek V4.1 Flash.
- Child provider: a dedicated verified Go or bridge provider configuration.
- Worker permissions: read-only.
- Worker instructions: obey the task contract, request shared changes from the parent, return proposed code/diffs instead of writing them.

Do not mix legacy and current role-discovery formats. Parsing the role configuration is not sufficient: verify effective provider/model and actual egress. Inspect built-in roles, explicit model overrides, defaults and recursive spawns for unwanted routes.

Model self-identification is not routing evidence. Use available effective configuration, captured non-secret request metadata, provider receipts or other verifiable observations. Clearly state when an identifier cannot be independently observed.

### 13.3 Bridge scope

A bridge is optional and manually enabled after necessity and feasibility are demonstrated. It may:

- Validate one request, issue its upstream request, and translate the response/stream.
- Preserve tool-call IDs and conversation identity.
- Represent completed, incomplete, failed and canceled results accurately.
- Preserve verified client/session headers.

It must not execute tools, edit files, plan tasks, recursively call models, spawn workers, compact conversations, maintain a conversation DB, change billing routes, or silently omit unsupported fields.

### 13.4 Bridge security

Bind only to an OS-assigned port on `127.0.0.1`. Create a cryptographically random per-run token. Validate authorization, host/origin where relevant, method, path, size and content type. The upstream Go host/path is fixed by an approved profile, never by a model-generated request URL.

Keep the Go credential separate from the bridge token. Do not forward OpenAI headers upstream. Configure bounded body/connection/header/idle limits and abort support. Close only this instance's listener. Loopback is not protection against arbitrary hostile processes running as the same OS user; document that limitation.

### 13.5 Translation acceptance matrix

| Input/condition | Required behavior |
|---|---|
| Text roles | Preserve instruction semantics through a verified mapping |
| JSON function definitions | Preserve supported schema semantics; reject unsupported forms |
| Function call and result | Preserve name, arguments, result and call-ID pairing |
| Text deltas | Handle UTF-8 boundaries and item indexes correctly |
| Parallel tool calls | Accumulate arguments separately by call/index |
| Normal completion | Emit the exact required completion representation |
| Token-limit termination | Incomplete, not success |
| Upstream error or truncated stream | Failure/unknown outcome, never synthetic success |
| Cancellation | Abort upstream; do not emit a later successful completion |
| Usage | Map only actually returned values |
| Images/audio/native web or computer tools | Unsupported initially; never silently drop |
| Grammar/freeform/custom tools | Reject unless semantics are preserved by a verified mapping |
| Opaque/encrypted reasoning or collaboration items | Do not decrypt, stringify, fabricate or discard; mark route unsupported |
| Prior-response reference without available context | Reject rather than inventing state storage |
| Compaction endpoint dependency | Independently verify; block the route if outside bridge scope |

Generate fixtures from observed, sanitized protocol contracts. This matrix does not define a complete Responses implementation.

### 13.6 Reasoning and collaboration compatibility

Verify Go's treatment of model-specific reasoning fields and tool constraints instead of borrowing assumptions from the direct DeepSeek API.

If the selected native collaboration path depends on opaque provider-specific items:

1. Check whether that pinned runtime officially supports a text-based alternative.
2. If so, select it explicitly and verify it as a separate capability profile.
3. Otherwise record `EXTERNAL_NATIVE_PROTOCOL_UNSUPPORTED` and block external mode.

A plain answer or tool call is not sufficient. Native task payloads, results, follow-up and resume must all work.

### 13.7 Behavior when blocked

Keep external mode visible with the precise state and reason. `hera doctor external` should identify the failed gate, runtime/provider versions and remaining check. Allow the user to select GPT mode, but never start it as an automatic fallback.

A GPT-only prerelease may be produced with the external limitation clearly stated. It does not complete R07 or M5.

---

## 14. Minimal persistence and recovery

### 14.1 Native history is authoritative

Do not clone transcripts or tool traces into a Hera DB. Store only reference metadata and app-specific recovery state.

Illustrative metadata (version text is a placeholder, not a supported release claim):

```json
{
  "schemaVersion": 1,
  "heraSessionId": "local-random-id",
  "codexThreadId": "native-thread-id",
  "codexVersion": "RESOLVED_PINNED_VERSION",
  "mode": "gpt_only",
  "workspaceRealPath": "/Users/example/Projects/sample",
  "phase": "analyze_read_only",
  "lastKnownTurnId": null,
  "status": "idle",
  "configFingerprint": "non-secret-config-hash",
  "capabilityFingerprint": "non-secret-capability-hash",
  "updatedAt": "2026-10-06T00:00:00Z"
}
```

No keys, private reasoning, full code or full model conversations belong here. A stable provider-session mapping may be stored when necessary.

### 14.2 Atomic metadata storage

Serialize writes per metadata file. Write a temporary file, flush as required, then atomically replace in the same directory using tested platform semantics. Preserve the previous file if replacement fails.

Use owner-restricted permissions where available. Do not claim POSIX `chmod` provides equivalent Windows ACL protection. Version migrations must retain backups and reject unsupported downgrades without destroying data.

### 14.3 Resume procedure

1. Validate metadata, workspace identity and supported runtime version.
2. Read the native thread through the official interface.
3. Reconcile app metadata with actual native state.
4. Inspect current changes and prior results before considering an interrupted operation.
5. Resume safely in idle/read-only and present the next action to the user.
6. Do not fabricate missing native history from log fragments.

A timeout after thread/turn creation does not prove nothing happened. Query actual state where possible. Otherwise record `unknown_outcome` instead of resubmitting a potentially writing operation.

### 14.4 Recovery matrix

| Failure | Response |
|---|---|
| TUI rendering failure | Stop input, cancel/clean up and restore terminal |
| Network timeout | Inspect native state; do not replay a writing turn |
| App Server exit | Mark incomplete, inspect resumability and process ownership |
| Sleep or reboot | Do not promise live-process survival; reconcile on resume |
| Shutdown during approval | Do not persist a grant for automatic reapproval |
| Shutdown during phase transition | Recover read-only and verify no old writer remains |
| Corrupt metadata | Preserve it, use a backup/native listing, do not overwrite blindly |
| Bridge failure | Fail/cancel the external turn, no GPT fallback |
| Remote Git push failure | Preserve local commits; reconcile the actual remote before retrying |

Repository setup recovery is specified separately in Section 20. Runtime recovery must not start repository publication as an automatic side effect.

---

## 15. CLI and TUI contract

### 15.1 Commands to implement

These commands describe the new product. They are not claims that Hera is already installed.

| Command | Behavior |
|---|---|
| `hera` | Open the TUI in the current workspace |
| `hera --cwd <path>` | Open the TUI in an explicit workspace |
| `hera --version` | Show Hera and its pinned/verified runtime version |
| `hera init` | User-level configuration, model selection and authentication guidance |
| `hera doctor` | Local toolchain/configuration/protocol readiness; support `--json` |
| `hera doctor external` | Read current external capability evidence, with no paid call by default |
| `hera doctor external --live` | Explicitly authorized, bounded live verification |
| `hera auth login openai` | Official native login |
| `hera auth status` | Non-secret account/key readiness |
| `hera sessions` | Hera session references for the current workspace |
| `hera resume [id]` | Native thread resume through the client |
| `hera config show` | Redacted effective settings and their origins |
| `hera run --prompt-file <file>` | Minimal headless path, read-only by default; fail when new interactive approval is needed |

`hera init` does not create files in a user's game project without approval. In a non-TTY environment, do not force the TUI to start; use or explain the headless path.

### 15.2 Exit codes

| Code | Meaning |
|---:|---|
| 0 | Successful request or normal exit |
| 2 | CLI or configuration error |
| 3 | Authentication/authorization required |
| 4 | Unsupported runtime, capability or provider path |
| 5 | Execution failed or safe completion cannot be established |
| 6 | Workspace lock conflict |
| 130 | User interruption |

Machine-readable errors include `errorCode`, `retryable` and `outcomeKnown`. Keep diagnostics on stderr and machine-readable final results on stdout when running headless.

### 15.3 TUI layout

Illustrative English rendering; the product must also support Korean text/input:

```text
HERA  project: sample  mode: GPT  phase: ANALYZE (read-only)
main: <effective model>  workers: 2/3  backend: Codex <version>
----------------------------------------------------------------
Conversation and activity
  User request
  Agent response
  Tool summary and observed execution state

Workers
  #1 <effective provider/model>  RUNNING  Inspect persistence
  #2 <effective provider/model>  WAITING  Propose tests

No approval pending | Changes not applied | Quota: unknown
----------------------------------------------------------------
> Input
```

Prefer observed effective model/provider data. Otherwise label it "requested model; actual route unverified." Never invent percentage completion, test counts, token usage or remaining balance.

### 15.4 Slash commands

Implement `/help`, `/mode`, `/model`, `/workers`, `/plan`, `/apply`, `/diff`, `/resume`, `/doctor`, and `/quit` as client actions or supported native requests.

- Mode/model changes apply to new sessions.
- `/workers` shows native state and only supported follow-up/cancellation actions.
- `/plan` requests or presents a read-only plan.
- `/apply` enforces the phase-transition gate.
- `/diff` shows actual repository differences, including a genuinely empty result.
- Do not add hidden hosted-API or direct-model execution paths behind convenience commands.

### 15.5 Input and rendering requirements

- Support Korean IME, Unicode paths, multiline input and long paste operations.
- Do not assume input chunks correspond to one character. Test grapheme-aware cursor movement and deletion.
- Bracketed paste/newlines/control sequences must not become accidental submission, slash commands or shell execution.
- Test actual terminal IME behavior rather than assuming composition events are available.
- Provide a reliable multiline-entry option when a modifier shortcut is not portable.
- Distinguish input cancellation, turn cancellation and application exit.
- Collapse auxiliary panels on narrow terminals; keep critical approvals visible.
- Respect `NO_COLOR` and usable monochrome output.
- Batch rendering of rapid deltas and keep bounded buffers; input/cancel remains responsive.
- Sanitize ANSI/OSC sequences from untrusted output, including clipboard and link controls.
- Preserve access to complete final items through native history even when old display buffers are trimmed.

### 15.6 Approval UI

Show the requesting thread/worker, observed model/provider, workspace, action, command/change summary, requested permission scope and grant duration.

Offer only decisions supported by the native request, such as allow once, deny or cancel. Do not attach extra permissions. Disable stale controls once a request resolves. Default focus must not accidentally approve a hidden action when the user presses Enter.

An approval event is a native request to be answered, not proof that Hera intercepts every possible side effect.

---

## 16. Filesystem, shell and platform behavior

### 16.1 Shared rules

Use `node:path` and filesystem APIs for joins, resolution and canonical paths. Do not turn Windows paths into POSIX strings and assume they will work in a shell.

Use validated executables plus argument arrays for internal Git/npm commands. Do not interpolate prompts or filenames into shell command strings. Model-generated commands run through native Codex tools and authorization, not a separate Hera `eval`.

Detect the actual shell environment; do not assume Windows has Bash. Platform command-launch behavior must be verified against Node and installed executables. [S12]

### 16.2 Windows

- This is the development and hands-on/local-test platform. Capture the actual Windows build, architecture, PowerShell edition/version, terminal and herdr version.
- npm's generated command shim is an entry point, not a reason to weaken PowerShell policy globally.
- When a `.ps1` shim is blocked, use the inspected, supported `.cmd` entry point (for example `npm.cmd`, and `codex.cmd`/`hera.cmd` only when actually installed). Do not change execution policy or run as administrator as an automatic workaround.
- Inspect `$LASTEXITCODE` immediately after each native command that must succeed. `$ErrorActionPreference = 'Stop'` alone is not the success check for all native executables.
- Do not paste `export`, `VAR=value command`, `$(...)` Bash assignments, `set -euo pipefail`, backslash line continuations or `command -v` into the PowerShell bootstrap. Use environment assignments, arrays and command discovery appropriate to the installed shell.
- Launch the verified Codex entry point in the appropriate Node/native manner.
- Terminate only owned PID trees; forced termination leaves the outcome unconfirmed until reconciled.
- Test UTF-8, CRLF, drive letters, long paths, spaces, Unicode usernames and junctions.
- When the native sandbox is not ready, show official setup guidance. Never automatically switch to unrestricted access or an elevated administrator process.

### 16.3 macOS

- First target native Apple Silicon Node/Codex. Do not make Rosetta a default prerequisite.
- Test shebangs, executable permissions and the terminal's actual PATH.
- Keep login-shell startup output and secrets out of the protocol channel.
- Label Intel checks as unverified until they actually run.
- Keep these requirements while implementing on Windows. Use the macOS CI path for available automated checks; do not instruct the user to switch development to a Mac. Record unavailable macOS IME/herdr/live-model checks instead of asserting they passed.

### 16.4 Existing editor tools

Leave an extension point for the user's existing Unity/Godot CLI or MCP connectors. Do not recreate them or make them core dependencies.

Editor tools may have effects outside a filesystem sandbox. Disallow those actions during read-only analysis. Do not automatically restart editors, run benchmarks, commit/push a user's target project, or install plugins as part of an ordinary coding task.

The repository publication authorization in Section 20 is for developing **heraAgent itself**, not blanket permission for future Hera sessions to push every project they open.

---

## 17. Test plan

### 17.1 Test levels

| Level | Real model? | Coverage | Default execution |
|---|---|---|---|
| Unit | No | Configuration, state, paths, mappings, redaction | Local Windows and every OS CI run |
| Protocol integration | No | Fake server, bidirectional RPC, order, errors, cancel | Local Windows and every OS CI run |
| Native smoke | No paid inference | Pinned runtime start, schema, initialize | Local Windows and each available target OS CI |
| Package smoke | No paid inference | Clean-prefix tarball installation and launcher | Local Windows and each available target OS CI |
| Live GPT | Yes | Auth, turns, tools, read-only, workers and resume | Explicitly approved, isolated local Windows fixture |
| Live external | Yes | Exact Go route, native child, bridge if used, collaboration | Explicit opt-in on Windows; no credentials in default CI |
| Manual TUI | Optional | Real herdr, IME, paste, resize, approval behavior | Actual Windows terminal now; macOS checks separately not run until observed |
| Repository lifecycle | No model | Local Git and controlled remote publishing logic | Temp local/bare repos; approved real push separately |

A mock suite does not certify live integration. Missing external credentials do not justify skipping offline or packaging tests.

### 17.2 Required test cases

| ID | Scenario | Expected result |
|---|---|---|
| T01 | Unknown settings, invalid model/mode | Clear validation error |
| T02 | Project overrides URL or secret path | Rejected |
| T03 | Runtime/schema mismatch | Unsupported error; no automatic latest install |
| T04 | Split UTF-8/JSON message | Parsed once without corruption |
| T05 | Multiple framed messages in one chunk | All processed correctly |
| T06 | Out-of-order replies and pre-ack events | Correct ID matching; no event loss |
| T07 | Worker approval during streaming | Responsive dispatch; no deadlock |
| T08 | Unknown notification/request | Safe ignore or refusal, never automatic grant |
| T09 | Interleaved tool-call argument deltas | Separate accumulation and correct IDs |
| T10 | Mid-stream truncation | Failed/unknown, not fabricated completion |
| T11 | 401/403/429/5xx | Distinct cause; no silent provider fallback |
| T12 | Process exits after submission but before result | No automatic replay on resume |
| T13 | Two Hera instances in one workspace | Only one active workspace owner |
| T14 | PID reuse, EPERM or stale lock | No blind ownership takeover |
| T15 | Analysis attempts writes through shell/files/MCP | Actually prevented or safety gate fails |
| T16 | Permission escalation during analysis | Denied |
| T17 | N+1 workers or recursive spawns | Real configured bound enforced or gate fails |
| T18 | Spawn requested in apply | No child created |
| T19 | Apply with pending worker/approval | Transition rejected |
| T20 | Old overrides survive phase restart | Detected and blocked |
| T21 | External edit changes baseline | Re-evaluation before apply |
| T22 | Patch traversal or symlink escape | Rejected |
| T23 | Worker claims an unexecuted test passed | No success without native execution evidence |
| T24 | Interrupt acknowledged while command lives | Not shown as fully stopped |
| T25 | Other Codex processes exist | Unaffected by Hera cleanup |
| T26 | Unicode/spaced paths and CRLF | Install/workspace operations pass |
| T27 | Long paste and ANSI/OSC output | No accidental submit, clipboard write or terminal takeover |
| T28 | Non-TTY start | Headless path or clear guidance |
| T29 | Login interrupted or keyring unavailable | No exposed secret or silent storage downgrade |
| T30 | Mode change while active | Deferred new-session switch |
| T31 | Requested Go child actually uses GPT | Drift reported; not counted as external success |
| T32 | Follow-up changes the task contract | Correct task/contract result returns |
| T33 | Unsupported opaque collaboration item | Explicit unsupported state |
| T34 | Wrong bridge token/host/path/redirect | Rejected; credentials not forwarded |
| T35 | Resume a Go conversation | Verified stable session identity |
| T36 | Subscription limit reached | No client fallback; account overflow caveat shown |
| T37 | Install/update/reinstall old tarball | Settings preserved; migrations honored |
| T38 | Package includes secrets/logs/user files | Packaging check fails |
| T39 | Thousands of events/large logs | Bounded memory, responsive input, final results accessible |
| T40 | Existing `hera` executable collision | Detected; no accidental editor-CLI invocation |
| T41 | Bootstrap inside an unrelated parent Git repo | Abort initialization/publication in that location |
| T42 | Wrong origin owner/repository or unexpected push URL | No push and no automatic remote rewrite |
| T43 | Existing nonempty remote | Fetch/reconcile safely; no force push or unrelated-history merge |
| T44 | Existing repo differs only in requested name casing | Report mismatch; do not silently rename remote |
| T45 | Secrets already tracked before adding ignore rules | Publication blocked; ignore file not treated as removal |
| T46 | GitHub auth or Git identity missing | Exact blocker recorded; other work continues |
| T47 | Upload/creation fails partway | Inspect actual remote and local refs before retry |
| T48 | Push reports success but remote SHA differs | Publication verification fails |
| T49 | Local tree contains unrelated user changes | Never stage/discard them or claim a clean tree |
| T50 | Repository exists but cannot be inspected | Treat as access/identity blocker, not empty or absent |
| T51 | Native command fails in a PowerShell bootstrap/test step | Nonzero exit detected; no next destructive step or false success |
| T52 | Windows-produced tarball installed on macOS CI | Correct macOS dependency/launcher resolution; no embedded Windows-only runtime |
| T53 | Windows-only path/case/CRLF assumptions in shared code | Platform fixtures catch errors; macOS workflow remains enabled |
| T54 | Windows tests pass while macOS manual/live checks are absent | Report those Mac checks as not run; never claim equivalent evidence |

Test remote workflow branches with temporary bare repositories and a fake GitHub CLI. Do not create disposable repositories in the user's GitHub account just to run unit tests.

### 17.3 Live fixture

Use a temporary sample repository, not the user's game project. Include a small TypeScript function and a failing test.

1. Read the code under read-only restrictions.
2. Have workers propose implementation and test changes.
3. Change one shared contract and verify a worker's revised response.
4. Confirm every child is quiescent.
5. Apply with the main agent only and observe the actual test exit code.
6. Interrupt and resume; verify the same modification is not repeated.

Record the OS, Node, runtime, provider/model, bridge status, commands, exit codes, observed route and diff scope. Do not commit raw tokens, authentication responses, user code or private model internals as evidence.

### 17.4 Live-call limits

`npm test` is offline. Paid/model tests require explicit opt-in and the appropriate credentials. Show the selected model/provider and bounded test scope first. Give fixtures deadlines and cancellation paths; avoid indefinite paid exploration.

Do not claim a perfect total-call limit when the native harness can make internal retries or compaction calls that the client cannot fully observe.

---

### 17.5 Windows local execution baseline

After M1 has created the referenced scripts and lockfile, run the baseline from the repository root in PowerShell. These are development checks, not commands available in the handoff archive before implementation:

```powershell
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Offline tests failed.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
npm.cmd run package:check
if ($LASTEXITCODE -ne 0) { throw 'Package content checks failed.' }
npm.cmd run package:smoke
if ($LASTEXITCODE -ne 0) { throw 'Windows clean-prefix package smoke failed.' }
```

Inspect the resolved npm launcher first. Do not assume these commands install or invoke an unrelated `hera` from PATH. Native smoke and package smoke must use the pinned runtime and a temporary test-owned home. Only run tasks that the current milestone has implemented; missing scripts must be reported, not replaced by a fabricated pass.

Then perform approved Windows-only live fixtures and actual Windows herdr/terminal interaction checks separately. Ensure the package smoke helper can run unchanged in macOS CI, including clean-prefix entry point resolution. Include evidence categories `windows_local`, `windows_ci`, `macos_ci`, and `macos_manual_or_live` in the human-readable report; keep unperformed checks explicit.

---

## 18. Implementation milestones

### Repository bootstrap B0-B6

Complete Section 20 before substantial product implementation when local tools and authentication permit. Create the local repository, commit the reviewed handoff/scaffold, create the private remote, push, and verify the result. A local-only result must explicitly state the remote blocker.

### M0. Discover and pin actual contracts

Tasks:

1. Inspect the native Windows workspace, Git root, remotes, existing `hera` command, available development tools, OS/CPU and PowerShell/terminal versions. Do not assume a macOS host or require WSL.
2. Resolve a released Codex package version, its license, integrity and OS dependencies. Do not assume the old document's candidate remains current or valid.
3. Pin that runtime locally, generate protocol types/schemas and record hashes.
4. Inspect real authentication, thread/turn/event, sandbox and custom-agent settings, including concurrency and feature precedence.
5. Recheck OpenCode Go model, endpoint and session-header behavior.
6. Resolve compatible exact Node/dependency versions and current CI Action/runner choices.

Deliverables: `docs/compatibility.md`, sanitized toolchain evidence, generated protocol artifacts, and initial ADR/configuration mappings.

Acceptance: offline schema generation and actual initialization are possible without invented fields. Live-only unknowns are separately recorded.

### M1. Package and CLI foundation

Implement strict ESM, build/test scripts, executable entry point, help/version/doctor, configuration validation, paths, redaction, fake server, repository hygiene and initial CI.

Acceptance: clean install/build and `hera --version` work locally on Windows; invalid configuration produces the specified error. Keep Windows/macOS CI enabled and report each result separately. Commit and push this milestone to the verified remote.

### M2. App Server client

Implement the pinned launcher, framed transport, generated protocol adapter, account/model discovery, thread lifecycle, streaming, interruptions, server requests, shutdown and minimal metadata.

Acceptance: protocol edge cases pass. Run a real read-only GPT turn only when authorized and authenticated; otherwise record it as not run.

### M3. GPT-only mode

Implement explicit model selection, effective model/provider display, native worker configuration, concurrency mapping, result inspection and supported follow-up/cancellation.

Acceptance: native GPT worker creation, message exchange, completion and limits are verified. Confirm the mode does not invoke Go. Mock-only completion is not sufficient for a live-support claim.

### M4. Safe collaboration and application

Implement the phase state machine, permission checks, quiescence, spawn disabling, workspace lock, baseline verification, task contracts and evidence-based completion.

Acceptance: negative write/spawn tests pass. Any analysis-phase write or apply-phase worker spawn invalidates the safety gate.

### M5. External-worker mode

Implement Go probing, identity headers, credential boundaries, direct native mapping first, and a limited bridge only when necessary. Verify the actual GPT parent and Go/DeepSeek child across tools, messages, context, cancel, resume and throttling.

Acceptance: G10-G15 pass. Missing credentials or unsupported upstream behavior is a specific blocker. A visible toggle backed by GPT workers is not completion. Continue other milestones when this route is blocked.

### M6. Hera TUI

Implement transcript, composer, status, workers, approvals, model/mode selection, IME/paste/resize/no-color behavior and bounded streaming. Keep the headless controller independent of React components.

Acceptance: actual protocol-driven UI behavior on Windows, not only a mock design. Run the Windows terminal/herdr checks locally. Preserve macOS input/rendering support and record its automated checks separately; mark macOS terminal/live checks not run until actually observed, without blocking unrelated implementation.

### M7. Distribution readiness

Build the tarball, lock/shrinkwrap procedure, package allowlist, checksums, CI package-smoke matrix, install/update/rollback docs and compatibility report. Prepare release materials; publish a release only with explicit approval.

Acceptance: build and test the tarball locally on Windows, then test that exact artifact in the required Windows/macOS CI prefixes without a source checkout. Secrets are absent. Required source commits are pushed and the remote SHA is verified. Missing macOS CI or manual/live evidence must be reported and limits the corresponding release claim; it does not authorize removing macOS support. A blocked external mode remains clearly labeled.

### Milestone evidence

Update `docs/status.md` with code/test changes, commit ID, actual commands and exit codes, live/manual status, blockers, divergences from the design, and next steps. Capture push verification separately. Do not confuse local commits, remote upload, passing CI and published releases.

---

## 19. Package, CI and release process

### 19.1 Package manifest contract

Fill exact dependencies during M0. The following is a manifest design, not a fully installable package by itself.

```json
{
  "name": "hera-agent",
  "version": "0.1.0-alpha.1",
  "private": true,
  "type": "module",
  "license": "UNLICENSED",
  "engines": { "node": ">=24 <25" },
  "os": ["darwin", "win32"],
  "bin": { "hera": "bin/hera.mjs" },
  "files": [
    "bin/", "dist/", "assets/", "README.md", "CHANGELOG.md",
    "SECURITY.md", "THIRD_PARTY_NOTICES.md", "npm-shrinkwrap.json"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:live": "vitest run --config vitest.live.config.ts",
    "protocol:generate": "node scripts/generate-protocol.mjs",
    "package:check": "node scripts/check-package.mjs",
    "package:smoke": "node scripts/smoke-package.mjs",
    "release:prepare": "node scripts/prepare-release.mjs"
  }
}
```

The private npm flag prevents accidental registry publication; it is not an access-control mechanism for GitHub. Set source `rootDir`/`outDir` so `src/cli.ts` actually emits `dist/cli.js`. Use a separate no-emit test configuration. Exclude live tests from the default test config.

`bin/hera.mjs` should be a small shebang entry point importing `main()` from the built output. It must not require source files, `tsx`, or development dependencies on an end-user PC.

The lowercased package name does not rename the Git repository. Do not claim registry ownership. Keep `UNLICENSED` until the owner chooses a project license; retain dependency license/NOTICE obligations. Verify distribution rights before publishing artifacts. [S08]

### 19.2 Package staging

In a clean staging directory, copy the reviewed manifest, source lock inputs and allowlisted built files. Create the consumer lock/shrinkwrap there and verify its correspondence to the source dependency tree. Inspect `npm pack --dry-run`/JSON output and actual archive contents. Exclude auth homes, raw logs, evidence containing secrets, source fixtures with private data, `.git`, and unrelated project files.

Produce the tarball once on the Windows build path (or a designated Windows CI build job), compute its SHA-256, and reuse those exact bytes for both platform checks. Preserve macOS-compatible launchers and optional dependency resolution. The official `npm pack` command is the intended packaging mechanism. [S18]

### 19.3 CI requirements

The implementing agent must produce actual workflows with verified action commits and available runners. Do not copy an unverified Action major or fake SHA into YAML.

- Trigger offline CI on pull requests and pushes to `main`.
- Use least privilege, normally `contents: read`, and avoid persistent checkout credentials in test jobs.
- Retain both required Windows x64 and macOS arm64 targets even though development and local testing take place on Windows. Treat Intel as a separate compatibility target, not a substitute for Apple Silicon.
- Use native PowerShell for Windows workflow glue where needed and cross-platform Node helpers for shared tasks. Do not make Bash, Git Bash, WSL, a Mac development host or remote Hera service a requirement.
- Use macOS CI for its available automated tests, not as evidence of an interactive macOS herdr/IME session. Missing runners/account capacity must be reported without silently removing the target.
- Verify actual runner architecture and account availability rather than inferring them from a label. [S15]
- Resolve and pin the current reviewed checkout/setup-node action commits in M0. Record their upstream versions. [S16, S17]
- Run clean install, production/test typechecks, offline tests, build, package-content validation and package smoke.
- Native smoke uses a temporary isolated Codex home and no production credentials.
- Never provide production secrets to untrusted PR code. Do not use `pull_request_target` to execute arbitrary changes with write privileges.
- Live tests are a separate explicit opt-in path, not the default CI job.
- Note private-repository CI usage/cost conditions rather than promising free execution.
- Do not silently remove a required OS from the matrix to make CI green.

If a workflow is triggered by a push, report it as queued/running/passed/failed based on actual checks. A successful push alone does not prove CI passed.

### 19.4 Release requirements

1. Verify tag and package-version agreement when preparing a release.
2. Run typechecks, tests, build, secret/license checks and archive inspection.
3. Pass **the same built tarball** through clean-prefix installation tests on each required OS. Do not test a different locally rebuilt artifact per OS and call it identical.
4. Test the entry point, runtime launcher, initialize and configuration persistence without the source checkout.
5. Produce checksums, release notes and a feature/platform compatibility report.
6. Prepare files locally. Creating/publishing a GitHub release is a separate gated operation; the source-push authorization is not an automatic release-publication instruction.
7. When authorized, use the verified `OWNER/heraAgent` remote and an accurately labeled draft/prerelease. Grant write permissions only to the publishing job. [S19]

Expected local artifacts:

```text
hera-agent-0.1.0-alpha.1.tgz
SHA256SUMS.txt
release-notes.md
compatibility.json
```

Never assert an artifact is hosted until the remote upload is actually verified. A source repository can be pushed before a product release exists.

### 19.5 End-user installation and rollback

These commands illustrate the workflow after a tarball has actually been built/downloaded.

Windows PowerShell (primary local installation/test path):

```powershell
npm.cmd install -g .\hera-agent-0.1.0-alpha.1.tgz
if ($LASTEXITCODE -ne 0) { throw 'Hera installation failed.' }
hera.cmd --version
if ($LASTEXITCODE -ne 0) { throw 'Hera launcher check failed.' }
hera.cmd init
if ($LASTEXITCODE -ne 0) { throw 'Hera setup did not complete.' }
Set-Location -LiteralPath 'C:\Projects\My Game' -ErrorAction Stop
hera.cmd
```

The Windows path above is illustrative; use a verified existing test/user project path. Inspect command resolution before running the `.cmd` entry point. The product command remains `hera`; `.cmd` is the Windows launcher form for avoiding a blocked PowerShell shim without relaxing execution policy.

macOS (supported end-user target, not the implementation host):

```bash
npm install -g ./hera-agent-0.1.0-alpha.1.tgz
hera --version
hera init
cd /path/to/project
hera
```

Document Node and native-runtime prerequisites. Check for a pre-existing `hera` executable before installation. Avoid automatic `sudo npm` or global permission weakening; recommend a correctly configured user-owned installation path.

Close active Hera processes before updating. Never delete the runtime home during install/uninstall. Roll back by installing a previous tarball while respecting metadata compatibility. Keep an unsupported newer metadata version intact and provide a safe recovery message.

---

## 20. Windows PowerShell bootstrap, local Git and GitHub upload

This section is **required implementation work**, not an optional suggestion. It supersedes the earlier handoff's restriction against creating the remote or pushing source. It does not mean those operations have already been performed.

### 20.1 Authorization, defaults and stop conditions

Authorized for this project:

- Create or safely reuse a local `heraAgent` Git repository in the user-selected workspace.
- Commit reviewed Hera implementation, tests and documentation.
- Create a new **private** `heraAgent` repository under the verified active personal GitHub account when no intended remote exists.
- Add the verified `origin`, push `main`, and push coherent subsequent implementation commits.
- Read resulting remote refs, repository metadata and CI status to verify the upload.

Not authorized by this request:

- Public visibility or changing an existing repository's visibility.
- Guessing an organization owner, granting collaborators access, or changing account-wide Git settings.
- Deleting/renaming an existing remote repository, force-pushing, mirroring refs or overwriting unrelated history.
- Uploading credentials, personal files, runtime homes, user projects or unreviewed existing commits.
- npm registry publication, a new public license grant, or release publication without approval.

Use the active personal account only when its identity is clear and agrees with any explicitly selected existing target. If the user specifies an owner later, that explicit value overrides the default after access is verified. Never infer an account from an old chat or the Windows username.

Missing authentication, missing Git identity, a name collision or a mismatched remote is a **specific blocker**, not permission to guess. Continue implementation where possible and record the remaining manual action precisely.

### 20.2 B0: Select and inspect the workspace

The handoff bundle can be extracted to:

```text
<user-selected-parent>/heraAgent/
├── docs/implementation-spec.md
└── CODEX_START_PROMPT.txt
```

Start Codex from that directory in a native Windows terminal. The archive stores repository-root files directly; do not create `heraAgent/heraAgent/`. Use the directory that already contains `CODEX_START_PROMPT.txt` and `docs/implementation-spec.md`.

Do not hard-code `C:\Users\<name>`, `/Users/<name>`, Desktop, an old project location, or a path from another PC. Respect the selected drive and paths containing spaces or Korean characters. Inspect an existing Git root before any initialization. If the selected path uses a junction or unusual canonical alias, resolve and verify it rather than guessing.

All bootstrap examples below are PowerShell, not Bash. Run them as reviewed steps, not a blind bulk script. Use the actual installed shell, `-LiteralPath` for filesystem paths, argument arrays for multiline native commands, and explicit `$LASTEXITCODE` checks after required native operations. Do not change system execution policy, Git credential helpers or global tool installations to make these examples run.

Before initialization:

```powershell
Get-Location
$PSVersionTable | Select-Object PSEdition, PSVersion, Platform
Get-Command git, node, npm, npm.cmd, codex, codex.cmd, gh, hera, hera.cmd -All -ErrorAction SilentlyContinue |
    Select-Object Name, CommandType, Source

git rev-parse --show-toplevel
$gitRootCheckExitCode = $LASTEXITCODE  # Nonzero is expected for a new non-repository folder.
if ($gitRootCheckExitCode -eq 0) {
    git status --short --branch
    if ($LASTEXITCODE -ne 0) { throw 'Git status failed.' }
    git remote -v
    if ($LASTEXITCODE -ne 0) { throw 'Git remote inspection failed.' }
}

node --version
if ($LASTEXITCODE -ne 0) { throw 'Node version check failed.' }
npm.cmd --version
if ($LASTEXITCODE -ne 0) { throw 'npm version check failed.' }
git --version
if ($LASTEXITCODE -ne 0) { throw 'Git version check failed.' }
```

Inspect the selected Codex entry point and run its `--version` separately: use `codex.cmd --version` only when that is the verified installed launcher; otherwise invoke the inspected native/Node entry point with an argument array. Do not interpret a blocked `.ps1` shim as a need to lower execution policy. Do not create or update the global Codex installation during this handoff.

Run applicable checks individually: Git commands failing in a genuinely new non-repository folder are expected, not a reason to abort every preflight command. Do not run `env`, `printenv`, `Get-ChildItem Env:`, token-display commands, or read credential-store files into the transcript. Collect only the specifically required non-secret metadata.

Decision rules:

| Observed state | Action |
|---|---|
| New `heraAgent` folder, no enclosing repository | Initialize here |
| Existing Git root is exactly the intended `heraAgent` root | Reuse after reviewing changes/history/remotes |
| Git resolves to an unrelated parent directory | Stop repository mutations; choose a proper sibling workspace |
| Folder is a worktree of another project or has an unexpected `.git` file | Inspect and report; do not replace its Git metadata |
| Folder differs only in case or contains unrelated files | Do not rename/delete automatically; resolve the intended location |

### 20.3 B1: Initialize locally and prepare safe tracked files

For a genuinely new directory with no enclosing repository, the intended initialization command is:

```powershell
git init --initial-branch=main
if ($LASTEXITCODE -ne 0) { throw 'Git initialization failed.' }
```

This is a documented Git initialization option. [S07] Do not run branch-forcing commands against an existing repository merely to make it match an example.

Inspect identity without printing secrets:

```powershell
git config --get user.name
git config --get user.email
```

Use an existing valid identity. If missing, ask the user to provide a preferred name/email or configure it explicitly for this repository. Do not fabricate an email, copy a profile detail from memory, change global identity, or automatically publish a personal address.

Create/review `AGENTS.md`, README, this specification, the start prompt, `.gitignore`, `.gitattributes`, and status documentation before the first commit. Suggested initial ignore rules:

```gitignore
node_modules/
dist/
coverage/
.artifacts/
release-staging/
*.tgz
.env
.env.*
!.env.example
.hera/
.codex/
*.log
.DS_Store
Thumbs.db
*.pem
*.key
```

`.env.example` is permitted only with obvious placeholders, never live values. Do not ignore `package-lock.json`, verified generated protocol code, or the specification. Merge with existing ignore rules rather than overwriting them blindly.

Suggested line-ending rules:

```gitattributes
* text=auto
*.sh text eol=lf
*.ps1 text eol=lf
*.cmd text eol=crlf
*.mjs text eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.md text eol=lf
*.json text eol=lf
*.yml text eol=lf
```

Before committing, review both staged and unstaged differences and scan the intended content. An ignore rule does not remove a file already tracked in history. For a reused local repository, inspect all commits about to be uploaded, not only the working tree.

For the new, handoff-only scaffold, an explicit initial staging example is:

```powershell
$initialPaths = @(
    'AGENTS.md', 'README.md', 'READ_ME_FIRST.md', 'CODEX_START_PROMPT.txt',
    '.gitignore', '.gitattributes',
    'docs/implementation-spec.md', 'docs/status.md'
)
git add -- @initialPaths
if ($LASTEXITCODE -ne 0) { throw 'Staging reviewed paths failed.' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Staged diff validation failed.' }
git diff --cached --stat
if ($LASTEXITCODE -ne 0) { throw 'Staged diff inspection failed.' }
```

Stage only files that were created and reviewed. Review the full staged diff locally; do not echo detected secrets into logs. Once the content/secret review passes:

```powershell
git commit -m "docs: add Hera Agent implementation specification"
if ($LASTEXITCODE -ne 0) { throw 'Initial commit failed.' }
```

A documentation-only first commit does not claim the application builds. Later code commits must include their relevant tests and status. Do not use `git add .` indiscriminately in a reused workspace.

### 20.4 B2: Resolve GitHub authentication and exact target

GitHub CLI is a **development dependency** for this publishing workflow, not a requirement on PCs that only run Hera. If missing, document the prerequisite or use a user-approved installation method; do not run an unaudited installer automatically.

Use the GitHub.com account deliberately. The following snippets assume the Windows PowerShell session is in the verified local root:

```powershell
$env:GH_HOST = 'github.com'  # Process-local; do not write a machine-wide setting.
gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication is not ready; use the login step below.' }
$ownerOutput = @(gh api --hostname github.com user --jq '.login')
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the authenticated GitHub account.' }
if ($ownerOutput.Count -ne 1) { throw 'Expected exactly one authenticated login.' }
$GitHubOwner = ([string]$ownerOutput[0]).Trim()
if ([string]::IsNullOrWhiteSpace($GitHubOwner) -or $GitHubOwner -notmatch '^[A-Za-z0-9-]+$') {
    throw 'Authenticated login was empty or invalid; do not guess an owner.'
}
$RepoSlug = "${GitHubOwner}/heraAgent"
Write-Output "Intended GitHub repository: $RepoSlug"
```

`gh api user` resolves the authenticated account without exposing a token. [S04, S05]

If not authenticated, use the official interactive flow on the user's machine:

```powershell
gh auth login --hostname github.com
if ($LASTEXITCODE -ne 0) { throw 'GitHub login did not complete.' }
```

Do not bypass human authentication or log the token. If several accounts are configured, inspect the active one and stop publication on an identity conflict. Respect an explicitly chosen owner. Preserve the user's chosen HTTPS/SSH Git protocol; do not replace existing credential helpers or SSH keys.

Record the selected owner, host, exact name, intended private visibility and local root in `docs/repository-setup.md`. Use values actually observed; never assert a repository URL already exists based only on string concatenation.

### 20.5 B3: Inspect existing local and remote state

Check the local remote list and, when `origin` exists, inspect both its fetch and push URLs. Detect explicit multiple push URLs and `pushurl` overrides; a correct fetch URL alone does not establish a safe push destination.

```powershell
git remote -v
```

If `origin` exists:

```powershell
git remote get-url --all origin
git remote get-url --push --all origin
```

Inspect the intended GitHub repository:

```powershell
$viewArgs = @(
    'repo', 'view', $RepoSlug,
    '--json', 'name,nameWithOwner,url,sshUrl,isPrivate,isEmpty,defaultBranchRef,viewerPermission'
)
gh @viewArgs
$repoViewExitCode = $LASTEXITCODE
# Inspect a nonzero result; it is not permission to assume the repo is absent.
```

A failure to view is **not automatically proof the repository is absent**. Distinguish authentication, network, permission and genuine not-found conditions. An existing private repository may be hidden from an account without access. Attempt creation only after the account/target is settled; a creation name-conflict is a safe blocker, not a reason to delete or rename the existing repository.

Branch by actual state:

| State | Safe behavior |
|---|---|
| No intended remote, no local origin, reviewed local commit | Create private remote using B4 |
| Intended remote exists and is empty | Verify owner/name/visibility/permission, add its returned clone URL, push explicitly |
| Intended remote has compatible existing history | Fetch, inspect ancestry and preserve history; continue only with a fast-forward-compatible plan |
| Existing remote has unrelated history or conflicting content | Stop destructive reconciliation; report the conflict |
| Local origin or push URL points elsewhere | Do not push or rewrite it automatically |
| Existing repository is public or differently cased | Record mismatch; obtain a decision before reuse or mutation |

GitHub may resolve a name case-insensitively. Still verify the returned `name` matches the user's exact **`heraAgent`** spelling. Do not rename an existing remote just to correct case without permission.

### 20.6 B4: Create the new private remote and first push

Use this path only after B0-B3 are satisfied and a reviewed commit exists on the intended `main` branch:

```powershell
$createArgs = @(
    'repo', 'create', $RepoSlug,
    '--private', '--source', '.', '--remote', 'origin',
    '--description', 'Hera: a custom coding-agent CLI/TUI using the Codex harness',
    '--push'
)
gh @createArgs
if ($LASTEXITCODE -ne 0) {
    throw 'Repository creation or first push failed; inspect actual remote state before retrying.'
}
```

These flags are documented by the GitHub CLI. [S06] Do not use `--add-readme`, a remote license template, or a remote `.gitignore` initializer here because local history is already prepared.

For a verified **existing empty** intended remote with no local origin, use its actual returned clone URL rather than guessing. Retrieve the HTTPS or SSH form consistent with the user's configured authentication, then:

```powershell
if ([string]::IsNullOrWhiteSpace($VerifiedCloneUrl)) {
    throw 'No verified clone URL; return to B3.'
}
git remote add origin $VerifiedCloneUrl
if ($LASTEXITCODE -ne 0) { throw 'Adding the verified origin failed.' }
git push --set-upstream origin main
if ($LASTEXITCODE -ne 0) { throw 'First push failed; inspect remote refs before retrying.' }
```

`$VerifiedCloneUrl` must have been assigned from an actual returned and checked URL during B3. It is not an input supplied by model output or an unrelated file. If the user's Git transport requires an additional credential-helper setup, use the official authenticated flow and disclose the change; do not embed a token in the remote URL.

If creation succeeds but push fails, the remote may now exist. Re-read the repository and refs before retrying. Do not blindly repeat creation or discard local commits.

### 20.7 B5: Verify upload rather than assuming success

Verify the repository identity, exact casing, private visibility, branch and permission using `gh repo view`. Ensure the expected default branch is `main` on a newly created repository. If the default differs, correct it only for this newly created project after verifying `main` exists; do not change an unrelated repository's settings.

Then verify the actual refs. The following is a PowerShell verification example for the Windows development host. Run it only after B3 has verified the single intended fetch/push destination and normal tracking refspec. It is not a claim that upload or a Windows test has already occurred:

```powershell
$ErrorActionPreference = 'Stop'

function Invoke-GitChecked {
    param([Parameter(Mandatory = $true)][string[]]$GitArgs)
    $output = @(& git @GitArgs)
    $nativeExitCode = $LASTEXITCODE
    if ($nativeExitCode -ne 0) {
        throw "Git verification command failed with exit code $nativeExitCode."
    }
    return $output
}

$expectedRoot = [IO.Path]::GetFullPath((Get-Location).ProviderPath).TrimEnd([char[]]'\/')
$rootOutput = @(Invoke-GitChecked -GitArgs @('rev-parse', '--show-toplevel'))
if ($rootOutput.Count -ne 1) { throw 'Expected a single Git root.' }
$actualRoot = [IO.Path]::GetFullPath(([string]$rootOutput[0]).Trim()).TrimEnd([char[]]'\/')
if (-not [string]::Equals($actualRoot, $expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The current directory is not the verified Git root; inspect aliases/junctions if applicable.'
}
if ([IO.Path]::GetFileName($expectedRoot) -cne 'heraAgent') {
    throw 'The local folder name must be exactly heraAgent.'
}
$branch = [string](Invoke-GitChecked -GitArgs @('branch', '--show-current'))
if ($branch.Trim() -cne 'main') { throw 'The current branch is not main.' }

$localSha = ([string](Invoke-GitChecked -GitArgs @('rev-parse', 'HEAD'))).Trim()
$remoteRows = @(Invoke-GitChecked -GitArgs @('ls-remote', '--exit-code', 'origin', 'refs/heads/main'))
$mainRows = @($remoteRows | Where-Object { $_ -match '\srefs/heads/main$' })
if ($mainRows.Count -ne 1) { throw 'Expected exactly one remote main reference.' }
$remoteSha = (([string]$mainRows[0]) -split '\s+')[0]
if ([string]::IsNullOrWhiteSpace($remoteSha) -or $localSha -cne $remoteSha) {
    throw 'Local HEAD and remote main differ; do not report upload success.'
}

# B3 must have confirmed the normal origin/main fetch mapping before this step.
Invoke-GitChecked -GitArgs @('fetch', 'origin', 'main') | Out-Host
$fetchedSha = ([string](Invoke-GitChecked -GitArgs @('rev-parse', 'refs/remotes/origin/main'))).Trim()
if ($fetchedSha -cne $remoteSha) {
    throw 'The fetched ref differs; inspect remote changes/refspec before continuing.'
}
Invoke-GitChecked -GitArgs @('branch', '--set-upstream-to=origin/main', 'main') | Out-Host
$upstream = ([string](Invoke-GitChecked -GitArgs @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'))).Trim()
if ($upstream -cne 'origin/main') { throw 'Unexpected upstream.' }

Write-Output "Verified pushed commit: $localSha"
Invoke-GitChecked -GitArgs @('status', '--short', '--branch') | Out-Host
```

`git ls-remote` reads the actual remote reference. [S09] Validate the single intended push destination in B3 before using this check. If the origin's fetch refspec is unusual, inspect it rather than assuming the fetch created a normal `origin/main` tracking ref.

If local/remote SHAs differ, do not report success. If the tree is dirty, list the reason without discarding files. Record:

```text
Local root:
GitHub owner/repository:
Verified URL returned by GitHub:
Visibility:
Branch and upstream:
Local commit SHA:
Remote main SHA:
Working-tree status:
CI status (not created / queued / running / passed / failed):
Blocked actions, if any:
```

Do not commit a document containing the SHA of the commit that contains itself. Record a previously verified SHA as an explicit historical receipt, and report the final current SHA in the implementation session's output.

### 20.8 B6: Ongoing implementation commits and push

For each coherent milestone:

1. Review diffs, preserve unrelated files and update status/evidence.
2. Run applicable checks locally on Windows. Report both OS CI results and macOS evidence gaps separately; do not claim blocked live tests ran.
3. Stage explicit reviewed paths, inspect staged changes and perform a secret/content check.
4. Commit with an accurate message, such as `feat: connect Hera to Codex App Server`.
5. Verify origin and remote history, then push normally to the intended branch.
6. Compare local and remote SHA again and report actual CI status.

Typical non-destructive commands after the review/checks:

```powershell
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
git log --oneline --left-right HEAD...origin/main
if ($LASTEXITCODE -ne 0) { throw 'History inspection failed.' }
# Stop here if divergence or unreviewed changes require reconciliation.
# Run the push only after the preceding review has passed.
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed; reconcile actual refs before retrying.' }
```

A remote change or branch protection may require a branch/PR workflow. Respect the rule; do not disable protection or force-push. Do not merge unrelated histories to make a push work. Resolve overlapping changes before proceeding.

Do not push arbitrary tags. Release tags and published release assets follow Section 19 and their explicit approval boundary.

### 20.9 Recovery and blockers

| Blocker | Required action |
|---|---|
| `gh` unavailable | Record prerequisite; continue local implementation |
| No GitHub login | Run/guide official login; do not fabricate upload success |
| No Git author identity | Request repository-local identity; preserve completed files |
| Repository name already used | Inspect intended owner/history; do not delete it |
| Wrong account/origin/push URL | Stop network mutation until destination is resolved |
| Secret in unpushed history | Stop push; remove safely with appropriate user coordination and rotate if needed |
| Secret already exposed remotely | Stop further publication, notify user, rotate/revoke; do not treat deletion as revocation |
| Push rejected or transport interrupted | Inspect remote refs; retain commits; retry only after reconciliation |
| CI fails | Report the failure, fix relevant code, commit and push; no fabricated green status |
| Protected branch | Follow branch/PR rules, not forced updates |

All of B0-B6 is scoped to the implementation repository. The shipped Hera application must not require GitHub CLI, create its own source repository, or automatically publish a user's projects.

---

## 21. Final acceptance criteria

### 21.1 Repository delivery

- [ ] The local project root is the intended `heraAgent` repository, not an unrelated enclosing repo.
- [ ] The GitHub owner is verified from actual authentication or an explicit user-selected target.
- [ ] The remote name is exactly `heraAgent`, and a newly created remote is private.
- [ ] `origin` fetch/push destinations are verified; no hidden extra push destination is used.
- [ ] Reviewed implementation, tests and English documentation are committed.
- [ ] The intended branch is pushed normally; local HEAD and remote branch SHA match.
- [ ] The upstream is correct and any dirty working-tree files are explained.
- [ ] No secrets, runtime homes, personal files, or unrelated histories were uploaded.
- [ ] Actual repository URL, commit SHA and CI state are reported, or a specific publication blocker is recorded.

### 21.2 GPT functionality

- [ ] Development and hands-on/local testing are performed on native Windows; actual OS, architecture and shell evidence is recorded.
- [ ] The exact release package installs and starts in a clean local Windows prefix and on the required Windows/macOS CI targets.
- [ ] macOS remains a supported product target in source/package/docs/CI; missing macOS manual/live evidence is explicitly reported and does not imply success.
- [ ] Official auth, real model selection, TUI conversation, local reading, approved changes and tests work.
- [ ] Native thread history/resume, interruptions and failures are handled.
- [ ] Worker state, concurrency, messages and the read-only/single-writer phases are verified.
- [ ] No duplicate conversation database, independent model loop or mandatory OpenCode runtime exists.
- [ ] The user's original Codex installation/home, project changes and unrelated processes remain intact.

### 21.3 External-worker support

- [ ] The main agent actually uses OpenAI and the worker actually uses Go/DeepSeek.
- [ ] Provider client/session identity and credential boundaries are preserved.
- [ ] Tools, assignment, follow-up, results, cancellation and resume all work, not just one text answer.
- [ ] Worker proposals integrate through the single main writer and actual tests pass.
- [ ] Errors and uncertain outcomes do not trigger silent fallback or duplicate writes.
- [ ] A bridge, when used, has an explicit supported/unsupported contract and version.
- [ ] Quota, extra balance use, actual routing and observed usage are reported honestly.

### 21.4 Release readiness

- [ ] Source tag/version/checksum agree when a release is prepared.
- [ ] The exact artifact passes clean-prefix installation on the required platforms.
- [ ] Archive content excludes secrets, auth homes, personal logs and user project data.
- [ ] Platform/CPU/Node/Codex/feature verification results and Windows/macOS install/rollback instructions are present.
- [ ] Windows local checks, Windows CI, macOS CI and macOS manual/live checks have distinct evidence; cross-platform release claims do not exceed observed results.
- [ ] Unverified or blocked features are labeled in the README and release materials.
- [ ] Public visibility, licensing, registry publication and release publication have not been inferred from source-push permission.

A GPT-only prerelease is a valid partial deliverable when accurately described. It does not complete R07/M5. A Windows-tested prerelease with pending macOS evidence is also a partial result, not permission to remove macOS support or claim full cross-platform verification. Continue implementation without local Mac hardware, but preserve the unfulfilled platform acceptance items. Full completion requires all mandatory requirements or an explicitly approved scope change.

---

## 22. Forbidden implementation patterns

- Replacing OpenCode Go with direct DeepSeek, Command Code or another billing route.
- Showing an external-mode toggle while silently running GPT workers.
- Inventing fields such as `subagent_provider` in a hosted API or guessing native feature flags.
- Claiming a model default forces every spawn path without testing explicit overrides.
- Confusing a simultaneous worker limit with total task count, always-N creation, or a global account limit.
- Adding SQLite because "agents need a database," or directly changing Codex's private storage.
- Claiming approval UI or `workspace-write` automatically serializes concurrent writers.
- Assuming every tool execution can be intercepted before side effects.
- Turning off one old feature flag while leaving a newer spawn path active.
- Passing, decrypting, fabricating or silently dropping opaque model state to make another provider appear compatible.
- Silently omitting unsupported bridge tool, media or compaction fields.
- Claiming process termination rolled back changes.
- Replaying an uncertain writing turn after a timeout.
- Testing read-only with files alone while leaving external side-effect tools enabled.
- Reporting green CI as real herdr/IME/live-model verification.
- Committing the Windows development PC's keys, runtime homes, user code or raw provider logs.
- Continuing to assume a Mac development host, requiring WSL/Git Bash/Homebrew, or dropping macOS because local tests run on Windows.
- Equating successful Windows local tests with macOS execution, or inventing macOS IME/herdr/live test results.
- Using POSIX-only bootstrap syntax in a PowerShell session or ignoring native nonzero exit codes.
- Requiring a new remote Hera server or a home PC to run the installed product.
- Renaming the requested Git repository to match the lowercase npm package identifier.
- Hard-coding a remembered GitHub username, fabricating an owner, or pushing to an unverified origin.
- Publicly creating the remote merely because the project uses open-source dependencies.
- Repeatedly asking for authorization to perform the already requested private creation/push after the destination and prerequisites are resolved.
- Conversely, treating that source-push authorization as permission to publish a release, disclose user data, or push a different project.
- Force-pushing, mirroring, deleting remotes, changing existing visibility, or merging unrelated histories to make upload succeed.
- Calling the work uploaded before checking the actual remote branch SHA.

---

## 23. Official references and re-verification rules

### 23.1 Entry points carried forward from the earlier English revision

The preceding English handoff recorded these entry points as inspected on 2026-10-06. This Windows-workflow revision carries those notes forward; it does not claim a new web/API verification. The listed scope is deliberately narrow. It does not certify an installed runtime, current account entitlement or live end-to-end behavior. URLs are supplied as code for the implementing agent to reopen.

| ID | Official source | Scope |
|---|---|---|
| S01 | `https://developers.openai.com/codex/app-server` | Client integration, initialization and version-specific schema generation; the site may redirect to its current documentation host |
| S02 | `https://developers.openai.com/codex/config-reference/` | Provider wire protocol; exact native settings must still be matched to the pinned binary |
| S03 | `https://opencode.ai/docs/go/` | Go model endpoint, client/session identity and account/billing integration guidance |
| S04 | `https://cli.github.com/manual/gh_auth_status` | Inspect authentication without displaying tokens |
| S05 | `https://cli.github.com/manual/gh_api` | Resolve the active authenticated GitHub user |
| S06 | `https://cli.github.com/manual/gh_repo_create` | Private repository creation from reviewed local Git source and push flags |
| S07 | `https://git-scm.com/docs/git-init` | Initialize a new local repository and choose its initial branch |
| S08 | `https://docs.npmjs.com/cli/v11/configuring-npm/package-json/` | Lowercase npm naming and package manifest contract |
| S09 | `https://git-scm.com/docs/git-ls-remote` | Read actual remote branch object IDs |
| S10 | `https://cli.github.com/manual/gh_repo_view` | Inspect returned name, owner, URLs, visibility, default branch and permission |

### 23.2 Additional implementation-time references

The following are official verification targets retained for implementation. This revision does not claim each was exhaustively re-read or that a version appearing in an older handoff remains current.

| ID | Official source | Verify during implementation |
|---|---|---|
| S11 | `https://cli.github.com/manual/gh_auth_login` | Interactive authenticated login on the Windows development PC |
| S12 | `https://nodejs.org/docs/latest-v24.x/api/child_process.html` | Native/launcher invocation, Windows behavior and cleanup |
| S13 | `https://docs.npmjs.com/cli/v11/configuring-npm/npm-shrinkwrap-json/` | Consumer dependency locking and platform behavior |
| S14 | `https://developers.openai.com/codex/auth` | Official native auth and credential storage |
| S15 | `https://docs.github.com/en/actions/reference/runners/github-hosted-runners` | Available OS/architecture labels and account constraints |
| S16 | `https://github.com/actions/checkout` | Reviewed supported action version and exact commit |
| S17 | `https://github.com/actions/setup-node` | Reviewed Node setup action version and exact commit |
| S18 | `https://docs.npmjs.com/cli/v11/commands/npm-pack/` | Packaging and archive inspection |
| S19 | `https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository` | Drafts, prereleases, release assets and publication |
| S20 | `https://developers.openai.com/codex/multi-agent` | Native agent configuration, communication and permission behavior |
| S21 | `https://git-scm.com/docs/git-worktree` | Optional later isolated-checkout extension |
| S22 | `https://nodejs.org/en/about/previous-releases` | Runtime support status and exact supported patch selection |
| S23 | `https://github.com/openai/codex/releases` | Actual release/package candidate; do not invent a latest tag |

### 23.3 Evidence hierarchy

- For protocol fields and settings, use generated schemas from the exact installed runtime and the corresponding source version.
- For model access, subscription rules and billing, use the current provider guidance and the actual authorized account.
- A GitHub issue is a report, not proof of current behavior on every version.
- A model's claim about its own identity is not proof of routing.
- Keep documentation inspection, mocked tests, live calls and manual platform checks in separate evidence categories.
- A `pass` requires an observed test result. Missing credentials are a blocker, not permission to synthesize success.
- A remote URL template is not a created repository. Report the URL returned by GitHub only after verification.
- Record actionable differences between this design and the real runtime instead of silently replacing constraints.

---

## Appendix A. Codex implementation start prompt

The text below is identical to the separate `CODEX_START_PROMPT.txt` file in the handoff bundle.

```text
Implement Hera, an independent CLI/TUI coding agent, from this native Windows
workspace using Codex. Perform development and hands-on/local testing on Windows.
Windows AND macOS remain required product targets; this is not a Windows-only app.

Use the installed PowerShell environment, verified Windows executable entry points,
and explicit native exit-code checks. Do not require WSL, Bash, Git Bash, a local
Mac, Homebrew, a remote development server, or a global execution-policy change.
Record actual Windows, CPU, PowerShell, Node, terminal and Codex versions.

Keep Windows/macOS CI and cross-platform source, package and installation support.
Use macOS CI for available automated checks; mark macOS manual/live checks not run
unless actually observed. Lack of local Mac hardware must not stop Windows work or
remove the macOS target. Never claim Mac validation from a Windows or mocked pass.

Read all applicable AGENTS.md files and docs/implementation-spec.md in full before
editing. The specification is the standalone source of requirements; do not rely
on earlier chat messages. Preserve existing files, Git history, user changes,
credentials, and unrelated Codex processes.

The Git repository and new local root must be named exactly heraAgent. The CLI
command is hera. The lowercase npm package identifier is hera-agent; do not change
the Git repository name to match it. Write engineering documentation, maintained
code comments, and implementation notes in English. Keep the product's Korean
input and localization requirements.

First execute the Windows PowerShell repository bootstrap B0-B6 in Section 20,
then M0-M7 in order. Work in this existing heraAgent root; do not create a nested
heraAgent/heraAgent directory.
Creating the local Git repository, making reviewed commits, creating a PRIVATE
GitHub remote, and pushing this project's source are explicitly authorized.
Resolve the active personal GitHub account with official authenticated tools;
do not guess the owner from memory. The target is <verified-owner>/heraAgent.
Before any push, inspect origin's fetch and push URLs, existing remote history,
tracked files and secrets. Preserve unrelated repositories and changes.

For a genuinely new remote, use the documented gh repo create workflow with
--private, --source ., --remote origin, and --push after a reviewed initial commit
exists. Reuse an existing intended remote only after verifying identity and
history. Do not force-push, delete or rename remote repositories, change existing
visibility, merge unrelated histories, or make the project public. Public
visibility, license grants, npm publication and GitHub release publication need
separate approval. Do not repeatedly ask for permission to perform the private
creation/push already authorized here once its target and prerequisites are clear.

Verify the actual remote URL, exact repository casing, branch/upstream, remote
commit SHA and local HEAD after upload. Report actual CI status separately.
If authentication, Git identity or destination conflicts block publication,
record the precise blocker and continue implementation where possible. Never
claim a repository, push, release or CI result exists without checking it.

Use TypeScript, Node.js, React/Ink, and the local Codex App Server. Target native
Windows and macOS installations running in herdr or a normal terminal. Reuse the
existing Codex harness rather than reimplementing its agent loop, conversation
storage, compaction, native tools, or supported worker controls. No Hera SQLite
or duplicate conversation database. Keep the shipped runtime independent of
GitHub CLI and remote repository creation.

Implement gpt_only and external_workers as separate model modes. OpenCode Go is
the required subscription API provider for DeepSeek V4.1 Flash, not a mandatory
OpenCode coding harness. Do not replace it with direct DeepSeek, Command Code,
another provider, or an implicit GPT fallback. Keep the main agent on the user's
selected GPT model. Resolve real model IDs from supported account metadata;
do not invent IDs from the labels Astra or Luna.

In M0, resolve and pin real compatible versions, generate the installed Codex
protocol schemas, and verify native settings instead of inventing fields. Use a
project-local runtime; do not update the global Codex currently implementing this
project. Treat external native-provider compatibility as unverified until task
routing, tools, parent/child messages, limits, cancellation and resume all pass.
If a protocol bridge is needed, keep it a narrowly scoped translator, not a
second agent engine. If native integration cannot work, document the evidence,
block that mode, and continue the GPT path and offline/distribution work.

Separate read-only parallel analysis/code/patch proposals from main-only file
application and testing. Enforce permissions and disable every worker-spawn
path in the apply phase using verified native controls. A prompt, approval UI,
or successful model call is not proof of safety or cooperation.

Keep live-model tests opt-in and bounded. Record missing credentials as blocked;
never substitute mocks for live success. Do not leak secrets into fixtures, logs,
Git history, release packages or tool environments. Do not replay uncertain
writing operations or silently switch billing routes.

At each milestone, run applicable local checks on Windows, make coherent commits,
push reviewed source to the verified remote, update status/evidence, and report
actual tests and exit codes. Separate Windows local, Windows CI, macOS CI and
unperformed macOS manual/live evidence. Deliver
an installable .tgz, Windows/macOS CI, installation/update/rollback instructions,
compatibility results, repository/upload verification and specific remaining
blockers. Prepare release artifacts without publishing a release unless approved.
```

---

**Final design summary:** Hera is a custom local client for an existing coding harness, not a replacement implementation of that harness. Develop and test it locally on native Windows in the exactly named `heraAgent` Git repository, push reviewed source to the verified private remote, and retain Windows/macOS support and separately evidenced release checks. Preserve Codex-owned responsibilities, make model-provider boundaries explicit, and verify safety, routing and recovery rather than asserting them.
