# Hera refactoring review request (2026-10-12)

Status: **MERGED REVIEW — Hand-off F authorizes the limited batch in Section 6.**
No refactoring had been performed at baseline `9389a177b6a578e924be0a53368e5644467b0e77`.
The original proposal used `5716ed3` (129 tests); references below are rechecked
against Hand-off E (135 tests). Tracked source was clean; this document was untracked.
Reviewers are asked to verify every claim against the code and return a verdict
per proposal; do not modify the working tree.

## 1. Purpose

Two independent reviewers (Claude and Codex) receive this same document. Each
should verify the factual claims at the stated commit, judge the risk/benefit of
each proposal, and return:

- a verdict per proposal (`accept` / `modify` / `reject`) with reasons and
  counter-evidence where applicable, and
- any additional refactoring findings with file/line evidence.

This report is the author's analysis, not evidence. Re-check claims in the
source before agreeing with them.

## 2. How to verify

- Repository: `heraAgent`, commit `9389a177b6a578e924be0a53368e5644467b0e77`
  (public remote `NotNull92/heraAgent`, branch `main`), clean tracked source.
- Historical Windows baseline results recorded in `docs/status.md` for Hand-off E
  (not rerun by this documentation correction):

  | Command | Result |
  |---|---|
  | `npm run typecheck` | exit 0 |
  | `npm test` | 23 files / 135 tests passed |
  | `npm run build` | exit 0 |

- All line numbers below refer to that commit. File sizes are approximate.
- This document follows the project's evidence policy: **Observation** items
  describe the code as read; **Proposal** items are design choices, not
  verified work.

## 3. Constraints that shape any refactor

1. **Capability fingerprints hash source content.** `src/codex/capabilities.ts`
   (lines 19-27) hashes a hardcoded list of 21 source paths; `nativeCapability`
   (lines 32-44) additionally hashes the two packaged handbooks and the bundled
   skills. Any change to hashed files invalidates the local native verification
   records (`<HERA_HOME>/metadata/native-<mode>-verification.json`); worker
   sessions stay blocked until fresh live qualification, which is a separate
   user-approved activity. Refactors should therefore be batched and
   re-qualified once.
2. **Legacy phased helpers and fixtures are preserved** as historical
   qualification evidence (`AGENTS.md`, spec amendment). Legacy code must not be
   deleted; isolating it is allowed.
3. **`docs/ux-guide.md` freezes TUI behaviors.** Anything under `src/tui/` must
   be a behavior-preserving move.
4. **Prompt wording is part of model behavior** and is separately qualified.
   Prompt refactors must be pure moves with identical strings.
5. Engineering documentation is English; product text stays Korean/English per
   configuration.
6. No new runtime dependencies are proposed; all items are internal
   restructuring.

## 4. Proposals

### R1 — Fingerprint source manifest + coverage test

**Observation.** `capabilities.ts` hashes a hardcoded path list (line 23).
Adding a new source file (for example an extracted prompts module) without
editing that list silently excludes it from qualification fingerprints. Moving
or deleting a listed file fails loudly with `ENOENT` instead.

**Proposal.** Export a single `FINGERPRINT_SOURCES` constant; add a test that
fails when any non-generated `src/**/*.ts(x)` file is neither listed nor
explicitly excluded. Preserve existing inputs and add accepted coverage. This
module hashes itself: even extracting the unchanged list changes its fingerprint.
Re-qualification is required.

**Evidence.** `src/codex/capabilities.ts:19-27,32-44`.

**Risk.** Low. **Size.** Small. **Depends on.** Nothing; do first.

### R2 — Split `controller.ts` (product path vs legacy path)

**Observation.** `src/session/controller.ts` mixes the following concerns:

- shared startup checks followed by legacy session start `start()` (line 53),
- product session start `startNative()` (line 83),
- `verifyRuntime()` (line 102),
- approval plumbing: `deny()` (139), `receiveRequest()` (145),
  `answerRequest()` (167),
- turn lifecycle `execute()` (185), and
- the legacy apply path `requestApply()` (213), `applyApproved()` (229).

**Observation — the apply path is product-unreachable.** `Controller.open()`
always constructs with `nativeFlow=true` (line 48); `startNative()` sets
`phase='NATIVE'` (line 99); `requestApply()` requires
`phase==='ANALYZE_READ_ONLY'` (line 214) and therefore always throws
`APPLY_GATE_BLOCKED` in product. The legacy path remains reachable from tests
and preserved live fixtures, including `scripts/live-product-apply.mjs:19-26`
and `scripts/live-product-workers.mjs:24-35`.

**Proposal.** Move `start`/`startNative`/`verifyRuntime`/`nativeBaseInstructions`
to `session/session-start.ts`; approvals to `session/approvals.ts`;
`requestApply`/`applyApproved` to `session/legacy-apply.ts`. Keep `Controller`
as a façade with its current public surface: tests call
`Reflect.get(controller,'startNative')`, so instance method names must stay.

**Risk.** Medium (private-method test access; fingerprint list must be updated).
**Size.** Medium. **Depends on.** R1.

### R3 — Extract slash-command handlers from `interactive.ts`

**Observation.** `command()` (lines 147-193) holds 17 command cases, including
the hidden `/apply` compatibility notice (16 menu entries). `/model` and
`/effort` already share `saveModelChoice`. That helper, `/mode` and `/workers`
prepare/validate a candidate before `newSession → saveConfig → Object.assign →
notice` (lines 80-91, 161, 174-175). `/style` only calls `setStyle` and displays
a notice (186-187); it must not acquire the other commands' reset behavior.
`observe()` (125-143) includes ownership and provider-dependent activity logic.

**Proposal.** Introduce a `src/session/commands/` registry with per-command
handlers; add one shared `applyConfigChange(candidate, message)` helper; convert
the activity-label chain to a lookup table with identical labels.

**Risk.** Low-medium (all user-visible text is ux-guide-governed; covered by
`tests/settings-commands.test.ts`, `tests/activity.test.tsx`). **Size.** Medium.
**Depends on.** Nothing (benefits from R2 for shared helpers).

### R4 — Prompts to named builders

**Observation.** `nativeBaseInstructions` (controller.ts line 29) and
`startNative`'s `routing`, `skillRouting` and `developerInstructions` (88-90) are large
nested template literals. `tests/native-workflow.test.tsx` asserts independent
substrings of these strings, so wording edits are brittle and the safety intent
behind each assertion is hard to see.

**Proposal.** Pure move to `session/prompts.ts` with named builders
(`nativeBaseInstructions(mode)`, `adaptiveRouting(...)`,
`developmentRouting(...)`, and developer instructions). Keep independent literal
assertions and captured pre-move output fixtures; expecting implementation
constants would hide wording drift. Include the `/plan` prefix at
`interactive.ts:178`. No wording change.

**Risk.** Low (move only). **Size.** Medium. **Depends on.** R1 (fingerprint
coverage for the new module).

### R5 — Single version constant + one settings serializer

**Observation.** `'0.1.0-alpha.1'` is hardcoded four times:
`src/cli.ts:19`, `src/codex/client.ts:42`, `src/providers/opencode-go.ts:11`,
`src/codex/external-runtime.ts:79`. Settings-to-`-c` flattening exists three times:
non-recursive in `client.ts:37` and `config-compiler.ts:38`, recursive `args()` in
`external-runtime.ts:80`.

**Proposal.** Add `src/version.ts` (with a test comparing it to
`package.json`); export one recursive `settingsArgs()` from
`config-compiler.ts` and use it in all three callers only after identical argv
checks for current caller inputs, dotted keys, nested objects, arrays, null and booleans.

**Risk.** Low. **Size.** Small. **Depends on.** Nothing.

### R6 — Decompose `NativeWorkers.refresh()`

**Observation.** `refresh()` (`src/session/workers.ts` lines 56-107) mixes a
bounded retry loop around pinned-runtime error-message regexes (60-69), bounded
hydration (512 threads / 32 MiB; lines 58, 73, 83), routing verification
(101-104) and limit verification (105). Empty-rollout detection uses a regex;
not-materialized detection requires RPC_-32600 and exact dynamic message equality
(79), not a regex.

**Proposal.** Extract `hydrateTree()` and `checkRouting()`; name the
version-coupled regexes as constants annotated with the pinned runtime version.
Public behavior unchanged.

**Risk.** Low-medium (tests exercise through public methods,
`tests/workers.test.ts`). **Size.** Medium. **Depends on.** R1.

### R7 — TUI pure logic to modules

**Observation.** `src/tui/App.tsx` contains `emphasis()` (42-58),
`formatLine()` (61-73) and the transcript windowing state machine (100-108)
driven by a mutable ref plus a character counter. `Composer.tsx` input helpers
(`graphemes`, `editInput`, `caret`) are already exported and unit-tested.

**Proposal.** Move `emphasis`, `formatLine` and the windowing/format state
machine into `src/tui/transcript.ts` as pure functions/reducer; keep components
thin. Behavior unchanged per `docs/ux-guide.md` (resize clear, fence survival,
`KEPT_LINES` blanking, bold-only markdown).

**Risk.** Low-medium (`tests/tui.test.tsx` covers). **Size.** Medium.
**Depends on.** Nothing.

### R8 — Small cleanups

**Observation.**

- `src/codex/launcher.ts:21` — dead ternary
  (`process.platform==='win32'?'PATH':'PATH'`).
- `src/codex/launcher.ts:15` — stray space in the package-escape check
  (`dirname(file)+ '\\'`); separator handling deserves a second look off
  Windows.
- `// ponytail:` comment prefix in `workers.ts:57,59`, `phase-policy.ts:18`,
  `queue.ts:11` — opaque to outside contributors.
- `interactive.ts:74` (`approveApply`) and `src/tui/ApplyReview.tsx` are
  product-unreachable for the same reason as R2's apply path.

**Proposal.** Fix the dead ternary; remove the stray source space without changing
the separator check; preserve the requested `ponytail:` prefix; mark the UI as
legacy compatibility.

**Risk.** Low. **Size.** Small. **Depends on.** Nothing.

## 5. Explicit non-goals

- No whole-codebase reformat. The dense one-line style is a deliberate
  token-efficiency choice; reformatting would create unreviewable diffs and
  conflict with existing review evidence.
- No deletion of legacy phased code, fixtures or their tests.
- No prompt-wording, native-settings, TUI-behavior, credential-handling or
  dependency changes.
- No exploratory live calls. Hand-off F explicitly authorizes one final native
  re-qualification and the bundled-skills checks for both supported modes.

## 6. Suggested sequence

Hand-off F accepts R1, R4, R5, one R3 config-save helper, and the limited R8 cleanup.
No per-command registry or activity lookup conversion is accepted.

R2 is deferred because startup, approvals and legacy apply share lifecycle state;
a facade split could replace local state with a large shared context. R6 is
deferred because snapshot publication, cancellation without routing checks,
unmaterialized children and inventory bounds must stay coupled. R7 is deferred
because JSX/state mutation make it more than a pure move and a reducer has no
demonstrated test gain; a KEPT_LINES boundary test belongs in a separate hand-off.

Complete the batch before typecheck, tests, build, a clean temporary build/package
inspection, and one native qualification per supported mode plus bundled-skills
live checks. Only this baseline document gets a docs-only commit; implementation
commits and all pushes are out of scope.

## 7. Questions for reviewers

1. Are the reachability claims (R2 apply path, R8 ApplyReview UI) correct for
   every product entry point: interactive TUI, headless `run`/`resume`,
   `/plan`, and single-agent operation?
2. Does R1's coverage test have loopholes — generated protocol files, assets,
   handbook files, `package.json` dependencies (which are also hashed), and the
   build-time `.ts`/`.js` extension switch?
3. Are there hidden coupling points that make R2/R4/R6 riskier than stated
   (circular imports, test private access, fingerprint inputs, `dist` output)?
4. Would you prioritize differently, or add proposals? Provide file/line
   evidence.
5. For R7: is the windowing reducer extraction genuinely simpler, or does it
   add indirection without test gain?
6. Anything in this report that is wrong or unsupported by the code?

## Appendix — Source files read in full for this review

`src/cli.ts`, `src/config.ts`, `src/errors.ts`, `src/metadata.ts`,
`src/paths.ts`, `src/secret-input.ts`,
`src/codex/capabilities.ts`, `src/codex/client.ts`,
`src/codex/config-compiler.ts`, `src/codex/external-runtime.ts`,
`src/codex/launcher.ts`, `src/codex/skills.ts`, `src/codex/startup.ts`,
`src/codex/transport.ts`, `src/codex/web-research.ts`,
`src/providers/accounts.ts`, `src/providers/go-credentials.ts`,
`src/providers/opencode-go.ts`,
`src/research/browser.ts`, `src/research/proxy.ts`, `src/research/queue.ts`,
`src/research/server.ts`,
`src/session/apply-review.ts`, `src/session/controller.ts`,
`src/session/interactive.ts`, `src/session/limits.ts`,
`src/session/phase-policy.ts`, `src/session/styles.ts`,
`src/session/workers.ts`, `src/session/workspace-lock.ts`,
`src/tui/App.tsx`, `src/tui/ApplyReview.tsx`, `src/tui/Composer.tsx`,
`src/tui/NativePrompt.tsx`, `src/tui/SettingsPicker.tsx`, `src/tui/theme.tsx`.

Tests and scripts were read selectively (fake app server, client, native
workflow, worker evidence, settings, TUI, transport, provider, research,
safety, repository, and the test-name inventory). Documentation read:
`AGENTS.md`, `CLAUDE.md`, `CODEX_START_PROMPT.txt`, `README.md`,
`CHANGELOG.md`, `docs/ux-guide.md`, `docs/token-efficiency.md`,
`docs/compatibility.md`, and the current checkpoint of `docs/status.md`.
`docs/implementation-spec.md` was read in part (Sections 0-4 plus the
authorized amendments and heading inventory).
