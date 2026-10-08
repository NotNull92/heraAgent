# Third-party notices

Hera's original source code and documentation are licensed under Apache-2.0;
see [LICENSE](LICENSE) and [NOTICE](NOTICE). Branding artwork is excluded; see
[its notice](assets/branding/LICENSE). Third-party materials retain their own
licenses. npm installs the original dependency packages; their metadata is not a
substitute for preserving applicable license/notice files when redistributing them.
Hera does not vendor their native binaries. Exact versions, integrity and transitive
license identifiers are recorded in the source lock and consumer shrinkwrap.

- @openai/codex 0.161.0: Apache-2.0, https://github.com/openai/codex
- TypeScript 7.0.2 (development only): Apache-2.0, https://github.com/microsoft/TypeScript
- React 19.3.0: MIT, https://github.com/facebook/react
- Ink 8.0.0: MIT, https://github.com/vadimdemedes/ink
- Commander 15.0.0: MIT, https://github.com/tj/commander.js
- Zod 4.6.5: MIT, https://github.com/colinhacks/zod
- Playwright 1.63.0: Apache-2.0, https://github.com/microsoft/playwright
- MCP TypeScript SDK 1.32.1: MIT, https://github.com/modelcontextprotocol/typescript-sdk
- ipaddr.js 2.3.0: MIT, https://github.com/whitequark/ipaddr.js

Chromium is installed separately into the user browser cache by the pinned
Playwright installer, preserving upstream licenses and existing browser versions.
Browser binaries and user browser data are not included in the Hera archive.

Generated Codex protocol declarations and matching config schema originate from
openai/codex rust-v0.161.0 (Apache-2.0). Hera changes only generated relative import
extensions for NodeNext. The original Apache license is included under assets/codex.
No third-party license changes the approval boundary for publishing Hera itself.

`assets/codex/coding-instructions.md` is the unmodified coding handbook from
`codex-rs/models-manager/prompt.md` at openai/codex commit
`979011409de0a60b52f179721948e65531d26144` (rust-v0.161.0), with LF line endings.
It is loaded on demand by a local native MCP tool. The Apache-2.0 license under
`assets/codex` applies to that file; Hera's current workflow instructions override
its generic CLI defaults. `research-instructions.md` is Hera's own workflow guide.

The development-only `experiments/codex-provider-routing/native-v1.patch` adapts
Apache-2.0 source from openai/codex and Bozentan/codex. Exact source revisions and
modifications are documented beside the patch. It is excluded from the npm archive
and does not replace the installed dependency or change Hera's license.

## User-installed answer styles (not bundled)

The optional `attention-kind`, `spartan` and `rundown` Markdown answer styles
originate from [alexgreensh/attention-span](https://github.com/alexgreensh/attention-span).
The upstream project identifies them as AGPL-3.0; see its
[license at the reviewed revision](https://github.com/alexgreensh/attention-span/blob/2714c965e6be1fa2597510e66651e63bc67cb448/LICENSE).
Hera's names for these choices are Sage, Warrior and Herald (현자, 전사, 전령).
The picker reads user-installed files from the Hera home. Neither their original
text nor translations are included in this repository or the reviewed npm archive.
Renaming a style does not change its license. Do not copy these texts into a
Hera release under the project's own license; preserve their upstream terms and
review the distribution obligations before adding any bundled style content.

## Transitive dependencies and distribution scope

The reviewed npm lock includes MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause
and `(MIT OR CC0-1.0)` runtime dependency declarations. Development dependencies
also include MPL-2.0 `lightningcss` and its optional platform packages through
Vitest/Vite. These packages are not vendored into Hera's source archive.
Their licenses continue to apply independently. This inventory is not a license
clearance for repackaged Codex binaries or Chromium and their internal libraries.
See the [license review](https://github.com/NotNull92/heraAgent/blob/main/docs/license-audit-2026-10-08.md) for scope and findings.
