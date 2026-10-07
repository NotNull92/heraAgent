# macOS installation, update and rollback

Apple Silicon is a required target; Intel compatibility remains unverified unless
separately reported. Install native Node 24.x (tested patch 24.12.0), avoiding an
unnecessary Rosetta dependency. Do not use sudo npm or switch development from Windows.

```sh
command -v hera
shasum -a 256 hera-agent-0.1.0-alpha.1.tgz
npm install -g --prefix "$HOME/.local/hera-cli" ./hera-agent-0.1.0-alpha.1.tgz
"$HOME/.local/hera-cli/bin/hera" --version
"$HOME/.local/hera-cli/bin/hera" init --list-models
"$HOME/.local/hera-cli/bin/hera" auth login openai
```

Compare the checksum to SHA256SUMS.txt. Use an explicit prefix until any existing
hera command collision is resolved. Dependency downloads are required. The same
Windows-built archive must pass macOS CI; npm selects its native Codex optional
dependency and sets the installed executable mode. No Windows binary is vendored.

Select exact catalog main/worker IDs with `init --model <id> --worker-model <id>`.
The isolated OS keyring profile is ~/.hera/codex; do not copy original Codex credentials
or put HERA_HOME inside a repository. OpenAI login/keyring errors are blockers.
Store the Go key with `auth login go` or `/providers`; it uses macOS Keychain.
Use `doctor --json` and explicitly choose `--single-agent` for analysis without workers.
The product offers reviewed main-only `/apply`, but macOS live validation is NOT_RUN.
GPT workers require matching local verification; Windows acceptance does not unlock
macOS. External Go workers remain blocked. Neither absence of a local Mac nor these
live evidence gaps removes macOS CI/package support.

Enter inserts a newline; Ctrl+S sends. If terminal flow control captures Ctrl+S,
use the headless `run --single-agent --prompt-file <file>` path. Bracketed paste is
literal. Real macOS Korean IME/herdr/terminal/live checks are MANUAL_NOT_RUN/LIVE_NOT_RUN;
automated macOS CI is reported independently.

Close sessions before updating. Install a new verified tarball into the same prefix;
rollback installs the previous tarball. Never delete ~/.hera during either operation.
Unsupported newer metadata is preserved and rejected. Initial evidence covers
same-version reinstall only because no prior Hera release exists.
