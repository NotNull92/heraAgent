# Implementation status

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
[CI `37720164302`](https://github.com/NotNull92/heraAgent/actions/runs/37720164302)
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
the private remote. [CI `37716932924`](https://github.com/NotNull92/heraAgent/actions/runs/37716932924)
completed successfully: both platforms' offline checks, Windows package smoke,
and clean-prefix Windows/macOS installation of the same Windows-built archive.
Downloaded archive SHA-256 matched its CI checksum file:
`419ddc54794eca6901d584ffae7999070309b36b6b30a3e7aa6309e86c5a5d17`.
Superseded native workflow `37715231091` was cancelled
following its macOS fresh-home pass. Replacement [native CI `37716968069`](https://github.com/NotNull92/heraAgent/actions/runs/37716968069)
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
[CI 37707243321](https://github.com/NotNull92/heraAgent/actions/runs/37707243321):
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
CI [37601591133](https://github.com/NotNull92/heraAgent/actions/runs/37601591133)
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
[37594309507](https://github.com/NotNull92/heraAgent/actions/runs/37594309507)
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
Product CI [37573653148](https://github.com/NotNull92/heraAgent/actions/runs/37573653148)
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
[37578298594](https://github.com/NotNull92/heraAgent/actions/runs/37578298594) passed
all four jobs: both platform offline checks, Windows packaging and Windows/macOS
installed-package checks. The downloaded CI archive checksum
matched `944f53782ac68963c492a67705055fd3b48501e3b8e0033cf214d0ff2058314b`;
those exact bytes passed local Windows install/native initialization/reinstall,
credential persistence and launcher checks. The first invocation used the local
artifact directory's checksum and failed before installation; selecting the downloaded
artifact directory corrected the invocation. Native qualification
[37578328995](https://github.com/NotNull92/heraAgent/actions/runs/37578328995) passed
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

CI run [37565451567](https://github.com/NotNull92/heraAgent/actions/runs/37565451567)
at `7a8f2f3` passed macOS offline checks, failed the Windows picker test and skipped
installed-package jobs. Waiting for visible frames did not flush React's passive
input subscription. The test now uses React `act` around rendering and keyboard
transitions. Windows focused picker and typecheck passed (exit 0). Two full-suite
runs during the Rust build each timed out in five tests (43/48 passed, exit 1),
including unchanged file-sync tests; these are recorded failures, not a full pass.
A later serial run with a 60-second per-test bound passed 48/48 (exit 0); this does
not erase those default-timeout failures. Main `bb4dd24551955b1a8860a485e93e339276851483`
was privately pushed and its remote SHA verified. CI run
[37567629845](https://github.com/NotNull92/heraAgent/actions/runs/37567629845) passed
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
