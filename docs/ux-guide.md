# Hera TUI UX guide

Decisions the owner has made about how the Hera TUI looks and behaves. Read this before
changing anything under `src/tui/` or the text a session prints. A change that contradicts
an entry here needs the owner's approval first; do not "fix" an intended behavior.

Product text is Korean by default with an English variant; this document is English like
the rest of the engineering documentation.

## Commands

- A command starts with `/` on every platform. A leading backslash is ordinary text.
- Pasted text never runs a command: a pasted leading `/` is sent with a leading space.
- Typed commands are echoed into the conversation as `You: /command`. `/providers`
  arguments are never echoed.

## Command list

Typing `/` at the start of an empty input opens the command list directly below the
input panel. Typing filters it by prefix; Up/Down move, Tab completes the name and adds
a space for arguments, Enter runs the selected command, Escape closes the list and keeps
the input. `/plan` needs request text, so Enter only completes it.

Intended behavior, not defects:

- **No "no match" row.** When nothing matches (for example `/zz`), the list closes
  without a message.
- **The hint row stays.** The last row shows the position and keys
  (`1/12 · ↑↓ 이동 · Tab 완성 · Enter 선택 · Esc 닫기`). It is the one place a key guide
  is shown, and only while the list is open.
- **At most six commands are visible.** The list scrolls inside those rows even when the
  terminal is tall enough to show every command.
- **Latin letters only.** Hangul typed after `/` (the IME left in Korean mode) matches
  nothing and closes the list. There is no layout conversion.

Appearance: the selected row is bold gold with a `› ` marker; on other rows the command
name uses the default text color and its description is iron (dimmed), so names read first.

The list does not open while a turn is running or for pasted text.

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

## Input panel

- Gold rules above and below, no side borders, a bold gold `> ` prompt.
- Placeholder `I can do anything with you.` in iron.
- No key guide under the input. Key bindings are documented in `/help` and the README.
- The real terminal cursor sits at the caret so a Korean IME shows the syllable being
  composed.

## Keys

Bindings follow Claude Code.

- Enter sends. Backslash+Enter, Shift/Alt+Enter and Ctrl+J insert a newline.
- Escape interrupts a running turn; pressed twice within a second it clears the input.
- Ctrl+C interrupts a running turn. When idle, the first press clears the input and
  turns the placeholder into `See you later codingborn.` in blood red; a second press
  quits. Any other input disarms it. Ctrl+Q quits after cleanup.
- Up/Down recall sent input. Ctrl+A/E/U/K/W edit the line.

## Conversation

- The conversation flows into the terminal's own scrollback like Codex or Claude Code:
  a finished line is written once and never repainted; only the unfinished line is live.
- Speaker labels: `You: ` in frost, `Hera: ` in gold; `Tool exit: ` lines in iron.
- Markdown bold in model output is drawn bold: a closed `**pair**` on one line loses its
  asterisks. Text the user typed (`You: ` lines) stays literal. No other Markdown is
  interpreted.
- On a terminal resize the screen and scrollback are cleared and the conversation is
  printed again at the new width.

## Banner

Printed once at the start: the `H E R A` title plate, the diamond-cross emblem (kept as
is by decision), one greeting, then the workspace and runtime version. The greeting is
one random Skyrim line per start, at most 51 characters. There is no setup hint text.

## Footer

Below the input, in this order:

1. Status line: activity glint, status, mode, and live worker pips when collaboration
   is enabled.
2. Main role line, then worker role line: model, effort, then limit windows.

Rules:

- The mode reads main model first, then worker model, in the same order as the two role
  lines (`GPT + DeepSeek`, `Astra + DeepSeek`).
- Show only figures the runtime actually returned. When there is none, say so
  (`확인 전`, `한도 정보 없음`, `한도: OpenCode 콘솔`, `메인과 한도 공유`); never show a
  made-up number.
- Not shown: cumulative token counts, the worker's provider name, the phase name or a
  phase track.

## Theme

Medieval fantasy, modeled on Skyrim. Hues come from `palette()` in `src/tui/theme.tsx`:
gold (accent, selection), iron (secondary text, ornaments), frost (the user), blood
(errors, exit warning), moss (healthy state). Every hue is dropped when `NO_COLOR` is
set or `ui.color` is `never`, so nothing may rely on color alone. Animation stops when
`ui.reducedMotion` is set.
