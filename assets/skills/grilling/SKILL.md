---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

<!--
Adapted from mattpocock/skills (https://github.com/mattpocock/skills)
Copyright (c) 2026 Matt Pocock — MIT License
Original: skills/productivity/grilling. Adapted to numbered rounds of up to five questions; detailed process and Hera integration added.
-->

## Core rules (adapted)

Interview me relentlessly about every aspect of this until we reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask up to five questions per round, numbered 1-5, each with a short recommended answer. Wait for the user's answers before the next round. Ask fewer when later questions depend on an unanswered decision; never assume the user's answer to fill a round.

If a *fact* can be found by exploring the environment (filesystem, tools, etc.), look it up rather than asking me. The *decisions*, though, are mine — put each one to me and wait for my answer.

Do not act on it until I confirm we have reached a shared understanding.

## Detailed process

1. **Map the decision tree first.** Before asking anything, silently enumerate the decisions the plan implies: goals, scope boundaries, constraints, trade-offs, failure modes, dependencies between decisions. Order them so that upstream decisions (which change the meaning of downstream ones) come first.
2. **Research before asking.** For every candidate question, check whether it is a *fact* (answerable from the codebase, docs, git history, tools, or the web) or a *decision* (a value judgment, priority call, or preference). Facts: look them up yourself and fold what you learned into the next question. Decisions: ask the user.
3. **Up to five questions per round.** Number the questions and wait for the user's answers before the next round. Each question must:
   - State the decision being resolved and why it matters now (one or two sentences of context, citing anything you researched).
   - Offer your **recommended answer first**, with a one-line rationale.
   - Offer the main alternatives only when they genuinely differ in consequence.
4. **Follow the branch.** The user's answers may open new sub-decisions or invalidate assumptions behind questions you had queued. Re-plan the remaining tree after every round instead of marching through a fixed list.
5. **Track state out loud when useful.** On long grillings, periodically summarize: decisions resolved (with the chosen answer), decisions still open. This keeps the shared model honest and lets the user correct drift early.
6. **Challenge, don't just collect.** If an answer contradicts an earlier answer, a known fact, or a stated goal, say so immediately and ask which one wins. Surfacing tension is the point of the exercise — do not smooth it over.
7. **Close explicitly.** When no open decisions remain, present a compact summary of the shared understanding (goal, chosen approach, key decisions with rationale, known risks). Ask the user to confirm it. **Only after confirmation** may any action be taken — and only if the user asks for it; grilling itself never implies execution.

## Anti-patterns

- Asking more than five questions in a round, omitting recommendations, or starting the next round before the user's answers.
- Asking the user for anything discoverable in the environment.
- Recommending nothing ("what do you think?") — always take a position.
- Quietly resolving a decision yourself because the answer "seems obvious".
- Ending the session without the explicit shared-understanding summary and confirmation.

## Hera integration

Use the user's language for conversation. Follow project language conventions for saved documents. Respect the current native permissions; a skill does not grant extra access or authorize commits, pushes, or publication.
