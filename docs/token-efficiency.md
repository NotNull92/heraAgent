# Token efficiency: bounded edits and test batching

The 2026-10-07 optimization keeps native model/tool execution, user approval and
the single-writer phase boundary. It adds no model, provider, billing route or
dependency. Unrelated in-progress UI/settings changes are excluded from this change.

## Behavior and safety

- The model proposes ordered `{oldText,newText}` edits. Hera reconstructs complete
  before/after text locally for review, without writing the workspace. Each oldText
  must match exactly once after earlier edits. Empty oldText is allowed only for a
  new or empty file. Missing/ambiguous matches fail; there is no fuzzy matching.
- Approval binds the baseline, resolved proposal and original edits. Approval is
  revalidated before the native main-only write phase. Only the compact edits are
  sent back to the model. Exact resulting file contents and unlisted-file integrity
  are still checked before any test. The model remains the native writer.
- All approved tests use one main turn. Each must be a separate native command,
  in approved order, with the preceding command complete. A live event observer
  rejects overlapping/foreign/extra commands, native file-change items and continuation
  after a failed/unknown command. Native history must also provide exact commands and
  exit codes. Missing evidence never becomes a pass; unexpected execution closes the
  owned session and retains uncertain recovery state. Event detection is not an OS
  pre-execution hook and does not claim to roll back an already-started command.
- Worker guidance is shorter and asks the main to handle small tasks itself. Worker
  count is a ceiling, not a target. Unchanged follow-up schemas/context need not be
  repeated. Routing, permissions, required contracts and local validation remain.

## Native Windows paired measurement

`node scripts/live-token-efficiency.mjs --live --before` used a preserved pre-change
build from source `995f70f`; `--live` used the optimized build. Both ran Astra/high,
fresh disposable workspaces, the same 6,423-character file, the same addition fix
and the same two Node tests. Both exited 0, preserved the test files, applied the
exact expected contents and observed both native test exit codes as 0. No workers
were used in this measurement. Each fixture was bounded to five main turns / 240s.

| Observed metric | Before | After |
|---|---:|---:|
| Main turns | 5 | 4 |
| Apply payload characters | 6,557 | 60 |
| Input tokens | 208,615 | 90,131 |
| Cached input tokens (included above) | 175,872 | 54,016 |
| Uncached input tokens (difference) | 32,743 | 36,115 |
| Output tokens | 2,892 | 1,089 |
| Total reported tokens | 211,507 | 91,220 |

Before thread: `01a11546-830d-7db0-8990-ab3d26731b3b`.
After thread: `01a11549-df0c-7410-bd2b-f70be59de982`.
Counts came from native `thread/tokenUsage/updated`, not character-to-token estimates.
The main instruction body separately shrank from 3,030 to 2,853 characters for GPT
workers and 3,311 to 3,134 for mixed mode; these are character counts, not tokens.

This is one sequential pair, not a repeated benchmark or a comparison against the
Codex TUI. The model can choose different tool steps and caching differs: uncached
input increased despite lower total/output tokens. Do not claim a fixed percentage
of billing, subscription allowance or future-task savings. One Hera turn can contain
multiple native model requests. The reproducible structural gains are compact edit
payloads and one verification turn regardless of the approved test count (1-10).

Offline negative checks cover ambiguous/missing edits, new files, Unicode/CRLF,
unsafe paths, stale/tampered approvals, unexpected command order, missing exits,
overlap and failure continuation. The scoped Windows source snapshot passed
typecheck, build and all 57 tests (exit 0). Its first test attempt was 56/57 because
the source archive lacked the Git marker required by the authentication-home test;
initializing that disposable local Git fixture fixed the setup. The shared working
tree had unrelated concurrent UI/probe edits (a later run was 58/64); those failures
were preserved and those files were not changed or included in this commit.

Windows live product worker regressions also passed (exit 0):

- Official GPT worker/root: `01a1154b-8b65-7892-a659-63ae1d4f1d76`.
- Mixed Go worker/root: `01a1154d-9820-7c01-9868-ade72799674f`.

Both exercised native worker read/follow-up, cold resume, result contracts, compact
proposal review, exact main-only application and actual Node test exit 0. Existing
worker-count/routing policy, native runtime, schemas, provider transport/auth,
permission denial and cancellation implementation were unchanged. Their earlier
native negative evidence remains historical; this run does not claim a fresh paid
expired-key/quota failure or macOS live test. Mode-specific local acceptance is
maintainer-attested using the reviewed unchanged boundary evidence plus these new
live regressions; neither an installer nor a mock test can promote it automatically.
Current commit CI is separate and must be observed after push. macOS live/manual
checks remain NOT_RUN.
