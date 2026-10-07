# ADR-002: Keep external workers unavailable pending native compatibility

Status: blocked native child routing; updated 2026-10-07 after live Go tests and
the user's request to investigate endpoint APIs and DeepSeek Harness.

## Observed endpoint and native behavior

Codex 0.160.1 WireApi contains only `responses`. Go documentation lists DeepSeek on
`/chat/completions`, but actual tests now establish more: the stored Go key returned
the requested coding expression with reported model deepseek-v4.1-flash, and a native
Codex root using Go `/responses` executed a read-only shell command and returned an
unpredictable file marker. No bridge was needed for that standalone turn. See status.md
for exact native thread IDs and failures. The earlier wire-format-only concern is
superseded; this does not imply Go supports every Responses feature.

The remaining observed failure is GPT-to-Go **native child routing**:

1. An explicit DeepSeek spawn model is rejected by the GPT parent's available-model
   validation before creating a child.
2. A role file can select the DeepSeek model when the model argument is omitted,
   but its model_provider is not applied. The actual child remains on openai and
   fails HTTP 400 as an unsupported ChatGPT model. A separate attempt requesting
   the older backend also failed; no alternate-backend pass is claimed.
3. The matching pinned source explains the result: AgentRoleOverrides allows model,
   reasoning, instructions and bounded features/skills, but omits model_provider.
   It reconstructs the role config from that allowlist. This is not a Go key failure.

Source: [Codex role override allowlist, pinned commit](https://github.com/openai/codex/blob/d27764b82f7118f674371e6d6e76271d9d606edb/codex-rs/core/src/agent/role.rs#L35).

## DeepSeek Harness reference investigation

Read-only investigation at commit `5badb15009ae1756c3afe0ae0cef1faafc290ccc`:

- [Provider adapter](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/llm/llm-pi-ai/src/provider.ts)
  selects a provider and wire protocol before streaming. It supports Chat Completions,
  Responses and Anthropic Messages for custom routes. This is useful design evidence
  for explicit endpoint/provider identity; it does not change Codex's child allowlist.
- [Subagent architecture](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/subsystems/subagent.md)
  owns a provider registry and continuation/descendant management. Adopting that layer
  would introduce another orchestration system, beyond the current native-only design.
- [Codex adapter contract](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/subagent/subagent-codex/README.md)
  starts a fresh app-server/ephemeral thread for each one-turn job; it does not provide
  continuation/resume or dynamically select modelProvider. It is not a fix for the
  same native GPT-child limitation and does not satisfy Hera's worker-resume requirement.

No Harness dependency, source code, credentials or separate runtime was installed.
The user's Hera OS credential store remains authoritative.

## Precedents investigated on 2026-10-07

Searches covered the exact symptom, OpenCode Go Responses workers, native provider
patches, encrypted V2 delivery and endpoint routers. Findings below distinguish source
inspection and other authors' reports from Hera's own Windows live evidence above.
No candidate was installed, built or executed. No credential was supplied to a router.

### Official regression and its security boundary

[OpenAI issue 40858](https://github.com/openai/codex/issues/40858) remains open.
It reports the same model-applied/provider-ignored behavior; a
[Go-specific reproduction](https://github.com/openai/codex/issues/40858#issuecomment-5540953471)
also reports that Responses compatibility alone does not fix native children.
[PR 39299](https://github.com/openai/codex/pull/39299), merged August 18, intentionally
restricted roles so they cannot replace parent-owned provider or permission settings.
This explains why older role configuration examples do not establish support in 0.160.1.

Routing is only one boundary: [issue 36387](https://github.com/openai/codex/issues/36387)
records a Windows child with the correct external provider but an unreadable encrypted
task. Changing the provider without proving task delivery, follow-up and recovery is
insufficient. Reverting all role restrictions would undo unrelated authority protections.

### Native runtime patch candidates

| Candidate | Inspected revision and evidence | Hera assessment |
|---|---|---|
| [Bozentan/codex PR 2](https://github.com/Bozentan/codex/pull/2) | `af3072ebbcde8d47bb8592a6a3226ef1b83b560a`, based on 0.154.0-alpha.1; 55 files, 4,046 additions / 464 deletions. User-owned provider allowlist, provider-specific child state/catalog, fresh cross-provider context, plaintext external delivery and resume checks. | Strongest reference for preserving native orchestration, but a substantial fork candidate, not an upstream fix or a drop-in 0.160.1 patch. |
| [magic3007/codex patch](https://github.com/magic3007/codex/commit/30e9f16e2c9db34ca233dd28ae74ed9a5356aca9) | `30e9f16e2c9db34ca233dd28ae74ed9a5356aca9`; 23 files, 643 additions / 107 deletions; routing and plaintext/fresh-context work. Fork PR 1 is closed and **not merged**. | Additional implementation precedent; no verified Hera/Go compatibility. A smaller diff does not establish equivalent isolation/resume coverage. |
| [NathanNT/codex-mux](https://github.com/NathanNT/codex-mux/tree/60efa6dede8990e6ae8e3e6f1911cea714f09560) | Source patch and PowerShell build script target 0.154.0-alpha.6.2. Role selection requires read-only + on-request + automatic review; documentation uses a file-backed assignment for encrypted messages. | Windows source-build precedent, but its approval policy differs from Hera's never-policy and its mailbox is not proof of native message delivery. No macOS acceptance established. |

Bozentan's author reports 6/6 cross-provider integration checks, 417/417 affected
package checks and a Windows release build. The inspected
[cross-provider suite](https://github.com/Bozentan/codex/blob/af3072ebbcde8d47bb8592a6a3226ef1b83b560a/codex-rs/core/tests/suite/cross_provider_subagents.rs)
uses `start_mock_server`, synthetic SSE and fixture credentials. Those numbers are
author-reported **mock-backed native integration results**, not real Go acceptance.
The PR's CI is not all green; its author reports base/fork infrastructure limitations,
including macOS billing limits. We have not independently validated that attribution.

Inspected [provider restoration](https://github.com/Bozentan/codex/blob/af3072ebbcde8d47bb8592a6a3226ef1b83b560a/codex-rs/core/src/agent/control/model_provider.rs)
rejects cross-provider history forks and reselects the persisted provider during resume.
Its [allowlist implementation](https://github.com/Bozentan/codex/blob/af3072ebbcde8d47bb8592a6a3226ef1b83b560a/codex-rs/core/src/config/subagent_model_provider.rs)
accepts grants from the user configuration layer. These are useful review requirements,
not a complete security audit. The [current-main adaptation PR](https://github.com/RobertKoval/codex/pull/1)
is still a draft staging PR, not proof the candidate works on Hera's pinned version.

### Endpoint and bridge precedents

- [HisenWeb/codex-opencode-adapter](https://github.com/HisenWeb/codex-opencode-adapter/tree/c78bfe9052d32b779b1b3065871a6b0984478ca1)
  translates Responses into Go Chat Completions. Its June 25 real-validation record
  reports streaming, tools and continuation against Go, but explicitly leaves broader
  real Codex subagent end-to-end testing outstanding. It predates the August role
  restriction. Project `.env` keys and global installation instructions are not suitable
  for Hera's credential/runtime policy. Hera already passed a direct Go Responses turn,
  so this translation layer does not address the observed blocker by itself.
- [duolahypercho/codex-router](https://github.com/duolahypercho/codex-router/tree/053f1b741dc89cc5b684b4df2e885cefcbdfabc7)
  routes model slugs behind an OpenAI base URL and merged catalog. Inspected
  [relay code](https://github.com/duolahypercho/codex-router/blob/053f1b741dc89cc5b684b4df2e885cefcbdfabc7/src/router.mjs#L1954)
  makes an additional native GPT request to reproduce an encrypted task as plaintext.
  This is model-assisted transport, not local decryption or transparent forwarding;
  exact reproduction and extra native usage need separate verification. Its inspected
  [DeepSeek proof](https://github.com/duolahypercho/codex-router/blob/053f1b741dc89cc5b684b4df2e885cefcbdfabc7/v2_agent/deepseek/deepseek-v4-flash/proof.md)
  and [Go/Qwen proof](https://github.com/duolahypercho/codex-router/blob/053f1b741dc89cc5b684b4df2e885cefcbdfabc7/v2_agent/opencode-go-messages/qwen3.8-max/proof.md)
  are drafts with pending relay, marker-return and follow-up checks. They do not prove
  Hera's Go/DeepSeek V4.1 Flash combination. The related sacoken fork was inspected
  at `09fabe3e69d1dbb74915325b8ead6465334946a1`, then checked against this upstream.
- [OpenCodex issue 3661](https://github.com/lidge-jun/opencodex/issues/3661) provides a
  field report using GPT-6 Astra and routed Go workers: many deliveries worked, but
  encrypted-task recovery intermittently failed. Its updated status says bounded error
  reporting landed while multipart recovery gaps remain. Issue closure is not evidence
  that every underlying compatibility problem was fixed. This is another user's
  macOS report, **not a macOS test performed for Hera**.
- Separate parent-level Codex worker scripts are reported in issue 40858, including
  the Go-specific comment above. This corroborates the independent-session workaround,
  but does not supply Hera's required cancellation, concurrency or resume guarantees.
  DeepSeek Harness's one-turn Codex adapter remains subject to the limitations above.

### Recommendation from the evidence

First evaluate a bounded native-runtime patch against the pinned 0.160.1 source, using
the Bozentan candidate as the most complete reference. That best preserves Hera's
native child tree and avoids adding a second orchestration system or GPT payload relay.
This is a recommendation for a compatibility experiment, not a runtime adoption.
The current specification excludes a harness fork; adopting a maintained patch requires
an explicit scope decision and reproducible Windows/macOS builds, new schemas and a
fresh capability fingerprint. No specification or runtime was silently changed.

Acceptance still requires real Astra/high -> Go deepseek-v4.1-flash task delivery and
same-child follow-up/resume; exact provider/auth separation; owned-tree cancellation;
worker limits; read-only denial; and main-only apply with spawning disabled. Offline
protocol tests must cover invalid grants, unavailable models, expired auth, 429 and
uncertain outcomes. A local Mac is not required; macOS CI results and unperformed
macOS live/manual checks must remain separate.

If maintaining a Rust patch is rejected, separate Go App Server sessions are the next
concrete option because their standalone tool path already passed locally. A generic
proxy or second harness is not justified just to solve a route already proven direct.

## Implementation choices after research

The user subsequently explicitly approved product adoption for mixed mode only:
"네, 혼합 모드에만 적용해서 진행해" (2026-10-07). The scope exception is now
recorded in specification section 1.2. GPT-only stays on official 0.160.1; mixed
mode requires an explicitly installed, integrity-checked private runtime and new
local acceptance evidence. Implementation and verification are in progress, not
an activation claim. No global installation or existing credential is replaced.

On 2026-10-07 the user accepted the GPT-main / read-only DeepSeek-worker division
and continued mixed-worker implementation. This authorizes the bounded project-local
native patch qualification recommended above. It does not establish compatibility or
activate a fork in the distributed product. Official 0.160.1 remains the default.

The reference patch does not apply cleanly to the pinned source (22 conflicted files).
An initial smaller port uses the already-present V1 plaintext collaboration backend
instead of introducing the reference patch's V2 external namespace. It retains native
child storage/control, isolates provider authentication and catalogs, restores the
persisted provider on resume, and rejects cross-provider history forks/V2 spawning.
Model metadata can select V2 even when the V2 feature flag is false; qualification
must observe the actual backend rather than infer V1 from the feature flag alone.
The port built on native Windows with Rust 1.95.0 (App Server, exit 0) and passed
101 model-provider tests, 27 focused role/grant tests and seven native mocked integration tests
(1,761 other integration tests filtered out). Fresh-home native initialization, strict profile loading,
disabled worker flags and invalid profile-path rejection also passed without inference.
The older reference CLI built and answered its version command only.
The port's first live parent failed HTTP 401 before creating any child. Official
Hera still reported ChatGPT ready. A read-only native storage diagnostic established
that the debug crypto build rejected the existing age-encrypted store's work factor.
Optimizing age/scrypt/salsa20 resolved the failure without changing credentials or the
decryption work limit. The rebuilt App Server reported the existing ChatGPT account ready.
On this runtime, actual Windows Astra/high -> Go DeepSeek V4.1 Flash read/follow-up,
cold same-child resume without rereading, read-only write denial, root worker limit
rejection and owned-tree cancellation passed (see status for thread IDs and scope).
A subsequent native main-only phase passed exact GPT application and a Node test,
with an actual spawn lookup failure and the Go child remaining unloaded. Mocked
HTTP 401/429/400/EOF each produced one failed child request without retry or GPT
fallback; an unsupported V2 route was rejected before contacting the child endpoint.
The macOS arm64 CI build/fresh-home native smoke passed at b01ee01; Windows CI is
still in progress. These checks do not establish macOS live/credential compatibility.
This proves a working local native path, not complete product integration or stability.
Remaining safety/failure tests and Windows/macOS distribution checks are outstanding.
Never run the older 0.154 reference binary against Hera's existing 0.160 history.

| Path | Concrete effect | Current disposition |
|---|---|---|
| Native provider-capable Codex child API | Keeps current native history, worker controls and permission architecture | Preferred within the current specification; unavailable in the tested pinned path |
| Reviewed project-local native runtime patch | Adds provider-safe native child routing and external task transport | Local Windows routing, follow-up, cold resume, write denial, root limit, cancellation and native main-only phase passed; macOS CI build/smoke passed; no product adoption |
| Separate Go App Server sessions behind an explicit delegation tool | Reuses proven Go native tools; Hera must own mapping, messaging, limits, cancellation and resume between independent roots | Architectural extension, not implemented or represented as native child cooperation |
| Direct Go completion/tool loop or Harness orchestration | Controls provider selection independently | Replaces/duplicates the required harness responsibilities; not silently substituted |

Changing only the endpoint cannot add a child-provider selector. A routing proxy would
also need credential separation and a proven opaque-state/tool contract; forwarding or
discarding unsupported model state is not an acceptable shortcut. Do not build a
speculative general Responses clone. The separate-session option is concrete because
standalone Go tools already passed, but its full cooperation/safety gates still need
implementation and real tests if that architectural extension is selected.

The main GPT selection stays unchanged. Missing credentials, quota, protocol or
tool support never trigger a switch to GPT, direct DeepSeek or another billing route.
Go account overflow/balance behavior is controlled by the user's provider console.
G11-G15 are not promoted by successful standalone calls. External mode stays blocked.
