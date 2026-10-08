# Prerelease preparation checklist

- Review source, intended commit history and exact origin fetch/push URLs.
- Run native Windows npm ci, typecheck, test, build, native:smoke and source:check.
- Run release:prepare in separate staging, then package:check and package:smoke.
- Inspect archive allowlist, all dependency integrities, licenses and absence of secrets.
- Package lock remains unchanged; consumer shrinkwrap preserves all OS optional packages.
- Run Windows/macOS offline CI and install the single Windows artifact on both required
  architectures without source checkout. Compare actual artifact SHA-256 in each log.
- Download that CI artifact and test those exact bytes locally on Windows.
- Record Windows local, Windows CI, macOS CI, and manual/live results separately.
- Report native-workflow/DRD verification by mode and platform. Windows resize and
  Korean IME are user-confirmed; macOS manual/live is deferred until after Windows
  completion and remains NOT_RUN. Keep macOS support and automated CI; the deferred
  checks do not block the Windows milestone. Historical apply-phase passes do not qualify
  current native permissions. Do not ship old blanket "Go blocked" claims as status.
- Verify local HEAD equals remote main, exact private name and origin/main upstream.
- Prepare notes/checksums/compatibility locally. No release tag or public license has
  been created; tag/version agreement is pending until release publication is authorized.
- Do not run npm publish or create/publish a GitHub release without separate approval.

Private CI build artifacts are test evidence, not a published GitHub release. They
expire under GitHub artifact retention. Private Actions may consume billed minutes.
