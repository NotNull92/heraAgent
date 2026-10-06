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
- Label incomplete native collaboration, apply, Go and real-terminal gates prominently.
- Verify local HEAD equals remote main, exact private name and origin/main upstream.
- Prepare notes/checksums/compatibility locally. No release tag or public license has
  been created; tag/version agreement is pending until release publication is authorized.
- Do not run npm publish or create/publish a GitHub release without separate approval.

Private CI build artifacts are test evidence, not a published GitHub release. They
expire under GitHub artifact retention. Private Actions may consume billed minutes.
