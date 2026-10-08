# Conversation context and effort settings — 2026-10-08

The reported high-to-low error occurred after saving the setting: the next
connection rejected the changed qualification fingerprint. It was not a rejected
DeepSeek effort value. Native v2 qualification excludes validated reasoning effort
while retaining code/runtime/platform/model/provider/permission/concurrency checks.
Old records are not migrated. Legacy phased qualification remains unchanged.

Go effort commands no longer start an unrelated OpenAI model-catalog connection.
Menus and commands still validate Go low/high/max; GPT efforts still require the
selected model's catalog. An idle session closes when settings change; the next
input starts a new native session with the saved settings, without restarting Hera.
Existing native histories remain stored with their original settings.

Native thread start/resume now supplies an 868-character Hera base instruction
instead of the observed 20,751-character generic CLI handbook. Native project
instructions, skills, tools, sandbox controls and research/routing guidance remain.
There is no classifier call, extra model loop, canned greeting or provider fallback.
Tool schemas are still included: this is a fixed-context reduction, not full lazy
tool loading or a guarantee of a particular response time.

## Observed Windows checks

Node v24.12.0, Windows x64; all commands exited 0:

- Typecheck and build.
- Offline tests: 87 tests in 18 files. The updated native test was rerun after its
  cleanup adjustment: 3 passed.
- Source/history pattern scan, package content check, clean-prefix installation,
  native initialization, credential persistence and reinstall preservation.
- `node scripts/live-native-workflow.mjs --live --mode=MODE --go-effort=low --record`
  for adaptive, gpt_only and external_workers: conversation, edit/test, resume,
  routing, approval denial/allow-once, cancellation and concurrency all passed.
  Each stage had a 180-second deadline and used disposable workspaces.
- `node scripts/live-effort-switch.mjs --live`: adaptive high then low, each with
  one native Go worker. Public `Controller.open` accepted the same qualification;
  native snapshots verified the selected effort on both root and child. User
  configuration bytes were unchanged. This does not claim a live max-effort test.

Greeting prompt was `안녕`; no tools or workers were used in these turns.

| Observation | Main effort | Input tokens | Cached input | Turn time |
| --- | --- | ---: | ---: | ---: |
| Original reported workspace session | high | 12,743 | 12,032 | 22.246 s |
| Updated adaptive disposable workspace | low | 8,233 | 0 | 3.490 s |
| Updated GPT-only disposable workspace | high | 8,811 | 0 | 3.350 s |
| Updated GPT/Go disposable workspace | high | 7,226 | 0 | 5.253 s |

These are single observations, not a controlled speed benchmark: workspace
instructions, effort, provider and cache conditions differ. They demonstrate
smaller observed inputs and successful greetings; they do not isolate which
change caused the timing difference. macOS live/manual checks remain NOT_RUN.
Windows/macOS CI results are available on the change's GitHub Actions run and
must not be inferred from these local results.
