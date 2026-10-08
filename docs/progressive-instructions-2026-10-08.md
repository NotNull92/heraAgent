# On-demand coding and research instructions

This supersedes the global base-prompt replacement described in
[the earlier latency correction](latency-settings-2026-10-08.md).

Fresh conversations receive a compact base instruction and current routing rules.
The model answers greetings directly. Coding/workspace requests load the original
20,751-character Codex coding handbook through the local native MCP tool
`hera_web.load_instructions({topic:"coding"})`. Design/research requests load the
separate `research` guide. The pinned upstream handbook is unchanged; Hera's
session instructions override its generic CLI defaults, including immediate
authorized edits and tests without a separate confirmation or apply phase.

The existing local MCP server reads only these two packaged UTF-8 files. The enum
accepts no user-supplied path or URL, and loading a guide starts neither Chromium
nor a web request. Only this tool receives an 8,000-token output budget. Native
shell limits and the existing web search/fetch budgets remain unchanged. Guide
content participates in qualification fingerprints and package inspection.

The same native thread, history, tools, workers and permissions are used throughout.
There is no classifier inference, keyword router, separate conversation engine,
provider fallback, temporary prompt file or canned reply. Guide loading is model
guidance, not an OS security boundary. Native permissions remain enforced.

Loaded guides remain in native history, so follow-up work reuses them. They can
be reloaded if absent after native compaction. Returning to casual chat does not
delete previous coding history. Tool schemas, skills, project instructions and
existing conversation still count toward context: this is progressive instruction
loading, not a tool-free chat profile or a guarantee of tiny total inputs.

## Observed Windows verification

- Typecheck/build passed; 88 offline tests in 18 files passed.
- Real local MCP tests returned both guides exactly, rejected an arbitrary-path
  topic, and observed no browser search/fetch call.
- Real Chromium/MCP fixture checks passed: cache, rate limits, CAPTCHA stop,
  private-address denial, interruption and cleanup.
- All three native mode suites passed, with 180 seconds per stage: no tools or
  guide loads for `안녕`; complete handbook before editing/testing; successful edit
  and test; same native thread after resume; no duplicate coding-guide load on a
  follow-up test; provider routing; denial/allow-once; cancellation; concurrency.
  Adaptive planning also loaded the research guide and used the Astra role.
- Read-only inspection of the three fixture traces found the entire coding
  handbook in model-facing tool output, including both direct MCP and code-mode
  text/JSON representations. The live runner now checks this, because app-server
  events alone can contain a full raw result even when model output is truncated.
- The same qualified adaptive profile passed actual high-to-low switching on
  both the root and its native Go worker, preserving user configuration bytes.
- A fresh package was prepared and inspected, including both handbooks. Its
  Windows clean-prefix install, native initialization, reinstall, credential
  persistence and launcher checks passed. Package SHA-256:
  `b33eda2bf6c5a6378dc7d886b3de808d9cdb047b68aaf84a6c39ff457d532648`.

Initial shell-based trials failed full-text verification: the native output budget
truncated the guide, and Windows sandbox shell output corrupted punctuation even
with UTF-8 file reads. Those trials did not produce passing qualification records.
The final MCP implementation delivered the unchanged UTF-8 content in all modes.

| Fresh greeting | Input tokens | Turn time | Guide loads |
| --- | ---: | ---: | ---: |
| adaptive / low | 7,828 | 2.967 s | 0 |
| gpt_only / high | 8,319 | 4.863 s | 0 |
| external_workers / high | 6,726 | 4.097 s | 0 |

These are individual observations in disposable workspaces, not controlled
performance benchmarks. macOS live/manual verification remains NOT_RUN. CI for
this change is reported separately; the prior commit's green CI does not qualify
this change or prove macOS live-model behavior. No release or npm publication.
