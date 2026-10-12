---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
---

<!--
Adapted from mattpocock/skills (https://github.com/mattpocock/skills)
Copyright (c) 2026 Matt Pocock — MIT License
Original: skills/productivity/handoff. Core rules preserved; save-location made
project-convention-aware and a detailed document structure added.
-->

Write a handoff document summarising the current conversation so a fresh agent can continue the work.

## Where to save

1. **Project convention first.** If the project defines a handoff/handover convention — a location, naming pattern, or process in its `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, or an existing `handoff_*`/`HANDOFF*` document directory — follow that convention exactly (location, file-name pattern, language, any commit/push rules attached to it).
2. **Otherwise**: save to the temporary directory of the user's OS — not the current workspace — and tell the user the full path.

## Core rules (original)

- Include a **"suggested skills"** section in the document, which suggests skills that the next agent should invoke (only skills that plausibly exist in the next session's environment; name them and say when to invoke each).
- **Do not duplicate content already captured in other artifacts** (specs, plans, ADRs, issues, commits, diffs). Reference them by path, commit hash, or URL instead.
- **Redact any sensitive information**, such as API keys, passwords, tokens, or personally identifiable information.
- If the user passed arguments, treat them as a description of **what the next session will focus on** and tailor the doc accordingly — lead with what that session needs, trim what it doesn't.

## Document structure

Use these sections (omit any that would be empty; keep the whole document skimmable):

1. **Goal** — what the overall effort is trying to achieve, in one or two sentences.
2. **Current state** — what has been done and verified so far. Distinguish *done and verified* / *done but unverified* / *in progress*. Reference commits and files rather than restating their contents.
3. **Decisions made** — each decision with its one-line rationale, so the next agent doesn't relitigate or silently reverse them.
4. **Open questions / pending decisions** — what is unresolved, and who resolves it (user vs. agent).
5. **Next steps** — the concrete, ordered actions the next session should take. If the user passed arguments, this section serves that focus.
6. **References** — artifacts by path/hash/URL: specs, plans, ADRs, issues, key source files (with line numbers where it helps).
7. **Environment notes / gotchas** — non-obvious traps discovered this session: tool quirks, ordering constraints, things that look done but aren't, state that must be cleaned up.
8. **Suggested skills** — per the core rule above.

## Quality bar

- The test of a good handoff: a fresh agent with **no access to this conversation** can continue without re-asking the user anything already answered here.
- Prefer pointers over prose — every fact that lives in a commit, doc, or file should be cited, not copied.
- State facts as of now; convert relative times ("yesterday", "next week") to absolute dates.
- End by telling the user where the document was saved.

## Hera integration

Use the user's language for conversation. Follow project language conventions for saved documents. Respect the current native permissions; a skill does not grant extra access or authorize commits, pushes, or publication.
