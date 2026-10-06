# heraAgent: English Codex implementation handoff

Document revision: **1.2.0, Windows development and local testing**.

This archive contains repository-root files directly. There is no additional
`heraAgent/` directory inside the archive and no enclosing handoff-bundle folder.
Extract once into a project directory named exactly `heraAgent`. Do not create
`heraAgent/heraAgent/`.

## Development host versus supported product targets

| Item | Requirement |
|---|---|
| Development host | Native Windows PC running Codex |
| Hands-on/local tests | Windows |
| Bootstrap shell | The installed Windows PowerShell or PowerShell 7 environment |
| Product targets | Windows and macOS, unchanged |
| Automated compatibility checks | Keep both Windows and macOS CI |
| macOS manual/live checks | Explicitly not run until actually performed |
| Repository/local root | `heraAgent`, exact casing |
| Product command | `hera` |

A local Mac, WSL, Git Bash, Linux server or separate Hera API server is not a
prerequisite. Do not remove macOS support because implementation happens on
Windows. Do not describe Windows results as macOS validation.

## Repository-root layout

```text
.
├── CODEX_START_PROMPT.txt
├── READ_ME_FIRST.md
└── docs/
    └── implementation-spec.md
```

## Start implementation on Windows

1. Extract the archive into `heraAgent`, outside any unrelated Git repository.
   Preserve existing files and Git metadata. Do not overwrite an existing project
   without inspecting it first.
2. Open Windows Terminal/PowerShell in that directory. The current directory must
   directly contain `CODEX_START_PROMPT.txt` and `docs/implementation-spec.md`.
3. Start the existing installed Codex session. If a `.ps1` shim is blocked, inspect
   and use its actual `.cmd` or native launcher; do not relax execution policy or
   replace the global Codex installation.
4. Paste this instruction into Codex:

```text
Read all applicable AGENTS.md files, CODEX_START_PROMPT.txt, and
  docs/implementation-spec.md in full, then follow the start prompt.

Develop and run hands-on/local tests on native Windows using PowerShell.
Retain Windows AND macOS product support and CI; do not require a local Mac.
Record unperformed macOS manual/live tests explicitly rather than claiming success.

Begin with Windows repository bootstrap B0-B6 in Section 20, then implement M0-M7.
Execute the work; do not stop after producing a plan. Use this existing heraAgent
root, not a nested directory. Follow the authorized private GitHub creation/push
workflow, preserving existing files, history, credentials and unrelated processes.
Report actual test results, verified upload status and precise blockers.
```

The full start prompt and Appendix A of the specification are identical. Both
supersede prior instructions that placed development on macOS. Engineering
instructions remain in English; the product still supports Korean input/UI.

## Authorization and current status

This is an implementation handoff, not an implemented application or an
initialized Git repository. Packaging these files did not create a GitHub
repository, perform a push, publish a release, run Hera, or execute Windows/macOS
tests. PowerShell examples are instructions to verify on the actual Windows host,
not claimed execution results.

The start prompt authorizes guarded local Git initialization, creating a private
GitHub repository named exactly `heraAgent` under the verified personal account,
and ordinary pushes of reviewed source. Do not infer an owner from memory.
Preserve existing repositories, history, user changes and credentials.

Public visibility, license grants, npm publication and GitHub release publication
require separate approval. Never force-push, upload secrets or silently change
model providers or billing routes. OpenCode Go remains the required subscription
API provider for external DeepSeek workers, not a required second coding harness.
Missing authentication or identity conflicts must be reported without fabricated
success; continue unblocked local work.
