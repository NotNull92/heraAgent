# Implementation status

## Hand-off L: concurrent workspace sessions (2026-10-13)

The owner's decision supersedes the uncommitted Hand-off J behavior. Removed
workspace exclusivity, nonce ownership checks, stale-directory rename takeover,
`WORKSPACE_LOCKED`, `LOCK_OWNERSHIP_CHANGED` and the recovery notice. The existing
`acquireWorkspace(home, cwd)` callers now create atomic per-PID presence files
under the same canonical workspace hash. Live sessions only trigger the new
Korean/English interactive warning; headless output gains no notice. Dead or
missing-PID records are cleaned within the current workspace directory; malformed
live records and legacy `owner.json` are ignored. Release removes only the caller's
record, including uncertain/error shutdowns, and removes the directory if empty.
Unknown-outcome metadata handling is unchanged. The 11 live script callers remain
unchanged, and no file-level edit locking or launch-mode flag was added.

Item 4 finding: neither CLI nor interactive resume had a separate duplicate-resume
guard; both relied on the exclusive workspace lock through `Controller.open`.
Before native startup/resume, the shared controller now publishes its new/saved
`heraSessionId` in the presence file and checks other live records. A matching ID
raises `SESSION_IN_USE` (exit 6) before native resume. This is a small presence
check, not a new session-lock subsystem; simultaneous claims may both refuse.
Dead records permit resume; unknown liveness conservatively refuses a matching ID.
Per-session metadata filenames and per-window in-memory configuration were
rechecked. Shared config saves remain last-writer-wins as accepted by the owner.

Observed Windows local results (Windows 10.0.26200 x64, Node 24.12.0,
PowerShell 7.6.6, project-pinned Codex 0.161.0):

- Typecheck, build, full offline suite (172 tests / 28 files), source/history
  pattern scan (1,232 tracked files) and diff whitespace checks: PASS, exit 0.
  Focused safety/provider checks cover coexistence, independent release, dead
  records, malformed/legacy records, `EPERM`, localized notice ordering,
  duplicate/simultaneous resume and release on uncertain/failed close.
- `node scripts/live-native-workflow.mjs --live --record --mode=adaptive`:
  PASS, exit 0; root `01a13352-d990-7e62-9c5b-f80c8c4699cd`.
- `node scripts/live-native-workflow.mjs --live --record --mode=external_workers`:
  PASS, exit 0; root `01a13355-f0f1-7500-98fa-b49128be1051`.
  Both suites passed conversation, edit/test, cold resume, routing, approval,
  cancellation and concurrency with fresh receipts.
- Agent-operated native Windows PowerShell PTY check: PASS. Two actual CLI
  processes (PIDs 31336 and 6760) shared a disposable workspace. A dead legacy
  `owner.json` was removed; the first session printed no notice and the second
  printed one warning before its startup Ready. Each completed a live greeting.
  A third headless resume of the first saved session was refused with
  `SESSION_IN_USE`, exit 6, empty stdout, and its own presence removed. Quitting
  the second left only the first record; both exited 0 and the directory was gone.
- Physical desktop-terminal check: NOT_RUN. A test PowerShell console launched
  but exposed no targetable desktop window, so its verified test-owned process
  tree was stopped. Its fixture presence was subsequently cleaned through normal
  acquire/release. The PTY results above are not physical-window acceptance.

New native fingerprints:

- adaptive: `23258ed0528323dccef9442e3beca24720408e2df926871fad4a9953e1383813`
- external_workers: `0b0baf400c04294c0c113dd150d3b769a7def2e7dba7e857b003a821830fd0d3`

The owner must quit and restart all Hera windows to load the new behavior and
publish session IDs; older running builds do not publish those IDs. The owner
accepts simultaneous file-edit conflicts; the notice does not prevent them.
PID reuse can produce a wrong notice or conservatively refuse a saved-session
resume. Windows/macOS CI, macOS live/manual and package smoke: NOT_RUN here.
Both CI targets and the three temp-cleanup files were preserved; their hashes
match this hand-off's starting state. No other old lock directories were cleaned,
and no commit, push, release or npm publication was performed.

## Hand-off J: dead workspace-lock owner recovery (2026-10-13)

Historical results below are superseded by Hand-off L above.

Workspace acquisition now reads `owner.json` after an existing-directory conflict
and takes over only when `process.kill(pid, 0)` returns `ESRCH`. Recovery renames
the directory to a unique sibling, removes that sibling and attempts acquisition
once; `ENOENT` during rename or `EEXIST` during reacquisition reports
`WORKSPACE_LOCKED` (exit 6). Live, reused or unverifiable PIDs and missing,
unreadable or invalid owner metadata remain locked. Conflict messages name the
lock directory and known PID. The returned recovery metadata reaches one Korean
or English interactive transcript notice before Ready; headless output stays
unchanged. Shutdown release conditions are unchanged. Section 12.7 documents the
rule; T14's "No blind ownership takeover" remains applicable.

Windows local results (Windows 10.0.26200 x64, Node 24.12.0, PowerShell 7.6.6,
project-pinned Codex 0.161.0):

- `npm.cmd run typecheck`, `npm.cmd test` (174 tests / 28 files),
  `npm.cmd run build`, `npm.cmd run source:check` (1,232 tracked files) and
  `git diff --check`: PASS, exit 0. The final build and focused rerun of all
  19 safety tests also passed, exit 0.
- Lock tests cover an actual exited child PID, live owner, fresh nonce/recovery
  metadata, old-owner release refusal, takeover release, incomplete/unreadable
  metadata, non-`ESRCH` liveness errors, and rename/reacquisition race failures
  without retry. The notice test covers Korean/English, no-recovery silence,
  exactly one line and ordering before Ready.
- `node scripts/live-native-workflow.mjs --live --record --mode=adaptive`:
  PASS, exit 0; conversation, edit/test, cold resume, routing, approval, cancel
  and concurrency. Root `01a1331f-7073-70c3-880e-6aaf0ef95a55`.
- `node scripts/live-native-workflow.mjs --live --record --mode=external_workers`:
  first run FAILED, process exit 1 (`TURN_FAILED`, Hera exit code 5), after
  conversation, edit/test, cold resume and routing passed. Reading the fixture
  thread through the native API confirmed `serverOverloaded`: "Selected model is
  at capacity. Please try a different model." The failed permission turn contained
  only the user message and no tool execution. Root
  `01a13322-2c6f-7ca1-a543-cb10e13dd54b`; no pass receipt was recorded for that
  attempt. One fresh full-suite attempt with the same model/settings PASSED,
  exit 0, including approval, cancellation and concurrency; root
  `01a13326-18c0-73a0-b2a0-2ea1e7a4c94c`. No provider/model fallback or replay of
  an uncertain writing turn was used.
- Agent-operated native Windows PowerShell PTY check: PASS. Created a disposable
  workspace with exited PID 35708 in its lock; launched `node bin/hera.mjs --cwd
  <fixture>`, observed exactly one Korean recovery notice before Ready, verified
  the replacement owner PID 41012 and a new nonce, submitted "안녕?", received a
  normal live reply and returned to Ready. Ctrl+Q exited 0 and the fixture lock
  directory was absent afterward. This is observed PTY evidence, not a physical
  herdr/desktop-terminal acceptance claim.

New native fingerprints:

- adaptive: `9cb6327f9422a253425a583e41873c1fc5744ab46f30a3884b345d70ec734cb6`
- external_workers: `0934c361c0e55d13f7b13892887187e52fbee5186f66c0d6a5d059f7c0160adc`

Both recorded fingerprints were checked against the final build: `ready: true`.
Concurrent temp-cleanup edits in `scripts/smoke-package.mjs`, `vitest.config.ts`
and `tests/global-setup.ts` were preserved. Typecheck and all 174 offline tests
passed again with the updated test setup; package smoke was NOT_RUN here.

The owner must quit and restart Hera to load this build. A reused PID still looks
alive and may require manual lock inspection/removal. No other old workspace
locks were cleaned up. Windows CI, macOS CI, macOS live/manual and physical
terminal checks: NOT_RUN for this change; both CI targets remain intact.
No commit, push, release or npm publication was performed.

## Public readiness review (2026-10-08; clean repository public)

Develop future changes for independent users on clean Windows and macOS machines,
with portable installation, user-owned credentials and actionable errors.
Public visibility is authorized only after the privacy review; npm/release
publication and a license grant remain unapproved.

Reviewed 1,186 tracked files and 1,528 historical blob versions across 51 commits.
The source scanner and Gitleaks 8.30.1 full-history scan passed. Gitleaks also
passed on 46 downloaded Actions logs and 25 downloaded artifacts, including
expanded package contents. Exact private-email searches found no matches in
those logs, artifacts or historical file contents. Five large native binary
artifacts were not fully downloaded/scanned; their workflows were reviewed, which
does not constitute a binary-content audit. No claim of exhaustive detection is made.

The sole identified personal email was in all 51 commits' author/committer metadata.
With explicit user approval, replaced it with the verified GitHub noreply address
and pushed using an exact `force-with-lease`. Every historical tree and commit
message was verified unchanged. The original complete Git bundle and scan reports
remain in ignored local `.artifacts/public-audit/`. Future local commits use the
noreply address. Added ignore rules for local outputs, credentials, certificates,
databases and backups; existing local files were preserved.

The sanitized tip is `5d3de75fc92ba1eb62ce6ccd3e3d61a005eab0d4`.
Historical commit IDs in older evidence below refer to the pre-rewrite history.
GitHub retained the former tip and its personal author email after the rewrite.
With separate user approval, renamed the original repository (ID 1406773417) to
`NotNull92/heraAgent-private-archive` and preserved it privately. Created a new,
independent `NotNull92/heraAgent` (ID 1409659092), pushed only sanitized `main`,
verified the old tip is unavailable there (HTTP 422), and confirmed no old Actions
runs/artifacts were carried over. Converted only the new repository to public.
The original repository and its five unscanned binary artifacts remain private.
Historical Actions links below refer to the private archive and require access.
The first public [CI run 37722082111](https://github.com/NotNull92/heraAgent/actions/runs/37722082111)
started on both platforms without the previous billing block. Each passed 85/86
tests; the repository test still mocked private visibility and hit the new public
visibility guard before its intended wrong-origin assertion. Updated that fixture
to public; all three repository checks passed locally on Windows. Replacement CI
results will be recorded separately when observed.
See [GitHub's removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
No release, npm publication or new live/manual model checks were performed.

## Command suggestions (2026-10-08)

Typing `/` or the existing backslash alias opens a localized command list below
the composer. Prefix typing filters it; Up/Down navigate, Tab completes for
arguments, Enter selects, and Escape dismisses. `/plan` completion waits for its
request text. The list uses at most six rows and scrolls within shorter terminals.
Existing backslash+Enter newline handling, input history, IME caret placement,
busy cancellation and literal pasted commands are preserved.
Native Windows typecheck/build, all 19 TUI tests and the full 86-test offline suite
passed, including three new keyboard/filter/scroll/paste regressions. No live
model calls or new physical terminal acceptance were performed. Source commit
`e4614ee6f965524e34c0c0a0b4c0f9e322f3bbd1` is verified on the private remote.
[CI `37720164302`](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37720164302)
failed before either platform's steps started: GitHub reported failed recent
account payments or a spending limit requiring an increase. Installed-package
jobs were skipped. No remote test failure or pass is inferred. Resolve the account
billing/limit issue and rerun that workflow; account billing was not changed.
This evidence-only follow-up skips duplicate CI.

## Runtime label (2026-10-08)

The TUI banner and CLI version output now display `api v0.161.0`, using the
existing pinned runtime constant. Native Windows build, CLI output check and
16 existing TUI tests passed, exit 0. This presentation-only change made no model
calls; the runtime qualification recorded below remains applicable. New push CI
results must be checked separately.

## Codex 0.161.0 upgrade (2026-10-08, Windows live qualified; all CI passed)

The user requested that Hera's fixed runtime match the installed Codex 0.161.0.
Updated the project dependency/lock, generated protocol and official config schema,
runtime checks, version labels and the maintained mixed-provider patch source pin.
The upstream source is `979011409de0a60b52f179721948e65531d26144`.
Preserved old generated files/package artifacts under ignored `.artifacts`.
Existing 0.160.1 session metadata remains readable without rewriting stored history;
future/unknown versions are rejected. Old runtime capability evidence stays stale.

Observed native Windows: dependency install/audit (zero vulnerabilities), typecheck,
83 offline tests, build and isolated no-inference native smoke passed, exit 0.
The isolated smoke has no login or configured sandbox; it does not inspect the
user's authenticated profile. Package inspection and clean-prefix Windows install,
native initialization, reinstall/settings, OS credential persistence and launcher
passed, exit 0, for SHA-256
`8f0d73426c1c59cb5c7b2c14c0e983ea903a9d3f6c4cdcedb3ed7ee0cacfc466`.
That archive predates the notice/changelog update, not a runtime/code change.
The mixed runtime built successfully on native Windows. Its initial fresh-home
smoke passed, but existing-profile startup failed before inference. A new
fresh-profile official/patched/official regression reproduced the failure.
Binary inspection found all 73 official Windows migration checksums use CRLF,
while the source checkout embedded LF. Qualification now matches source migration
bytes to the official platform binary before compilation. Rebuilding fixed the
round-trip regression and existing-profile startup, without directly reading,
rewriting, removing or resetting any user database. Old binaries and install
receipts remain backed up under the user's runtime directory.

Installed Windows binary SHA-256:
`2d9e485bf99ca1915a1def917b1301e99cdbc2e9ed1ef7c71abdc3fee1c7f260`.
Bundle SHA-256:
`84bb2ba64b27e2c35c6a1f66c0c4a719dbebb072ccd4d5f96338bf08abaa5593`.
Both focused native tests passed: provider allowlist/profile precedence and
`apply_role_cannot_expand_parent_authority`. The latter used the already compiled
test executable; the waiting redundant Cargo invocation was stopped. Migration
compatibility is established separately by the rebuilt executable's round trip.

The user explicitly authorized live model qualification for all three modes.
GPT-only workflow passed, root `01a11939-5d81-7560-be14-7962a016c6a1`.
The first mixed-mode live attempts failed on Go SSE idle timeouts (adaptive root
`01a11951-7fd3-7861-86db-0d476910be42`, GPT/Go root
`01a11951-5163-7a41-80e9-2a313672eb48`). These did not create pass receipts.
A bounded Go stream probe subsequently completed in 2.4 seconds. No retry policy,
provider timeout, model or credentials were changed. Fresh sequential qualification
then passed adaptive root `01a11955-18b7-76a0-93ba-93a26b0bacb9` and GPT/Go root
`01a11958-0c00-7112-84bd-860f7ee293a3`, exit 0. Each full suite includes
edit/test, cold resume, routing, approval,
cancellation and concurrency. New fourth-spawn/DRD and macOS manual/live checks
are NOT_RUN; earlier runtime passes do not certify those upgrade checks.

All three public gated `Controller.open` paths then passed without inference,
using matching fresh verification records and runtime 0.161.0. User configuration
remained byte-identical. Native RPC also read the three saved turns of the prior
0.160.1 fixture `01a118df-c4f2-7252-b893-8be3d834ed12`; this is history-read evidence,
not a new model turn in an old session. `hera --version` reports Codex 0.161.0.

CI `37715214835` passed both platforms' offline checks, but Windows reached the
15-minute job limit during package smoke; downstream archive jobs were skipped.
The combined offline/package job now allows 30 minutes with all checks retained.
Follow-up source commit `a656fdbad659301bdf55300953579b911347192e` is verified on
the private remote. [CI `37716932924`](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37716932924)
completed successfully: both platforms' offline checks, Windows package smoke,
and clean-prefix Windows/macOS installation of the same Windows-built archive.
Downloaded archive SHA-256 matched its CI checksum file:
`419ddc54794eca6901d584ffae7999070309b36b6b30a3e7aa6309e86c5a5d17`.
Superseded native workflow `37715231091` was cancelled
following its macOS fresh-home pass. Replacement [native CI `37716968069`](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37716968069)
completed successfully: Windows and macOS builds and official/patched/official
profile round trips. No CI jobs remain pending for this executable source.
The follow-up status/qualification README commits are documentation-only and skip
duplicate CI; the runs above target executable source commit `a656fdb`.
Historical passes below do not certify this upgrade. No release was published.

## Current checkpoint (2026-10-08)

The user confirmed the herdr resize fix and subsequently completed Korean IME
inspection on 2026-10-08. Record both as user-confirmed Windows manual acceptance,
not agent-observed tests. macOS manual/live remains NOT_RUN.

The user explicitly deferred macOS login, live model and physical terminal checks
until after Windows completion. These are next-phase work, not blockers for the
Windows milestone. Preserve macOS support and automated CI; deferral is not a pass.

Design/architecture/research requests now automatically ask the native root for
3-5 complementary DRD assignments, public source evidence and synthesis. The
configured worker ceiling is unchanged; adaptive mode gathers evidence with Go
and uses Astra for difficult synthesis. No classifier inference, independent model
loop, /drd requirement or restored apply phases. Explicit no-web/no-delegation
requests override the guidance. Single-agent operation reports its lack of workers.
Research coverage is model guidance; runtime/tool limits remain separate guarantees.

Observed native boundary checks (`scripts/live-native-boundaries.mjs --live`):

- Adaptive root `01a118d2-d41b-7c41-9492-29fa0325c722` passed, exit 0.
- GPT-only root `01a118d4-a49e-7e42-af3a-8e43bed85148` passed, exit 0.
- GPT-root/Go-worker root `01a118d4-a98d-72e0-8741-6cd12400db8f` passed, exit 0.
- Each observed three simultaneous workers, the actual native fourth-spawn error,
  running-child command interruption, idle-tree/background cleanup and a successful
  subsequent root turn. Configuration was fixture-local; user settings/credentials
  were not changed. These checks preceded the final DRD prompt correction and used
  unchanged native runtime, permissions and concurrency settings.
- After the worker startup fix, adaptive root
  `01a118df-c4f2-7252-b893-8be3d834ed12` repeated the same boundary/cancellation
  checks successfully, exit 0, with peak three and the real fourth-spawn rejection.

Initial automatic DRD fixture `01a118d6-29b2-7de3-acf4-a15f8c1f5f19` failed:
the model merged five requested perspectives into three assignments. Native Go
document reads and Astra synthesis occurred, but this is not a five-task pass.
The guidance now preserves explicit counts independently of concurrent worker slots
and states the existing 6,000-character tool maximum. Fresh qualification is
reported below; historical passes do not certify this source change.

The second DRD fixture `01a118d8-ead2-7182-8863-378f4e3ce586` exposed a native
startup race: a newly loaded child can precede its first materialized message.
NativeWorkers now handles only that exact pinned RPC error with a metadata-only
read, still validates ownership/routing and counts the child as pending rather
than idle. Unknown read errors still fail; pending children cannot certify idle
or cancellation completion. The focused regression passed, including unresolved
startup cancellation and recovery after history becomes available.

Final automatic DRD fixture `01a118da-f005-7360-af1f-0ad0ce371c13` passed, exit 0:
five numbered perspectives, peak three active workers, ten successful official
document fetches, Go evidence gathering and Astra synthesis. No shell execution or
workspace changes occurred during research. This used known URLs, not live search;
the report explicitly retained unresolved facts under the two-reads-per-perspective
budget. It verifies workflow behavior, not exhaustive coverage or research quality.

Final-source native workflow qualification passed, exit 0, for all three modes:

- GPT-only root `01a118db-372a-7d70-b864-6823f887853e`.
- GPT-root/Go-worker root `01a118db-3c66-7072-aead-0399abd05e64`.
- Adaptive root `01a118db-43da-7df3-ad7f-f272bb028cca`.

Each included conversation without children, direct edit and observed test command,
cold resume, worker routing, actual permission decline/allow-once, read-only plan,
shell cancellation and concurrent workers. Matching native verification records
were saved with backups outside Git. The public gated Controller.open startup
then passed for all three configurations without inference. Credentials and user
configuration were preserved.

Native Windows typecheck/build, all 82 offline tests, isolated native initialization
and actual Chromium boundary/cache/CAPTCHA/cleanup fixtures passed, exit 0. The
isolated native smoke intentionally has no login or configured sandbox; it does
not describe the user's authenticated profile. No live search was rerun by that
browser fixture. Local archive inspection and clean-prefix Windows installation,
native initialization, reinstall/settings, OS credential persistence and launcher
passed, exit 0, for SHA-256
`7d5faf794055d56ede46be4ce160909ec1263995913afb57665b630c3821249a`.

Final implementation commit `41c48c38b4885ca41f7d722907da1da270d88778`, including
DRD commit `dc6f298`, passed all four jobs in
[CI 37707243321](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37707243321):
Windows x64/macOS arm64 offline checks and identical-archive installation on both
platforms. Each offline run passed 82 tests. The exact Windows-built archive was
downloaded and passed local Windows installation, native initialization,
reinstall/settings preservation, OS credential persistence and launcher checks,
exit 0. The archive SHA-256 matched both CI installation logs:
`b7216e7e9e6d51e7d19159e27f968732e89adcfd0bcb13dacc3182d4d28db5f6`.
The local receipt is `.artifacts/ci-41c48c3/verification.json` (not tracked).
Its manual-check fields predate the user's later IME confirmation and macOS deferral
recorded above. CI/package checks do not establish macOS live/manual acceptance.

The preceding DRD CI 37707162418 was cancelled when Windows package smoke reached
the 15-minute job deadline; its installed-package job was skipped. This remains a
cancelled run, not a pass. The subsequent implementation run above passed.
The current Windows implementation/verification scope is complete; remaining
macOS manual/live work is explicitly deferred. Release publication is not authorized.
This documentation closeout changes no runtime or package inputs. Local live-model,
package and manual checks were not repeated for these documentation-only edits.

Prior source `3b01e24` CI 37612842135 passed both OS offline and identical-archive
installation jobs; feature CI 37610664560 passed after its Windows-only rerun.
Later UI CI runs 37619226659, 37632048652 and 37632742033 were cancelled, not failed
or passed. These historical runs are separate from the final receipts above.

The dated sections below are historical receipts. Older missing-login, blocked-Go,
phase-transition and "remaining work" entries are superseded where later evidence
or the native-workflow amendment says so. No historical failure is relabeled a pass.

## Current checkpoint (2026-10-07)

### Remove the obsolete TUI workflow track

Removed the historical IDLE-to-COMPLETE track and its native guidance replacement
from the footer. Existing status, mode, worker and model information remains;
pickers can use the freed row. Native Windows typecheck, build and all 15 TUI tests
passed, exit 0, including wide/narrow scrollback and status rendering. Live model,
physical terminal/IME and macOS checks were not rerun for this display-only change.

### Codex-native execution replaces the mandatory apply workflow

The user authorized immediate edits and checks, with questions only for decisions
or extra native permissions. Public Controller/TUI/headless sessions now start in
native workspace-write/on-request, without a whole-workspace baseline, proposal
schema turn, `/apply` confirmation or phase restart. `/plan` sets the native turn
to read-only/never. Unknown requests and persistent write-root grants remain
unavailable; allow-once/decline and native question UI are responsive during turns.
Native resolved notifications remove stale controls. Headless requests are declined.
Native children inherit permissions; scoped file ownership is coordination, not
the former read-only-worker/single-writer guarantee. Historical phased helpers and
evidence remain distinct from new native-workflow verification records.

Adaptive mode runs conversation/routine work through Go DeepSeek V4.1 Flash/low,
delegating deep reasoning, planning and design through the native Astra role with
the selected model/effort. The user's local selection is gpt-6-astra/high, worker
limit 3. GPT-only and GPT-root/Go-worker modes remain. Role menus/footer describe
adaptive responsibilities. No extra classifier call, agent loop or history DB.
The selected local config was backed up outside Git before saving adaptive mode.
Credentials remain in the existing OS stores and were not changed.

Observed native Windows 10.0.26200 x64, PowerShell 7.6.6, Node v24.12.0 results:

- Typecheck/build and 80 offline tests passed, exit 0. Regressions cover a 129 MiB
  file without a baseline scan, on-request approvals during streaming, headless
  refusal, stale grants, per-turn plan sandbox, adaptive route drift and separate
  capability records. Existing Ctrl+C, Unicode and scrollback tests remain.
- `scripts/live-native-workflow.mjs --live --mode=<mode> --record` passed for all
  three modes, exit 0. Each fixture included greeting with no children, direct
  sum.cjs edit and observed native `node check.cjs` exit 0, same-thread cold resume,
  native child routing, actual denied and accepted permission requests, a read-only
  plan turn, actual running shell interruption, and two native workers within the
  configured ceiling. This does not claim a fresh N+1 rejection test at limit 3.
- Successful native roots: GPT `01a115f7-a45f-7251-be1c-56d2c96b2d63`, mixed
  `01a115f7-a98c-76f3-a548-ffe703e0fca5`, adaptive
  `01a115f7-b07a-7870-88eb-b465440d89fe`. Adaptive design delegation was chosen by
  the model from a normal planning request; effective child model/effort was
  gpt-6-astra/high. Greeting used no Astra child. Capability records/backups remain
  outside Git and require matching runtime/source/configuration/platform.
- Initial adaptive startup incorrectly queried OpenAI readiness through the Go
  root; fixed by querying the official OpenAI runtime. A later parallel fixture
  rejected native Codex resource inventory as an external tool; only the two
  read-only inventory operations were allowed. Early allow-once fixtures falsely
  declined because display-escaped Windows paths did not match; the fixture now
  compares the single parsed command action exactly. Failed runs are not passes.
- The earlier archive ce72c5466d52ec4fa55b8363de6128738f5998b3251fedfb49f9f801dc05c7d2
  passed Windows installation, native initialization, reinstall/settings, OS-store
  persistence and launcher checks. It precedes a TUI hook-order correction; the
  final artifact receipt and current upload/CI status are reported separately.
- Public `hera run` in this actual large repository returned a Korean greeting
  through Go, root `01a115fb-c123-7192-8a2d-8b8e95d92905`, exit 0. An actual native
  Windows PTY then launched `hera`, accepted injected Korean `안녕` and Enter,
  displayed a response/Ready with zero active workers, and exited 0 after two idle
  Ctrl+C presses with native tree cleanup. This verifies injected terminal input,
  not physical IME composition. Repeated input reuses the connected runtime rather
  than repeating provider setup; adaptive usage refresh queries OpenAI separately.
- Final prepared local archive SHA-256:
  `d65063832dfb9e566439515fa8c63057ff53f5d1a1186cc3004d402fcbb62cad`.
  Its native Windows clean-prefix install, native initialization, reinstall,
  OS-store credential persistence and launcher checks passed, exit 0. Staged source,
  Git history and decompressed archive passed the credential/JWT scan without
  displaying values. `.omo/` and `outputs/` remain unrelated, untracked and excluded.

Upload and follow-up verification receipt:

- Feature commit `a259d4739fc7c71060a6a25c5873bf133fb9dfdc` was pushed to the
  verified private `NotNull92/heraAgent` main branch; local and remote SHAs matched.
- CI run `37610664560`, attempt 1: both offline jobs and the macOS installed-package
  job passed. The fresh Windows installed-package job failed with
  `CREDENTIAL_STORE_UNAVAILABLE` (OS-store helper unavailable or timed out). The
  same archive had passed the Windows build-runner installation check. No key or
  helper stderr was disclosed. A failed-job-only rerun was requested; this entry
  does not claim its result.
- The exact downloaded CI archive SHA-256 is
  `d7a62b9ad967bc9181ebedcd22a9acb984fa4184b98398ae4ab20d64053a18f6`.
  Local Windows installation, native initialization, reinstall/settings,
  credential persistence and launcher checks passed on those bytes, exit 0.
  It differs from the local archive only in LICENSE/NOTICE line endings.
- A second native Windows PTY exercised an actual command approval: the picker
  defaulted to decline, Enter declined it, the turn returned to Ready, and Ctrl+Q
  cleaned up and exited 0. Permission acceptance was verified by the separate
  controller integration fixture, not by clicking this picker.
- Existing opt-in GPT smoke/interrupt scripts now explicitly select GPT and
  read-only turns. Historical proposal/apply fixtures instantiate the retained
  phased controller directly; they do not use the public native entry point.
  All four scripts passed syntax checks. `npm run test:live -- --live` passed
  real GPT read-only file inspection and cold resume, exit 0. The historical paid
  proposal/token-comparison fixtures were not rerun for this script-only change.

The previous source CI run 37605900976 failed a Windows OS credential-store timeout
after its 74 offline tests passed. Earlier browser CI 37601591133 and greeting CI
37602184114 passed. Those are historical results, not this change's CI result.
Windows/macOS workflows remain enabled. macOS native adaptive/permission/live and
manual terminal/IME checks are NOT_RUN. The new UI's real IME composition and
physical terminal review are not certified by injected/offline input tests.

### Earlier checkpoint: free local Playwright replaces keyless Exa


At the user's request, analysis now uses a bundled local Playwright service through
the existing native MCP client, with only search/fetch and no paid search API or
fallback. Main and workers share queue/cache; CAPTCHA stops until the user uses
`/research open` and `/research resume`. `hera research setup` installs pinned
Chromium without deleting existing versions. [Operation/evidence](web-research.md)
records the outside-sandbox browser boundary, public HTTPS egress guard, limits,
official sources and human-only CAPTCHA handling. DRD 3-5 assignments are not yet
enforced. Existing Windows/macOS product targets and CI remain.

Windows: actual user-assisted DuckDuckGo search/resume, official page fetch/cache,
real Chromium/MCP block/throttle/cleanup fixtures, native GPT/Go worker document
reads/shared cache and native write-phase tool denial passed. Typecheck/build and
73 offline tests passed (exit 0). Initial setup CLI failed because Playwright does
not export its CLI subpath; resolving its CLI beside the exported package manifest
fixed it, and the actual setup command then passed. Installed-package checks now
exercise this command. No credentials or user browser profile are imported.
Previous Exa CI does not qualify this change. macOS local/manual/live search
remains NOT_RUN.

Positive product regression passed for both modes (worker follow-up, saved session
resume, current contracts, exact main-only edit and Node test exit 0): GPT root
`01a115af-33ed-77a3-acc2-59216514b0fb`, mixed root
`01a115af-39a7-7ae0-a004-606d3675ea9d`. An additional mixed cancellation failed,
root `01a115b1-2a0f-75e1-89ca-e655956d9a26`: the parent completion was reconciled
while child cleanup was still finishing. Its later saved history showed the child
command failed with exit -1; the original unknown-outcome fixture remains preserved.
Controller now waits for an ongoing owned cancellation before judging command
outcomes. The regression retains rejection of truly unresolved commands. Fresh
actual cancellation fixtures then passed in both modes: GPT
`01a115b3-ddcf-75f3-ba99-b2cb557944e3`, mixed
`01a115b3-e2a6-74a2-9a91-85b5e9a94ede`; pending-worker apply blocked, actual child
command interrupted, tree idle, workspace released and unrelated process preserved.

Reviewed source (excluding concurrent unstaged TUI changes) passed typecheck,
73 tests, build and actual Chromium fixtures. The first index-export test lacked
a `.git` marker and failed the expected repository-home boundary fixture; adding
that marker to the disposable export made all 73 pass, with no product change.
The normal shared worktree separately passed 74 including an unrelated TUI test.
Prepared archive SHA-256:
`8003d4827a3a54fa50e6ec845d425b823b10c0cb139a7ac02aef8afa995a6d5b`.
Archive inspection and native Windows installation, actual research setup, native
initialization, reinstall, OS-credential persistence and launcher checks passed,
exit 0. An earlier archive also passed but predates the cancellation correction.
No release, npm publication, license grant or global Codex change was performed.

After reviewing these actual probes and historical unchanged native permission,
concurrency, provider/auth/failure gates below, mode-specific local acceptance was
maintainer-attested outside Git with uniquely named backups. Historical negatives
are not relabeled as fresh. Browser/source/dependency pins are fingerprint inputs;
tests/installers do not auto-promote acceptance. Public gated startup was checked
without inference. Credentials remain outside the repository.

Source commit `1a9b3a38f0b934ae15a1e73f4d1cfbb5fdebd43b` was pushed to private
`NotNull92/heraAgent` main with exact remote SHA verification after owner, both origin
URLs, ancestry, staged-content, source/history pattern and exact-value Go credential
checks. The latter also checked the decompressed archive without logging the key.
Concurrent TUI changes and untracked `.omo/`/`outputs/` were preserved.
CI [37601591133](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37601591133)
has passed macOS offline/Chromium checks and the Windows offline/Chromium step;
Windows artifact preparation/installation is still running at this checkpoint.
The two identical-archive installation jobs are pending, not passed. No current
macOS live/manual search result is claimed. Local `hera doctor` reports account
and sandbox ready and mixed mode `verified_local`.

### Bundled public web research

Historical Exa checkpoint, superseded by the free local browser implementation above.

Official Exa remote MCP is integrated through the native runtime, with exactly
search/fetch in analysis and the server disabled in apply/tests. No new dependency,
key, global plugin or custom search loop. Effective settings/catalog checks and
native per-tool output budgets constrain the integration; this is not a hard task
token cap, private-data filter or offline index. The requested 3-5 DRD research
workflow is not yet enforced by this increment.

[Research and precise evidence](web-research.md) compare Exa, Tavily, Brave and
Firecrawl primary sources and record actual GPT/Go worker search, Astra fetch,
native write-phase search denial, regression failures and package results.
Windows typecheck/build, 67 offline tests, native smoke and the newly prepared
archive installation/reinstall/credential persistence/launcher passed. macOS
live/manual search remains NOT_RUN; current-source CI is verified separately.

Source commit `98862bb5aa5efc3d324ee614a0a19189a1f63b3e` was pushed to private
`NotNull92/heraAgent` main after identity, origin, ancestry, staged-content and
secret checks; remote SHA matched local HEAD. CI
[37594309507](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37594309507)
completed successfully: Windows/macOS offline checks and both identical-archive
installation jobs (4/4). These CI jobs do not perform live search/model inference.
Actual Windows GPT/Go search and write-phase denial are separately recorded above;
macOS live/manual search remains NOT_RUN. Unrelated local `.omo/` and `outputs/`
files were preserved and excluded from the push.

### Ctrl+C follows the existing shutdown path

In the composer, Ctrl+C now interrupts busy work and quits when idle, using the
same awaited session cleanup as Ctrl+Q. Dialog cancellation is unchanged. The
pinned Codex source disables its double-press shortcut and uses this busy/idle
distinction. Korean/English footer text and help document the behavior.

Native Windows PowerShell checks passed: typecheck, build, focused TUI tests 6/6
and the full offline suite 54/54 (all exit 0). The new keyboard regression verifies
busy interruption, idle cleanup before unmount and no exit from bracketed paste.
The actual `hera` launcher was exercised in a Windows PTY: one idle Ctrl+C restored
cursor/input modes and exited 0. No paid inference was needed. This change's CI
results are separate from prior runs; macOS manual/live checks remain NOT_RUN.

### Authorized mixed-mode product integration (Windows locally verified)

The user explicitly approved a maintained native patch **only for mixed mode**;
specification section 1.2 records this exception. GPT-only retains official 0.160.1.
Hera now has explicit runtime installation/integrity checking, isolated native role
profiles, a separate mixed-mode acceptance fingerprint, mode selection and Go-aware
worker reconciliation. The Go key is present only in the read-only analysis server's
environment; main-only application launches without it. No acceptance record is
automatically created by installation, CI or mocked tests.

Current Windows checks: typecheck and 53 offline tests passed (exit 0). Eight native
cross-provider integration tests passed (1,761 filtered), including a new full-history
fork bypass rejection for a user-owned cross-provider default role. Scoped Clippy
passed twice (16m29s for affected crates; 10m32s after the new core guard); unrelated
baseline unused-import fixes were reviewed and restored. Bazel 9.0.0 native lock
refresh exited 0 with no MODULE.bazel.lock change. Native configuration schema
generation exited 0 without content drift. Re-exporting the compiled pinned protocol
crate produced 318 JSON schemas matching the existing schema SHA-256 exactly.
The first schema-export helper build used the wrong compiler, then lacked a Windows
import-library search path; both setup failures were corrected without global changes.

The maintained patch is now SHA-256
`057f04af2e05d945a6a00613fadc77202c6063f30a12e8136caab157e36b6eaf`.
The rebuilt executable and fresh product-level live checks below qualify this guard;
the earlier experimental binary/CI receipts do not qualify this product build.
Product CI [37573653148](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37573653148)
at `b01ee01954105c66d5c411325adb298b9b37f859` passed all four Windows/macOS jobs.
The new optimized Windows executable built in 1m38s (exit 0), SHA-256
`97225251787f19adf19d4641efc00dc22593f6a5bd9569ab75b21e1399df5aca`.
Fresh-home installation/integrity/initialization smoke and explicit installation into
the external Hera runtime slot passed. No acceptance record or mode switch was
created by installation. Product-level positive live checks passed on Windows (exit 0):

- GPT-only official runtime: root `01a114da-5f76-7692-8bbd-f1b174052dbe`.
- Mixed runtime: root `01a114db-23bc-7982-89cb-35da37ebb455`, Go
  `deepseek-v4.1-flash/low`, configured worker limit 3. Native read/follow-up,
  cold same-child resume, latest worker-result contract validation, exact reviewed
  main-only file application and observed Node test exit 0 all passed.

The scripts use disposable workspaces and the real Controller, while deliberately
bypassing its public acceptance gate for qualification. No public gate is promoted
by that bypass. Mixed negative gates passed: native read-only write denial, root N+1 rejection at
fixture limit 1, and actual spawn lookup rejection after all three switches were
disabled (root `01a114de-0987-75c3-a0ca-50ed36be0c15`). Recursive spawning
was not exercised by that live Go fixture. A separate on-request fixture observed
a real Go child approval request and the existing Hera decline handler; sentinel
unchanged, no permission granted (root `01a114e0-cf43-7d23-9346-cb8b0b305a04`).
Product policy remains never.

Two product cancellation attempts failed and are not counted as passes. First, a
root completed between inventory and interrupt, returning `no active turn to
interrupt`. The shared cancellation path now rereads that exact native thread
and accepts only a proven idle result. Second, a completed root was incorrectly
rejected because an owned read-only worker still had a running command. Controller
command tracking now retains native ownership: active child work may outlive the
root response, while apply still requires full-tree quiescence. Focused regression
tests cover both races and retain rejection of active/unknown main outcomes. The
corrected live cancellation passed (exit 0): actual child command interrupted,
pending-worker apply blocked, tree/terminals idle, workspace released, unrelated
process preserved. Both corrected product cancellation probes passed: mixed root
`01a114e5-5079-7902-aa60-05d0fd9eed03` and official GPT root
`01a114e8-f0bf-7072-805c-a119fad9f0f1`. Windows full offline regression passed
53/53 (exit 0). Four additional native unit tests passed for depth, shared concurrency,
legacy limit configuration and resume limits (2,551 filtered); these are not live Go
recursive-spawn tests or a full native-suite pass.

The independent read-only audit of Go child `01a114db-a2cc-79d1-92c5-202111c0c32e`
confirmed an actual command exit 0 and unpredictable marker, followed by cold-resume
recall without a new command/file read. Maintainer-attested Windows acceptance records
were then saved outside Git, separately for GPT and mixed mode. Provider failure
coverage is mocked native HTTP, not paid-service quota exhaustion or expired-key live
testing. Public `Controller.open` subsequently passed with its real mixed-mode gate.
`hera doctor --json` reports `verified_local`; the saved user mode is now mixed,
with Astra/high, Go DeepSeek V4.1 Flash/low and limit 3. GPT Luna/max preferences remain
saved for GPT-only mode. Installation and mocked tests cannot self-promote acceptance.

The actual `hera` launcher opened the mixed-mode TUI. A PTY exercised `/model worker`,
the DeepSeek-only model and low-only effort pickers, then Ctrl+Q exited 0. This is not
physical Korean IME/herdr testing. A fresh auth status process confirmed OpenAI ChatGPT
ready and Go source=keyring, without displaying credentials.

The locally prepared archive SHA-256 is
`a61b502889fc71f623b6cac8b362569b5c96bd3104938fb949a3820824518fee`.
Its Windows clean-prefix installation, native initialization, reinstall, credential
persistence and launcher smoke passed. An exact-value Go-key check found no match in
the full Git patch history, staged diff or decompressed archive; the key stayed in
process memory and was never printed or supplied in command arguments. Source/history
pattern scanning also passed (1,161 tracked files).

Source commit `67c68e30d65ba812c4f12126f5243921fe66a90c` was pushed to private
`NotNull92/heraAgent` main after origin, identity, staged-content, secret and ancestry
checks. `ls-remote` matched the local SHA. Product CI
[37578298594](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37578298594) passed
all four jobs: both platform offline checks, Windows packaging and Windows/macOS
installed-package checks. The downloaded CI archive checksum
matched `944f53782ac68963c492a67705055fd3b48501e3b8e0033cf214d0ff2058314b`;
those exact bytes passed local Windows install/native initialization/reinstall,
credential persistence and launcher checks. The first invocation used the local
artifact directory's checksum and failed before installation; selecting the downloaded
artifact directory corrected the invocation. Native qualification
[37578328995](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37578328995) passed
the macOS arm64 build, explicit runtime installation/integrity and fresh-home native
initialization/profile smoke; its completed job log reports the current patch SHA and
binary SHA-256 `2e630d57c66b46e9c7ec0d881bb150a31124e10e870311bdda784a80338fa674`.
The optional 128 MB macOS binary download was stopped after remaining pending; no
local download/hash or execution of that binary is claimed. Windows was still building.
These CI checks do not use
existing credentials or perform inference. macOS live/manual and physical Korean IME
checks remain NOT_RUN. No public release, npm publication or global Codex change occurred.

### Historical mixed-worker experiment (superseded by product checkpoint above)

The user accepted GPT main for task selection, review and final application/testing,
with read-only Go DeepSeek workers for bounded discovery and proposals. The authorized
next step is a project-local native-runtime compatibility experiment (ADR-002).
At that experimental checkpoint, the shipped runtime remained official Codex 0.160.1
and external product mode was still blocked. The product checkpoint above supersedes it.

The full reference patch conflicts with 22 files on the pinned source. A smaller
experimental port now targets the existing V1 plaintext worker backend: user-owned
provider grants/roles, separate provider auth/catalog and persisted child routing.
Cross-provider history forks and V2 child creation are rejected in that experiment.
Both experimental runtimes built on native Windows. The smaller 0.160.1 App Server
port passed 101 model-provider tests, 27 focused role/grant tests, seven mocked native
integration tests (routing/auth separation; revoked grants and V2 rejected before a
child request; HTTP 401, 429, 400 and stream EOF with one request and no GPT fallback),
and a no-inference profile/initialization smoke. The other 1,761 integration tests were
filtered out, as were 2,528 other core unit tests; these are not a full native-suite
pass. An initial `codex-agent-roles --lib` invocation exited 1 because that crate has
no unit tests; the actual role tests above run in `codex-core`.
Its first live attempt failed before spawning: the unoptimized crypto build could not
decrypt the existing OS-backed auth store within age's calibrated work limit, and the
parent received HTTP 401. A separate read-only diagnostic confirmed the decryption
work-limit failure; the official runtime still reports ChatGPT ready. No credential
was replaced or copied. Optimizing only age/scrypt/salsa20 fixed the local build:
both the official and experimental App Servers reported ChatGPT ready. The optimized
Windows executable SHA-256 is
`50372c5d5b54d1597081a77d0b03fe73796f6091ace95bc70dc996081f9b65aa`.

The experimental runtime then passed these actual Windows live checks (exit 0):

- Astra/high parent -> Go `deepseek-v4.1-flash` child; native sentinel read,
  same-child follow-up, and marker returned to the parent.
- Cold process restart, same parent/child IDs and Go provider restored; the child
  recalled the marker without another file read.
- Actual child write command denied by the read-only sandbox, sentinel unchanged,
  and a second root spawn rejected with native `agent thread limit reached` output.
- An actual child sleep command interrupted through Hera's existing owned-tree
  cancellation; no active turns/background commands remained and an unrelated
  test-owned process survived.
- Cold restart into a main-only write phase: all three worker switches were false,
  an actual native spawn lookup failed, the Go child stayed unloaded with unchanged
  turn count, and only the GPT root applied the exact fixture change and ran its
  Node assertion successfully. The check file and sentinel stayed unchanged.

Parent: `01a114aa-825f-7321-b763-733282f5abf8`; child:
`01a114aa-c4ab-76b0-96ce-b9d48db4cedb`. These are experimental native cooperation
checks, not product Controller external-mode/apply acceptance. The error-path tests
use local mocked HTTP; they do not claim a real Go quota exhaustion or expired key.
Remaining safety checks, product/schema/fingerprint integration and patched runtime
distribution qualification are still outstanding.
Source checkouts/build outputs stay under ignored `.artifacts/`; the source-only patch
and pinned reproduction manifest are under `experiments/codex-provider-routing` and
excluded from the npm package. A manually dispatched Windows/macOS build/smoke workflow
ran at `b01ee01954105c66d5c411325adb298b9b37f859`. Its macOS arm64 job passed a
Rust 1.95.0 build and actual fresh-home native initialization/profile smoke; the
downloaded receipt identifies patch SHA-256
`7ee14e1215de57d917a4ea0ed6e3ef52c449ca616d9cd9bb321d7458b50013bb`
and binary SHA-256
`00c08bac7f0174fffdd99e4dac552f242f35408c7f284c248e48eb495654bff6`.
The Windows x64 job also completed successfully. This CI checks no inference or existing
credentials and does not run the native Rust test suite. The older reference runtime did
not open the existing Hera home or migrate its history.

CI run [37565451567](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37565451567)
at `7a8f2f3` passed macOS offline checks, failed the Windows picker test and skipped
installed-package jobs. Waiting for visible frames did not flush React's passive
input subscription. The test now uses React `act` around rendering and keyboard
transitions. Windows focused picker and typecheck passed (exit 0). Two full-suite
runs during the Rust build each timed out in five tests (43/48 passed, exit 1),
including unchanged file-sync tests; these are recorded failures, not a full pass.
A later serial run with a 60-second per-test bound passed 48/48 (exit 0); this does
not erase those default-timeout failures. Main `bb4dd24551955b1a8860a485e93e339276851483`
was privately pushed and its remote SHA verified. CI run
[37567629845](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37567629845) passed
all four jobs: Windows/macOS offline checks with normal timeouts and both installed
archive checks. The exact CI archive SHA-256 is
`81c5ce1ae8b12ac67249246cb2c71ba0e11e5cae9bfca62d6c1ae836f1799b95`;
those bytes also passed local Windows clean-prefix install, native initialization,
credential persistence, reinstall and launcher smoke (exit 0). macOS native-patch
live/manual checks remain NOT_RUN. No login material enters these checkouts or
tracked files.

The earlier sections below are historical. The real Go key is now present in the
OS credential store; a fresh process reports source=keyring. No key value was printed,
copied into the repository, sent in command arguments, or included in an artifact.
OpenAI remains the isolated official keyring login. Global Codex is unchanged.

GPT product collaboration is implemented and locally verified on Windows with
gpt-6-astra/high, gpt-6-luna/max and configured worker limit 3. Native loaded inventory,
spawn history and parentThreadId reconcile descendants, including V2 children omitted
from thread/list. No assumption of shared sessionId or separate conversation store.
Quiescence includes descendants/background commands; cancellation touches only owned
threads. Main-authorized task contracts are checked against latest native worker final
results and workspace baseline. Stale/missing results block apply. Worker test claims
are retained as unverified claims; only observed main test exit codes establish tests.

Windows live evidence (all pinned Codex 0.160.1):

- Product native collaboration, follow-up, marker recall after same-root/child resume,
  validated result contracts, reviewed exact file application and actual test exit 0:
  `scripts/live-product-workers.mjs --live`, root
  `01a1143c-cfaf-72e3-b5d5-fa41be2e1484`, exit 0.
- Actual worker write denial and unchanged sentinel: earlier product fixture root
  `01a11426-d7de-7520-a564-844e31093f15`, exit 0. The later positive fixture deliberately
  separates normal collaboration from permission-negative instructions. Its first
  revised run withheld a pass because no write attempt occurred; model compliance
  with a no-write instruction was not misreported as a native denial.
- Root N+1 and recursive child spawn rejection at fixture limit 1; after runtime
  restart all three spawn switches were false and an actual native spawn lookup/call
  failed, with no new child. Root `01a11428-9237-7232-8447-8cde51b0727d`.
  The combined script reports incomplete because the model declined to issue its
  never-policy escalation request. That subtest is NOT counted as a native denial.
- A separate on-request, read-only fixture exercised a real worker approval request
  and Hera's decline handler, with unchanged sentinel and no permission granted:
  `scripts/live-worker-approval.mjs --live`, root
  `01a11430-b1d5-7da3-9834-0dda8ce1daf2`, exit 0. Product policy remains never.
- `scripts/live-product-worker-cancel.mjs --live`: real child sleep interrupted,
  apply rejected while busy, entire tree/terminal inventory idle, workspace lock
  released, unrelated test-owned process preserved; exit 0.
- Public Controller.open (parallel mode) initialized and closed without inference
  using the matching local acceptance record; exit 0.

The local `metadata/worker-verification.json` contains only audited check outcomes,
native thread references and the code/configuration/platform fingerprint. It is not
shipped or committed. Missing/stale records block workers, and model/effort/limit or
runtime changes require fresh native checks. The current record covers this Windows
profile only. The fixture scripts are opt-in maintainer verification, not unattended
paid self-tests; they do not automatically mint acceptance from mocks. A newly started
thread is read metadata-only until its first turn because this native version rejects
includeTurns=true before then. Bounded hydration currently caps 512 threads / 32 MiB.

Go direct coding-expression probe: one request, 64 output tokens, 20-second bound,
requested and reported model deepseek-v4.1-flash, exit 0. An additional Responses HTTP
request returned 200. More importantly, `scripts/live-go-native.mjs --live` completed
a real native read-only command and returned an unpredictable marker from its file:
root `01a1143f-be40-75c3-820f-6a118d00f9eb`, exit 0. Provider request/stream retries
were disabled. An initial fixture launch had a malformed nested CLI config and exited
before inference; flattening the documented config keys fixed the test launcher.
This is standalone Go access, not cross-provider worker acceptance.

Cross-provider investigation: explicit V2 spawn model deepseek-v4.1-flash was rejected
as unknown (`01a11441-c59f-7520-bc45-ec035429fa55`). Omitting that argument allowed a
role-configured DeepSeek model, but the actual child provider remained openai and its
turn failed HTTP 400 (unsupported ChatGPT model), child
`01a11443-0a4c-7290-b6d1-cf50e236257d`. This is a failed route, never a successful Go
worker or a fallback policy. The first isolated cross-provider launcher omitted the
keyring setting and received OpenAI HTTP 401 before spawning; this test setup error
was corrected without touching saved credentials. External mode remains blocked.
An additional attempt requesting the older backend also failed with the same
unsupported ChatGPT model result (root 01a11444-5070-72c1-bfa7-e75e6314d8a1);
no alternate-backend compatibility is claimed. The pinned Codex role override source
omits model_provider. [ADR-002](adr/002-external-mode-blocked.md) records that source,
the requested DeepSeek Harness investigation and the architectural options.

Current local checks: typecheck/build and 48 offline tests passed, exit 0. Prepared
archive inspection and clean-prefix Windows install/reinstall/OS-credential persistence/
native initialization/launcher checks passed (exit 0). This is not a paid installed
model test. CI results for this source must be observed after reviewed private push.
Previous commit 2350c0d52faae2d0932db7c99f24b3b3e99d0f46 was uploaded and its CI run
37443934863 passed all four Windows/macOS offline and identical-archive install jobs.
Windows physical Korean IME/herdr and macOS manual/live remain NOT_RUN. Windows/macOS
product code and CI are retained. No public release, npm publication or license grant.

Private main commit 65a5480611ea190a786fabda871875522ea21699 was uploaded and remote SHA
verified. CI 37564398977 passed macOS offline checks, but Windows passed 47/48 tests:
the picker test sent its next keys after session state changed and before Ink committed
the replacement menu. Package jobs were skipped, not passed. The test now waits for
the rendered current menu and idle selection handler, with a bounded slower-runner
timeout. The focused picker test and full 48-test Windows suite passed locally after
the fix; the subsequent CI must be checked separately. Actual local TTY provider menu
showed both saved providers and exited 0; this does not establish physical IME/herdr.

Follow-up main a85ff66342c14db506dd300eda6269a1bc609309 was also uploaded and remote
SHA verified. CI 37564801010 again passed macOS offline and failed the Windows picker
test (47/48): the worker-effort check observed the main role's options. Waiting for
the menu title alone did not fully synchronize navigation. The test now waits for the
visible arrow selection and the composer after cancellation/save before sending its
next input. Focused test, typecheck and all 48 tests passed locally on native Windows;
the next CI result remains separate. Both failed runs skipped package jobs.

The requested precedent investigation is recorded with pinned sources in ADR-002:
native cross-provider forks exist, but their mock-based tests are not real Go acceptance;
routers also need encrypted task transport. No external runtime, proxy or Harness was
installed, no secret was moved, and no architectural extension was adopted.

## Provider setup and OS credential storage (2026-10-06)

User-requested scope extension: store Go credentials persistently in the OS credential
store and require initial OpenAI/Go setup. Windows uses CredReadW/CredWriteW/CredDeleteW;
macOS uses the native security utility and login Keychain. Secret material is passed
through pipes, never command arguments, project files or conversation text. Storage is
scoped to the canonical Hera home. No plaintext fallback, global Codex change, new
dependency or provider billing call is introduced.

`hera auth login go` accepts masked input; `--from-env` explicitly imports an existing
process key. `auth status go` reports presence/source, and `auth logout go` removes
only that saved entry. `/providers` and `\providers` offer exactly OpenAI and OpenCode
Go; startup opens this menu until both credentials are present in their OS-backed
profiles. Noninteractive model sessions also require setup. Credentials being present
is not a claim of valid entitlement or successful Go worker integration.

Native Windows checks: OS-store save/read, lookup from a fresh Hera process,
replacement, deletion and absence of plaintext files all passed (exit 0). The actual
TTY showed the existing OpenAI login and missing Go key, masked test typing, canceled
without saving, returned to setup and exited cleanly. The real Go key has not been
entered by the user yet; the original OpenAI credential was preserved. Offline tests
passed 40/40, including required setup, both command prefixes and masked paste handling.
Windows/macOS CI now includes native credential persistence checks and exact-package
reinstallation checks. Results for this source change remain to be observed. No local
Mac or live Go test was performed.

Initial provider CI run 37443536313 passed macOS native Keychain checks and all
40 Windows offline tests, but the Windows credential helper exceeded its 15-second
limit. The OS helper now has a bounded 60-second timeout, and the smoke records
initial read duration without credential contents. The follow-up CI result must
be checked independently; the failed initial run is not counted as a pass.
An additional Windows TTY check passed hidden CLI input, fresh-process lookup and
cleanup using a separate generated test profile.

Native API references: https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew
and https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/macOS/security.1.

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
[CI run 37425015641](https://github.com/NotNull92/heraAgent-private-archive/actions/runs/37425015641)
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

## Nordic-fantasy TUI presentation (2026-10-07)

The TUI presentation was restyled after the Skyrim HUD/menu look: a title plate, a
compass-style phase track, iron frames with gold corner studs, a journal panel with
an emblem title screen while the transcript is empty, and themed menus, review and
provider panels. The art and palette are original; no third-party asset, code or new
dependency was added. A public GitHub search found no licensed kit worth reusing.

This is a presentation-only change. Commands, key bindings, approval rules and every
displayed value are unchanged; the phase track and worker studs show only observed
state, and the activity mark is indeterminate. `NO_COLOR` and `ui.color=never` drop
all hues, `ui.reducedMotion` stops the activity animation, and the phase track and
worker row collapse on small terminals. The journal is now bottom-anchored, so
wrapped lines no longer hide the newest output.

Windows local: typecheck, build and 56 offline tests passed (exit 0), including new
checks for the colorless palette, the phase track, narrow collapse and newest-output
visibility. Colors were inspected from a truecolor render of the test frames in a
headless browser, not in a terminal. Actual Windows Terminal/herdr, IME, macOS
terminal and light-background checks are NOT_RUN. CI for this change is not observed.

Follow-up the same day, at the user's request: the composer has gold top and bottom
rules, a bare `>` prompt and an English placeholder; a "Worker model" row names the
configured provider, model and effort (configured values, not an observed route).
Divergence from the illustrative Section 15.3 layout: the static "worker
verification / quota unknown" row and the "no approval pending" row are removed.
The worker row appears only with live native collaboration, the approval row only
while a notice is pending, and the /help hint moved to the composer key line.
Windows local after these edits: typecheck, build and 57 offline tests passed (exit 0).

Korean input follow-up: the composer drew its own caret while the terminal cursor
stayed hidden, so a terminal IME had nowhere to show the syllable being composed and
Korean text appeared only after each commit. The composer now places the real cursor
at the caret through Ink's cursor API (cell widths for Hangul/CJK/emoji, newlines and
hard wraps) and no longer draws a substitute caret. Windows local: typecheck, build
and 58 offline tests passed (exit 0). A fake-TTY render emitted the expected
cursor-move and show sequences (column 10 after typing "한글 ab"). Composition in an
actual Windows Terminal/herdr or macOS IME is NOT_RUN and remains the acceptance check.

## Usage display (2026-10-07)

The TUI shows a usage line under the requested model (and under the worker model in
gpt_only mode, which shares the OpenAI account). It reads the native
`account/rateLimits/read` at startup and after each model turn, merges sparse
`account/rateLimits/updated` notifications, and draws only the windows the runtime
returned, labeled by their real duration. Nothing is estimated; unread and
unavailable states are stated as such.

Windows local: typecheck, build and 59 offline tests passed (exit 0). Live read-only
check against the authenticated pinned runtime (no inference): one `codex` bucket
with a single 10080-minute window and no 5-hour window or per-model bucket; the
product session's refresh returned the same snapshot.

Live Go usage probe, explicitly requested by the user: one direct native Go
read-only text turn (deepseek-v4.1-flash, effort low, retries disabled, 120 s bound)
completed. The runtime emitted one `thread/tokenUsage/updated` (7,122 total tokens,
6,784 cached input, 2 output) and one `account/rateLimits/updated` whose windows
were all null; `account/rateLimits/read` on that Go-configured runtime failed with
RPC -32600. So token counts are observable for a Go-routed thread, Go limits are
not. The official Go page documents 5-hour/weekly/monthly limits visible only in the
web console. This was the stock-runtime direct route, not a patched cross-provider
worker child; worker-child attribution of token usage is NOT_RUN. No usage line is
shown for Go workers yet.

Worker token attribution follow-up, explicitly requested by the user: one live
external_workers product turn in a disposable workspace (GPT main spawning one Go
worker to read a sentinel, read-only, 300 s bound) completed with exit 0. The
runtime emitted `thread/tokenUsage/updated` for two distinct thread IDs, so totals
can be attributed per thread. During the Go turn `account/rateLimits/updated`
arrived with null windows, while GPT turns carried the weekly window; the sparse
merge keeps the last observed window. The per-thread detail at the top of the probe
output was cut off by the capture, so the exact main/worker split of that run is not
recorded here.

The TUI now appends the observed cumulative thread tokens to each usage line (main =
the root thread, workers = the sum of the other owned threads; cached input is
included in the runtime's total). The Go worker line shows those tokens plus a
pointer to the provider console and never a limit figure. Windows local: typecheck,
build and 60 offline tests passed (exit 0). The token display has offline render
tests only; it has not been observed in a live TUI session.

## Composer keys follow Claude Code (2026-10-07)

At the user's request the composer key bindings now follow Claude Code and the key
guide line under the input is removed. Enter sends; backslash+Enter, Shift/Alt+Enter
(when the terminal reports the modifier) or Ctrl+J inserts a line; Escape interrupts
active work and, pressed twice within a second, clears the input; Ctrl+C interrupts
active work, otherwise clears the input and arms exit (the placeholder turns into a
red farewell), and a second Ctrl+C exits through the existing cleanup; any other
input disarms it. Ctrl+D on an empty input behaves the same. Up/Down recall sent
input and Ctrl+A/E/U/K/W edit the line. Ctrl+S no longer sends; Ctrl+Q still exits.

This supersedes the earlier "Enter inserts a newline, Ctrl+S sends" behavior.
Bracketed paste still never submits or exits, a pasted leading slash stays literal,
and a single input chunk containing text plus a carriage return does not submit.
Windows local: typecheck, build and 65 offline tests passed (exit 0). Real terminal
key reporting (Shift+Enter, Alt+Enter) and IME behavior are NOT_RUN.

## Scrollback conversation and input footer (2026-10-07)

At the user's request the TUI now behaves like a shell-style agent session. The
framed fixed-height journal is gone: a banner (title plate, emblem, greeting,
workspace) is printed once, every finished transcript line is written once through
Ink's Static output so it stays in the terminal's own scrollback, and only the
unfinished line remains in the live area above the input. Slash commands are echoed
into the transcript like other input; `/providers` is echoed without arguments.
Lines already written keep their slot but drop their text beyond the newest 2,000,
and the session transcript stays a 128 KiB sliding window.

Everything that changes at runtime moved to a footer under the input panel: the
phase track (always shown; studs plus the current name below 76 columns), a status
line (activity, status, mode, exact phase, live worker count) and one line per role
with the configured route, the observed limit windows and observed thread tokens.
The empty-state setup hint was removed earlier and the greeting is one of eleven
short Skyrim lines chosen per start.

Windows local: typecheck, build and 74 offline tests passed (exit 0). A fake-TTY
render confirmed the banner and finished lines are written once and not repainted
when typing, and that the cursor lands on the input row; one render after a new
unfinished line appears places the cursor a row high before the next frame corrects
it. Behavior in an actual Windows Terminal/herdr (scrollback, resize reflow, IME)
is NOT_RUN.

Follow-up at the user's request: the cumulative token figures were removed from the
footer, together with the session's per-thread token tracking that only fed that
display. The role lines now show the configured route and the observed limit windows
(or the plain limit statement) only. Windows local after this edit: typecheck, build
and the offline tests passed (exit 0).

Further footer trimming at the user's request: the worker line no longer names the
provider, and the status line no longer repeats the exact phase name (the phase track
remains the phase display). Windows local: typecheck, build and 74 offline tests
passed (exit 0).

Resize fix (user report: dragging a herdr pane border stacked input rules): a terminal
re-wraps the rows it already holds when its width changes, so the rows Ink erases by
count no longer match the live area. Once resize events settle for 100 ms on a TTY,
the TUI now clears the screen and scrollback (CSI 2J, 3J, H) and prints the banner
and conversation again at the new width. Windows local: typecheck, build and 81
offline tests passed (exit 0), including a test that the clear is written once after
a burst of resize events. The cause was read from Ink 8.0.0's resize handler, not
reproduced; behavior in herdr or any real terminal is NOT_RUN. A terminal that
ignores CSI 3J would keep the old copy in scrollback above the reprinted one.

Resize follow-up (user observed in herdr: rules still stacked while dragging and
vanished on release, which confirms the settle-time clear works there): the clear no
longer waits for resizing to settle. A prepended resize listener wipes the screen and
scrollback before Ink repaints for the same event, and the next 50 ms tick reprints
the banner and conversation. Windows local: typecheck, build and 81 offline tests
passed (exit 0). Behavior while dragging in herdr after this change is NOT_RUN; a
long conversation is reprinted up to 20 times per second during a drag.

Footer label at the user's request: the adaptive mode now reads `Astra + DeepSeek`,
matching the order of the two role lines below it (deep reasoning, then routine work);
the root that receives the conversation in that mode is still DeepSeek. Windows local:
typecheck and the 16 TUI tests passed (exit 0); the full suite was not rerun.

Command prefix at the user's request: commands start with `/` only, on Windows and
macOS alike. A leading backslash is ordinary text: it no longer runs a command, opens
the command list or gets the pasted-command space guard. Backslash+Enter still inserts
a newline. The web-research note, `/help` text and the tests that used the
backslash alias were updated. Windows local: typecheck, build and 86 offline tests
passed (exit 0). Real-terminal behavior is NOT_RUN. Two command-list defects found in
the same review remain open: typing `/mode` in full and pressing Enter runs `/model`,
and recalling a sent command from history reopens the list and traps Up/Down.

Command list follow-up at the user's request: descriptions on unselected rows are now
iron so command names read first. The owner confirmed four list behaviors as intended
(no "no match" row, the hint row, the six-row cap, Latin letters only); they are
recorded with the other TUI decisions in the new `docs/ux-guide.md`, which the new root
`CLAUDE.md` references alongside `AGENTS.md`. Windows local: typecheck and 86 offline
tests passed (exit 0). The color change was not viewed in a real terminal (NOT_RUN).

Go effort probe at the user's request (live, 2026-10-08, 20 direct non-streaming
`/responses` requests to the Go route with `deepseek-v4.1-flash`, no retries; not run
through the native runtime): the gateway returned 200 and echoed the effort for `none`,
`minimal`, `low`, `medium`, `high`, `xhigh` and `max`, and 422 for an invalid value.
`none` produced 0 reasoning tokens and a wrong answer to a simple sum. For `minimal`
through `high` the reasoning-token counts were indistinguishable (easy sum 46-60;
mid-difficulty question 225-242); `max` gave 278 and 300 on that question (two samples,
not conclusive). A harder question hit the 2000-token output cap at every effort.
Native Go turns with tools at any effort other than `low` remain NOT_RUN, so
`GO_EFFORT` is unchanged.

Selectable Go worker effort at the user's request: `workers.goReasoningEffort`
(`low`, `high`, `max`; default `low`) replaces the fixed `low`. `/effort worker` and the
effort picker offer the three levels in the Go modes and reject anything else; the
selected value feeds the Go role file, the adaptive root turn effort, worker routing
checks and the footer. The saved GPT worker choice is untouched. Because the
verification fingerprint covers these sources and the worker settings, all three
native verification records became stale, as expected. Windows local: typecheck, build
and 86 offline tests passed (exit 0). Live, with the user's go-ahead and the Go effort
saved as `high` (main `gpt-6-astra`/high): `scripts/live-native-workflow.mjs --live
--record` passed all seven checks (conversation, editTest, resume, routing, approval,
cancel, concurrency) for `adaptive`, `external_workers` and `gpt_only`, and all three
modes report ready again. `low` and `max` were not re-verified with this code (NOT_RUN);
changing the Go effort makes the records stale until the suite is run again. macOS
NOT_RUN.

Mode picker labels at the user's request: `/mode` now lists `[GPT 밸런스] Astra 깊은
추론 · Luna 일상 작업` (gpt_only), `[HERA 밸런스] Astra 깊은 추론 + DeepSeek 일상 작업`
(adaptive) and `[HERA 개발] Astra 깊은 추론 + DeepSeek 개발 작업` (external_workers), in
that order. Only the labels and their order changed; the values and mode behavior are the
same. The labels name Astra and Luna literally, while the models stay configurable.
Windows local: typecheck, build and 86 offline tests passed (exit 0); the native
verification records stay ready because this file is outside the fingerprint.

## Design and Development modes — 2026-10-08

Supersedes the three-mode picker described above. GPT Balance is retired from
the picker, slash command and native task startup. Legacy config/session metadata
and historical test fixtures remain readable; there is no automatic provider
migration. Select `/mode` or `hera init --mode adaptive|external_workers` explicitly
for retired settings. New installations default to HERA Design (`adaptive`).

HERA Design replaces the HERA Balance label. Its base/developer instructions
contain design/research guidance, without the coding workflow. Its local handbook
tool exposes only `research` and rejects `coding`, including calls from children
using that server. HERA Development (`external_workers`) loads the unchanged full
pinned coding handbook on demand; both modes retain lightweight greetings.
The shared research guide no longer instructs automatic coding continuation;
Development supplies that continuation in its own developer instructions.
This is an instruction-scope change, not a new read-only sandbox. Explicit edit
and permission regression requests still use native permissions in either mode.
Existing native histories are preserved; start a fresh session for the new scope.

Windows local results (exit 0): typecheck, build, 91 tests across 18 files; targeted
native fixture rerun after correcting its saved mode; isolated CLI selection and
retired-mode rejection; archive inspection and clean-prefix install, native
initialization, reinstall/settings/keyring preservation and launcher smoke.
Prepared local artifact SHA-256:
`e3666c6a4b6bf0fd027d3bfcfcbacf5c44874b164aeb05ed3da8ef5c23d7d594`.
No release or npm publication.

With the existing live-test authorization, both supported modes passed the bounded
native suite (conversation, edit/test, resume, routing, approval, cancellation and
concurrency), using Go low and the selected GPT high. Development loaded the full
UTF-8 coding guide before edits, including complete model-visible output. Design
loaded research guidance and delegated deep planning to Astra, without a coding
handbook call across the test history. Separate MCP tests reject an explicit
coding-topic request in Design. Both current configurations report ready:

- Design: `f278c6554d36d9d76e62acf4302ece1361ab8ee75009f5c3d0f18abd442166b8`.
- Development: `a8057a023432a83d4852c7113ba94f677c2bae83561b947bc857e2500e0bb81f`.

User settings and running user sessions were not changed. Windows/macOS CI remains
configured; macOS live/manual checks for this revision are NOT_RUN. CI results
must be checked separately for the pushed commit.

Bold rendering at the user's request: a closed Markdown `**pair**` on one line of model
output is drawn bold without the asterisks; `You: ` lines stay literal and unpaired or
space-padded asterisks are left alone. The match is per line and unaware of code fences.
Windows local: typecheck, build and 92 offline tests passed (exit 0); a color-enabled
test render showed the bold escape around the emphasized words. Viewing it in a real
terminal is NOT_RUN. Separately, the user enabled a personal answer-style file at
`~/.hera/codex/AGENTS.md` (outside the repository); one live `hera run` question in the
HERA Design mode returned an answer-first reply with bold lead-ins from DeepSeek.

Voice picker at the user's request: `/style` lists the user's own Markdown voice files
in `<Hera home>/output-styles/` plus "own voice", and writes the chosen one into the
isolated runtime's `AGENTS.md` between `hera-style` markers, preserving other text
there; it applies from the next session. The three published voices are shown under
Hera names (현자, 전사, 전령). No voice text is bundled: the upstream files are AGPL-3.0
and stay in the user's home. Windows local: typecheck, build and 93 offline tests passed
(exit 0), including marker handling, frontmatter stripping, rejection of unknown or
path-like names and removal of an emptied file. On this machine the three upstream
files were placed in the Hera home and 현자 re-applied through the new code. NOT_RUN:
the picker in a real terminal; a live turn after switching voices; whether worker
threads also read the voice; the README files (three languages) do not mention `/style`.
The native verification records stay ready (these files are outside the fingerprint).

Voice checks at the user's request (live, 2026-10-08, HERA Design mode, root
`deepseek-v4.1-flash`, one `hera run` question per voice in a fresh scratch workspace,
voice switched through `setStyle`): 전사 (spartan) returned a blunt answer-first reply
in arrow paragraphs; 전령 (rundown) returned a TL;DR line, a ✅/🟡/⬜/🔴 checklist and
numbered next moves; 현자 (attention-kind) was confirmed earlier. Observed defects of
the voices themselves: an English heading ("Your move:") inside a Korean reply, and
em-dashes the spartan text does not forbid. Workers do read the voice: in a run that
spawned one Go worker, the worker thread's session record (source `thread_spawn`, role
`worker`) contained the voice text and its report used the arrow/bold format. Emoji
column alignment in a real terminal and the `/style` picker in a real terminal remain
NOT_RUN. The active voice was left at 현자.

Voice follow-up at the user's request (no mixed English, a shorter 전사, no formatting in
worker reports): every applied voice is now wrapped by two Hera-owned lines, one before
the voice text (human-facing replies only, user's language, workers report in plain
text) and one after it (English labels are placeholders to translate). Windows local:
typecheck, build and 93 offline tests passed (exit 0). Live rechecks (one `hera run`
each, HERA Design, DeepSeek root): 전령 answered with 요약 and 다음 행동 instead of TL;DR
and "Your move"; 현자 had no English label; a one-worker run returned the worker's part
as plain sentences without arrows or bold. A first attempt with only the leading line
still produced "TL;DR", "Your move" and "Also found", which is why the trailing line
exists. The 전사 length change is a local edit to the user's own
`~/.hera/output-styles/spartan.md` (a cap of line one plus four short points), not part
of the repository; the same question went from eight points to four. These are single
samples, not a measured rate. Technical terms such as PostgreSQL stay in English.
A later local edit to the same user file added a curt-register rule (plain Korean
endings, no politeness markers); one live rerun of the question returned line one plus
three flat statements in plain endings.

Enter-as-newline fix (user report: Enter after typing sometimes added a line break
instead of sending): Ink delivers characters and the Enter that follows them as a single
text chunk when the terminal batches them (fast typing, an IME commit, a busy event
loop), and the composer inserted that chunk verbatim, turning the CR into a line break.
A printable run of at most 16 characters ending in one CR is now inserted and then
handled as Enter; longer or multi-line chunks and a chunk that alone forms a `/command`
keep the paste-safe behavior. Windows local: typecheck, build and 94 offline tests
passed (exit 0). The cause was derived from the input handler and the existing
embedded-control test, not reproduced in a real terminal; whether this covers every
occurrence the user saw is NOT_RUN.

Attention Span integration review fixes (2026-10-08): prose-only bold rendering
preserves inline code, backtick/tilde fenced blocks, indented code and user
continuation lines. Completed transcript lines retain their formatting flags;
only completed lines advance fence state, so streaming and resize keep code
literal. Voice saves reuse the existing serialized temporary-file/fsync/rename
writer (now shared by JSON and text), preserving prior AGENTS.md contents if a
write or replacement fails. The voice picker always offers Own voice, even after
the active voice's source file is removed.

Windows local: typecheck, build and 98 offline tests across 19 files passed
(exit 0). Regression checks cover streamed code and resize, source-file deletion
followed by picker reset, and injected partial-write/rename failures with original
instructions retained and temporary files removed. No user voice files or live
runtime settings were changed. Live model calls and physical terminal checks are
NOT_RUN for this change; Windows/macOS CI results are recorded separately from
these local results. No dependencies or bundled third-party voice texts were added.

Immediate submitted-input echo (2026-10-08): normal TUI submissions now append
the user's text before awaiting provider readiness and runtime connection. The
composer previously cleared while `connect()` ran, leaving no visible submitted
message until startup finished. The Hera reply prefix is still added only after
connection succeeds; failed connections keep the user's message visible.
Windows local: typecheck, build and 29 targeted tests (TUI, provider setup and
settings commands) passed, exit 0. A deferred-connection UI fixture verified
Korean typing, Enter echo while connection remains pending, and preservation
after connection failure. No live model calls or physical terminal checks ran;
cross-platform CI results remain separate from these local checks.

First-reply latency diagnosis (2026-10-08): the existing greeting rollout used
DeepSeek Flash/high in Design, with no tools/workers, 10,051 input tokens (9,856
cached), first token at 2,560 ms and native turn completion at 3,365 ms. Compact
Hera base instructions do not remove native tools, skills, permissions, project
AGENTS.md or the user's separately installed voice. No new inference was invoked
for this investigation and no model/effort/voice settings were changed.

A disposable-workspace, no-turn native startup measurement took 13,691 ms:
InteractiveSession performed provider discovery before Controller.open repeated
the required live credential/model checks. Removed that redundant discovery from
connect; Controller retains authentication, model, capability and sandbox checks,
and a credential failure still reopens provider setup. Configured TUI startup now
prepares the native session before reporting Ready, with a visible preparation
status, so the first greeting reuses the prepared session without a startup wait.
A subsequent no-turn sample took 8,862 ms cold and less than 1 ms to reuse the
prepared connection. These are single local samples, not a controlled provider
benchmark or a claim that model/network latency disappeared. Model response speed
after the change and physical terminal behavior were not remeasured.

Windows local: typecheck, build and all 100 offline tests (19 files) passed,
exit 0. Tests cover pending preparation, Ready ordering, native gate propagation,
missing-credential recovery and submitted-input echo. No native qualification
fingerprint inputs changed. CI results remain separate from local evidence.

Startup check reuse (2026-10-08): one startup attempt now shares in-flight
account/model discovery, OS credential reads, schema verification, native
qualification and mixed-runtime integrity results. Independent provider/key
checks and Controller readiness checks run concurrently. The startup scope is
discarded on success or failure, including callbacks retained by a runtime;
subsequent attempts revalidate. Authentication, model compatibility, native
permissions and qualification gates remain enforced. No dependencies were added.

The preceding configured TUI startup sample took 13,469 ms. Three fresh temporary
workspace startups through initializeProviders now took 6,441 / 6,472 / 6,211 ms,
each with exactly one official account/model discovery process and less than 1 ms
to reuse the prepared session. These samples used Design with the existing user
configuration, project AGENTS.md and user voice. Configuration and voice bytes
were verified unchanged. These are local observations, not a controlled provider
benchmark; the three startup measurements made no inference calls. Model response
time and physical terminal paint latency are separate from startup time.

Windows local: typecheck, build and all 102 offline tests (20 files) passed,
exit 0. Tests cover concurrent/nested sharing, separate attempts, failed checks,
callbacks after scope completion, discovery process reuse and runtime tampering
between attempts. Native fingerprint inputs include the new startup helper and
account discovery module. Under the user's existing live-fixture authorization,
both adaptive and external_workers passed conversation, edit/test, same-thread
resume, routing, approval denial/allow-once, cancellation and concurrency checks
in disposable workspaces, with a 180-second per-stage limit. Development loaded
the full coding handbook before edits; Design kept the coding handbook absent
and used the research handbook and an actual GPT worker for planning. Fresh local
qualification evidence was recorded only after each complete suite passed;
previous records were backed up. macOS live/manual checks remain NOT_RUN.
Cross-platform CI results are separate from these local results.

## Pause labels in the status line (2026-10-08)

Investigation of perceived DeepSeek slowness in Design mode, measured from the
runtime log database and session rollouts (local observations, one machine):

- "안녕?" on the DeepSeek root: 3.5 s from Enter to the first visible character
  (Hera pre-turn checks 0.3 s, native turn preparation 1.0 s, gateway response
  headers 1.4 s, first token 0.4 s, reasoning 0.2 s). A GPT root greeting: 2.5 s.
- Reasoning at effort high ran 12 to 642 reasoning tokens (0.2 to 3.7 s) even for
  trivial prompts, none of it visible.
- One design question in the qualification run took 171 s: handbook load round
  trip about 8 s, Astra hand-off wait 148 s, three DeepSeek reasoning passes
  about 15 s. Nothing was printed during that time.
- Text deltas arrive spread over generation; streaming itself is not buffered.
- Every model request rebuilds the HTTP client (certificate load logged per
  request); DeepSeek responses came through a US Cloudflare edge. This cost is
  shared with GPT and is outside Hera.

No DeepSeek-specific defect was found in Hera. The perceived delay is the sum of
hidden reasoning, the mandatory handbook load and Astra delegation with no
feedback. Change: the status line now names the root thread's current pause
(waiting for the model, thinking, reading the handbook, running a command,
handing off to or waiting for Astra or a worker) with an elapsed counter, from
native events of the root thread only, cleared when reply text streams. Code:
`src/session/interactive.ts` (`observe`, `activity`) and `src/tui/App.tsx`
(`Activity`); neither is a native fingerprint input.

Windows local: typecheck, build and all 103 offline tests (21 files) passed,
exit 0. The new test drives the session with native event fixtures. NOT_RUN: the
labels in a real terminal with a live turn; macOS.

## Narrow adaptive instruction triggers (2026-10-12)

Owner-approved revision to the earlier automatic Design/DRD guidance: adaptive
loads the research handbook only before web_search/web_fetch, spawning or
messaging a worker, or workspace commands. Knowledge/conversation answers stay
direct. Loaded guidance is reused from native history and reloaded if absent
after compaction. The shared handbook now scopes the numbered DRD workflow to
Development, so loading it cannot restore broad adaptive delegation.

Adaptive consults Astra only for an explicitly requested design proposal,
architecture/technology decision, alternatives comparison with a recommendation,
deep thinking, or when the root cannot answer reliably. Explanations, factual
questions, summaries, snippet reviews and follow-ups otherwise stay with the
root. Before a hand-off it streams a short notice in the user's language, then
spawns once and waits. Model/identity/configuration answers use the developer
role description; unknown details are acknowledged without searching files.
The root description includes its configured DeepSeek model and effort.

Changed `controller.ts`, the adaptive handbook tool description and research
handbook, with focused instruction assertions and live acceptance checks.
Development's base instructions were compared byte-for-byte with HEAD and are
unchanged. Astra role configuration/model/effort, native sandbox, approvals,
search policy/catalog and routing gates are unchanged. This is model guidance,
not a new execution gate. No dependencies were added. Claude's existing pause
label changes were preserved; this section is appended after that work.

Windows local (win32/x64, Node v24.12.0, PowerShell 7.6.6):

- `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test`: PASS, exit 0;
  all 103 offline tests in 21 files passed.
- `node scripts/live-native-workflow.mjs --live --record --mode=external_workers`:
  PASS, exit 0. Complete coding handbook before edits, actual edit/test,
  same-thread resume, worker routing, denial/allow-once, cancellation and
  concurrency passed. Fresh qualification recorded at 01:02:41 UTC.
- `node scripts/live-native-workflow.mjs --live --record --mode=adaptive`:
  first attempt FAILED at the unchanged 180-second planning deadline, exit 1,
  with no qualification record written. The exact unbounded acceptance prompt
  announced Astra in Korean before one `spawn_agent(hera_astra)` and wait. Astra
  completed after about 164 seconds; the root did not finish before the deadline.
- Adaptive rerun with the fixture's bounded two-sentence design scope: PASS,
  exit 0, qualification recorded at 01:06:48 UTC. Korean commentary streamed at
  5.510 s before the single Astra spawn; final answer completed at 80.613 s.
  The research handbook loaded completely before the first workspace command
  and was reused across resume and the later consultation. No coding handbook
  loaded. All existing edit/test, routing, permission, cancellation and
  concurrency checks passed. Previous qualification files were backed up by
  the existing recorder; no gate or per-stage deadline was relaxed.

Both fresh Design runs used the existing Go high effort. The three direct-answer
turns contained no tool calls or workers (including no handbook or shell calls):

| Prompt | First text, run 1 | First text, run 2 |
| --- | ---: | ---: |
| Greeting (`안녕?`) | 3.136 s | 3.062 s |
| HTTP/2 vs HTTP/1.1 explanation | 18.747 s | 6.703 s |
| DeepSeek identity question | 3.115 s | 3.361 s |

Times measure the first root text delta from the live controller, not physical
terminal paint. Native rollout inspection confirmed the first HTTP answer used
2,416 reasoning tokens despite making no tool calls. The unnecessary handbook
and delegation round trips are gone for these samples, but a consistent
few-second factual answer is NOT achieved; provider/model reasoning latency
remains. The unbounded design answer's full completion remains unverified after
its timeout. These are local samples, not a controlled speed benchmark.

NOT_RUN: physical TUI paint/IME checks, a separate web-only live request, live
compaction/reload, Windows CI, macOS CI, macOS live/manual checks, package smoke
and release checks. Windows/macOS CI configuration is preserved. No release,
npm publication, commit or push was performed for this change.

## Follow-up: answer scope and remaining reasoning latency (2026-10-12)

The earlier bounded two-sentence planning pass did not complete the owner's
original latency acceptance. The live workflow now uses the exact original
design question again, without a two-sentence limit or a no-web hint.

Rollout inspection found the root had expanded that short question into an
implementation specification, at least three alternatives, an extensive
failure-mode survey and a test plan. Astra returned roughly 18,000 characters.
Adaptive instructions now match assignments to the requested scope: an ordinary
recommendation asks for a decision brief, normally within 250 words, including
rationale, the main tradeoff and correctness risks. Explicit depth requests and
correctness requirements override that default. The root checks and synthesizes
the result without independently re-solving the same design. Familiar factual
explanations default to the core distinction and essential caveats rather than
an unsolicited survey. No model, effort, user style, sandbox or routing setting
was changed.

Actual Windows live observations with the saved Go high and unchanged Astra high:

- Exact original design request completed in 52.712 s in the first follow-up,
  51.629 s in a fresh acceptance session, and 40.275 s in final qualification.
  Each used one Astra consultation and wait, with Korean commentary first. The
  fresh acceptance session loaded research before its first spawn; later
  qualification reused the handbook already loaded for workspace work.
- Added `node scripts/live-design-latency.mjs --live`: three fresh Design
  sessions, the original Korean prompts, no tools on direct answers, and one
  full design request with the existing 180-second deadline. It checks actual
  first text, handbook ordering, streamed announcement, Astra role/model/effort
  and cleanup. It does not add a product timeout or another inference loop.
- This stricter acceptance run FAILED its five-second direct-answer target,
  exit 1: HTTP first text was 7.774 / 3.774 / 5.051 s. All three greetings and
  identity questions were under five seconds; the full design request finished.
  The final qualification HTTP sample was 3.476 s. These passing individual
  samples do not erase the failed repeated latency check.
- An isolated low-effort experiment produced HTTP first text at 4.573 / 5.761 /
  10.804 s, still with reasoning tokens. It was not saved as a user setting.
- An isolated `none` experiment through the same pinned native runtime and
  OpenCode Go model produced HTTP first text at 2.533 / 2.638 / 2.579 s, with
  zero reported reasoning tokens and no tools in all three fresh sessions.
  [DeepSeek's thinking-mode documentation](https://api-docs.deepseek.com/guides/thinking_mode/)
  motivated the probe; these observed Go results, not upstream documentation
  alone, establish support for these text-only samples. No direct DeepSeek
  billing route, fallback or runtime patch was used.

The `none` option is NOT enabled in the shipped configuration or current user
settings, and these text-only probes are NOT full workflow qualification.
Applying it only to the Design root requires a separate setting, matching
runtime/turn/routing checks, and accurate effort display. The existing Go effort
is shared with Development workers, so changing it globally would violate the
requested scope. Owner confirmation was requested because the minimal settings
UI changes would touch the explicitly protected `interactive.ts` and `App.tsx`.
Their existing bytes, `tests/activity.test.tsx` and `docs/ux-guide.md` remain
unchanged while that decision is pending. Astra configuration stays unchanged.

Windows local typecheck, build and all 103 offline tests passed, exit 0.
Both final `live-native-workflow.mjs --live --record` runs passed, exit 0:
`--mode=external_workers` recorded at 01:23:27 UTC and `--mode=adaptive` at
01:24:02 UTC. Both passed conversation, actual edit/test, same-thread resume,
observed routing, denial/allow-once, cancellation and concurrency with the
existing safety checks and deadlines. The current fingerprints were rechecked
against the saved receipts. These are workflow passes, separate from the failed
five-second latency acceptance above.
NOT_RUN: physical TUI, macOS/CI, live compaction, full workflow with a separately
configured non-thinking root, package/release checks. No user configuration or
credentials were changed, and no commit, push or publication was performed.

## Design root without hidden reasoning (2026-10-12)

Owner approval to modify the previously protected settings display/save paths
in interactive.ts and App.tsx supersedes the pending decision above. Their
existing pause-label changes were preserved. activity.test.tsx and ux-guide.md
remain byte-identical to the initial working tree, and the original status.md
prefix remains unchanged.

Added optional user setting designReasoningEffort (none/low/high/max). It affects
only the adaptive root's startup, turn effort, role description, routing checks
and settings display. Missing settings retain the old Go effort. The Go worker
schema still accepts only low/high/max, and Astra's model, role and effort are
unchanged. Project settings cannot override this field. Switching between none
and thinking requires separate native qualification; no sandbox, approval,
search or routing check was relaxed.

Applied designReasoningEffort=none to the owner's local config after an exclusive
backup, config.json.2026-10-12T01-30-07.136Z.bak in the Hera home. Read-back comparison
confirmed every other setting unchanged: Astra high and Go workers high. No
credentials or global runtime were changed. README documents selection, legacy
behavior, qualification and downgrade removal of the new optional field. Existing
running processes must reload this build/config; use a fresh Design session.

Actual Windows results:

- Typecheck, build and all 107 offline tests across 21 files passed (exit 0).
  Tests cover separate effort save/display, legacy fallback, project rejection,
  root/child routing drift, and distinct none qualification.
- The initial none latency run passed all nine direct-answer timing/tool checks
  but FAILED the handbook-before-spawn assertion. Its design response completed
  in roughly 38 s, but this was not acceptance. The adaptive hand-off instruction
  now explicitly sequences announcement, absent-handbook load/read, then spawn,
  without batching the prerequisite; fresh workers receive the loading rule.
- After that correction, node scripts/live-design-latency.mjs --live PASSED,
  exit 0, with three new native Design sessions. First root text, measured from
  Controller.run (session startup excluded), in seconds:

  | Prompt | Sample 1 | Sample 2 | Sample 3 |
  | --- | ---: | ---: | ---: |
  | Korean greeting | 2.462 | 3.030 | 2.635 |
  | HTTP/2 versus HTTP/1.1 | 1.973 | 1.886 | 1.986 |
  | DeepSeek identity | 1.815 | 1.738 | 1.772 |

  All nine direct turns used no tools/workers and reported zero reasoning tokens.
  The exact original offline-first to-do sync design request streamed its Korean
  Astra announcement at 1.806 s and completed in 44.375 s. The rollout confirmed
  research loaded before one hera_astra spawn, wait, and the selected OpenAI
  model/high effort; cleanup completed. The deadline remains 180 s.
- node scripts/live-native-workflow.mjs --live --record --mode=adaptive PASSED,
  exit 0, recorded at 2026-10-12T01:36:51.401Z, fingerprint
  c5e25d6232c295f64404c572981b19d9fc42a55d898970132e0043b205e57284.
  HTTP first text was 1.548 s; the exact design request announced at 2.254 s and
  completed in 42.322 s, reusing the handbook already loaded for workspace work.
- node scripts/live-native-workflow.mjs --live --record --mode=external_workers
  PASSED, exit 0, recorded at 2026-10-12T01:36:41.082Z, fingerprint
  9f850a8e127a37f57faa7fa7476496d676b5cea9cbc47ddfd86753e1317fc096.
- Both suites passed conversation, actual edit/test, same-thread resume, routing,
  real approval denial/allow-once, cancellation and concurrency. Both recorded
  fingerprints were rechecked against the final build and saved config: ready.

These are observed samples, not a provider latency guarantee. The timing fixture
is not a factual-quality benchmark: some sampled HTTP explanations oversimplified
HTTP/1.1 pipelining or connection reuse. none removes root deliberation; Astra
continues to use high for delegated design decisions.

NOT_RUN: physical TUI/manual interaction, macOS/CI, live compaction, exhaustive
factual-quality evaluation, package/release checks, and live high/low effort-switch
fixture on this final fingerprint. No commit, push or publication was performed.

## Terminal check of pause labels and the none root (2026-10-12)

Actual Windows results, build 8daa223, `hera` driven in a psmux (tmux 0.4.1) pane
of 110x36 with the status line sampled every 0.3 s. The workspace was a scratch
folder because the owner's own Hera session from 2026-10-08 still held the lock on
the repository (pid 39056; that session runs the pre-c6938b7 build until restarted).

| Turn | Enter to first visible text | Labels seen |
| --- | ---: | --- |
| 안녕? | 4.4 s (first turn of the session) | 응답 기다리는 중 0:00–0:02 |
| 지금 답변하고 있는건 딥시크지? | 2.9 s | 응답 기다리는 중 0:00–0:02 |
| 오프라인 우선 할 일 앱의 동기화 설계안을 추천해줘 | 2.5 s (announcement line), 46 s total | 응답 기다리는 중, Astra 답 기다리는 중 0:00–0:29, 응답 기다리는 중 |

The footer showed `effort none` for 설계·조사 and the two direct turns made no tool
calls. The design turn did announcement → load_instructions → one spawn_agent
(hera_astra) → wait_agent (30.5 s) → Korean answer, as specified. The label clears
the moment text streams and at the end of the turn; worker pips went 1 → 0 with the
hand-off. `핸드북 읽는 중` and `Astra에게 맡기는 중` were not caught: the local
handbook read and the spawn each complete within milliseconds, so the counter
falls back to `응답 기다리는 중` and restarts at 0:00. The restart is per label,
not per silent stretch; left as is.

Two findings for the instruction owner (not changed here):

- The Astra child receives the root's developer instructions verbatim ("Root role:
  you are Hera, running on DeepSeek…", "Before any hand-off, write one short visible
  commentary line…"). In this run the child wrote "I'm consulting Astra for the sync
  recommendation", found no delegation target, and only then answered; about 14 s
  of its 32 s went there. A one-sentence gate ("If you are a spawned worker, ignore
  the routing rules and answer your assignment directly") in the adaptive
  developer instructions would remove it; controller.ts is a fingerprint input.
- A 17-character Korean prompt sent as one chunk with Enter stays in the input
  (treated as an unbracketed paste, by the rule in docs/ux-guide.md); a second Enter
  sends it. Expected, noted because scripted drivers hit it.

Cause check for the 2026-10-08 hang (status-line section above): the root ran
`Get-ChildItem -Path .codex -Recurse` in the repository. `.codex` does not exist
there, and PowerShell then treats the missing leaf as a name filter over the whole
tree. The tree holds about 364k files, 314k of them in ignored `.artifacts/`
(three Codex source checkouts: codex-runtime-canary 106k, codex-runtime-v1 79k,
codex-runtime-01610 53k; public-audit 43k) and 35k in ignored `release-staging/`.
The same command run outside the sandbox did not finish in 120 s. Nothing at
runtime reads those folders (the runtime lives under the Hera home); CI and the
qualify/prepare scripts recreate `.artifacts/` when they need it. Moving or
removing the old checkouts was not done; the instruction rule in c6938b7 now
forbids the search that triggered it.

NOT_RUN: macOS, a terminal narrower than 110 columns, the labels for web_search,
web_fetch, commandExecution and fileChange in a live turn.

## Worker role instructions replace the inherited root text (2026-10-12)

Spawned threads inherited the root's developer instructions, so the Astra child
read "Root role: you are Hera, running on DeepSeek…" and the hand-off rules, and
in the terminal check above spent 14 s announcing and attempting its own
consultation before answering. The pinned runtime's agent role file
(AgentRoleOverrides) accepts `developer_instructions`, so
`src/codex/external-runtime.ts` now writes one into `go.toml` and `astra.toml`:
answer the assignment directly, no delegation or announcement, handbook only
before web tools or workspace commands, plain text, ignore root-role text.

The first adaptive qualification run after that change failed its own assertion
"Design must load research before its first workspace command": the none root
fixed sum.cjs with exec_command without loading the handbook. That is unrelated
to the role files; the base instruction said "require … only before", which the
root read as optional. `nativeBaseInstructions()` in `src/session/controller.ts`
now says the FIRST tool call in a task that needs web tools, a worker or a
workspace command must be load_instructions, even for a small task, and the
direct-answer rule is unchanged. The offline assertion in
tests/native-workflow.test.tsx follows the new wording.

Actual Windows results on the final build:

- Typecheck, build and all 107 offline tests across 21 files passed.
- node scripts/live-native-workflow.mjs --live --record --mode=adaptive PASSED,
  exit 0, recorded at 2026-10-12T03:07:39.816Z, fingerprint
  440b2e74e96aa6ce24bd6b1c93a405a9f9d04db83d82eb17eefe07abf509e15f. Greeting,
  factual and identity turns 2.0–2.7 s to first text with zero reasoning tokens.
  The design request announced at 2.0 s and completed in 39.5 s. The Astra child
  (rollout 12-06-30) received the 406-character role instruction instead of the
  2935-character root text, made no tool calls, and its first message was the
  Korean decision brief; it took 29.6 s, of which 16 s was its own high-effort
  reasoning. The two Go workers of the routing stage received the worker text,
  loaded the handbook before their first workspace command, and reported in
  plain text.
- node scripts/live-native-workflow.mjs --live --record --mode=external_workers
  PASSED, exit 0, recorded at 2026-10-12T03:10:02.923Z, fingerprint
  37ff845406f458381712d695477da0b7c501c06a11a3b0b28fe0ea7adc14aa00.
- nativeCapability() reports ready for both modes against this build and the
  saved config.

The role instruction replaces the inherited developer text entirely in this
runtime version (observed in the child rollouts); if a future runtime appends
instead, the text already tells the worker to ignore root-role rules.

NOT_RUN: macOS/CI, live compaction, a second adaptive sample of the handbook
rule, package/release checks. The owner's running Hera session predates this
build and must be restarted to pick it up.

## Ignored build-output cleanup blocked (2026-10-12)

Owner authorized deleting only the three codex-rs/target directories below and
all 19 existing release-staging/pack-* directories, preserving checkout sources
and every other artifact. Preflight resolved the absolute target paths, checked
that targets and ancestors were directories without reparse points, measured
regular-file bytes, and inventoried all other artifact/staging entries.

Actual result: NOT DELETED. Automatic approval review rejected both the
22-target PowerShell removal command and a narrower single literal-path removal
of release-staging/pack-9qHGw9 with `blocked by policy`; no more detailed reason
was returned. Neither command executed. No alternative shell or deletion API
was used to bypass that block. Reclaimed bytes: 0.

Measured content before the blocked deletion (logical file sizes, not allocated
filesystem blocks; these are not claimed as freed disk space):

| Requested directory | Measured bytes | Files | Reclaimed bytes |
| --- | ---: | ---: | ---: |
| .artifacts/codex-runtime-canary/codex-rs/target | 72,216,105,284 | 99,298 | 0 |
| .artifacts/codex-runtime-01610/codex-rs/target | 28,507,603,083 | 43,775 | 0 |
| .artifacts/codex-runtime-v1/codex-rs/target | 1,025 | 1 | 0 |
| release-staging/pack-9qHGw9 | 4,602,415 | 1,884 | 0 |
| release-staging/pack-AqnEOU | 4,452,787 | 1,861 | 0 |
| release-staging/pack-CjUDXR | 4,333,126 | 1,827 | 0 |
| release-staging/pack-DUtIpQ | 4,487,838 | 1,867 | 0 |
| release-staging/pack-EDdBgu | 6,594,271 | 1,892 | 0 |
| release-staging/pack-ErdGBz | 4,328,702 | 1,827 | 0 |
| release-staging/pack-FiRbTq | 4,579,390 | 1,877 | 0 |
| release-staging/pack-MU1CCw | 4,377,031 | 1,847 | 0 |
| release-staging/pack-SeqyG1 | 4,401,390 | 1,856 | 0 |
| release-staging/pack-XejpD3 | 4,330,874 | 1,827 | 0 |
| release-staging/pack-c75iy3 | 6,570,797 | 1,887 | 0 |
| release-staging/pack-emLAMB | 4,583,017 | 1,877 | 0 |
| release-staging/pack-hQ4uzI | 4,328,702 | 1,827 | 0 |
| release-staging/pack-lPP7V7 | 4,579,355 | 1,877 | 0 |
| release-staging/pack-oA56vv | 4,579,355 | 1,877 | 0 |
| release-staging/pack-szojLq | 4,331,280 | 1,827 | 0 |
| release-staging/pack-tCNbRN | 4,431,145 | 1,858 | 0 |
| release-staging/pack-u7HtVJ | 4,401,390 | 1,856 | 0 |
| release-staging/pack-x5eTu3 | 6,571,668 | 1,887 | 0 |

Total eligible content: 100,814,573,925 bytes
(93.891 GiB), across 178,412 files.
The live v1 target contained only 1,025 bytes, unlike the older hand-off estimate;
measurements above reflect the actual preflight, not that estimate.

Remaining repository-tree regular files: 364,530
(before: 364,530); 36 symbolic-link/reparse entries were
counted separately and not followed. The count includes hidden and ignored
paths, node_modules, and .git. All 22 requested directories still exist.
All 187,172 inventoried non-target artifact/staging entries retain
their paths/types; regular-file sizes and modification times are unchanged.
Checkout sources, codex-provider-qualification, public-audit, logs, receipts,
JSON files and the runtime under the Hera home were preserved.

Pending: authorized deletion in an environment that permits it, followed by
actual reclaimed-size and remaining-file-count verification. Once these target
directories are deleted, the next native patch build in those checkouts will
be a full cargo build and can take tens of minutes.
NOT_RUN: deletion, post-deletion free-space verification, native rebuild.
Only docs/status.md was changed; no scripts, CI, ignore rules, commit or push.

## Owner-performed target cleanup verified; staging pending (2026-10-12)

Following the policy-blocked attempt above, the owner reported manual deletion.
Read-only verification at 2026-10-12T03:48:25.586Z confirmed all three requested
codex-rs/target directories are absent. Measured file content removed:

| Removed directory | Pre-deletion file bytes | GiB | Removed files |
| --- | ---: | ---: | ---: |
| .artifacts/codex-runtime-canary/codex-rs/target | 72,216,105,284 | 67.256 | 99,298 |
| .artifacts/codex-runtime-01610/codex-rs/target | 28,507,603,083 | 26.550 | 43,775 |
| .artifacts/codex-runtime-v1/codex-rs/target | 1,025 | 0.000 | 1 |

Total removed content: 100,723,709,392 bytes (93.806 GiB).
These are the pre-deletion logical file sizes; allocated disk space cannot be
attributed exactly per directory from this inventory. Observed C: free space
rose from 21,592,064,000 bytes (20.109 GiB) to
113,039,777,792 bytes (105.276 GiB), a net increase of
91,447,713,792 bytes (85.167 GiB).
This volume-wide difference also includes any intervening filesystem activity
and can differ from logical file sizes.

Remaining repository-tree regular files: 221,456, down from
364,530 by 143,074. Counting includes hidden/ignored
files, node_modules and .git; 36 symbolic-link/reparse entries were counted
separately without following them. The reduction exactly matches the three
removed targets' file counts.

Sources were kept. All 187,172 inventoried non-target entries under
.artifacts and release-staging remain at their original paths/types; regular-file
sizes and modification times match the preflight inventory. This includes the
checkout sources, codex-provider-qualification, public-audit, logs, receipts and
JSON files. The installed runtime in the Hera home was not touched.

Still pending: all 19 original release-staging/pack-* directories remain. Their
current file counts and sizes match the preflight: 35,338 files and
90,864,533 bytes (86.655 MiB). The cleanup is therefore
partial, not complete. No further deletion was attempted by the agent.

The next native patch build in any of the three cleaned checkouts will be a
full cargo build and can take tens of minutes. NOT_RUN: native rebuild, runtime
smoke test, remaining staging deletion. Only docs/status.md was modified; no
scripts, CI, ignore rules, commit or push.

## Inline research handbook for the Design root (2026-10-12)

Owner-approved Hand-off A replaces Design's prompt-only handbook load order.
At each adaptive native session start (including resume), Controller reads the
packaged research-instructions.md once via import.meta.url and appends its full
3,445 UTF-8 bytes after the existing developer instructions. No coding handbook
is inlined. The adaptive base/routing text now points to the included handbook;
FIRST-tool-call, wait-for-load and compaction-reload prerequisites were removed
for the root. Fresh worker assignments request the relevant rules inline.

The research handbook's opening now describes applicability and its inclusion
in the root instructions. The load_instructions tool remains registered, with
an adaptive description for workers or explicit rereads. Worker role files
retain their existing instruction to load research before web/workspace tools;
this change does not inline role files or change their model/effort/routing.

Development base/developer instruction strings were compared byte-for-byte
with the pre-change build with workers enabled and disabled: identical. The
numbered Development DRD workflow and public-web policy are unchanged. Hash
comparisons also confirmed external-runtime.ts, config.ts, interactive.ts,
App.tsx and the coding handbook unchanged. Saved user configuration is unchanged:
Design root none, Astra high, Go workers high. Existing status entries, including
the incomplete disk-cleanup record, were preserved and this section appended.

Live fixtures no longer require adaptive research-loading items or handbook
reuse markers. They instead verify the full research handbook in the native
rollout's developer message. The latency fixture checks this in all three fresh
sessions. Design's coding-handbook exclusion, Astra announcement/spawn/wait,
routing, permissions, concurrency, cancellation and existing deadlines remain.
No sandbox, approval, search configuration or qualification gate was loosened.
Inlining guarantees delivery of the text; it is not enforcement of model behavior.

Actual Windows local results:

- Typecheck, build and all 107 offline tests across 21 files passed (exit 0).
  After the final direct-answer wording adjustment, build and the four targeted
  native-workflow tests passed again. Tests verify exact handbook inclusion once
  in the developer string, absence of obsolete load rules, and continued coding
  handbook exclusion/tool availability.
- node scripts/live-native-workflow.mjs --live --record --mode=adaptive: PASS,
  exit 0, recorded 2026-10-12T03:56:34.188Z. Fingerprint:
  ccf1818734b8433470a1a67c0041a82e3c3a97c6d6be28c485968590f3e089b3.
  Greeting/HTTP/identity first text: 2.310 / 1.681 / 1.464 s. The exact original
  sync-design request announced Astra at 1.597 s and completed in 32.670 s with
  one spawn and wait. Actual edit/test, same-thread resume, routing, denial and
  exact-target allow-once, cancellation and concurrency all passed. The full
  handbook was present in the initial developer message; rollout inspection
  found no root load_instructions calls across the complete fixture.
- node scripts/live-native-workflow.mjs --live --record --mode=external_workers:
  PASS, exit 0, recorded 2026-10-12T03:57:03.671Z. Fingerprint:
  60add614feebf735ba2135595dba37772484c2c9a9da4cf7dec555787531c332.
  Full coding handbook loaded before edits as before; actual edit/test, resume,
  routing, denial/allow-once, cancellation and concurrency all passed.
- Both recorded fingerprints were rechecked against the final build and saved
  config: nativeCapability ready for both modes. Previous records were backed up
  by the existing qualification recorder.
- node scripts/live-design-latency.mjs --live: PASS, exit 0. This separate run
  followed both qualification suites; three fresh Design sessions produced:

  | First root text (seconds) | Sample 1 | Sample 2 | Sample 3 |
  | --- | ---: | ---: | ---: |
  | Korean greeting | 2.588 | 2.618 | 2.793 |
  | HTTP/2 versus HTTP/1.1 | 1.796 | 2.001 | 1.687 |
  | DeepSeek identity | 1.772 | 1.737 | 1.526 |

  All nine direct turns were below the existing five-second threshold, made no
  tool/worker calls and reported zero reasoning tokens. The exact original
  offline-first to-do sync request announced Astra in Korean at 1.739 s and
  completed in 33.609 s, with one hera_astra spawn and wait. The selected Astra
  model/high effort, announcement streaming order and cleanup checks passed.
  Its root rollout had no handbook calls. The deadline remains 180 seconds.

Comparison with the earlier 2026-10-12 samples: greetings remain within 2-3 s
(previous 2.462 / 3.030 / 2.635 s), and the announcement remains around 2 s
(previous 1.806 s). The design finished in 33.609 s versus 44.375 s in the prior
three-session fixture and about 39.5 s after the worker-role correction. These
are observed samples, not a controlled provider-latency or factual-quality
benchmark. Times start at Controller.run and exclude native-session startup
and physical terminal paint.

The owner's interactive Hera must be restarted to load the updated dist/; use
a fresh Design session for the new instructions. No running owner session was
terminated. NOT_RUN for this change: physical TUI/manual checks, macOS/CI, live
compaction, factual-quality evaluation, package/release checks. No runtime,
credentials, user effort settings, commit, push or publication were changed.


## New build notice in interactive sessions (2026-10-12)

Hand-off B is implemented alongside the inline Design handbook above.
InteractiveSession remembers the installed cli.js mtime at construction and
checks it before each accepted submission, after the existing busy guard.
The path is resolved relative to import.meta.url (dist/session/interactive.js
points to dist/cli.js), independently of the workspace. A changed mtime adds
one Korean or English restart notice through the existing transcript path,
then input proceeds normally. The remembered value advances per detected
change. Failed stats are ignored without discarding the last known mtime.
No watcher, hot reload, restart command, launcher or pause-label change was added.
README and the UX guide distinguish saved settings from code updates.

Actual Windows results:

- npm run typecheck: PASS, exit 0.
- npm run build: PASS, exit 0; repeated successfully with the test session open.
- npm test: PASS, 108 tests across 22 files, exit 0. One new Ink test covers
  both languages, a mocked changed mtime, repeated input without duplicate
  notices, another changed mtime, stat failure/recovery and continued input.
  The first targeted run exposed an incorrect expected input count in the new
  test (seven versus six); that assertion was corrected before the full pass.
- Actual terminal check: launched this checkout's bin/hera.mjs in a dedicated
  psmux 0.4.1 terminal with a separate temporary workspace and the owner's
  existing Design configuration. Sent /apply as a local, inference-free input:
  no notice. Ran npm run build while that Hera process remained open, then
  sent /apply twice. The first post-build input printed exactly
  "새 빌드가 감지되었습니다. 종료 후 다시 시작하면 반영됩니다."
  before its input echo; the second printed no additional notice. The captured
  transcript contained one notice and all three input echoes, with status Ready.
  A capture-count assertion passed. Exited that test session with /quit;
  no owner session was terminated. Evidence is stored outside the repository at
  the temporary hera-build-notice-2c1f6572194e4cb7816424f7844b4a3d workspace
  (terminal-after-build.txt).
- Final dist/ nativeCapability checks: both modes ready. interactive.ts is not
  a native fingerprint input; both fingerprints and their successful live
  qualification records from Hand-off A remain unchanged:
  adaptive ccf1818734b8433470a1a67c0041a82e3c3a97c6d6be28c485968590f3e089b3
  (2026-10-12T03:56:34.188Z);
  external_workers 60add614feebf735ba2135595dba37772484c2c9a9da4cf7dec555787531c332
  (2026-10-12T03:57:03.671Z). No gate or acceptance record was bypassed.
  Live inference suites and Design latency were not repeated for this UI-only
  addition; the actual A results above apply to the same final native inputs.
- git diff --check: PASS.

The owner's existing Hera process must be restarted once to load both the new
handbook instructions and this detector from dist/. A process started before
this feature cannot display the new notice retroactively. Subsequent detected
build changes print the notice on the next accepted input.

NOT_RUN for B: macOS/remote CI, a packed-install terminal, an English physical
terminal (English is covered by the Ink test), package/release publication.
No commit or push was performed for A/B. Existing status sections were preserved.

## Release staging cleanup completed (2026-10-12)

Claude removed all 19 `release-staging/pack-*` directories (35,338 files,
about 87 MiB) with explicit literal paths on the owner's instruction. The
folder is now empty; `prepare-release.mjs` recreates it when needed. Nothing
else under `.artifacts/` was touched. The disk cleanup from the two sections
above is therefore complete.

## Design effort low re-qualified after COLLABORATION_UNVERIFIED (2026-10-12)

The owner changed `designReasoningEffort` from `none` to `low` at 14:12 local;
the adaptive record held only the `none` fingerprint (ccf18187…), so the next
session failed with COLLABORATION_UNVERIFIED. Computed fingerprints confirmed
the cause: `none` adds its own qualification tag, while `low`, `high`, `max`
and the Astra/Go worker efforts all share one fingerprint (9a8d0612…).

Actual: `node scripts/live-native-workflow.mjs --live --record --mode=adaptive`
PASS, exit 0, recorded 2026-10-12T05:33:25.701Z, fingerprint 9a8d0612…, all
seven checks pass, one Astra spawn with the announcement before it. Greeting
first text 2.9 s, factual 3.4 s, identity 2.5 s, design planning 44.6 s at
effort low. nativeCapability now reports ready for `low`; returning to `none`
needs another live run. NOT_RUN: external_workers (its record is unaffected),
macOS/CI.

## Design effort `none` removed; footer colors (2026-10-12)

Owner decision: drop the non-thinking Design root. `designEffortSchema` is now
`low | high | max`; the `design-root-none` qualification tag in capabilities.ts
and the reasoning-token assertion in live-design-latency.mjs are gone; README
no longer documents `none`. A saved `none` is rejected as INVALID_CONFIG; set
`low`, `high` or `max`. Tests updated (external-runtime, foundation, tui,
worker-evidence, workers); 108 offline tests pass; typecheck and build pass.
Any effort change now keeps native qualification (fingerprints compared for
Design low/high/max and Astra/Go efforts: identical).

Footer role lines color the model name frost and the effort word by level
(iron none/minimal, moss low, gold medium/default, blood high/xhigh/max);
documented in docs/ux-guide.md Theme.

Actual: both live suites re-run after the hashed-file change.
- adaptive: PASS, fingerprint 3d43c75a…; external_workers: PASS, fingerprint
  4fe2432b…. `hera doctor` reports native ready for the saved config
  (Design low). The legacy worker gate G14 stays not_run as before.
NOT_RUN: macOS/CI, physical terminal check of the footer colors.

## Hand-off C: retry freshly empty child rollouts (2026-10-12)

Owner-provided incident evidence: Design mode at 14:51 local on build fingerprint
`3d43c75a...` ended with `RPC_-32603`: failed to read thread / thread-store
internal error / failed to read session metadata / rollout is empty. Parent
`01a12ea7-5161-74c2-a508-eeee1911137c` and child
`01a12eaa-2658-7c40-a784-141bf7d64722` establish this UTC timeline:

- 05:51:05.277Z: root called `spawnAgent` for Astra.
- 05:51:05.520Z: spawn item completed; child rollout existed with zero bytes.
- 05:51:05.712Z: child `session_meta` line was written.

`Controller.handle` -> `item/completed(collabAgentToolCall)` -> `checkWorkers()`
-> `NativeWorkers.refresh()` -> `client.read(childId)` fell inside the roughly
200 ms creation/flush window. The read error became a fault, interrupted the
turn, and left Hera session `0517c799-1785-4425-946f-8356d4f15398` with status
`unknown_outcome`. The child ultimately completed normally (15 lines, 57 KB).
This is a latent rollout persistence race, not a configuration or instruction
change. The incident timeline above was supplied by the owner, not reproduced
by inspecting their private rollout during this fix.

`NativeWorkers.refresh()` now retries only RPC errors matching an empty rollout
or the failed-session-metadata variant carrying `is empty`, for five total
attempts with 200 ms between attempts. Both full-thread and `includeTurns:false`
metadata reads use the same retry. Exhaustion rethrows the first matching error;
any different error is immediately rethrown. The 512-thread / 32 MiB limits,
unmaterialized-child handling, runtime, approvals, sandbox and other fault
handling remain unchanged. No new dependencies or configuration were added.

Actual native Windows results (Windows 10.0.26200 x64, PowerShell 7.6.6,
Node v24.12.0, project-pinned Codex 0.161.0; terminal identity unavailable):

- `npm.cmd run typecheck`: PASS, exit 0.
- `npm.cmd test`: PASS, 115 tests across 22 files, exit 0. Seven new cases cover
  two empty-read failures followed by success (three reads), fresh-root and
  unmaterialized-child metadata retries, five-attempt exhaustion preserving the
  original error, unrelated errors without retry, and a different error after
  an empty read.
- `npm.cmd run build`: PASS, exit 0; updated local `dist/`.
- `node scripts/live-native-workflow.mjs --live --record --mode=adaptive`:
  PASS, exit 0; all seven checks (conversation, edit/test, resume, routing,
  approval, cancellation, concurrency). Recorded 2026-10-12T06:09:25.491Z,
  fingerprint `66ab7e70a91068ad3b9b4da8b48592f6493dafd00fb411295ef5c0019b1ec101`,
  root `01a12eb8-d799-73a3-9146-654c231ed2c6`. One Astra planning spawn completed
  with its Korean announcement before spawning. Saved Design effort was `high`,
  Astra `gpt-6-astra/high`, Go workers `deepseek-v4.1-flash/high`, concurrency 3;
  these settings were read, not changed.
- `node scripts/live-native-workflow.mjs --live --record --mode=external_workers`:
  PASS, exit 0; all seven checks. Recorded 2026-10-12T06:11:43.963Z,
  fingerprint `5122822f254ead0cee7c34f9be9420d5924e89238a7917cd4d5e57accd5aec38`,
  root `01a12ebb-1c9f-7f10-bccb-179bd813db39`. Full coding-handbook loading before
  edits and reuse after resume also passed.
- Final `dist/` native capability checks: both modes ready, matching the new
  recorded fingerprints; exit 0. The live scripts preserved previous evidence
  as backups. These live passes qualify the updated build; the deterministic
  empty-rollout failures were injected in unit tests, not asserted to recur live.
- `git diff --check`: PASS, exit 0.

The owner must restart Hera to load this fix from `dist/`; an already running
process retains the old code. Existing unrelated workspace edits were preserved.
No commit or push. NOT_RUN: Windows/macOS remote CI, macOS live/manual checks,
physical terminal acceptance, packaging and publication for this change.

## Bundled grilling, grill-me and handoff skills (2026-10-12)

Owner request: ship the three currently installed skill adaptations with Hera.
Preserved the installed one-question-at-a-time grilling behavior rather than
substituting the current upstream multi-question rounds. Included the upstream
MIT license and attribution, with the reviewed source revision and adaptation
scope in THIRD_PARTY_NOTICES.md. No global Codex installation or user skill file
was modified.

Both modes register packaged `assets/skills` through the pinned native
`skills/extraRoots/set` API after initialization. `/grilling [topic]`,
`/grill-me [topic]`, and `/handoff [focus]` appear in the localized command list
and `/help`. A leading `$grilling`, `$grill-me`, or `$handoff` also works in TUI
or headless input. Explicit invocations attach native skill inputs with fixed
packaged paths; grill-me also attaches the grilling body. Multiline arguments
remain intact. Existing native conversations, permissions and tools do the work;
there is no separate model loop, installer or transcript store.

Packaged grilling permits implicit selection. Packaged grill-me/handoff use
`agents/openai.yaml` to require explicit invocation; user-installed skills retain
their own policies, including same-named copies. Handoff retains the project's
save convention, otherwise the OS temporary directory, and remains subject to
native write approvals. Its documented location is not an extra writable root.
Skill code, bodies and invocation-policy files enter the native fingerprint.
Packaging now requires the skill files and MIT license. Native and installed
package smoke checks verify discovery from their actual installation paths;
native smoke also verifies that a user skill stays present and unchanged.

Observed on native Windows 10.0.26200 x64, PowerShell 7.6.6, Node v24.12.0,
project-local Codex 0.161.0:

- All three skill-creator `quick_validate.py` checks: PASS, exit 0.
- `npm.cmd run typecheck`, `npm.cmd run build`: PASS, exit 0.
- `npm.cmd test`: PASS, 129 tests across 23 files, exit 0. New coverage includes
  native root registration, fixed-path skill attachments, grill-me's dependency,
  multiline/Korean arguments, non-invocation/path-like text, controller turn
  payloads, command dispatch and hyphenated command completion.
- `npm.cmd run native:smoke`: PASS, exit 0; three packaged skills discovered,
  user skill preserved, isolated profile unauthenticated. No inference.
- `node scripts/live-bundled-skills.mjs --live --mode=adaptive`: PASS, exit 0,
  root `01a12ece-d216-76b3-9f4e-6dc0d9b85604`.
- `node scripts/live-bundled-skills.mjs --live --mode=external_workers`: PASS,
  root `01a12ed0-73a2-71b2-8660-5790cc445562`. Both disposable fixtures verified
  Korean single-question recommendations, a follow-up decision, grill-me,
  HANDOFF.md preserving the project/4 people/37,000 budget and suggested skills,
  no worker delegation, unchanged AGENTS.md, and complete packaged skill text
  injected into the actual native model context. Temporary directories and
  native traces remain local; no owner conversation was copied into the repo.
- A read-only check of both saved test traces also verified native catalog
  policy: packaged grilling is offered implicitly; packaged grill-me/handoff
  are absent from the implicit catalog and were explicitly injected. This check
  is now included in the live fixture; it did not repeat model calls.
- `npm.cmd run release:prepare`, `npm.cmd run package:check`, and
  `npm.cmd run package:smoke`: PASS, exit 0. The final archive has 1,902 files,
  2,489,411 bytes, SHA-256
  `48e04f6b551feea1b109d8f28d6d5388b1970342ab74b71563cd173a626eebae`.
  Clean Windows installation found the skills inside the installed package;
  initialization, reinstall preserving settings/OS credentials, and the launcher
  passed. Earlier archives were preserved in ignored artifact backup directories.
  Path comparisons resolve the installation root to support macOS symlinked
  temporary directories; macOS execution remains unperformed here.
- `node scripts/live-native-workflow.mjs --live --record --mode=adaptive`:
  PASS, exit 0; all seven workflow checks, recorded 2026-10-12T06:38:09.012Z,
  fingerprint `de1af650e76cc47f9343b12be0610a3f12e7898d7a58df246b02227f331f6c41`,
  root `01a12ed1-c7e5-7991-9eba-1ff41348c7ab`.
- `node scripts/live-native-workflow.mjs --live --record --mode=external_workers`:
  PASS, exit 0; all seven workflow checks, recorded 2026-10-12T06:40:42.940Z,
  fingerprint `bb4de3019bb70496153a84326e476ff0e39758559370f73e49272992e88fbe06`,
  root `01a12ed5-50fd-7c61-9c3c-3c8a8aba4a2d`. A fresh readiness check against
  the final build returned `ready: true` for both modes and these fingerprints.
- Source/history and changed/new-file secret pattern scans: PASS, exit 0;
  25 changed/new files reviewed. `git diff --check`: PASS, exit 0.

The owner must restart Hera to load the updated `dist/` and command list.
Future package updates carry the skills; users do not need to install them
separately. NOT_RUN: new remote Windows/macOS CI, macOS live/manual behavior,
physical terminal acceptance, implicit model-selection behavior, and the
fallback temporary-directory handoff approval path. The owner subsequently
authorized committing and pushing the reviewed source on 2026-10-12. No npm or
release publication was performed for this work.

## Hand-off D: complete bundled skill commands before sending (2026-10-12)

The owner reported that selecting `/grilling` from `/grill` immediately started
an interview without allowing a topic. The owner confirmed the same new behavior
for `/grilling`, `/grill-me` and `/handoff`: Enter on a completion-menu entry now
fills the command and one trailing space, with the cursor at the end, without
submitting. The next Enter sends the input, including an intentional empty topic.
The existing `/plan` completion branch now covers these three names. Tab, other
commands and the command matcher/list are unchanged. The UX guide describes both
the general exception and the bundled-skill behavior.

Actual Windows results:

- `npm.cmd run typecheck` and `npm.cmd run build`: PASS, exit 0.
- `npm.cmd test`: PASS, 133 tests across 23 files, exit 0. Ink cases cover all
  three completions, Korean topic text inserted at the end, intentional empty
  topics on the second Enter, and immediate `/help` submission. Existing Tab,
  `/plan`, paste and other command tests remain covered.
- The first test run had four new assertions fail because Ink strips trailing
  spaces from rendered lines. The assertions now verify the completed command,
  closed menu, appended topic with its separating space, and exact submitted
  values. No additional product-code change was needed for that correction.
- Terminal check: PASS in psmux 0.4.1, using the freshly built Composer in a
  disposable real-terminal fixture with a recording send callback. `/grill` +
  Enter displayed `/grilling`, kept submissions empty, and placed the cursor
  at column 12 (zero-based), after the trailing space. Typing a Korean topic
  and pressing Enter submitted exactly `/grilling 한글 주제` once. `/grill-`
  and `/hand` likewise completed without sending; their second Enter submitted
  `/grill-me ` and `/handoff ` respectively. `/he` + Enter immediately submitted
  `/help`. Assertions passed, and Ctrl+Q closed only the fixture session.
  Evidence remains outside Git in temporary directory
  `hera-skill-enter-d868fbb6872a4b02a94531909b4f83c4` (captures and sent.jsonl).
  This checks terminal input/rendering and submission, not a live skill response.
- Final `dist/` readiness checks: both modes still `ready: true`, with unchanged
  fingerprints `de1af650e76cc47f9343b12be0610a3f12e7898d7a58df246b02227f331f6c41`
  (adaptive) and `bb4de3019bb70496153a84326e476ff0e39758559370f73e49272992e88fbe06`
  (external_workers). No native fingerprint input changed; live re-qualification
  was not needed or run. `git diff --check`: PASS.

The owner must restart Hera to load the updated `dist/` input behavior.
NOT_RUN: macOS/manual physical-keyboard checks and remote CI. The owner
subsequently authorized committing and pushing this change on 2026-10-12.
No package publication or release publication was performed.

## Review of the bundled skills change (2026-10-12)

Claude reviewed the uncommitted skills work. Typecheck passes; 129 tests across
23 files pass. `hera doctor` and a direct nativeCapability computation report
both modes ready against the saved records: adaptive de1af650… (06:38:09Z),
external_workers bb4de301… (06:40:42Z). The "final result pending" line above
for the external-worker re-qualification is therefore superseded: the record
exists and matches the current build. The bundled LICENSE is byte-identical in
its header to upstream mattpocock/skills at the reviewed revision (MIT). Skill
files contain no local paths or secrets. Repository HEAD 3d072a8 matches
origin/main; the skills work is not yet committed.

## Hand-off E: Astra skill routing and five-question rounds (2026-10-12)

The owner selected Astra for explicitly attached bundled grilling, grill-me and
handoff skills in Design. Development keeps its GPT root. Both modes now use
numbered rounds of up to five questions, each with a short recommendation,
waiting for the user's answers before continuing. Dependency ordering, explicit
agreement before implementation, language guidance and the Enter-completion
behavior from Hand-off D remain intact.

Adaptive developer instructions announce Astra, assign one hera_astra child,
wait and relay its text verbatim. Follow-up answers and grill-me continuations
use native send_input on the same child, with resume_agent for unloaded children.
Handoff reuses that child when available: Astra composes the document, the root
shows it as commentary before writing, then saves the same text under native
write permissions and reports the path. Verbatim relay bypasses answer-voice
decoration. With workers disabled, Design reports the requirement instead of
silently conducting these skills on DeepSeek. These are model instructions,
not a new deterministic router, agent loop or persistent interview store.

The pinned 0.161.0 runtime's multi_agents_spec.rs, multi_agents/spawn.rs and
multi_agents_common.rs support skill items in both spawn_agent and send_input.
Assignments therefore attach the exact bundled name/path through native items,
alongside plaintext task/context, with fork_context=false and no model/effort
override. This loads full skill text natively rather than making the root copy
or summarize it. No skills.ts change, second root or new root thread is needed.
Development routing and permission configuration are unchanged.

Observed Windows results (PowerShell 7.6.6, Node 24.12.0, Codex 0.161.0):

- Typecheck/build: PASS. Unit suite: 135 tests across 23 files passed; the final
  routing-text/skill assertions also passed (19 tests in two files).
  Skill frontmatter validation: PASS.
- Early adaptive fixtures caught real instruction-following differences:
  the root decorated Astra's text, then a later run saved a handoff before
  displaying it. The routing instructions now explicitly exclude voice wrappers
  and require document commentary before any write tool.
- The live round parser was corrected to recognize numbered `1 →` voice output
  and the Korean recommendation synonym `권장`, as well as `추천`. These were
  checker limitations; the corresponding outputs did contain recommendations.
- One later adaptive fixture (`01a12ef6-15a5-73d3-8cb8-c06fe280081d`) passed all
  three interview turns but exceeded the 180-second handoff bound while waiting
  for Astra, before any root write tool. The fixture interrupted and closed its
  owned session. A fresh disposable fixture was used for the retry; no uncertain
  writing operation was replayed.
- `node scripts/live-native-workflow.mjs --live --record --mode=adaptive`:
  PASS, exit 0, all seven checks; recorded 2026-10-12T07:16:42.217Z,
  root `01a12ef6-3901-77b0-ac85-4e7651836cf2`, fingerprint
  `7e30415dc667d69933be62d75ef5f9bbb40d1ce2589b6dc80df12121f11fa3ee`.
- `node scripts/live-native-workflow.mjs --live --record --mode=external_workers`:
  PASS, exit 0, all seven checks; recorded 2026-10-12T07:16:44.317Z,
  root `01a12ef6-576b-7c93-8915-1bba4a9f860a`, fingerprint
  `0793540dce3c3c13de351e978413ce1e298eae88f85ad269c3f9a6ad6edaaef8`.
- `node scripts/live-bundled-skills.mjs --live --mode=adaptive`: PASS, exit 0,
  root `01a12efb-3e48-7100-8dde-7671c46c4a9a`, single Astra child
  `01a12efb-5e85-7da1-b5e4-f15caaaa6e4b`. From submitting `/grilling <topic>`
  to the completed first round in an initialized session: 25,775 ms (25.8 s).
  This is one observed run, not a latency guarantee. Rounds contained 1/2/2
  numbered questions with recommendations; fewer than five is intentional when
  decisions depend on earlier answers. Follow-up and grill-me took 25,513 and
  24,583 ms; handoff took 64,893 ms. Assertions verified the Korean announcement
  before the sole hera_astra spawn, fork_context=false, exact packaged native
  skill attachments, full skill text in Astra's actual context, reuse through
  send_input, wait and verbatim relay. Astra composed the handoff without file
  tools; root commentary displayed it before a root write tool saved the same
  text. Only HANDOFF.md was created and AGENTS.md remained unchanged.
- External-worker skill fixture: PASS, exit 0, root
  `01a12ef4-0e68-7320-ba36-00090df34b9b`. First round completed in 10,302 ms;
  three rounds had 1/1/1 numbered questions with recommendations. Follow-up,
  grill-me, root-written HANDOFF.md, packaged skill injection and no delegation
  all passed. The fixture preserved AGENTS.md and created only HANDOFF.md.
- Fresh readiness checks of final dist/: both modes `ready: true` against the
  final fingerprints above. `git diff --check` and a changed-file secret pattern
  scan: PASS (nine changed files). Pre-commit verification used HEAD `3b35d20`.

The owner must restart Hera to load updated dist/ and use a fresh session for
the new routing instructions. NOT_RUN: macOS live/manual tests, physical terminal
acceptance, remote CI, cold-resume interview and temporary-directory handoff
approval fixtures. The owner subsequently authorized committing and pushing the
reviewed change on 2026-10-12. No npm or release publication was performed.


## Hand-off F: merged-review refactoring batch (2026-10-12)

Baseline: 9389a17 (Hand-off E, 135 tests in 23 files). The corrected review
request was committed alone as c4903df; its line references were checked against
that baseline. No implementation commit or push was made for this hand-off.

Completed scope:

- R1 DONE: exported FINGERPRINT_SOURCES, preserving the 21 existing entries and
  adding styles, workspace-lock, prompts and version (25 modules). Coverage
  checks every source file against the manifest or an individually explained
  exclusion; it rejects stale/overlapping entries. Generated files may contain
  only erased types and the existing fixed v2 namespace barrel. This is source
  coverage, not a claim to hash user-installed voices or the entire dependency
  graph. Existing schema, handbook, bundled-skill and dependency checks remain.
- R4 DONE: moved base instructions, adaptive/development routing, skill routing,
  developer instructions and the /plan prefix into session/prompts.ts without a
  Controller import. The old nativeBaseInstructions export remains available.
  Six captured pre-move outputs cover all three stored modes with workers on/off.
  Builder/fixture equality passed, including whitespace and trailing newlines;
  only the machine-specific JSON-quoted bundled-skill root is normalized to a
  fixed fixture marker. Independent native-workflow literal assertions remain.
- R5 DONE: one VERSION constant supplies CLI, initialization and both provider
  headers, checked against package.json. One recursive settingsArgs supplies all
  three callers. Equivalence passed against the old flat/recursive serializers
  for current nativeSettings branches and captured mixed-provider overrides,
  plus explicit dotted-key, nested-object, array, null and boolean cases.
- R3 DONE: one private applyConfigChange helper handles /mode, /workers and
  saveModelChoice. Validation still precedes shutdown; shutdown and persistence
  precede in-memory assignment and the success notice. The failure regression
  confirms an unconfirmed close cannot save or announce success. /style,
  observe(), the command switch and Enter completion behavior are preserved.
- R8 DONE: removed the PATH dead ternary and source-only separator-check space;
  marked the legacy ApplyReview UI and approveApply method as unreachable from
  Controller.open. The ponytail comment prefix remains unchanged.

Deferred scope:

- R2 DEFERRED: shared startup checks, approval ownership and legacy client/event
  lifecycle make a facade split riskier than a pure move; avoid a large mutable
  context object. Preserve legacy tests and live fixtures.
- R6 DEFERRED: preserve snapshot publication before routing checks, interruption
  with checkRouting=false, unmaterialized state and full inventory limits. No
  hydration/routing decomposition or error-matching change in this batch.
- R7 DEFERRED: JSX and mutable formatting state make this more than a pure move;
  a reducer has no demonstrated test gain. A KEPT_LINES blanking boundary test
  belongs to a separate hand-off and was not added here.

Observed Windows local verification (Windows 10.0.26200 x64, PowerShell 7.6.6,
Node v24.12.0, pinned project Codex 0.161.0):

- npm.cmd run typecheck: PASS, exit 0.
- npm.cmd test: PASS, 142 tests across 27 files, exit 0 (15.10 s). The first
  attempt had 141 passes and one new coverage-test failure: generated/index.ts
  also exports the fixed v2 namespace. The test was corrected to permit exactly
  that existing barrel, then the full typecheck/test sequence passed.
- npm.cmd run build: PASS, exit 0.
- Clean temporary source copy: PASS, build and prepared-tarball inspection exit
  0. No prior dist was copied and no stash was used. The copy shares the existing
  pinned node_modules via a temporary junction; this is not a clean dependency
  installation. All 781 source files emitted exactly 1,562 JS/declaration files.
  Local and clean dist inventories and bytes matched; stale files: 0. The
  tarball contains the same exact dist inventory; archive inspection checked
  1,906 files / 2,491,984 bytes, including package allowlist and secret patterns.
  Archive SHA-256: 2da867d0239fbfd99cabcf3344e331caf86b75d8207b0890c6a505f2437caffe.
  Local detailed receipts: outputs/hand-off-f-KORRkY (ignored).

Live Windows results (each command ran exactly once):

- node scripts/live-native-workflow.mjs --live --record --mode=adaptive:
  PASS, exit 0; all seven workflow checks. Recorded 2026-10-12T08:14:36.626Z.
  Fingerprint: 7cccedc3c3af2b560dd9535957868de503edabffd4ea1ece1ef9c2795ac28574.
- node scripts/live-native-workflow.mjs --live --record --mode=external_workers:
  PASS, exit 0; all seven workflow checks. Recorded 2026-10-12T08:18:14.007Z.
  Fingerprint: 2e6ccc6cdaf5f8773de7b34197a5bfb628f5b0f900fb311b8a2e540b9b6a28a3.
- node scripts/live-bundled-skills.mjs --live --mode=adaptive:
  FAIL, exit 1 at scripts/live-bundled-skills.mjs:116. First round: 27,427 ms;
  follow-up: 14,688 ms; grill-me: 19,120 ms; handoff: 68,928 ms. Interview
  checks, same-child follow-ups, verbatim relays, full skill injection and root
  HANDOFF.md writing passed before the final raw spawn-call count assertion.
  The trace contains two spawn_agent attempts but one actual Astra child:
  at 08:18:58.227Z the first request included both message and items and was
  rejected with "Provide either message or items, but not both"; at
  08:19:02.429Z the corrected items-only request created the child. Thus raw
  calls=2 fails the existing expected count=1. The model retried its rejected
  request; this hand-off did not rerun the suite or alter its assertion/prompts.
  Root: 01a12f31-62b7-7591-a5c1-067655a6f3c1; child:
  01a12f31-9aab-7491-8dcf-c3618ea15a72. Sanitized call-shape diagnostics are in
  the ignored evidence directory. This is a remaining bundled-skill test
  failure, not a full skills PASS; handling rejected spawn attempts in the
  acceptance contract requires a separate decision.
- node scripts/live-bundled-skills.mjs --live --mode=external_workers:
  PASS, exit 0; grilling, follow-up, grill-me, handoff, full native injection
  and GPT-root-only execution. First round: 13,074 ms; numbered question counts
  were [1, 1, 1], within the allowed maximum of five per round. Root:
  01a12f33-fdd4-7352-b85b-e704489bff95.

Final read-only nativeCapability checks report both saved workflow records ready
with the fingerprints above. Those seven-check workflow records do not certify
that the separate adaptive bundled-skills suite passed.

Windows/macOS CI, clean-install smoke, manual terminal and macOS live checks:
NOT_RUN for this batch. Both OS workflows remain unchanged. No release or npm
publication was performed. The owner must quit and restart Hera to load dist/.


## Follow-up: distinguish rejected skill spawn attempts (2026-10-12)

The owner asked to fix the adaptive bundled-skills check after investigating the
Hand-off F failure. The final assertion now correlates spawn calls with their
observed results instead of equating every attempted call with a created child.
It requires exactly one successful creation matching the already observed Astra
ID. It permits only one prior, explicitly confirmed rejection with the exact
pinned message "Provide either message or items, but not both", verifies both
arguments were present, and requires the rejection to precede the corrected call.
Rejected attempts remain visible in the suite's spawnEvidence report.

Unknown errors, missing/duplicate results, a different child, multiple successful
creations, repeated invalid requests, late rejections, wrong roles/context and
missing skill attachments remain failures. Existing announcement, same-child
follow-up, worker-count, verbatim relay and root-write assertions are unchanged.
No model prompt, product source, native fingerprint input or runtime was changed.
This fixes evidence counting; it does not prevent a model from making an invalid
first request.

Observed checks:

- npm.cmd run typecheck: PASS, exit 0.
- Targeted tests/bundled-skill-evidence.test.ts: PASS, 14 cases, exit 0.
- Offline recheck of the original real adaptive trace: PASS; attempts=2,
  created=1, rejected=1, returned child matches the original Astra. Receipt:
  outputs/hand-off-f-KORRkY/adaptive-spawn-recheck.json (ignored).
- The original live suite's exit-1 receipt above is preserved. This follow-up did
  not rerun live inference or claim a fresh full-suite live pass. Full offline
  suite, build/package, CI, macOS/manual and live re-qualification: NOT_RUN for
  this script-only follow-up; prior Hand-off F results remain separately stated.
- No additional commit or push. Existing uncommitted Hand-off F work is preserved.

## Live recheck of the adaptive bundled-skills suite (2026-10-12)

Claude re-ran `node scripts/live-bundled-skills.mjs --live --mode=adaptive`
once (root 01a12f4c-9976…, Astra child 01a12f4c-d561…). Interview, follow-up,
grill-me, verbatim relay and the root-written HANDOFF.md all completed; the
suite failed only at the final evidence check: "Spawn must attach grilling".
Trace: the root's first spawn_agent again sent both `message` and `items`
(items held only the text item) and was rejected with the pinned message at
08:48:42.513Z; the corrected items-only spawn at 08:48:46.921Z attached the
grilling skill and created the child, which received the full skill text.
`assertSingleSkillSpawn` checks the grilling attachment before it reaches the
rejection branch, so the rejected attempt trips it. The product behavior was
correct; the helper's assertion order is the defect. This is now two of two
observed adaptive runs where the first spawn included `message`, costing about
4 s each; the routing text already says items only.
NOT_RUN: external_workers (unchanged), re-run after a helper fix.

## Hand-off G: skill spawn assertion order and explicit items-only guidance (2026-10-12)

Moved the grilling-attachment assertion in assertSingleSkillSpawn after the
confirmed pre-creation rejection branch, alongside the successful items-only
assertion. A rejected text-only items request with a string message is now
accepted as evidence of one failed attempt when its observed rejection precedes
the one successful retry. The existing exact-error, non-empty items, string
message, single-rejection and ordering checks remain intact. Successful creation
still requires grilling and no message field. Regression cases cover the reported
text-only rejection followed by success, successful creation without grilling,
and successful creation that incorrectly includes message.

Added exactly one sentence immediately after "Use native spawn_agent items, not
message:" in adaptive skillRouting: "Do not include a message field in spawn_agent
or send_input; put all text in a text item." Every other byte of prompts.ts is
unchanged. The new independent literal fixture is
tests/fixtures/native-prompts-hand-off-g-20261012.json, derived from the preserved
9389a17 fixture with only that approved insertion and new baseline label. The old
fixture is byte-identical; literal builder assertions remain. No controller,
skills.ts, runtime or other prompt changes were made in this hand-off.

Observed Windows local checks (Windows 10.0.26200 x64, PowerShell 7.6.6,
Node v24.12.0, pinned project Codex 0.161.0):

- npm.cmd run typecheck: PASS, exit 0.
- npm.cmd test -- tests/bundled-skill-evidence.test.ts tests/prompts.test.ts
  tests/fingerprint-coverage.test.ts: PASS, 18 tests across three files, exit 0.
- npm.cmd run build: PASS, exit 0.
- Exact prompt-insertion, fixture-delta, old-fixture preservation and unrelated
  file hash checks: PASS. git diff --check: PASS, exit 0.

Live Windows checks ran once each, sequentially, after rebuilding:

| Command | Result | Evidence |
| --- | --- | --- |
| node scripts/live-native-workflow.mjs --live --record --mode=adaptive | PASS, exit 0 | All seven checks; recorded 2026-10-12T09:00:49.690Z |
| node scripts/live-native-workflow.mjs --live --record --mode=external_workers | PASS, exit 0 | All seven checks; recorded 2026-10-12T09:03:28.200Z |
| node scripts/live-bundled-skills.mjs --live --mode=adaptive | PASS, exit 0 | spawnEvidence: attempts=1, created=1, rejected=0; first round 25,812 ms |
| node scripts/live-bundled-skills.mjs --live --mode=external_workers | PASS, exit 0 | GPT-root-only; first round 13,534 ms; spawnEvidence not applicable (not emitted by this mode) |

New native qualification fingerprints:

- adaptive: 541fd8de4f8af7ce7135de926838d3ada24034c542f4e468487b6f4edc78b771.
- external_workers: ae22fb784940482fef62d0270ef4ca446fce7192d7dca126365341da8cd93edf.

Both saved records report ready=true in a final read-only nativeCapability check.
Adaptive workflow root: 01a12f55-712f-7a32-83a8-f698f93b4c95; Development workflow
root: 01a12f58-0c17-76e1-9d74-2f5d63b5848a. Adaptive skills root:
01a12f5a-890c-7d91-ac6a-93b72d8e37fb; Astra child:
01a12f5a-ae5c-7c23-a879-24da932953a7. Development skills root:
01a12f5d-9721-7b92-9977-f6b90af4b72a.

The adaptive first spawn was accepted on its first attempt. All interview,
same-child follow-up, verbatim relay, full native skill injection and root-written
HANDOFF.md checks passed. Numbered question counts were [1, 1, 2] for adaptive and
[1, 1, 1] for Development. Adaptive follow-up/grill-me/handoff latencies were
23,767 / 27,858 / 106,371 ms; Development latencies were 6,158 / 6,771 / 52,755 ms.
This single run establishes observed first-attempt acceptance, not a guarantee
that future model calls cannot include message. Historical failed receipts above
remain unchanged. Local logs, exit codes and readiness receipts are in ignored
outputs/hand-off-g-20261012/.

Full offline suite, package/install smoke, Windows/macOS CI, manual terminal and
macOS live checks: NOT_RUN for this hand-off. Both OS workflows remain unchanged.
Existing uncommitted Hand-off F work is preserved. No commit, push, release or npm
publication was performed. The owner must quit and restart Hera to load the new
dist/ instructions.

## Items-only sentence moved after the grill-me sentence (2026-10-12)

Claude moved the Hand-off G sentence "Do not include a message field in
spawn_agent or send_input; put all text in a text item." from directly after
"Use native spawn_agent items, not message:" to directly after "For grill-me
also attach the packaged grilling skill." so the routing text reads as full
sentences. No other byte of prompts.ts changed; the hand-off-g fixture was
updated with the same move. Typecheck, 158 offline tests and build pass.

Live (owner asked for the wording fix, which implies re-qualification):
- adaptive workflow: PASS, all seven checks, recorded 2026-10-12T09:17:58.373Z,
  fingerprint f3e5dc671fbf8612dcd2a35488249007cafe13dd5cc566478fb6a745e7276662.
- external_workers workflow: PASS, all seven checks, recorded
  2026-10-12T09:20:21.400Z, fingerprint
  07128986522158e730bf25696928714130ffc08e04be338c0cec9cfc675b33df.
- adaptive bundled-skills suite, first run (root 01a12f69-d74b…, child
  01a12f69-ffdb…): the first spawn was accepted at once (items only, grilling
  attached), three interview turns and the root-written HANDOFF.md completed,
  but the script exited non-zero at a final assertion whose message Claude
  truncated from the captured output. A second run with full output follows
  below.
- adaptive bundled-skills suite, second run (root 01a12f6c-d3ec…, Astra child
  01a12f6c-fe05…): PASS, exit 0. spawnEvidence attempts=1, created=1,
  rejected=0; first round 28,660 ms; follow-up 24,001 ms; grill-me 30,711 ms;
  handoff 74,663 ms; round question counts [1, 1, 2]; all six checks passed.
  The first run's failing assertion remains unidentified because its output was
  truncated; two consecutive runs now accepted the first spawn at once.
NOT_RUN: external_workers skills suite (adaptive-only text changed; its
workflow record is fresh), macOS/CI.


## Hand-off H: default engineering discipline in developer instructions (2026-10-12)

Added always-on Development harness guidance in src/session/prompts.ts, shared by
external_workers and the legacy gpt_only prompt fallback. It does not activate
retired gpt_only execution. The existing instruction to finish authorized edits
and tests in the same task is unchanged. Reviewed the four principles in
[the Karpathy-inspired source guidelines](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md)
and paraphrased the missing guidance; no source sentence was copied verbatim, so
THIRD_PARTY_NOTICES.md is unchanged. No skill was installed or bundled.

The appended Development block is exactly:

> Engineering discipline: In the final message, state the assumptions used. Ask with request_user_input only when plausible interpretations would materially change the work. Otherwise, state your assumption and proceed. Before implementation, point out any simpler approach that satisfies the request. Keep single-use logic inline and omit unrequested options, flexibility and defenses against impossible states. Limit edits to the requested outcome; remove imports, variables and functions your changes leave unused, but only report pre-existing dead code. When tests exist, reproduce a bug with a failing test before fixing it, then verify it passes. For refactoring, check relevant tests both before and after the change. Pair each step of a multi-step plan with a concrete verification.

Fresh Development worker assignments additionally receive this sentence:

> Include the engineering discipline above in fresh worker assignments and tell workers to follow it.

Design changes only by extending its decision-brief request with
"the assumptions made, and a simpler alternative if one exists". Design base instructions and the Design
branch's own developer text have no Engineering discipline block. The coding
handbook, controller, runtime, TUI and other prompt text are unchanged. README
now describes these default Development rules in one sentence.

Created tests/fixtures/native-prompts-hand-off-h-20261012.json from the G fixture
plus precisely these insertions. Older fixtures are untouched. Retained literal
native-workflow assertions and added checks for conditional request_user_input,
worker guidance, the Design decision clause, and absence of Engineering discipline
from Design base/developer instructions. The existing Development fixture is
1,748 characters, so its upper bound changes minimally from <1500 to <1750; the
base-instruction bound remains <1500.

Developer-message size delta (character counts, not measured tokenizer counts):

| Fixture mode | Workers | Before | After | Delta |
| --- | --- | ---: | ---: | ---: |
| adaptive | disabled | 1652 | 1652 | +0 |
| adaptive | enabled | 5233 | 5296 | +63 |
| external_workers | disabled | 859 | 1748 | +889 |
| external_workers | enabled | 863 | 1752 | +889 |
| gpt_only | disabled | 859 | 1748 | +889 |
| gpt_only | enabled | 924 | 1813 | +889 |

The Development block contributes 789 characters and
its worker sentence 100; the Design clause contributes
63. Counts use the same portable skill-root placeholder,
research-handbook fixture and configuration before and after. Actual token delta
was NOT_MEASURED; whole-turn token usage is not a developer-message token count.

Observed Windows local checks (Windows 10.0.26200 x64, PowerShell 7.6.6,
Node v24.12.0, project-local pinned Codex 0.161.0):

- npm.cmd run typecheck: PASS, exit 0.
- npm.cmd test -- tests/prompts.test.ts tests/native-workflow.test.tsx
  tests/fingerprint-coverage.test.ts: PASS, seven tests across three files, exit 0.
- npm.cmd run build: PASS, exit 0.
- node --check scripts/live-engineering-discipline.mjs: PASS, exit 0.
- Exact three-insertion source/fixture checks: PASS. Older fixtures and unrelated
  files preserved; git diff --check: PASS, exit 0.

Both requested workflow suites ran once after rebuilding and passed all seven
checks, exit 0:

- node scripts/live-native-workflow.mjs --live --record --mode=adaptive:
  recorded 2026-10-12T09:46:22.589Z; root
  01a12f7f-5d77-7ee2-b40d-a2538a02d46d; fingerprint
  698979d336c85781c12ce43dcb97944f45b4d79a46f3c0cf37aa668591f2c362.
- node scripts/live-native-workflow.mjs --live --record --mode=external_workers:
  recorded 2026-10-12T09:49:11.630Z; root
  01a12f81-baf5-7f52-b621-1b0352e3454a; fingerprint
  9f7bbb6fda8f57563c544b36f189e38cb50a46853a807899a099ed090792c82f.

A final read-only nativeCapability check reports both saved fingerprints ready.
These workflow receipts do not certify the separate discipline probe below.

Added scripts/live-engineering-discipline.mjs: one bounded, opt-in Development
turn in a disposable workspace with sum.cjs and tests/sum.test.cjs. Its assertions
require an actual failing reproducer before the source fileChange, a passing
root rerun after the fix, a final assumption statement and independent test
verification. It declines interactive approvals and never changes permissions.

Observed probe results:

- Initial preflight: FAIL, exit 1 before any model call. The local Node test runner
  emitted spec output while the self-check expected TAP. Changed the checks to
  use the test name, assertion error and exit code instead of a reporter format.
- node scripts/live-engineering-discipline.mjs --live: one actual live model turn,
  root 01a12f84-c03a-79a2-88dd-821678fd7ba9. First text: 2,733 ms; total turn:
  41,310 ms. Suite FAIL, exit 1; acceptance BLOCKED by native test execution.
- Read-only saved-event inspection confirms the root attempted node --test at
  item index 4 before the completed sum.cjs source fileChange at index 7. The
  command exited 1 with spawn EPERM before executing the test assertion. The
  headless fixture declined the requested escalation. This is attempted test
  ordering, not a reproduced failing test or a successful test-first pass.
- The root fixed the operator and explicitly stated numeric-input assumptions
  in its Korean final message, while reporting tests as unverified because of
  the permission restriction. No passing native test rerun was observed.
- Corrected two probe-check details found during readback: expected nonzero
  commands have native status failed, and Korean assumption wording can use
  "전제" as well as "가정". Offline saved-event checks and final syntax check pass;
  the corrected live probe was NOT_RUN again. The real EPERM failure remains
  rejected; no evidence was promoted to pass and no model turn was replayed.

Full offline suite, bundled-skills rerun, package/install smoke, Windows/macOS CI,
manual terminal and macOS live checks: NOT_RUN for this hand-off. No sandbox,
credential or runtime settings were changed. Both OS workflows remain intact.
Local receipts are in ignored outputs/hand-off-h-20261012/. No commit, push,
release or npm publication was performed. The owner must quit and restart Hera
to load the rebuilt instructions. A future discipline probe still needs an
executable test runner within the native sandbox; its live acceptance is open.

## Hand-off H review: ask rule no longer names an unexposed tool (2026-10-13)

Claude reviewed Hand-off H. Typecheck, 158 tests across 28 files, build and
git diff --check pass; the H fixture equals the G fixture plus only the three
recorded insertions (checked by stripping them and comparing every field).

Defect found in the brief itself, not in Codex's implementation: the block said
"Ask with request_user_input only when ...". In pinned Codex 0.161.0 that tool
is offered only in Plan collaboration mode unless the under-development feature
default_mode_request_user_input is enabled (tools/src/tool_config.rs,
features/src/lib.rs: default_enabled false). Hera sets neither, so a Development
turn has no such tool. Reworded to "Ask the user only when plausible
interpretations would materially change the work." in src/session/prompts.ts,
the H fixture (four Development cases) and the native-workflow assertion. The
Development developer message is 15 characters shorter than recorded above
(1,733 for the fixture case; bound <1750 unchanged). Enabling the feature so
questions use the existing NativePrompt UI is a possible later change; not done.

The fingerprints recorded in the section above are superseded:

- node scripts/live-native-workflow.mjs --live --record --mode=adaptive: PASS,
  seven checks, 2026-10-13T00:13:21.092Z, fingerprint
  d2a8c477c9bb814837b0015d1f07debb00cf094f7e4fe37ccb29a705ee88dc38.
- node scripts/live-native-workflow.mjs --live --record --mode=external_workers:
  PASS, seven checks, 2026-10-13T00:15:58.272Z, fingerprint
  977b089dfa960bfa1cf769b67d6114f5d0f83c50cce1b41784db44f97e6039f7.

Discipline probe readback (outputs/hand-off-h-20261012/probe-thread.json)
confirms Codex's account: the root ran node --test before editing sum.cjs, and
the runner failed with spawn EPERM because the Windows workspace sandbox denies
the per-file child process, so no assertion ran. Consequence for users: on
Windows the test-first rule leads to an approval request for runners that spawn
children. scripts/live-engineering-discipline.mjs has never passed; its fixture
needs a test that runs in-process (plain node tests/sum.test.cjs with assert).
NOT_RUN: corrected discipline probe, bundled-skills suite, macOS/CI.

## Hand-off I: in-process engineering-discipline fixture (2026-10-13)

Changed only scripts/live-engineering-discipline.mjs and this status section.
The disposable tests/sum.test.cjs now uses node:assert/strict directly, without
node:test, and runs as node tests/sum.test.cjs. The Korean probe request adds one
clause explaining that invocation and its in-process execution. The preflight
checks stderr for the assertion failure, since a plain Node script reports an
uncaught assertion there. The successful script prints the existing test-name
marker so the passing-rerun check remains intact.

The reproducer now requires a commandExecution referencing sum.test.cjs, a
numeric nonzero exit code, and ERR_ASSERTION or AssertionError in its output,
before the completed sum.cjs fileChange. It does not mistake spawn EPERM for a
reproduced bug. Passing-rerun ordering, final-assumption and independent-test
checks are unchanged. No product prompt, fingerprint input, runtime or sandbox
setting changed; the Hand-off H review qualification remains applicable.

Observed Windows offline verification:

- Executed the exact generated plain-assert fixture locally: buggy source exited
  1 with ERR_ASSERTION; corrected source exited 0 with the success marker.
- Eight reproducer-predicate cases passed: both assertion forms/nonzero codes
  accepted; success, missing/unknown exit, unrelated command/item and EPERM-only
  output rejected.
- node --check scripts/live-engineering-discipline.mjs: PASS, exit 0.
- Source preservation and git diff --check: PASS. Other uncommitted work remains
  unchanged. Local receipt: outputs/hand-off-i-20261013/offline-check.json (ignored).

node scripts/live-engineering-discipline.mjs --live: NOT_RUN, pending the owner
go-ahead explicitly required by Hand-off I. First-text latency: NOT_RUN; total
latency: NOT_RUN. Local fixture execution is not native sandbox/live acceptance.
No build, broad test suite, CI, macOS checks, commit or push was performed.

## Hand-off I live probe (2026-10-13)

Owner go-ahead given. node scripts/live-engineering-discipline.mjs --live: PASS,
exit 0, one run, Windows x64, external_workers, fingerprint
977b089dfa960bfa1cf769b67d6114f5d0f83c50cce1b41784db44f97e6039f7, root
01a132eb-d385-7870-9b04-a710febfdeed. First text 3,210 ms; total 27,343 ms.
The root ran the failing reproducer (item 4) before the sum.cjs fileChange
(item 7), reran it successfully (item 8) and stated an assumption in the final
message; the independent rerun passed. Single sample; runners that spawn child
processes still hit the Windows sandbox limit recorded above.
NOT_RUN: bundled-skills suite, macOS/CI.

## Hand-off J review (2026-10-13)

Superseded by Hand-off L: the exclusive lock and its takeover were removed, so the limits below no longer apply.

Claude reviewed the dead-owner lock takeover. Typecheck, 174 tests across 28
files, build and git diff --check pass on the final tree; both recorded
fingerprints report ready against the rebuilt dist. Implementation matches the
brief; no code change from review.

Known limit, accepted: two Hera processes starting in the same workspace at the
same moment after a crash can both read the dead owner; if the first completes
its whole takeover before the second renames, the second renames the first's
new live lock. The window is the few file operations between reading
owner.json and rename. Closing it means checking the renamed directory's nonce
against the one read and refusing on mismatch. A rename that fails with a code
other than ENOENT (for example EPERM while another process holds the
directory) surfaces as an unclassified error instead of WORKSPACE_LOCKED.

## Hand-off L review (2026-10-13)

Claude reviewed the presence-record change. Typecheck, 172 tests across 28
files, build and git diff --check pass; both recorded fingerprints report ready
against the rebuilt dist; no hera-test-run-* directory remained in %TEMP%.
Implementation matches the brief; no code change from review. No reference to
WORKSPACE_LOCKED, LOCK_OWNERSHIP_CHANGED or recoveredLock remains in src, tests,
scripts, READMEs or the UX guide.

Checked specifically: one process reuses one <pid>.json across successive
sessions, which is safe because InteractiveSession.newSession() awaits the old
controller's close (and its release) before opening the next. Accepted limits:
a hard-killed session whose pid is later reused keeps its saved session
refusing resume with SESSION_IN_USE until that record is removed by hand; a
crash during an atomic write can leave a .tmp file that keeps the directory.
NOT_RUN by Claude: live suites (Codex's results above stand), package smoke,
macOS/CI.

## Hand-off K: script fixture cleanup (2026-10-13)

Added `scripts/temp-fixture.mjs`: each created directory is registered for
synchronous recursive removal on process exit code 0, with force and five
retries. Failed or interrupted runs retain their fixtures. Removal errors print
one escaped stderr line per directory and do not change the exit code.
Replaced all 25 requested temporary-directory creation sites in 24 scripts,
including the design-latency loop, live-apply's outside directory and both
live-native-workflow directories. Assertions, script logic and printed JSON
remain unchanged; printed fixture paths may no longer exist after success.

`live-worker-boundaries.mjs` and `live-workers.mjs` remain unchanged, including
their creation paths: later `--cwd` continuation/verification invocations need
those directories. No final-invocation cleanup was added.

`prepare-release.mjs` now removes only its own `release-staging/pack-*` directory
after successful preparation; failures retain staging. Reviewed package:check,
package:smoke, the Windows/macOS CI workflow and release documentation: subsequent
steps read the archive/checksums/metadata in `.artifacts`, not pack staging.
The existing Vitest global cleanup and package-smoke cleanup from 143040e were
left unchanged.

Observed Windows local verification (Windows 10.0.26200 x64, Intel i7-12700,
PowerShell 7.6.6 Core, Node v24.12.0; project-local pinned runtime):

- `node scripts/temp-fixture-check.mjs`: PASS, exit 0. Child processes verify
  natural and explicit exit 0, nonzero exitCode and explicit exit, uncaught
  failure, SIGTERM interruption, multiple nested fixtures and simulated removal
  failures. Failed child fixtures exist when asserted, then the successful
  self-check removes its own enclosing fixture. Zero new `%TEMP%/hera*` entries.
- `node --check` on all 27 touched/new `.mjs` scripts: PASS, exit 0.
- `npm.cmd run typecheck`: PASS, exit 0.
- `npm.cmd test`: PASS, exit 0; 172 tests across 28 files. Zero new hera temp entries.
- `npm.cmd run build`: PASS, exit 0.
- `native-smoke`, `native-safety-smoke`, `credentials-smoke` and
  `research-browser-check`: PASS, exit 0 each. Before/after `%TEMP%/hera*`
  comparisons found zero new entries after each script. No model inference;
  credentials-smoke used only a fresh fixture-scoped OS credential, and the
  browser check used intercepted fixture pages, not live search.
- `npm.cmd run release:prepare`: PASS, exit 0; zero new pack directories remain.
- `npm.cmd run package:check`: PASS, exit 0; freshly prepared archive has 1,906
  files and 2,493,444 bytes. SHA-256:
  `99105e69398af8743deafb4a4ec6fee772fab8938628af133df9dfa8e43e6713`.
- Source comparison confirms the 24 script bodies differ only in fixture calls
  (apart from import changes); both resumable scripts and prior cleanup files
  match HEAD. `git diff --check`: PASS.

NOT_RUN: all live scripts (no owner go-ahead for this handoff), native-patch-smoke
(requires an explicitly supplied experimental standalone executable), package
smoke, Windows CI, macOS CI and macOS manual/live checks. CI targets are unchanged.
No src changes, fingerprint-input changes, re-qualification, deletion of
pre-existing temp entries or Hera locks, commit, push or publication.

## Hand-off K review and presence-record race fix (2026-10-13)

Claude reviewed Hand-off K. The 24 script diffs are import changes plus the
fixture call; no script still uses an import that was removed (checked tmpdir,
join and mkdtemp usage against imports per file). temp-fixture-check, node
--check on every touched script, native-smoke and native-safety-smoke pass
with no new %TEMP%/hera* entry. Hand-off K itself needed no change.

Defect found while reviewing, in Hand-off L code already pushed at 143040e and
missed in that review: tests/safety.test.ts "never admits both simultaneous
claims of the same saved session" failed in four consecutive full-suite runs
with EPERM on rename. On Windows a presence record cannot be replaced while
another session is reading it, so setSessionId could fail session start-up
with a raw EPERM when two sessions start together. Separately, a record that
could not be read at that moment had no pid, was treated as dead and deleted,
removing a live session's presence. Fixed in src/session/workspace-lock.ts:

- write() retries ENOENT, EPERM, EBUSY and EACCES up to five attempts with
  50 ms x attempt back-off;
- an unreadable <pid>.json takes its pid from the file name, so a live
  session's record is ignored instead of deleted.

After the fix: typecheck and build pass; three full-suite runs gave 172/172,
171/172, 172/172, with no presence failure. The one remaining failure is
tests/tui.test.tsx "shows submitted Korean input while the runtime is still
connecting ...": the frame after a 70 ms tick did not yet show the echoed
input. It passes alone (3/3) and failed in 5 of 8 full-suite runs during this
review while a disk scanner was running on the machine; treated as a
timing-sensitive test, not changed here.

workspace-lock.ts is a fingerprint input, so both modes were re-qualified:

- node scripts/live-native-workflow.mjs --live --record --mode=adaptive: PASS,
  seven checks, 2026-10-13T05:41:14.417Z, fingerprint
  c30d23d6146ecd2864c8805d34ced3408346b03368fe413c994e67b265b86cfe.
- node scripts/live-native-workflow.mjs --live --record --mode=external_workers:
  PASS, seven checks, 2026-10-13T05:44:22.826Z, fingerprint
  56a951db451c0fd258a0c017a79e8d3bfe3a63fceb7cbcb7dd8e87cf37ea4f93.

These two live runs also exercised the Hand-off K helper: %TEMP%/hera* entries
were 213 before and 213 after. The fingerprints in the Hand-off L section are
superseded. NOT_RUN: other live scripts, package smoke, macOS/CI. The owner
must restart Hera.
