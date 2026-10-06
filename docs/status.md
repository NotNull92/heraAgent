# Implementation status

## Bootstrap

- B0: native Windows root verified, no enclosing Git repository (git exit 128 expected).
- B1: initialized main, preserved three supplied handoff files; existing Git identity used.
- B2: authenticated GitHub personal account verified as NotNull92 using gh api user.
- B3: no local remotes; authenticated exact target lookup returned GraphQL not-found and REST 404.
- B4/B5: pending reviewed initial commit and private creation/upload verification.
- B6: subsequent milestones must review, test, scan and verify each push.
- No applicable ancestor or existing descendant AGENTS.md files were found before creating root instructions.
- Existing global hera command collision detected; leave it intact.

## Evidence categories

- windows_local: PowerShell 7.6.6; Windows 11 Pro 10.0.26200 x64; Intel i7-12700;
  Node 24.12.0; npm 11.14.1; Git 2.52.0.windows.1; global Codex 0.160.1.
- Terminal/herdr version: unavailable in automation environment; manual checks not run.
- windows_ci: not created yet.
- macos_ci: not created yet.
- macos_manual_or_live: MANUAL_NOT_RUN / LIVE_NOT_RUN.
- Live GPT and external model checks: not run; credentials in Hera's isolated home not yet assessed.

The attempted codex.cmd version command failed because only codex.exe exists;
the verified native executable returned codex-cli 0.160.1 (exit 0). No global update.
