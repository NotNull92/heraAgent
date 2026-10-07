# Public web research through native MCP

## Decision and alternatives (2026-10-07)

The user requires real web search for research before implementation and asked to
investigate useful search plugins before enabling built-in search. Use the official
Exa remote MCP through the existing pinned Codex MCP client. No npm dependency,
global plugin installation, separate agent loop, credential or Rust patch is added.
The connection is bundled; the remote search service is not embedded/offline.

| Official option | Verified documentation | Decision for this increment |
|---|---|---|
| [Exa MCP](https://exa.ai/docs/get-started/exa-mcp) | Keyless access with rate limits; URL tool selection, search and fetch | Selected: minimal two-tool connection, with actual native Windows probes below |
| [Tavily MCP/keyless](https://docs.tavily.com/documentation/keyless) | Keyless search/extract using `X-Tavily-Access-Mode: keyless`; full access also supports credentials | Viable alternative; not benchmarked or installed |
| [Brave official MCP](https://github.com/brave/brave-search-mcp-server) | Search API key; local STDIO/HTTP server and search filters | Extra key and server setup unnecessary for the first integration |
| [Firecrawl MCP](https://docs.firecrawl.dev/mcp-server) | Keyless Search/Scrape/Parse within daily limits; account/key paths for full tools | Viable alternative; broader crawl/browser surface unnecessary here |

This is an integration/operational choice, not evidence that Exa has universally
better search quality or lower model cost. Only Exa received hands-on calls; the
other candidates were compared from their primary documentation. Remote behavior,
free quotas and catalog versions can change independently of Hera's pinned runtime.

## Minimal profile and limits

`src/codex/web-research.ts` defines `hera_web` at
`https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa`. Native enabled-tools
selection also permits exactly those two names. No `agent_run`, arbitrary server,
editor tool, paid fallback, authentication header or local MCP process is enabled.
Effective configuration is checked before the thread starts; connection, origin,
catalog names and read-only/non-destructive annotations are checked after startup.
Unexpected MCP/dynamic-tool events invalidate the session. The main and native
workers inherit this analysis profile; a fresh main-only write runtime disables it.
Native built-in web search and shell network access remain disabled in both phases.

Native per-tool output budgets are 1,500 tokens for search and 2,000 for fetch,
before Codex's documented 20% serialization allowance. Guidance requests three
focused results, fetching only necessary sources (initially at most two URLs and
3,000 characters/page), citations and reuse of existing findings. Result counts,
URL counts and character requests are prompt guidance, not hard argument limits.
Output budgets can truncate useful excerpts; the model must not claim it read
unseen text. Smaller focused follow-ups may be needed. These limits do not cap
total calls, reasoning tokens or a whole research task's bill. No savings percentage
has been measured for this feature.

Remote MCP calls are outside the filesystem sandbox. They send queries/objectives
and selected URLs to Exa; do not include secrets, private code, local paths or private
identifiers. This is prompt guidance, not a DLP filter. Read-only annotations are
server assertions, not proof of server implementation or privacy. Retrieved content
is untrusted evidence, never permission to change task/policy. Service failure or
quota exhaustion must be reported; no silent provider or billing switch is allowed.
Required connection/catalog failure prevents opening a session, including local-only
tasks. A fresh session needs connectivity. No Exa login/key is configured by Hera.

The 3-5 complementary research tasks requested for DRD are a subsequent workflow
layer; this increment provides actual native search/fetch, not enforced DRD coverage,
a persistent cross-session research cache or an automatic quality verdict.

## Actual Windows evidence

Native PowerShell / Node 24, project-local official and mixed Codex 0.160.1:

- Direct public MCP initialize/tools/list returned HTTP 200, server
  `exa-search-server` 3.2.1 and exactly the selected tools. Three search calls with
  `numResults=3` returned official Node.js, Godot and Unity documentation links.
  Raw response lengths were 12,162 / 7,747 / 9,552 characters respectively: these
  are not token measurements and show why result count alone is insufficient.
- An isolated unauthenticated native thread connected with exactly two tools and
  `authStatus=notLoggedIn` (root `01a1156e-315f-7681-bdf8-92efaac79286`). No model
  inference was used for that connection check.
- Actual product Controller search checks: GPT Luna/max worker root
  `01a11573-54ba-74a0-afa3-47ea711a712a`, child
  `01a11573-c3cb-7081-a3cb-3d5abecce287`; Go DeepSeek V4.1 Flash/low worker root
  `01a11572-50a2-7a81-8a4a-4031d0ce7833`, child
  `01a11572-ce43-7af0-9cd2-2715872d9feb`. Both workers completed native Exa search
  with three results; their Astra/high parents completed native page fetch with
  3,000 characters requested and an official nodejs.org URL.
- Both initial live scripts exited 1 after successful research: config/read omits
  the default `required=false` field in the disabled profile. The strict verifier
  now accepts this exact native default omission; widened profiles still fail.
  A no-inference follow-up audited both saved native histories, resumed both roots
  into write mode, observed a disabled server/empty tool catalog, and received
  actual `RPC_-32603: unknown MCP server 'hera_web'` for a search request. Exit 0;
  the original script failures are not relabeled as full-script passes.
- Existing mixed-mode product regression passed, exit 0, root
  `01a11574-f559-7203-ab42-923226202b7a`: read/follow-up, cold same-child resume,
  validated worker contracts, exact reviewed main-only write and Node test exit 0.
  The first GPT regression failed with `APPLY_MISMATCH`, root
  `01a11575-1864-7d02-b0e6-44c84f5434c4`: the model's PowerShell byte-array edit
  incorrectly replaced the disposable source with `+`. Hera detected the mismatch
  and did not run tests; the failed workspace/history were preserved without a
  repair/replay. This is an observed model edit failure, not a passing apply check.
- A fresh GPT regression passed without product code changes, exit 0, root
  `01a11579-1118-75d3-9056-81018cd96109`, covering worker follow-up, cold resume,
  contracts, exact main-only application and actual test exit 0. This new fixture
  does not erase the earlier model failure or guarantee future model edits.

Mode-specific Windows acceptance was maintainer-attested outside Git after reviewing
these checks and the historical native permission/concurrency/cancellation/provider
failure evidence documented in status.md. The underlying worker/sandbox/provider
implementation and native binaries were unchanged; historical negatives were not
rerun or relabeled as fresh. Prior acceptance files were backed up. Public
`Controller.open` then connected successfully for both modes with normal gates,
without inference. No installer or mocked test promoted acceptance.

Reproduction: build, then `node scripts/live-web-research.mjs --live` or add
`--external`. Each is opt-in, one main turn / one worker / 180 seconds, uses public
queries in a disposable workspace and checks actual native search/fetch plus the
write-phase denial. Tests do not automatically create a worker acceptance record.
Offline checks cover configuration widening, unknown tools and phase restrictions.
CI remains Windows/macOS and offline; macOS live/manual search is NOT_RUN.

Local verification: Windows 10.0.26200 x64, Intel i7-12700, PowerShell 7.6.6,
Node v24.12.0. Typecheck, build, 67/67 offline tests, native initialization, current
archive inspection and current archive install/reinstall/credential-persistence/
launcher checks passed (exit 0). The first archive smoke targeted the previous
artifact and does not qualify this change. After preparing the new archive, its
separate smoke passed for SHA-256
`baec612b334cd91b23d77c6b37e399ae15ebbcba410c906cfd03c2994feeb963`.
No release/npm publication or global Codex change was performed.
Source/history pattern scanning and an exact-value Go credential scan of the staged
diff, full Git patch history and decompressed current archive found no credential
matches; the secret was used only in memory and not printed or placed in arguments.
