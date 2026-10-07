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

## Implementation choices

| Path | Concrete effect | Current disposition |
|---|---|---|
| Native provider-capable Codex child API | Keeps current native history, worker controls and permission architecture | Preferred within the current specification; unavailable in the tested pinned path |
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
