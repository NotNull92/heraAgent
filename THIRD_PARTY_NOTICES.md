# Third-party notices

Hera is UNLICENSED; no public license grant is made. Dependencies retain their own
licenses. npm installs original dependency packages with their license/notice files;
Hera does not vendor their native binaries. Exact versions, integrity and transitive
license identifiers are recorded in the source lock and consumer shrinkwrap.

- @openai/codex 0.160.1: Apache-2.0, https://github.com/openai/codex
- TypeScript 7.0.2 (development only): Apache-2.0, https://github.com/microsoft/TypeScript
- React 19.3.0: MIT, https://github.com/facebook/react
- Ink 8.0.0: MIT, https://github.com/vadimdemedes/ink
- Commander 15.0.0: MIT, https://github.com/tj/commander.js
- Zod 4.6.5: MIT, https://github.com/colinhacks/zod

Generated Codex protocol declarations and matching config schema originate from
openai/codex rust-v0.160.1 (Apache-2.0). Hera changes only generated relative import
extensions for NodeNext. The original Apache license is included under assets/codex.
No third-party license changes the approval boundary for publishing Hera itself.

The development-only `experiments/codex-provider-routing/native-v1.patch` adapts
Apache-2.0 source from openai/codex and Bozentan/codex. Exact source revisions and
modifications are documented beside the patch. It is excluded from the npm archive
and does not replace the installed dependency or change Hera's license.
