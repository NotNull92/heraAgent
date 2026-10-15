# Implementation status

This file records Hera's current verified state and the evidence that is still in
force. Actual results are kept separate from checks that were NOT_RUN. On
2026-10-14 the superseded checkpoints, receipts, fingerprints and statements that
no longer matched the code were removed. The complete earlier log remains in Git
history (`git show 82f1c9c:docs/status.md`); its commit IDs before `5d3de75` and
its Actions links refer to the private archive repository. Append new dated
sections at the end.

## Current state (2026-10-14)

### Product and runtime

- Project-local Codex runtime pinned at 0.161.0 (`package.json`,
  `src/codex/launcher.ts`); maintained mixed-provider patch source pin
  `979011409de0a60b52f179721948e65531d26144`. Session metadata written by 0.160.1
  stays readable; unknown or future versions are rejected.
- Two modes: HERA Design (`adaptive`, the default for new installations) and
  HERA Development (`external_workers`). GPT Balance (`gpt_only`) is retired:
  every session start throws `MODE_REMOVED`, while legacy configuration and
  session metadata stay readable. There is no automatic migration.
- Native workspace execution: workspace-write with on-request approvals, `/plan`
  read-only, no separate `/apply` step. The worker ceiling is the configured
  `maxConcurrent` (default 3).
- Go credentials live in the OS credential store; `/providers` and
  `hera auth login|status|logout go` manage them.
- Bundled `grilling`, `grill-me` and `handoff` skills are registered through
  native `skills/extraRoots/set`.
- Original source and documentation are Apache-2.0 (owner grant 2026-10-08);
  branding artwork is excluded. Release and npm publication remain unapproved.

### Native qualification (Windows x64)

The newest recorded fingerprints come from the PID reuse correction below
(uncommitted when recorded): adaptive
`161df9bbefba0c3c9bc71d833d278a839a37fabdede814c1f683479b60a6658d`, external_workers
`c90612cd3e002e407c998feee32ca9b8ec52b3cb0c2c2e38a75809750bae4645`. The committed
`82f1c9c` was qualified as `3dbbc36f…` / `ef5239b9…` (Hand-off N). Changing any
module in `FINGERPRINT_SOURCES` (`src/codex/capabilities.ts`), the coding or
research handbook, a bundled skill file, the dependency list or the selected
configuration makes the records stale; re-run
`node scripts/live-native-workflow.mjs --live --record --mode=adaptive` and
`--mode=external_workers`. Reasoning-effort changes do not affect fingerprints.

### Owner decisions in force

- Windows manual acceptance: the user confirmed the herdr resize fix and Korean
  IME behavior on 2026-10-08 (user-confirmed, not agent-observed).
- macOS login, live model and physical terminal checks are deferred until after
  the Windows work. Deferral is not a pass; macOS CI stays in place.
- Several Hera sessions may share one workspace. Simultaneous file-edit conflicts
  are accepted, shared configuration saves are last-writer-wins, and no file-level
  edit locking exists.
- The Design root effort is `low | high | max`; `none` was removed.
- In Design, explicitly invoked bundled skills are conducted by Astra; both modes
  ask in numbered rounds of up to five questions.
- Commands start with `/` only; a leading backslash is ordinary text.
- The pause-label counter restarts per label, not per silent stretch.
- Further TUI decisions are recorded in `docs/ux-guide.md`.

### Open defects

- Observed live (2026-10-14): Go (DeepSeek) workers on Windows cannot pass a
  multi-line patch through Codex's `apply_patch.bat` shim and fall back to ad-hoc
  file writes; DeepSeek has no model-catalog entry, so no native `apply_patch` tool
  is offered (see "Codex overlap probes").

- From code reading, not reproduced: typing `/mode` in full and pressing Enter runs
  `/model`; the prefix filter keeps both entries and selects the first
  (`src/tui/Composer.tsx`). `/mode` followed by a space and Enter runs `/mode`.
- From code reading, not reproduced: recalling a sent command from history reopens
  the command list, which then captures Up/Down.
- The `live-token-efficiency.mjs` `beforeMode` branch and the `live-product-*`,
  `live-worker-approval`, `live-worker-boundaries` and `live-web-research` scripts
  still force `gpt_only` or exercise only the legacy phased path.

### Known limits

- Windows unelevated sandbox: write access to newly created named pipes is
  denied, so runners that spawn children with piped stdio (default `node --test`,
  Vitest forks, `npm test` scripts wrapping them) fail with `spawn EPERM`.
  Development guidance prefers `node --test --test-isolation=none` or Vitest
  `--pool=threads` (Hand-off N).
- `request_user_input` works for the root thread only; workers are told to report
  ambiguity to Hera instead (Hand-off M).
- OpenCode Go usage limits are not readable through the runtime; the footer points
  to the provider console.
- In Design, the root has twice sent `message` together with `items` on its first
  `spawn_agent`, costing one rejected call (about 4 s) before the corrected call.
- A crash during an atomic presence write can leave a `.tmp` file that keeps the
  workspace's presence directory; the PID reuse limits are stated below.

### NOT_RUN (consolidated)

- macOS: every live, manual and physical-terminal check.
- Elevated Windows sandbox setup; pytest (not installed) and Jest in the sandbox.
- Bundled-skills live suites since 2026-10-12 (last passes: adaptive root
  `01a12f6c-d3ec…`, external_workers root `01a12f5d-9721…`), cold-resume interview,
  the temporary-directory handoff approval path and implicit skill selection.
- Physical-terminal checks: footer colors, Shift/Alt+Enter
  reporting, `/style` picker, emoji alignment, pause labels for web, command and
  file-change activity, terminals narrower than 110 columns.
- Live compaction, factual-quality evaluation, the per-thread main/worker token
  split, and live Go worker efforts other than the saved one.
- The README files (three languages) do not mention `/style`.
- Windows/macOS CI and package smoke for the uncommitted working tree.

### Legacy code still in the source (pending owner decision)

Unreachable from `Controller.open`, which always opens the native flow, but still
exercised by tests or legacy live scripts. All of it sits in fingerprinted files
except the TUI parts, so removal requires live re-qualification of both modes.

- The phased apply path: `Controller.requestApply`, `applyApproved`, `cancelApply`,
  `assertThreadIdle`, `testObserver`, the non-native branch of `start()` and the
  legacy `deny()` branch (`src/session/controller.ts`); `src/session/apply-review.ts`;
  the `PhasePolicy` transitions, `baseline`, `validateProposalPath` and the
  assignment/result schemas (`src/session/phase-policy.ts`);
  `NativeWorkers.contractReferences` and `validateResults`
  (`src/session/workers.ts`); `InteractiveSession.approveApply`/`cancelApply`;
  `src/tui/ApplyReview.tsx` and its branch and `COMPLETE` color in
  `src/tui/App.tsx`.
- Retired `gpt_only` branches beyond reading legacy settings: `config-compiler.ts`
  (the worker-model check after `requireActiveMode` can never run), `client.ts`,
  `controller.ts` `verifyRuntime`, `interactive.ts`, `App.tsx`, `prompts.ts`,
  `workers.ts`; CLI `--worker-model`/`--worker-effort` only matter there.
- Small items: unused `startupArgs` import in `controller.ts`; unused `url`
  parameter of `snapshot()` in `src/research/browser.ts`; the test-only
  `nativeBaseInstructions` re-export in `controller.ts`; `GO_EFFORT`
  (`external-runtime.ts`, used only by tests and legacy scripts); the stale
  comment in `config.ts` that Design roots can disable thinking.

### Deferred refactors (Hand-off F)

- R2: shared startup checks, approval ownership and the legacy client/event
  lifecycle make a controller facade split riskier than a pure move; avoid a
  large mutable context object.
- R6: preserve snapshot publication before routing checks, interruption with
  `checkRouting=false`, unmaterialized state and full inventory limits.
- R7: formatting and cached wrapping now live in `tui/transcript.tsx` as required
  by the scrollable viewport. Scroll/window state remains in `App.tsx`; further
  extraction is deferred. The `KEPT_LINES` trimming boundary test in
  `tests/tui.test.tsx` covers the limit, three over, and a trimmed fence opener.

## Evidence records

### Repository publication and history rewrite (2026-10-08)

Reviewed 1,186 tracked files and 1,528 historical blob versions across 51 commits.
The source scanner and Gitleaks 8.30.1 full-history scan passed, as did Gitleaks
on 46 downloaded Actions logs and 25 downloaded artifacts. Five large native
binary artifacts were not downloaded or scanned; their workflows were reviewed,
which is not a binary-content audit. No claim of exhaustive detection is made.

The only personal email was in the author/committer metadata of all 51 commits.
With explicit approval it was replaced by the GitHub noreply address; every tree
and message was verified unchanged. The original bundle and scan reports remain in
ignored `.artifacts/public-audit/`. The sanitized tip is
`5d3de75fc92ba1eb62ce6ccd3e3d61a005eab0d4`. With separate approval, the original
repository (ID 1406773417) was renamed to `NotNull92/heraAgent-private-archive`
and kept private; a new `NotNull92/heraAgent` (ID 1409659092) received only the
sanitized `main`, the old tip was verified unavailable there (HTTP 422), and only
the new repository was made public. The five unscanned artifacts stay private.

### Codex 0.161.0 upgrade: migration checksums (2026-10-08)

All 73 official Windows migration checksums use CRLF while the source checkout
embedded LF, so a patched runtime built from source failed existing-profile
startup after an official round trip. Qualification now matches source migration
bytes to the official platform binary before compiling
(`scripts/qualify-native-patch.mjs`). The rebuilt runtime passed the
official/patched/official round trip without reading, rewriting or resetting any
user database. Installed Windows binary SHA-256 at that time:
`2d9e485bf99ca1915a1def917b1301e99cdbc2e9ed1ef7c71abdc3fee1c7f260`.

### OS credential storage (2026-10-06)

Windows uses CredReadW/CredWriteW/CredDeleteW (`assets/auth/go-credential.ps1`);
macOS uses `/usr/bin/security` and the login Keychain. Secrets pass through pipes,
never command arguments, project files or conversation text. Storage is keyed to
the canonical Hera home; there is no plaintext fallback. The helper timeout is 60
seconds because the first Windows CI run exceeded 15 seconds. `hera auth login go`
takes masked input, `--from-env` imports an existing process key. Present
credentials are not a claim of valid entitlement. References:
https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew
and https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/macOS/security.1.

### Usage and Go effort probes (2026-10-07 and 2026-10-08)

- `account/rateLimits/read` on the authenticated runtime returned one `codex`
  bucket with a single 10,080-minute window. On a Go-configured runtime it failed
  with RPC -32600, and `account/rateLimits/updated` carried null windows during Go
  turns. Token usage is observable per thread (`thread/tokenUsage/updated`, one
  sample: 7,122 total, 6,784 cached input), Go limits are not.
- Twenty direct `/responses` requests to the Go route (`deepseek-v4.1-flash`, no
  retries, not through the native runtime): `none` through `max` were accepted,
  an invalid value returned 422. `none` produced 0 reasoning tokens and a wrong
  answer to a simple sum; `minimal` through `high` were indistinguishable
  (46-60 tokens on an easy sum, 225-242 on a mid-difficulty question); `max` gave
  278 and 300 (two samples, not conclusive).

### Voice styles (2026-10-08)

`/style` lists Markdown voices in `<Hera home>/output-styles/` plus "own voice" and
writes the chosen one into the isolated runtime's `AGENTS.md` between `hera-style`
markers, wrapped by two Hera-owned lines (human-facing replies in the user's
language, plain-text worker reports; English labels are placeholders). The
wrapper exists because a leading line alone still produced "TL;DR" and "Your
move". No voice text is bundled: the upstream files are AGPL-3.0 and stay in the
user's home. Single live samples showed workers read the voice (a `thread_spawn`
worker record contained it).

### Startup and reply latency (2026-10-08)

Startup now shares in-flight account/model discovery, credential reads, schema,
qualification and runtime-integrity checks within one attempt and prepares the
native session before Ready. Three fresh startups took 6,441 / 6,472 / 6,211 ms
(previously about 13.5 s), each with one discovery process. A DeepSeek greeting
measured 3.5 s from Enter to first character (Hera checks 0.3 s, turn preparation
1.0 s, gateway headers 1.4 s, first token 0.4 s, reasoning 0.2 s). The status line
names the root's current pause from root-thread native events
(`src/session/interactive.ts` `observe`, `src/tui/App.tsx` `Activity`). These are
single-machine samples, not a provider benchmark.

### Research handbook inlined for Design (2026-10-12)

Each adaptive native session start reads the packaged
`assets/codex/research-instructions.md` and appends it to the developer
instructions; no coding handbook is inlined and `load_instructions` stays for
workers and rereads. Live fixtures check the handbook is present in the rollout's
developer message. Samples at the time: greetings 2.6-2.8 s to first text, the
sync-design request announced Astra at 1.7 s and completed in 33.6 s. Inlining
guarantees delivery of the text, not model behavior.

### New build notice (2026-10-12)

`InteractiveSession` remembers the installed `dist/cli.js` mtime and checks it
before each accepted submission; a change prints one restart notice ("새 빌드가
감지되었습니다. 종료 후 다시 시작하면 반영됩니다.") and input proceeds. A psmux
terminal check confirmed one notice after a rebuild. `interactive.ts` is not a
fingerprint input.

### Empty child rollout retry (Hand-off C, 2026-10-12)

Owner-supplied incident: Design ended with `RPC_-32603` ("rollout is empty")
because `NativeWorkers.refresh()` read a just-spawned Astra child inside the
roughly 200 ms window between rollout creation (zero bytes) and its first
`session_meta` line, leaving the session `unknown_outcome`. `refresh()` now
retries only empty-rollout errors, five attempts 200 ms apart, for both full and
metadata reads; exhaustion rethrows the first matching error and other errors are
rethrown at once. The race was injected in unit tests, not reproduced live.

### Bundled skills (2026-10-12)

The three skills ship under `assets/skills` with the upstream MIT license and
attribution in `THIRD_PARTY_NOTICES.md`. `/grilling`, `/grill-me`, `/handoff` and
the `$` forms attach native skill items with fixed packaged paths; grill-me also
attaches grilling. Packaged grill-me and handoff require explicit invocation;
user-installed skills keep their own policies. Enter on a skill completion fills
the command and a space without sending (Hand-off D). In Design the root
announces Astra, assigns one `hera_astra` child with `fork_context=false` and
items only, relays its text verbatim and reuses it through `send_input`; handoff
documents are shown as commentary before the root writes them (Hand-off E).
Observed adaptive first rounds took about 26-29 s and handoffs 65-106 s; one run
exceeded the 180 s handoff bound while waiting for Astra. The pinned runtime
supports skill items in both `spawn_agent` and `send_input`.
`scripts/bundled-skill-evidence.mjs` accepts exactly one prior rejection with the
pinned message "Provide either message or items, but not both" before one
successful creation (Hand-off G). One adaptive run in the same session failed at an
assertion whose message was truncated; it remains unidentified.

### Engineering discipline (2026-10-12 and 2026-10-13)

Development developer instructions carry an engineering-discipline block (state
assumptions, ask through `request_user_input` only when interpretations would
materially change the work, point out simpler approaches, limit edits, reproduce
bugs with a failing test first, pair plan steps with verification) and pass it to
fresh workers. Design only extends its decision brief with assumptions and a
simpler alternative. The guidance paraphrases the four principles of
[the Karpathy-inspired guidelines](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md);
no sentence was copied, so `THIRD_PARTY_NOTICES.md` is unchanged.
`scripts/live-engineering-discipline.mjs` uses an in-process `node:assert` test;
it passed live on 2026-10-13 (Hand-off I) and again during Hand-off M.

### Concurrent workspace sessions (Hand-off L, 2026-10-13)

Exclusive workspace locks, nonce takeover, `WORKSPACE_LOCKED` and
`LOCK_OWNERSHIP_CHANGED` were removed. `acquireWorkspace` writes one
`<pid>.json` presence file per process under the canonical workspace hash;
interactive sessions print one warning when other live sessions exist (headless
output gains none). Dead records and legacy `owner.json` files are cleaned;
release removes only the caller's record and the directory when empty. A
duplicate resume of a saved session raises `SESSION_IN_USE` (exit 6). One process
reuses its record across successive sessions, which is safe because
`newSession()` awaits the previous close. Review fix (2026-10-13): on Windows a
record cannot be replaced while another process reads it, so writes retry
ENOENT/EPERM/EBUSY/EACCES up to five times with 50 ms × attempt back-off, and an
unreadable record takes its pid from the file name so a live session's record is
not deleted. A PTY check with two real CLI processes passed; a physical
desktop-terminal check is NOT_RUN.

### Script fixture cleanup (Hand-off K, 2026-10-13)

`scripts/temp-fixture.mjs` removes registered temporary directories on exit code 0
(five retries) and keeps them on failure or interruption; removal errors print
one escaped stderr line and do not change the exit code. `live-worker-boundaries.mjs`
and `live-workers.mjs` keep `mkdtemp` because later `--cwd` invocations need their
directories. `prepare-release.mjs` removes only its own `release-staging/pack-*`
directory after success.

### Native model questions (Hand-off M, 2026-10-13)

`features.default_mode_request_user_input` is enabled; the pinned 0.161.0 source
adds Default mode to the tool's available modes when it is on (the feature is
UnderDevelopment and off by default). Root requests reach Controller's pending
queue and `NativePrompt`. Children inherit the tool, but the native handler
rejects non-root threads with "request_user_input can only be used by the root
thread" before any App Server request, and the role feature allowlist cannot
disable it per child; the worker instructions forbid user questions. The schema
allows one to three questions with two or three options plus free-text Other.
Escape in a free-text answer cancels the whole request with `{}`; headless runs
answer `{answers:{}}`, and the live probe confirmed the model then states an
assumption and completes without re-asking.

### Windows sandbox test runners (Hand-off N, 2026-10-13)

Reproduced without inference through the project-local launcher and
`codex sandbox`, with the owner's isolated configuration at
`windows.sandbox = "unelevated"` (unchanged). Host: Windows 10.0.26200 x64,
PowerShell 7.6.6, Node v24.12.0, Vitest 5.0.3.

| Case | Exit | Observed result |
| --- | ---: | --- |
| Node `spawnSync(process.execPath, ['-v'])`, default pipes | 1* | EPERM, errno -4048; child status null |
| Same with `stdio: 'inherit'` or `'ignore'` | 0 | Child runs normally |
| `node --test tests/x.test.cjs` | 1 | spawn EPERM in the test runner; no assertion runs |
| `node --test --test-isolation=none tests/x.test.cjs` | 0 | Assertion runs and passes |
| `cmd /d /c node -v` | 0 | v24.12.0 |
| `npm test` wrapping `node --test` | 1 | node:test hits spawn EPERM |
| `npx --no-install vitest run` | 1 | Forks worker fails with spawn EPERM |
| Vitest `--pool=threads` (direct or through npx) | 0 | Test passes |
| `python -m pytest` | NOT_RUN | pytest not installed |

*`spawnSync` returns the error; the minimal wrapper maps it to exit 1.

Outcomes were identical with Hera defaults, TEMP/TMP redirected to a writable
directory, that directory added to `writable_roots`, and
`shell_environment_policy.inherit=all`. A separate C# Win32 probe run inside the
sandbox showed `CreateNamedPipe` succeeds and `CreateFile` with `GENERIC_READ`
succeeds, while `GENERIC_WRITE`, `READ|WRITE` and `READ|WRITE|WRITE_DAC` return
error 5; outside the sandbox all four succeed. Node's libuv creates pipe pairs
whose client ends need write access before `CreateProcessW`, hence spawn EPERM.
The responsible ACE was not instrumented. The elevated setup mode provisions
dedicated accounts and host state and is NOT_RUN. The mitigation is one
Development sentence preferring in-process runners; it is guidance, not a runtime
repair. `scripts/live-native-test-runner.mjs` passed live once: the model chose
`node --test --test-isolation=none` unprompted, reproduced the failure before the
edit and passed afterwards with no approvals, questions or workers.

### PID reuse notice correction (2026-10-14)

The workspace presence scan now compares process identity after a successful PID
liveness check. Windows uses the system PowerShell's OS start time and executable;
macOS uses `/bin/ps` start time with a fixed locale/time zone. New records use OS
start time when available. Both new-session notices and duplicate saved-session
checks share this logic. Identity lookup is bounded to three seconds; a failed,
denied or malformed lookup retains live records conservatively. No dependencies,
process termination, file locks or conversation migrations were added. The new
helper is included in capability fingerprints.

The two-second tolerance accommodates older uptime-derived records and macOS
second precision. Same-executable PID reuse inside that tolerance, or unavailable
OS identity, can still cause a conservative false notice/refusal. macOS does not
compare `ps comm`, which represents mutable argv[0], rather than stable executable
identity ([Apple ps source](https://github.com/apple-oss-distributions/adv_cmds/blob/main/ps/print.c)).

Observed Windows local results (Windows 10.0.26200 x64, Node 24.12.0,
PowerShell 7.6.6, project-pinned Codex 0.161.0):

- Typecheck, full offline suite (188 tests / 30 files), build and diff whitespace
  check: PASS, exit 0. Coverage includes real child-process coexistence, stale
  start/executable cleanup, saved-session resume, lookup failures, `EPERM`, and
  Windows/macOS query parsing (the macOS query tests are mocked on Windows).
- Built-code check against the affected workspace: PASS, exit 0. Only the stale
  presence for PID 19732 was removed; live Hera PID 32668's record was byte-for-byte
  preserved, and only that live PID was returned. No process was stopped.
- With explicit user approval, `node scripts/live-native-workflow.mjs --live
  --record --mode=adaptive` and the corresponding `--mode=external_workers` run:
  PASS, exit 0. Both passed conversation, edit/test, cold resume, routing,
  approval, cancellation and concurrency, and recorded fresh verification.
  Native root threads: `01a13875-68d5-7342-9e9b-6808dd8e82de` (adaptive) and
  `01a13877-a013-7020-80d0-a271fef1f02d` (external_workers).
  Fingerprints: `161df9bbefba0c3c9bc71d833d278a839a37fabdede814c1f683479b60a6658d`
  and `c90612cd3e002e407c998feee32ca9b8ec52b3cb0c2c2e38a75809750bae4645`, respectively.
- Windows/macOS CI, macOS live/manual, physical terminal and package smoke:
  NOT_RUN for this correction. Both CI targets remain intact.

Restart existing Hera windows after qualification to load the corrected build;
the prior warning already printed in a transcript is not retracted. No commit,
push, release or npm publication has been performed for this correction.

### Status cleanup and non-fingerprinted dead code (2026-10-14)

Rewrote this file from 3,411 lines to the current state plus the evidence still in
force, after a section-by-section comparison with the working tree. Removed
superseded receipts and fingerprints, and statements that contradicted the code:
the `\providers` alias and backslash command prefix, the exclusive workspace lock,
"no license grant", GPT-only qualification, `none` Design effort, one-question
grilling rounds, and the claim that Development has no `request_user_input`.

Removed dead code outside the fingerprint inputs: `scripts/live-smoke.mjs` and
`scripts/live-interrupt.mjs` with the `test:live` npm script (both forced the
retired `gpt_only` mode and failed with `MODE_REMOVED` at `Controller.open`); the
four prompt fixtures no test reads (`native-prompts-9389a17`, `-hand-off-g-`,
`-hand-off-h-`, `-hand-off-m-`; only the Hand-off N fixture is used); the unused
`VERSION` re-export in `src/cli.ts`; unused default `React` imports in four TUI
components (`jsx: react-jsx`).

Observed Windows results: `npm.cmd run typecheck` PASS, exit 0; `npm.cmd test`
PASS, 188 tests across 30 files, exit 0. No fingerprint input changed, so no
live suite was run. The legacy code listed under "Current state" remains pending
an owner decision. NOT_RUN: CI, package checks, macOS.

### Native question picker key guide (2026-10-14)

Per the owner decision, native question option lists now show the same position
counter and Korean/English key guide as other pickers. Removed the unused
`showKeys` prop; free-text answers still show no key guide. Updated the UX guide
and existing Korean/English question tests. Preserved the prior import cleanup.

Observed Windows local results: `npm.cmd run typecheck`, `npm.cmd test` (188 tests
across 30 files, including the new guide assertions), `git diff --check` and
`npm.cmd run build`: PASS, exit 0. No fingerprint input changed in this update;
live re-qualification was not required. NOT_RUN: Windows/macOS CI, macOS checks
and package smoke. No staging, commit or push.

Follow-up real-terminal check (Claude, Windows, psmux): a scratch script rendered
the built `dist/tui/NativePrompt.js` with a fixture request of one option question
and one free-text question; no model call. Korean and English option lists showed
`1/4 · ↑↓ 이동 · Enter 선택 · Esc 취소` / `1/4 · ↑↓ move · Enter select · Esc cancel`,
and Down moved the counter to `2/4`. `직접 입력` / `Type an answer` and the free-text
question showed the input panel with no key guide. Typed `/help` and `note` returned
`{"scope":{"answers":["/help"]},"note":{"answers":["note"]}}` in both languages,
and Escape returned `{}`.

Live check with owner go-ahead (Claude, Windows, psmux, 110×40): `bin/hera.mjs`
in an empty scratch workspace, switched with `/mode` to HERA 개발 (gpt-6-astra
high), one prompt asking for a format question before creating a greeting file
and to only echo the answer. The root issued `request_user_input`. The picker
showed the model's question with `txt`/`md`, `직접 입력`, `취소` and
`1/4 · ↑↓ 이동 · Enter 선택 · Esc 취소`; Down showed `2/4`. Choosing `md` resumed the
turn and the reply was `md`; no file was created. Defect found: the raw request
JSON is printed above the picker (see "Open defects"). The mode was switched back
to HERA 설계 and `~/.hera/config.json` was byte-identical to its pre-run copy.

### Native question request summary suppression (2026-10-14)

The interactive request listener still tracks every shown request ID but appends
the summary only for approvals. Ordinary and secret questions now rely on the
picker instead of printing raw request JSON. Approval action details remain
unchanged. Updated the UX guide and removed the resolved raw-JSON open defect.

Observed Windows local results: `npm.cmd run typecheck`, `npm.cmd test` (189 tests
across 30 files), `git diff --check` and `npm.cmd run build`: PASS, exit 0. The new
fake-controller test covers ordinary/secret question suppression and approval
summary display without duplicates. The initial typecheck caught an empty-array
fixture type; explicitly typing that array resolved it, and the recheck passed.
Confirmed `interactive.ts` is excluded from `FINGERPRINT_SOURCES`; `controller.ts`,
its 32 KiB summary limit and `tests/native-prompt.test.tsx` were not changed.
No live re-qualification required. NOT_RUN: Windows/macOS CI, macOS checks and
package smoke. No staging, commit or push.

Live re-check with owner go-ahead (Claude, Windows, psmux, same procedure as the
key-guide live check): after `You:` and an empty `Hera:` line the picker opened
directly with the model's question, `txt (권장)`/`md`, `직접 입력`, `취소` and
`1/4 · ↑↓ 이동 · Enter 선택 · Esc 취소`; no request JSON was printed. `직접 입력`
showed the question above the input panel with no key guide; typing `rst` resumed
the turn and the reply was `Hera: rst`. No file was created; the mode was restored
to HERA 설계 and `~/.hera/config.json` was byte-identical to its pre-run copy.

### Transcript KEPT_LINES boundary prerequisite (2026-10-14)

Exported the existing `KEPT_LINES=2000` constant; no production behavior changed.
Added "keeps the KEPT_LINES blanking boundary on resize" in `tests/tui.test.tsx`
with three cases: exactly 2,000 finished lines, three over the limit, and a code
fence whose opener is blanked. Assertions inspect frames after the terminal wipe,
cover the kept markers, literal fenced text, emphasized text after the closing
fence and an unfinished tail. R7 itself remains deferred.

With the owner's approval, the overflow case adds 2,000 lines in one batch, waits
for their first print, then adds three more: a single oversized batch blanks its
oldest lines before they are initially printed. This permits verifying both the
earlier output and its absence after resize. No fixed sleeps or limit overrides
were added. Targeted Windows case timings: 470 ms, 349 ms and 465 ms, respectively
(all below the approximately three-second concern).

Observed Windows local results: `npm.cmd run typecheck`, `npm.cmd run build` and
`git diff --check`: PASS, exit 0. Three consecutive full `npm.cmd test` runs each
passed 192 tests across 30 files (17.20 s, 17.14 s, 17.00 s), exit 0; no flake
observed. No fingerprint input changed; no live re-qualification required.
NOT_RUN: real-terminal/manual and live checks, Windows/macOS CI, macOS checks and
package smoke. No staging, commit or push.

### Codex overlap probes (2026-10-14)

An audit compared Hera code with what the pinned Codex 0.161.0 App Server
provides. Three of its claims depended on unverified runtime behavior; Claude
probed them on Windows with owner go-ahead using scratch scripts (not in the
repository), the built `dist/` code and an empty scratch workspace. No source
file or `~/.hera/config.json` was changed; each probe session wrote one Hera
metadata record for the scratch workspace.

- Managed requirements from `CODEX_HOME` (no model call): an app server launched
  through Hera's `launch()` with a temporary Hera home returned
  `configRequirements/read` → `requirements: null` both without and with
  `<home>/codex/requirements.toml` (`allowed_web_search_modes`,
  `allowed_sandbox_modes`, `[features]`); a `-c web_search="live"` override was
  still accepted. The binary names `%ProgramData%\OpenAI\Codex\requirements.toml`
  as the Windows location. Result: requirements are machine-wide, not per
  `CODEX_HOME`, so Hera keeps its `verifyRuntime` post-start checks.
- Go worker reading a skill (Development, gpt-6-astra root, `hera_go`
  deepseek-v4.1-flash worker): a probe skill in an extra root outside the
  workspace was added with `skills/extraRoots/set`. The worker's developer
  context listed it with a skill-roots table giving absolute paths (`r0`
  `~/.agents/skills`, `r1` `~/.hera/codex/skills/.system`, `r2` Hera
  `assets/skills`, `r3` the probe root). The worker read the `SKILL.md` with
  `Get-Content` under the native sandbox (exit 0) and returned the codeword
  `AMBER-FALCON-7731`; the root relayed it. Caveat: the root's spawn message
  included the absolute skill path. A stricter rerun forbidding added paths failed
  twice before any worker spawned with `429 Too Many Requests` (OpenAI), after a
  first attempt failed with "Selected model is at capacity". A later strict rerun
  passed: the root's `spawn_agent` message was exactly the task sentence, and its
  follow-up `send_input` carried only the standard Hera worker rules. The probe
  root appeared in the worker's context only in Codex's skill-roots table. The
  worker (`01a13940-3063…`) resolved `r3/hera-probe/SKILL.md` to the absolute path,
  read it with `Get-Content` (exit 0) and returned `AMBER-FALCON-7731`.
- Root-only interrupt (same mode): the worker ran
  `powershell -NoProfile -Command Start-Sleep -Seconds 120`; `turn/interrupt` was
  sent for the root turn only. Root rollout: `turn_aborted` at 07:06:25.8Z. Worker
  rollout: no abort until 07:06:45.9Z, when the probe's cleanup ran Hera's tree
  interrupt; its command then ended `failed -1`. Result: a root interrupt does not
  cascade to children in 0.161.0, so `workers.ts` tree interruption stays.
  The probe bypassed `Controller.run`, so the controller reported "A new native
  root became active before Hera submitted a turn"; it did not interrupt anything.

- Sandboxed shell reads of handbook-sized files (no model call): `command/exec`
  through a Development controller with the native `workspaceWrite` policy ran
  `Get-Content -Raw` on the coding handbook (20,902 bytes), the research handbook
  (3,444 bytes) and a 10,439-byte UTF-8 Korean file. Nothing was truncated. pwsh 7
  (the shell workers use) returned the ASCII-only research handbook intact, kept
  Hangul, but replaced non-ASCII punctuation and emoji (`–`, `’`, `—`, `✅`) with
  `?`. Windows PowerShell 5.1 garbled the Korean file entirely. The bundled
  `grilling`, `grill-me` and `handoff` skills currently contain 15, 3 and 45
  non-ASCII bytes respectively. Result: skill text a model reads through the
  Windows shell must be ASCII-only.

- Draft handbook split, skill selection (owner go-ahead; drafts in Claude's
  scratchpad, no source change): a ~2.1 KB ASCII coding core plus a root add-on
  formed a new Development root's developer instructions (base instructions
  without the `load_instructions` paragraph). This session's Go role file was
  patched to the core plus a worker add-on (the worker rollouts confirm the
  patched text). `hera_web.enabled_tools` was limited to `web_search`/`web_fetch`
  for that thread, and `skills/extraRoots/set` added a draft `hera-research` skill
  (the research handbook body plus frontmatter). T1: a worker given only "Find the
  current Node.js Active LTS major version using official sources and report it
  with the source URL." read `hera-research/SKILL.md` first, then made two official
  `web_fetch` calls (each with `maxCharacters: 6000`, above the skill's
  3,000-character first-fetch guidance) and answered v24 with sources. The root,
  whose add-on names the skill, also read it before delegating. T2: a worker given
  "Create hello.txt ... then verify its content." did not read the research skill,
  wrote and verified in one command, and reported files changed, verification and
  assumption as the worker add-on asks. Worker input totals: T2 16,065 tokens over
  2 model calls (first call 7,924), versus 36,013 over 3 calls (first call 8,122)
  for the earlier A2 worker that loaded both handbooks. The scratch file was removed.

- A/B quality evaluation of the draft split (owner go-ahead): nine scratch cases,
  each run in a fresh git-initialized workspace through `Controller` with
  approvals declined and questions answered empty. "old" = current Hera; "new" =
  draft instructions with the controller's root swapped to a draft-instruction
  thread (original root archived), the session's role files patched, and
  `load_instructions` removed from that thread's MCP allow-list. Hidden tests were
  copied in only after each run. Development cases: c1 slugify bug, c2 refactor that
  orphans a helper next to pre-existing dead code, c3 new function beside an
  unrelated failing test, c4 nested `packages/api/AGENTS.md` (tabs, double quotes,
  JSDoc), c5 two features plus README, c6 default change that makes README stale.
  Design cases: d1 short factual answer, d2 three-perspective web comparison, d3
  deep design consultation. Single runs per variant; five first-pass runs failed
  with OpenAI 429 and were rerun.
  - v1 drafts found three problems: c5's Go worker left `.patch.tmp` and
    `patchgen.mjs`; c6's root delegated a one-line README edit (104 s and 295k input
    tokens versus 49 s and 85k); in d3, Astra read the research skill (its
    description named design and architecture) and searched the web (264 s versus
    177 s). v2 narrowed the skill description to web research, added "delete
    temporary or helper files you create" to the core, told the root to do small or
    tightly coupled changes itself, and limited the Design worker and Astra line to
    "Use the hera-research skill before web tools."
  - old versus v2 (seconds, total input tokens of the tree, hidden tests, case
    checks): c1 51/44 s, 97k/53k, both miss the out-of-scope `'a - b'` hidden case
    with identical fixes; c2 59/76 s, 109k/65k, all checks pass in both; c3 91/110 s,
    110k/55k, both leave `money` untouched and report its failure; c4 49/119 s,
    86k/53k, both follow the nested AGENTS.md; c5 147/96 s, 543k/56k, both pass (old
    delegated the CLI to a Go worker; v2 did not delegate); c6 49/49 s, 85k/53k, both
    update README and test; d1 12/13 s, 12k/12k; d2 348/275 s, 593k/169k (old: three
    Go workers plus Astra; v2: Astra alone with seven cited sources covering three
    perspectives); d3 177/126 s, 102k/70k. Totals: old 983 s and 1,737k input tokens;
    v2 909 s and 585k. Final messages kept the voice and gained `path:line`
    references.
  - Pre-existing defect found in both variants: Go workers on Windows edit through
    Codex's `apply_patch.bat` shim, which truncates a multi-line patch argument
    ("The last line of the patch must be '*** End Patch'"); calling the runtime
    `codex.exe --codex-run-as-apply-patch <patch>` directly applied the same patch.
    The DeepSeek model has no entry in Hera's model catalog, so Codex offers it no
    native `apply_patch` tool. Old c5's worker had 4 failed command outputs; v1's 11.
  - NOT_RUN: repeated samples per case, macOS, and implementation of the split in
    the repository (`prompts.ts`, role files, skill packaging, tests).

Side finding: every Hera thread, including Go workers, also lists the user's
personal `~/.agents/skills` and Codex's bundled `.system` skills (for example
`imagegen`, `openai-docs`, `frontend-design`).

### Alternate-screen exit cleanup (2026-10-14)

Per the owner decision, quitting removes the entire Hera UI and conversation
from view. The CLI now enables Ink's existing alternateScreen option; normal
teardown restores the screen from before Hera started. Existing session cleanup
and Ctrl+C interrupt/confirmation behavior remain unchanged. Native saved history
is preserved, but normal terminal scrollback is unavailable during the TUI.
Updated the UX guide to record this change.

Observed Windows local results: npm.cmd run typecheck, npm.cmd test (193 tests
across 30 files), npm.cmd run build and git diff --check: PASS, exit 0. The new
real-Ink test uses simulated TTY streams to confirm alternate-screen entry,
Ctrl+C confirmation, waiting for session cleanup and restoration without replaying
the Hera transcript. No fingerprint input changed; no live re-qualification
required. NOT_RUN: physical-terminal/herdr check, live model checks, macOS and CI.
No staging, commit or push.

### Successful command exit messages hidden (2026-10-14)

Per the owner decision, the interactive transcript no longer prints Tool exit: 0
for successful root or worker commands. Nonzero and unknown exit results remain
visible, and the root activity still returns to waiting for the model. Native
events and saved history are unchanged. Updated the UX guide.

Observed Windows local results: npm.cmd run typecheck, npm.cmd test (194 tests
across 30 files), npm.cmd run build and git diff --check: PASS, exit 0. The new
activity test covers repeated successes, failures, interrupted/nonzero exits,
null/missing exit codes and root versus worker activity. No fingerprint input
changed; no live re-qualification required. NOT_RUN: physical-terminal/live
re-check, macOS and CI. No staging, commit or push.

### Alternate-screen transcript viewport and mouse wheel (2026-10-14)

Replaced Static transcript output with a full-height, measured viewport above the
pinned input/picker and footer. Wheel up/down moves three display rows; PgUp/PgDn
moves a viewport minus two. Scrolling anchors the top logical line, counts new
wrapped rows in a localized indicator, and resumes following at the bottom or
when submitting a prompt. Tall composers retain their caret row; cursor placement
includes nested layout offsets. No new key guide was added beneath the input.

Finished logical lines are trimmed to the latest 2,000, with the unfinished tail
retained. Fence/user state survives trimming. Formatting is preserved before
wrapping, including bold pairs across wraps and Korean wide characters; unchanged
lines reuse their wrapped-row cache. The banner remains reachable at the top.
The previous boundary test now checks trimming, including a single oversized batch.

The scoped stdin read filter consumes SGR mouse reports and page keys before Ink
key/paste dispatch. It handles split/batched reports and ignores clicks/releases.
Only button-event and SGR modes (1000/1006) are enabled. Unmount restores stdin
and disables both modes before Ink leaves the alternate screen; setup failures
also restore the input hook. The UX guide records Shift+drag selection in Windows
Terminal and Option/Fn+drag in macOS terminals. No selection/copy subsystem or
new dependency was added; wrapping/styles reuse installed Ink dependencies.

Observed Windows local verification:

- npm.cmd run typecheck, npm.cmd run build and git diff --check: PASS, exit 0.
- Final npm.cmd test runs: PASS twice, 207 tests / 31 files, exit 0; 15.68 s and
  15.56 s. No flake observed. Initial targeted checks exposed obsolete Static
  expectations and a nested renderToString renderer issue; both were corrected
  before these final runs.
- Coverage includes wheel/page bounds, idle/busy input and every picker/provider
  input state, split reports at every byte boundary, ignored clicks, follow/reset,
  unread rows, history/menu arrows, long-input layout, resize anchors, wide/bold
  wrapping and caching, monochrome output and retained fence/tail semantics.
- Real Ink with simulated TTY streams: mouse-on after alternate-screen entry,
  mouse-off before restoration, normal quit and SIGTERM-style close/unmount: PASS.
  A separate built-code child with an intentional uncaught exception exited 1
  as expected and emitted both mouse-off sequences before alternate-screen exit;
  parent assertions passed, exit 0. No live Hera process was changed.

The explicit resize wipe was removed: Ink now repaints a fixed full-height frame,
with no Static indices or terminal scrollback to reconstruct. Automated resize
checks pass. Physical Windows Terminal acceptance remains NOT_RUN: the computer-use
native pipe was unavailable on the initial attempt and retry. Therefore absence
of resize artifacts in Windows Terminal is not claimed. Pending physical checks:
wheel/PgUp/PgDn over a long reply, indicator during streaming, resize, Shift+drag,
and a clean shell after normal quit and SIGTERM. macOS terminal/manual checks, CI,
package smoke and live model checks are also NOT_RUN. No fingerprint source was
changed by this task, so no live re-qualification was required. No staging, commit
or push.

Review (2026-10-15): typecheck, 207 tests, build and diff check re-run: PASS. A
psmux pane (Windows, built code, 60-line fixture, no model call) confirmed: SGR
wheel-up moves 3 rows and shows the indicator; PageUp moves a viewport minus two;
three lines streamed while scrolled up leave the view in place and show `새 출력
3줄`; typed text reaches the composer without stray report bytes; wheel-down to the
bottom resumes following; Ctrl+Q returns a clean pwsh prompt.

Follow-up checks (2026-10-15):

- Under ConPTY, Node 24.12.0 `setRawMode(true)` sets the console input mode to
  0x208, which includes ENABLE_VIRTUAL_TERMINAL_INPUT (cooked mode is 0x1F7).
  The console therefore passes VT input through as text, so Windows Terminal's
  SGR wheel reports take the same path as the psmux-injected ones. `engines`
  requires Node >=24 <25.
- Microsoft's Windows Terminal selection docs state that VT-input Windows
  applications receive mouse input and that Shift+drag selects while an
  application is in mouse mode.
- Resize in psmux (split to 59 columns, then back to 120): rules and the frame
  match the new width, the frame stays at 30 rows with no leftover rows, and the
  scrolled-up anchor survives both resizes.
- An attempt to drive a real Windows Terminal window with SendInput was
  abandoned: the window could not be brought to the foreground, so input would
  have reached the owner's other windows.

Still NOT_RUN: a human wheel or Shift+drag in Windows Terminal, and all macOS
terminals. Known regression: the legacy `/apply` review (`ApplyReview.tsx`)
can no longer page with PgUp/PgDn because the transcript consumes those keys;
Up/Down/Enter still page it.
