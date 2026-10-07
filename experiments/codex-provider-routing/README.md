# Native provider-routing qualification

This is an opt-in compatibility experiment, excluded from the Hera npm archive.
The product launcher still uses the original pinned `@openai/codex` package and
external mode remains blocked. No experimental executable or credential is committed.

`native-v1.patch` applies to the exact official source commit in `manifest.json`.
It adapts the user-owned grants, routing snapshots, provider auth/catalog isolation
and saved-provider restoration from the pinned Bozentan reference. It uses existing
V1 plaintext collaboration, rejects cross-provider history forks/V2 spawning, and
adds a bounded named-profile flag to standalone App Server for isolated qualification.
Cargo.lock changes only normalize workspace versions to the source tag's 0.160.1.
It does not add external dependencies or a second agent loop.

Upstream and reference code retain Apache-2.0. See the original
[license](../../assets/codex/LICENSE) and [notice](../../assets/codex/NOTICE).
This notice does not grant a license to Hera or authorize public publication.

On native Windows PowerShell or macOS, after `npm ci` and `npm run build`:

```text
node scripts/qualify-native-patch.mjs --prepare-only
```

This fetches the pinned public source into a new ignored checkout and verifies/applies
the patch. It refuses to overwrite an existing checkout. To build and run a fresh-home,
no-inference smoke, use the script without `--prepare-only` in a fresh workspace.
Rust uses the upstream pinned toolchain, without changing the global default.
The script copies matching official platform helpers into a separate experiment bundle;
it replaces only that bundle's executable. It never alters the installed npm runtime.

The debug build optimizes age, scrypt and salsa20. Without this, age's calibrated
decryption work limit rejected the existing release-created Windows auth store.
The limit and stored credentials are unchanged. A no-inference fresh-home smoke does
not prove existing-login compatibility; the Windows live qualification separately did.

The manually dispatched `Native patch qualification` workflow builds Windows x64 and
macOS arm64 and uploads only a receipt. It makes no model calls and publishes no binary.
Its results must be observed; adding the workflow is not a passing Mac build.

Local Windows evidence and outstanding gates are in [ADR-002](../../docs/adr/002-external-mode-blocked.md)
and [status](../../docs/status.md). Passing routing/resume tests does not activate the
product or establish full runtime safety, packaging, quota/recovery or Mac live support.
