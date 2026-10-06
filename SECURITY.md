# Security

Credentials must never enter this repository. Official login uses the isolated
`HERA_HOME/codex` profile and requires the OS keyring. No plaintext fallback or
existing Codex credential copy is performed. Default HERA_HOME is outside projects.
Hera rejects HERA_HOME inside a Git repository, including canonical junction targets.

Go keys default to a narrowly scoped OS credential entry: Windows Credential Manager
(current user, local-machine persistence) or macOS login Keychain. The entry is namespaced
by canonical HERA_HOME and separate from native OpenAI credentials. This user-requested
extension replaces the original environment-only setup; no general secret vault exists.
Secret input is masked, is never placed in arguments, and crosses helper processes only
through private stdin/stdout pipes. macOS uses a base64 transport representation inside
Keychain, not encryption supplied by Hera. OS storage failure has no plaintext fallback.
The key is used in memory for an explicit fixed-host probe and not inherited by Codex.
HERA_OPENCODE_GO_API_KEY remains an explicit process override; startup setup requires
a persistent OS entry. Project .env files are never loaded. Diagnostics omit raw helper
stderr/provider bodies and account email/token fields. Same-user malicious processes
are outside this credential-isolation boundary.

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
