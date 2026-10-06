# Implementation status

## Single-agent application checkpoint (2026-10-06)

`/apply` now builds a native structured proposal, validates text/path/secret boundaries,
and displays all before/after contents, test commands and risks in a paginated review.
Only an explicit approval on the final page grants workspace-write. Escape cancels;
Enter and paste cannot approve. The approved baseline and proposal hash are rechecked.
Hera closes its old server and resumes the same thread with worker paths disabled,
network disabled, no additional writable roots, and no shared-temp write allowance.
It checks exact file contents and unlisted-file changes before test execution, records
native command exit codes, and never retries uncertain writes. After completion,
continue via an explicit read-only resume. This is a workspace sandbox, not a per-file
OS lock. Binary/deletion/credential-path proposals remain unsupported.

Actual native Windows result: `node scripts/live-product-apply.mjs --live` exited 0.
Four main-model turns inspected a disposable fixture, prepared the review without
writing, rejected a stale approval ID, applied the exact approved sum correction,
and ran `node check.cjs` with native exit 0 on the same thread. Worker activity was
not permitted. The first attempt did execute the test successfully but the verifier
did not recognize the native shell display wrapper; it correctly withheld a pass.
The second attempt stopped without changing the file because the model selected
.NET file APIs unavailable under PowerShell ConstrainedLanguage. Native-tool guidance
was corrected and the fresh third fixture passed. No uncertain operation was replayed.

Offline tests cover review paging, paste/Enter rejection, unsafe paths/aliases/binary
content, baseline edits, stale approval, wrong resume sandbox, and native test-command
matching. Final local typecheck/build and 37 offline tests passed. One concurrent
native-resume/offline run hit four test timeouts and an unconfirmed immediate server
shutdown; the lock was retained. A separate offline rerun passed 37/37. A subsequent
no-inference native write-profile check confirmed approval=never, no extra writable
roots and graceful shutdown (exit 0). The retained disposable-fixture lock was not
silently cleared. Full worker phase transitions are still blocked: arbitrary saved child trees,
fork/role model overrides and remaining negative cases need integration and verification.
The existing worker probes are partial evidence, not blanket G02-G04/G14 acceptance.

Prior checkpoint `cef98ba6e35c2986bd4bb17ed46bfeca561416aa` was verified on private remote
main. CI run `37436407759` passed all four Windows/macOS offline and exact-package
installation jobs. This application checkpoint requires its own CI result.
Go live tests remain deferred by the user. Official Go documentation checked again:
console login obtains an API key; no external-client OAuth flow is documented at
https://opencode.ai/docs/go/#how-it-works. Credentials remain outside source and artifacts.
Physical Windows IME/herdr and macOS manual/live checks remain NOT_RUN.

## Current checkpoint (2026-10-06, native Windows live follow-up)

Historical sections below preserve the evidence at each earlier milestone.
OpenAI login is ready; main is gpt-6-astra/high and worker is gpt-6-luna/max.
The saved worker limit is still 3. Official unelevated Windows sandbox setup now
reports ready in a fresh Hera runtime. Credentials remain outside Git.

Observed Windows checks:

- `hera sandbox setup`: exit 0, fresh readiness=ready, no elevation requested.
- Typecheck, build, 32 offline tests and isolated unauthenticated native smoke pass.
- Strengthened live read/resume test: a real native command reads an unpredictable
  fixture marker and the resumed conversation recalls it and the corrected code.
- Native read-only command tests allow reading and deny both overwriting and creating
  fixture files. These are actual sandbox executions, not model assertions.
- Live main interruption starts a real sleep command, interrupts its turn, cleans
  that thread's native background terminals, verifies an empty inventory, and exits 0.
- Native worker probe verifies Luna/max from thread metadata, an actual read/write
  denial, a second spawn rejected with the fixture limit of 1, follow-up and return
  messaging. The saved user limit is not changed. V2 uses subAgentActivity for several
  operations; the pinned native fixture rollout supplies the failed spawn result.
  The test only reads that owned rollout and does not duplicate native persistence.
- Worker recovery reopens the same root and child, starts a new bounded sleep probe,
  interrupts the active worker command and verifies empty native terminal inventory.
- Main-only apply probe resumes the same root with every worker flag disabled,
  denies a write to a disposable sibling directory, fixes a fixture sum function,
  and observes its real test command exit 0. No worker activity occurred in that turn.

Corrections discovered by live testing:

- The initial live smoke reported turn completion even though file reading failed.
  Its first result is NOT file-read evidence. The selected models advertise
  code_mode_only; disabling the native code-mode host removed usable tools. Hera now
  enables the native host and checks actual tool output and unpredictable file content.
- Native turn interruption can precede command cleanup/completion notifications.
  Hera now uses the pinned experimental backgroundTerminals clean/list APIs, waits
  up to two seconds for the empty inventory, and reconciles terminal command records.
  An acknowledgment alone never promotes an unknown outcome to success.
- Initial worker-probe assertions expected V1-style spawn events and failed despite
  real V2 child execution. The corrected verifier passed against the same saved
  fixture without repeating inference. Initial worker-recovery checks also failed
  before bounded cleanup draining and a distinct new cancellation probe were added.

Product worker/apply activation remains blocked while phase policy, approval UI,
child tracking and remaining negative cases are integrated. The probes above are
not blanket G02-G04/G14 acceptance. Go live verification is deferred at the user's
request until a key is ready; the protocol mismatch remains unresolved. Physical
Windows IME/herdr and macOS manual/live checks remain NOT_RUN. The prior source
4873351 CI run 37427962111 passed all four jobs; this change needs its own CI result.

Runnable fixtures: `scripts/native-safety-smoke.mjs`, `scripts/live-smoke.mjs --live`,
`scripts/live-interrupt.mjs --live`, `scripts/live-workers.mjs --live`, and the
worker-recovery/apply probes with the parent ID and disposable cwd from that probe.

## Bootstrap

- B0: native Windows root verified, no enclosing Git repository (git exit 128 expected).
- B1: initialized main, preserved three supplied handoff files; existing Git identity used.
- B2: authenticated GitHub personal account verified as NotNull92 using gh api user.
- B3: no local remotes; authenticated exact target lookup returned GraphQL not-found and REST 404.
- B4/B5: private creation and initial push verified. Historical receipt:
  fbf228d665ede1e20cb26ddce63f7c29f6594fa0 equals remote main; upstream origin/main.
- B6: subsequent milestones must review, test, scan and verify each push.
- No applicable ancestor or existing descendant AGENTS.md files were found before creating root instructions.
- Existing global hera command collision detected; leave it intact.

## Evidence categories

- windows_local: PowerShell 7.6.6; Windows 11 Pro 10.0.26200 x64; Intel i7-12700;
  Node 24.12.0; npm 11.14.1; Git 2.52.0.windows.1; global Codex 0.160.1.
- Terminal/herdr version: unavailable in automation environment; manual checks not run.
- windows_ci: PASS; final source/artifact run 37425015641 (details below).
- macos_ci: PASS; final source/artifact run 37425015641 (details below).
- macos_manual_or_live: MANUAL_NOT_RUN / LIVE_NOT_RUN.
- Live GPT and external model checks: NOT_RUN; isolated account readiness=false and Go key absent.

The attempted codex.cmd version command failed because only codex.exe exists;
the verified native executable returned codex-cli 0.160.1 (exit 0). No global update.

## M0

Exact dependencies installed locally; npm install --ignore-scripts exit 0, audit 0 findings.
node scripts/generate-protocol.mjs exit 0; native-discovery.mjs exit 0;
native version/help/features inspection exit 0. Generated protocol and matching config
schema recorded. Live GPT: BLOCKED_NO_CREDENTIALS in isolated home.
Cross-provider and safety enforcement remain UNVERIFIED. See compatibility.md.

## M1

CLI/package/config foundation implemented with strict NodeNext and exact dependencies.
Windows: typecheck, offline tests (3), build and local --version all exit 0.
First typecheck found TS7 explicit types and generated directory-import requirements;
fixed the generator and config merge, reran successfully. Markdown hard-break whitespace
in the original handoff is preserved via .gitattributes.
Windows/macOS CI added; remote CI results are pending, not assumed passed.
M0 historical verified upload: 567ee2944d5d5fe56f5dd545fbed3eefef1ae7c2.

## M2

Pinned launcher, sanitized child environment, owned-process cleanup, bounded framed
RPC, generated request adapters, native account/catalog/thread/turn methods and atomic
reference metadata implemented. Unknown side-effect requests are surfaced, never granted.
Windows typecheck, offline tests (6), build and native:smoke all exit 0.
Native smoke initialized without credentials/inference; eight catalog entries returned.
Live conversation/resume and tools: BLOCKED_NO_CREDENTIALS; no paid calls made.
M1 verified upload: 0099c888329606ecfc5929699a104d2160e3192d.
CI run 37421528929 completed success (Windows and macOS offline jobs).

## M3 (implementation available; live acceptance blocked)

Explicit catalog model selection, native keyring login, account readiness, read-only
headless sessions, native resume, event streaming and reference-only persistence added.
Native settings map the worker default and concurrency limit; all worker paths remain
disabled until G02-G04 pass. A user must explicitly choose --single-agent; no fallback.
Windows typecheck, 8 offline tests, build, native smoke and doctor: exit 0.
Doctor on the actual Hera profile reported accountReady=false. Model catalog is not
entitlement. Live worker messages, concurrency and resume: BLOCKED_NO_CREDENTIALS.
This does not satisfy M3 live acceptance. M2 upload receipt:
c589315aae192e374596098d07dcb62c91eca36b.

## M4 (safety implementation; live negative gates blocked)

Atomic canonical-workspace ownership locks, conservative stale-lock handling, baseline
hashing, traversal/junction proposal validation, task contracts and fail-closed phase
transitions added. No apply route is enabled without observed native gate evidence.
Effective native multi-agent V1/V2 settings, external-tool configuration and Windows
sandbox readiness are checked before a model turn. Schema content hash is checked.
Interrupted/unknown outcomes retain workspace ownership for explicit recovery.
M3 verified upload: e842bdd21805a8b76253c74b2daf49e6c52afe19.
Windows typecheck, 11 offline tests, build and native smoke exit 0. Unit safety
passes are not live T15-T18 evidence. Live negative gates remain BLOCKED_NO_CREDENTIALS.

## M5 (blocked; diagnostic/probe implemented)

Fixed Go subscription endpoint, identifying session headers, bounded explicit probe,
distinct provider errors and no retries/fallback implemented. Native external mode
remains blocked. Matching Codex schema supports only Responses; Go documents Chat
Completions for the requested model. No speculative bridge or second harness added.
See ADR-002. Go live verification: BLOCKED_NO_CREDENTIALS; mocks are not live results.
M4 upload receipt: 141d39500858eabf1a92a58400859eb115f1461f.
Windows native sandbox readiness returned notConfigured; an additional live execution
blocker. Official sandbox setup is required; no elevation or unrestricted fallback used.

## M6 (TUI implemented; live/IME acceptance incomplete)

React/Ink transcript, status, literal bracketed paste, grapheme editing, reliable multiline
input, Ctrl+S submission, cancellation and slash commands implemented. Core actions stay
outside React. Unsupported apply/external/worker operations show their specific gates.
Windows PTY observation: TUI rendered Korean, /doctor drove the real App Server and /quit
restored terminal and exited 0. Verified that controls embedded in a text chunk do not auto-submit; regression
test added. This automated PTY check is not a physical Korean IME or herdr test.
Physical Windows IME/herdr: MANUAL_NOT_RUN. macOS terminal/live: MANUAL_NOT_RUN / LIVE_NOT_RUN.
M5 upload receipt: b011e5d7bb4b6251033fa7a57a23a6c5ac056ae1.

## M7 (distribution verified; live product acceptance incomplete)

Allowlisted npm tarball, separate consumer shrinkwrap staging, unchanged source lock,
archive secret/path checks, checksums, install/reinstall smoke and Windows/macOS
instructions implemented. CI builds one Windows artifact and installs those identical
bytes on both platforms without source checkout. No npm/GitHub release or tag published.

Windows local: npm ci --ignore-scripts, typecheck, 20 offline tests, build,
native:smoke, release:prepare and package:check exit 0. Initial clean-prefix install,
native initialization, installed .cmd and same-version reinstall preserved settings.
Archive bin mode is 0644 on Windows npm 11.14.1; npm's bin-links sets installed
executable permissions. macOS direct shebang execution passed in final artifact CI.
Prior package inspection deliberately failed on archive mode; no false pass recorded.

Credentials protection: HERA_HOME inside a Git repository is now rejected before
authentication. No real credential content is included in evidence or packages.
M6 verified upload: 74b2f8ba6a33f1accc35cd97b2d06c17b55b6e81;
CI 37422688140 passed Windows/macOS offline jobs. Live model selection/login still pending.

## Distribution follow-up

Windows local expanded suite: 23 tests, typechecks and clean-prefix archive smoke pass.
CI 37424343028: both OS offline/native checks passed; Windows packaging failed because
npm 11.6.2 `shrinkwrap` removed Linux optional-package libc metadata from npm 11.14.1's
reviewed lock. Reproduced locally with project-local npm 11.6.2 (global npm untouched).
The staging helper now renames the exact source lock into the equivalent shrinkwrap
format and verifies deep equality, preserving every reviewed platform/integrity field.
Corrected packaging succeeds under both npm versions; follow-up artifact CI passed.

Additional safety review moved unexpected-worker/external-tool detection into the shared
controller (including headless), tracks unfinished commands, retains unknown outcomes,
preserves repeated shutdown results and cleans up interrupted official login.
An opt-in bounded two-turn read-only/resume fixture is available via test:live -- --live;
it has not run against a model. It does not claim worker/apply or external acceptance.

Final local regression pass: native Windows `npm ci`, typecheck, build, native:smoke
exit 0; latest offline suite 25 tests exit 0. Source/history scanner passes. Production
npm audit: zero findings; 52 production/platform lock entries have integrity and
MIT, Apache-2.0, ISC or (MIT OR CC0-1.0) licenses. No license grant for Hera.
Additional tests cover fake-GitHub wrong-origin rejection, enclosing-repository refusal,
tracked auth-file detection, shared-controller worker drift, repeated uncertain shutdown
and preserving an unrelated test-owned process. These are offline tests, not live gates.
Ctrl+Q is an explicit TUI exit/owned cleanup action, distinct from Ctrl+C interruption.

## Final verified evidence (2026-10-06)

Source commit `fcbdd69cc26a16a4c6ec7786fc539ad24c73cdaf` was pushed and matched
remote main in the private `NotNull92/heraAgent` repository, upstream origin/main.
[CI run 37425015641](https://github.com/NotNull92/heraAgent/actions/runs/37425015641)
completed successfully: Windows x64 and macOS arm64 offline jobs, plus both
installed-package jobs without source checkout. Earlier corrected run 37424674193
also passed all four jobs. The earlier packaging failure above remains recorded.

The single Windows-built `hera-agent-0.1.0-alpha.1.tgz` has SHA-256
`7d0ea3bcb85c1b48afcf2a6a4839b2a22b08f698c4fd7fd78901ca48348c9790`
(560271 bytes, 1827 archive entries). Both installed-package logs report this same
hash, successful install, native initialization, launcher execution and preservation
of settings across reinstall. Windows CI reports 10.0.26100 x64; macOS CI reports
Darwin 24.6.0 arm64; both use Node 24.12.0. These are actual remote observations.

Those exact CI bytes were downloaded and passed the local Windows clean-prefix
install/native/reinstall/launcher smoke and archive check. The local artifact and
SHA256SUMS.txt are under ignored `.artifacts/`; no release or npm package is published.
Local Windows PTY additionally verified literal bracketed `/quit` plus Korean paste,
Escape clearing and Ctrl+Q exit 0 with terminal state restored.

The final readiness query still returned OpenAI ready=false/category=none and
goKeyPresent=false. No credential values were read into test evidence. Authentication
uses Hera's separate OS keyring profile outside Git; repository-local HERA_HOME is
rejected. Tracked paths, staged content and all Git history passed the source pattern
scanner; the allowlisted package passed its separate secret/path checks.

### Remaining work and blockers

- B0-B6 bootstrap and private uploads are verified; full M0-M7 product acceptance is
  **not complete**. Offline and package passes do not establish live safety gates.
- Native parallel-worker orchestration and write/apply activation are unavailable.
  They require remaining implementation and successful G02-G04/G14 and live negative
  safety checks; adding credentials alone does not enable these paths.
- The read-only single-agent live/resume test awaits Hera OpenAI login, explicit main
  and worker model IDs, and official Windows sandbox setup (`notConfigured` observed).
- Go credentials are absent. The requested provider exposes Chat Completions while
  the pinned native provider contract requires Responses; native integration remains
  unresolved (ADR-002). A passing standalone probe would not prove integration.
- Physical Windows Korean IME/herdr tests and macOS manual/live checks remain NOT_RUN.
  No local Mac is required; macOS CI success is reported separately.

## Role settings follow-up (2026-10-06)

Hera account readiness now reports true (ChatGPT); login is no longer a blocker.
The user selected main `gpt-6-astra` / `high`, worker `gpt-6-luna` / `max`.
Both combinations were checked against the authenticated catalog and saved in the
external Hera user configuration. The existing worker limit remains 3.

CLI init now supports --effort and --worker-effort, including default to clear an
override. Older configurations receive a null worker effort without losing settings.
The TUI accepts slash and backslash model/effort commands for each role and a worker
limit command (1-8). Invalid catalog combinations and counts cannot overwrite saved
settings. Literal bracketed paste protection covers both prefixes. Worker settings
map to the pinned runtime's default_subagent_model/default_subagent_reasoning_effort;
these are defaults, not proof that future explicit spawn overrides are constrained.

Windows local: 28 offline tests, typecheck and build passed. Actual pinned-runtime
config/read returned main effort high and worker effort max/model gpt-6-luna, with
worker spawning still disabled. Windows PTY accepted the backslash worker model and
count commands and Ctrl+Q exited cleanly. No inference was performed for these checks.
Windows sandbox setup and live safety gates remain outstanding. New CI results must
be observed separately; the earlier passing artifact predates this settings change.

## Interactive settings menus (2026-10-06)

Bare /model and /effort now open role-aware keyboard selection menus; /workers opens
a project-capped count menu. Up/Down selects, Enter confirms and Escape cancels.
Model selection leads to that model's native-advertised effort options; no role
setting is saved until the effort is confirmed. Catalog validation runs again at
commit time. Effort storage accepts bounded identifiers; the native per-model
catalog, rather than a global enum, decides which identifiers are supported.

Windows local typecheck/build and 29 tests passed, including full Ink keyboard
selection, unsupported ultra exclusion, canceled model switch preserving settings,
stale catalog rejection, project count ceiling and pasted input remaining literal.
Actual Windows PTY with the authenticated pinned runtime displayed Astra's ultra
option, omitted ultra for Luna, saved Astra/high using Enter, canceled Luna's menu
with Escape and exited with Ctrl+Q (exit 0). The user's Astra/high, Luna/max and
worker limit 3 remain unchanged. No model inference or worker execution was claimed.
Prior role-settings CI 37426852347 passed all four Windows/macOS jobs; this menu
change requires its own CI result. Physical IME/macOS manual/live remain NOT_RUN.
