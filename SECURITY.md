# Security

Credentials must never enter this repository. Official login uses the isolated
`HERA_HOME/codex` profile and requires the OS keyring. No plaintext fallback or
existing Codex credential copy is performed. Default HERA_HOME is outside projects.
Hera rejects HERA_HOME inside a Git repository, including canonical junction targets.

Go keys are accepted only from HERA_OPENCODE_GO_API_KEY, used in memory for an
explicit fixed-host probe and not inherited by Codex. Project .env files are never
loaded. Diagnostics omit raw stderr/provider bodies and account email/token fields.

The npm archive uses an allowlist and is scanned; Git source/history are scanned
before each reviewed private push. Pattern scans complement human review and do
not guarantee detection of every possible secret format. Dependency integrity is
locked. Report security issues privately to the repository owner; omit credentials.

Runtime homes inherit OS access controls. POSIX file modes are not Windows ACLs.
Sandbox read-only is not a guarantee against hostile processes running as the same
user. Native sandbox setup, live negative tests and provider isolation remain gates.
Workspace locks coordinate Hera instances only. Unknown outcomes keep locks for
manual reconciliation; never delete a lock solely because a PID appears absent.

No automatic provider fallback, turn replay, user-project Git publication, global
process kill, global execution-policy changes, runtime update or privilege escalation.
