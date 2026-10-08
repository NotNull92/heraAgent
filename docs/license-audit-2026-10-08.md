# License review — 2026-10-08

## Scope and conclusion

Reviewed source HEAD `409beb1922c8132e3629338b3b384553e3438909`, the existing
uncommitted `/style` implementation, `package-lock.json`, bundled Codex assets,
the provider patch's pinned upstreams, user-installed style files (read-only),
and the existing `hera-agent-0.1.0-alpha.1.tgz`. The latter predates `/style`;
it is evidence about that archive, not a claim about a future build.

The owner approved Apache-2.0 for Hera's original code and documentation after
reviewing these findings. The root LICENSE and NOTICE implement that choice,
while branding artwork is excluded and AGPL styles remain separately installed.
Apache-2.0 was recommended given the existing Apache-2.0 Codex-derived assets
and patch. MIT is another possible license for original code; it would
not replace the Apache terms on those files. Neither choice relicenses external
AGPL styles. Retaining the current user-installed, unbundled style boundary is
the simplest route to a permissively licensed Hera. This is a scoped engineering
assessment, not a determination that every possible combined distribution is cleared.

## Materials with their own license

| Material | Observed license | Distribution and action |
| --- | --- | --- |
| Codex generated protocol/schema and coding handbook | Apache-2.0 | Bundled. Preserve `assets/codex/LICENSE`, `NOTICE`, attribution and modification notices. |
| Provider-routing patch, based on OpenAI and Bozentan Codex | Apache-2.0 | Patch is in Git, excluded from the npm archive. Preserve the pinned provenance and changes notice. |
| `attention-kind`, `spartan`, `rundown` answer styles | AGPL-3.0 as identified upstream | User-installed, outside Git. No original or translated style bodies are bundled. A new Hera license cannot override these terms. |
| npm runtime dependencies | MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, MIT OR CC0-1.0 | Installed separately by npm; retain each package's applicable terms when redistributing. |
| Lightning CSS and platform packages via Vitest/Vite | MPL-2.0 | Development dependencies. Not vendored in the Hera archive. Revisit source availability obligations if distributing modified MPL files or binaries. |
| Codex executables/platform helpers; Chromium | Multiple upstream/component terms | Installed separately. The npm declaration or top-level license is not a complete native binary notice inventory. |
| Hera hero artwork | Excluded from the Apache-2.0 grant | Original generated asset according to `docs/branding.md`; the owner retained its separate rights. No sibling artwork is copied into the shipped asset. |

## Attention Span finding

The `/style` work reads files in the user's Hera home and inserts their bodies
into the isolated runtime instructions. The repository implements a generic
local file reader and picker. Three upstream names receive Hera display names;
the upstream style bodies themselves are not in tracked or untracked product
source. Searching their distinctive sentences also found no body text in the
reviewed archive. Test fixtures contain short synthetic example instructions.

Upstream source: [Attention Span at 2714c965](https://github.com/alexgreensh/attention-span/tree/2714c965e6be1fa2597510e66651e63bc67cb448).
Its [LICENSE](https://github.com/alexgreensh/attention-span/blob/2714c965e6be1fa2597510e66651e63bc67cb448/LICENSE)
is AGPL version 3. Local attention-kind and rundown matched that revision after
line-ending normalization; local spartan differed. No user file was modified.
The exact origin of the spartan changes was not established by this review.

Private use does not by itself establish an obligation to put all of Hera under
AGPL. Conversely, excluding a file from Git is not a general exemption if a
future installer distributes it or a combined/modified work is offered over a
network. Review AGPL sections 2, 4-6 and 13 for that actual distribution. Keep
upstream attribution and license information with any redistributed style copy;
translations and renaming do not remove the original obligations. This audit
does not authorize bundling, translating or relicensing those styles.

## Verified provenance and inventory

Fetched LICENSE and NOTICE through the GitHub API for both pinned sources:

- [OpenAI Codex 97901140](https://github.com/openai/codex/tree/979011409de0a60b52f179721948e65531d26144).
- [Bozentan Codex af3072eb](https://github.com/Bozentan/codex/tree/af3072ebbcde8d47bb8592a6a3226ef1b83b560a).

Both pairs matched the bundled files after line-ending normalization. Their
NOTICE retains OpenAI and Ratatui attribution. Apache section 4 requires license
delivery, applicable notices and prominent modification notices; choosing MIT
for Hera's own additions does not delete these requirements.

All 232 non-root lock entries declare a license. Counts include optional binaries
for other platforms; they are not the installed package count:

| Declared license | Runtime entries | Development entries |
| --- | ---: | ---: |
| MIT | 127 | 47 |
| Apache-2.0 | 9 | 23 |
| ISC | 8 | 1 |
| BSD-2-Clause | 1 | 0 |
| BSD-3-Clause | 2 | 1 |
| MIT OR CC0-1.0 | 1 | 0 |
| MPL-2.0 | 0 | 12 |

No npm lock entry declares GPL or AGPL. This does not cover native Rust/browser
dependencies hidden inside binaries. `npm explain lightningcss --json` confirmed
the Vitest/Vite development chain. The installed Lightning CSS LICENSE confirms
MPL-2.0. The existing archive contains Codex LICENSE/NOTICE and Hera's third-party
notices, with no bundled node_modules or style bodies.

## Approved implementation

The root LICENSE uses the standard Apache-2.0 text. NOTICE identifies the project
and scope; assets/branding/LICENSE records the artwork exception. Package/lock
metadata and all three READMEs match the grant. The packaging copy list and
archive allowlist include LICENSE and NOTICE; the archive checker also requires
third-party, Codex and artwork notices. Earlier historical UNLICENSED statements
are superseded by the explicit authorization amendment. No npm package or release
is published by this change.

Implementation checks on Windows (exit 0): build, release preparation, archive
inspection and clean-prefix installation smoke, including native initialization,
reinstall/settings/keyring preservation and the installed launcher. The new
archive includes the `/style` implementation committed separately in `7517cab`,
but still contains no upstream style bodies. Its license and notice files match
the source bytes; package and shrinkwrap root licenses both read Apache-2.0.
All other dependency-lock fields remain unchanged. No model calls were made for
this license change. macOS installation/live/manual checks were NOT_RUN locally;
Windows/macOS CI remains configured and its results must be checked separately.

The root LICENSE was downloaded from the Apache Software Foundation's
[standard text](https://www.apache.org/licenses/LICENSE-2.0.txt), SHA-256
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
Prepared local artifact SHA-256:
`8d0e0056e5241e21116372c5ecacb9bcf4e0e4adda0f801c8b0c825266d54f83`.

Sources for interpretation: [Apache-2.0 terms](https://www.apache.org/licenses/LICENSE-2.0),
[MIT terms](https://opensource.org/license/mit),
[Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/), and the pinned
Attention Span license above. Binary redistribution requires a separate complete
component/source-offer review before a claim of release compliance.
