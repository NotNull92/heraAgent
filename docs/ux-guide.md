# Hera TUI UX guide

Decisions the owner has made about how the Hera TUI looks and behaves. Read this before
changing anything under `src/tui/` or the text a session prints. A change that contradicts
an entry here needs the owner's approval first; do not "fix" an intended behavior.

Product text is Korean by default with an English variant; this document is English like
the rest of the engineering documentation.

## New build notice

Before accepting an input, the session checks the installed `dist/cli.js` modification
time. Each detected change prints one localized restart notice in the transcript,
then input continues normally. Missing or unreadable files are ignored. There is no
watcher or automatic restart; code updates require quitting and starting Hera again.
Saved settings still apply without restarting Hera.

## Other workspace sessions notice

Several Hera windows may use the same folder. When startup finds other live
session PIDs, print one transcript line before Ready: "이 폴더에서 다른 Hera 세션이
실행 중입니다. 같은 파일을 동시에 고치지 않도록 주의하세요." / "Another Hera session
is running in this folder. Avoid editing the same files at once."
Print nothing when no other session is present, or in headless runs. This notice
does not serialize file edits. Windows keep their own in-memory mode/settings;
saved settings are last-writer-wins. Resuming the same saved session while another
process has it open is refused with `SESSION_IN_USE` (exit 6).

## Commands

- A command starts with `/` on every platform. A leading backslash is ordinary text.
- Pasted text never runs a command: a pasted leading `/` is sent with a leading space.
- Typed commands are echoed into the conversation as `You: /command`. `/providers`
  arguments are never echoed.

## Command list

Typing `/` at the start of an empty input opens the command list directly below the
input panel. Typing filters it by prefix; Up/Down move, Tab completes the name and adds
a space for arguments, Enter runs the selected command except for `/plan` and the
three bundled skills, and Escape closes the list and keeps the input. For `/plan`,
`/grilling`, `/grill-me` and `/handoff`, Enter only completes the name and trailing
space, leaving the cursor at the end for request text.

Intended behavior, not defects:

- **No "no match" row.** When nothing matches (for example `/zz`), the list closes
  without a message.
- **The hint row stays.** The last row shows the position and keys
  (`1/12 · ↑↓ 이동 · Tab 완성 · Enter 선택 · Esc 닫기`). Within the command list,
  this hint row is the only key guide and appears only while the list is open.
- **At most six commands are visible.** The list scrolls inside those rows even when the
  terminal is tall enough to show every command.
- **Latin letters and hyphens only.** Hyphens support `/grill-me`. Hangul typed after `/` (the IME left in Korean mode) matches
  nothing and closes the list. There is no layout conversion.

Appearance: the selected row is bold gold with a `› ` marker; on other rows the command
name uses the default text color and its description is iron (dimmed), so names read first.

The list does not open while a turn is running or for pasted text.

## Bundled skills

`/grilling [topic]` and `/grill-me [topic]` start the same interview in rounds of
up to five numbered questions, each with a short recommendation, followed by a
wait for the user's answers. They use the
current conversation when no topic is given. `/handoff [next-session focus]`
writes a handoff using the current history and the project's save convention
(otherwise the OS temporary directory). Native write permissions still apply.
For these three commands, Enter on a list entry completes `/<name> ` without
sending. Type the content and press Enter again to send; a second Enter without
content deliberately runs the skill on the current conversation. Tab still
completes the command with a trailing space without sending.
`$grilling`, `$grill-me` and `$handoff` at the start of an ordinary message also
select the bundled skills. The conversation and follow-up remain in one native
thread; an interview does not authorize implementation. Handoff and grill-me
require an explicit invocation, while grilling permits native implicit selection.

In Design, explicit bundled-skill input goes to Astra after a short announcement.
Interview answers go back to that same Astra child, and Hera relays its output
verbatim. For handoff, Astra composes the document and Hera saves it under normal
native write permissions. Development's GPT root performs the same skill workflow
directly. Design requires workers to be enabled for these Astra assignments.

## Questions from the model

Development asks through native question choices when different interpretations
would materially change the work. Up/Down selects an option; Enter confirms it.
Request parameters are not printed; the picker title shows the question, while approvals still print the action details above the approval picker.
Choose `직접 입력` / `Type an answer` for a different answer, then type and press
Enter. Slash-prefixed answers are literal text, not commands. Up to three
questions appear one at a time; answers are sent together after the last one.
Escape or `취소` / `Cancel` cancels the whole request and sends empty answers,
including from the free-text input. The option list shows the same hint row as
other pickers (`n/m · ↑↓ 이동 · Enter 선택 · Esc 취소` / `n/m · ↑↓ move · Enter select · Esc cancel`), while the free-text input shows none.
Headless run/resume sends empty answers so the model can state an assumption and proceed.
Workers report ambiguity to Hera instead of questioning the user. Bundled
grilling/grill-me interviews keep their numbered text rounds.

## Voices (`/style`)

`/style` picks the voice Hera answers in. A voice only changes how answers are worded
and laid out, never how the work is done. The product word is 화법 (voice); "style" is
only the command name.

- Voice files are the user's own Markdown files in `<Hera home>/output-styles/`. Hera
  ships none: the three published voices come from a third-party AGPL-3.0 project and
  must not be copied into this repository.
- The chosen voice is written into the isolated runtime's `AGENTS.md` between
  `hera-style` markers; other text in that file is preserved. It applies from the next
  session.
- Hera wraps every applied voice with its own two lines (`SCOPE` before, `LABELS` after
  in `src/session/styles.ts`): replies stay entirely in the user's language, including
  the labels a voice spells in English (TL;DR becomes 요약, "Your move" becomes 다음 행동),
  and a worker reporting to another agent ignores the voice and writes plain text without
  arrows, bold or emoji.
- Picker entries use Hera names: `[현자]` (attention-kind: answer first, short and kind),
  `[전사]` (spartan: blunt, signal only), `[전령]` (rundown: summary, checklist, numbered
  choices) and `[본래 목소리]` (no voice). A user's own file shows its file name.
- The own-voice option remains available when no voice files are installed, including
  when the active voice's source file was deleted. Saving a voice uses a temporary
  file and atomic replacement so a failed write leaves existing instructions intact.

## Input panel

- Gold rules above and below, no side borders, a bold gold `> ` prompt.
- Placeholder `I can do anything with you.` in iron.
- No key guide under the input. Key bindings are documented in `/help` and the README.
- The transcript's scroll indicator is a state line inside the viewport, not an
  input key guide. A tall composer keeps its caret row visible within the available space.
- The real terminal cursor sits at the caret so a Korean IME shows the syllable being
  composed.

## Keys

Bindings follow Claude Code.

- Enter sends. Backslash+Enter, Shift/Alt+Enter and Ctrl+J insert a newline.
- When the last characters and Enter arrive from the terminal as one chunk (fast typing,
  an IME commit), a short run of at most 16 characters is text plus Enter. A longer or
  multi-line chunk, or one that alone forms a `/command`, is treated as an unbracketed
  paste and stays text.
- Escape interrupts a running turn; pressed twice within a second it clears the input.
- Ctrl+C interrupts a running turn. When idle, the first press clears the input and
  turns the placeholder into `See you later codingborn.` in blood red; a second press
  quits. Any other input disarms it. Ctrl+Q quits after cleanup.
- After cleanup, quitting closes Hera's alternate screen and restores the terminal
  screen from before Hera started; the Hera UI and conversation disappear from view.
- Up/Down recall sent input. Ctrl+A/E/U/K/W edit the line.
- PageUp/PageDown scroll the transcript by one viewport minus two rows, including
  during a turn or with a picker/command list open. Up/Down retain their input/menu roles.

## Conversation

- Hera uses the terminal's alternate screen with an internal transcript viewport:
  the banner, finished lines and unfinished tail occupy the space above the pinned
  input/picker and footer. Its height follows the actual layout, including multiline
  input, command lists and provider screens. Saved native history survives exit.
- By default the viewport follows the newest output. Wheel up/down scroll three
  display rows; PageUp/PageDown are the keyboard fallback. Clicks and other mouse
  reports are ignored and never become input text or selection actions.
- Scrolling up anchors the view; new output does not move it. The last viewport row
  shows `↑ 이전 대화 보는 중 · 새 출력 N줄 · 휠 아래로 또는 PgDn` /
  `↑ Viewing earlier output · N new lines · wheel down or PgDn`, omitting the new-line
  count when zero. Reaching the bottom resumes following and removes the indicator;
  submitting a new prompt also resumes following.
- Keep the latest 2,000 finished logical lines plus the unfinished tail, trimming
  older lines rather than leaving blank slots. The banner remains reachable at the
  top. A large batch keeps its newest lines; fence/user formatting state survives
  trimming. Rows are pre-wrapped at the current terminal width and cached per line.
- Mouse reporting is active only inside Hera. Terminal text selection therefore
  uses Shift+drag in Windows Terminal (and most Linux terminals), or Option+drag /
  Fn+drag in macOS terminals, depending on the terminal. No in-app selection or copy.
- Speaker labels: `You: ` in frost, `Hera: ` in gold; `Tool exit: ` lines in iron.
  Successful command exits (code 0) are silent; nonzero or unknown exits remain visible.
- Submitted input is echoed before runtime connection/authentication begins, and
  remains visible if setup fails. The Hera reply label appears after connection.
- Once provider setup is complete at startup, prepare the native session before
  showing Ready. Preparation performs no model turn; the first prompt reuses that
  session. Show runtime preparation explicitly rather than deferring it to a greeting.
- Within one startup attempt, reuse account/model discovery, OS credential reads,
  protocol verification and runtime integrity results. Independent readiness checks
  may run concurrently. Discard these results when startup succeeds or fails;
  another attempt must check again. Preserve authentication and native worker gates.
- Markdown bold in model output is drawn bold: a closed `**pair**` on one line loses its
  asterisks. Inline code, fenced/indented code blocks and user text (including
  continuation lines) stay literal. Fence state survives streaming and resize.
  No other Markdown is interpreted.
- Resize re-wraps the retained conversation. Following stays at the bottom;
  scrolling keeps the top visible logical line anchored. Ink repaints the full-height
  viewport without Hera explicitly clearing the screen or shell scrollback.

## Banner

Printed once at the start: the `H E R A` title plate, the diamond-cross emblem (kept as
is by decision), one greeting, then the workspace and runtime version. The greeting is
one random Skyrim line per start, at most 51 characters. There is no setup hint text.

## Footer

Below the input, in this order:

1. Status line: activity glint, status, what the root thread is doing with its
   elapsed time while nothing is printed, mode, and live worker pips when
   collaboration is enabled.
2. Main role line, then worker role line: model, effort, then limit windows.

Rules:

- The mode reads main model first, then worker model, in the same order as the two role
  lines (`GPT + DeepSeek`, `Astra + DeepSeek`).
- Show only figures the runtime actually returned. When there is none, say so
  (`확인 전`, `한도 정보 없음`, `한도: OpenCode 콘솔`, `메인과 한도 공유`); never show a
  made-up number.
- Not shown: cumulative token counts, the worker's provider name, the phase name or a
  phase track.
- The pause label (`응답 기다리는 중`, `생각 중`, `핸드북 읽는 중`, `명령 실행 중`,
  `Astra에게 맡기는 중`, `워커 답 기다리는 중` …) comes only from native events of the
  root thread and shows a `m:ss` counter since the pause began. It disappears as soon
  as reply text streams and at the end of the turn. Worker threads never drive it.
  It exists because a Design question can spend minutes in hidden reasoning, a handbook
  load and an Astra hand-off before the first visible character.

## Theme

Medieval fantasy, modeled on Skyrim. Hues come from `palette()` in `src/tui/theme.tsx`:
gold (accent, selection), iron (secondary text, ornaments), frost (the user), blood
(errors, exit warning), moss (healthy state). In the footer role lines the model name is
frost and the effort word climbs with the setting: iron for `none`/`minimal`, moss for
`low`, gold for `medium`/`default`, blood for `high`/`xhigh`/`max` (hot, not an error).
Every hue is dropped when `NO_COLOR` is
set or `ui.color` is `never`, so nothing may rely on color alone. Animation stops when
`ui.reducedMotion` is set.
