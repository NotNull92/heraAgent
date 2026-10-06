# ADR-002: Keep external workers unavailable pending native compatibility

Status: blocked integration; no architectural substitution approved.

Codex 0.160.1 config.schema.json WireApi contains only `responses`. OpenCode Go's
current documentation lists DeepSeek V4.1 Flash on `/chat/completions`. That mismatch
is documented evidence, not a live proof that another Go route cannot work.

The product can perform one explicit, bounded direct Go text probe. That result
does not enable native workers. G11-G15 still require tools, native parent/child
assignment/messages, concurrency, cancellation, stable resume and route evidence.
No credential was supplied during initial development. No live Go request is claimed.

A bridge has not been built: native request/opaque item translation feasibility
has not been established, so implementing a speculative Responses clone would violate
the scope. Independent Codex/OpenCode worker pools are not substituted. A follow-up
ADR and verified translator contract are required if the native path cannot work.

The main GPT selection stays unchanged. Missing credentials, quota, protocol or
tool support never trigger a switch to GPT, direct DeepSeek or another billing route.
Go account overflow/balance behavior must be checked in the user's provider console.
