# Public repository transition: verified results

The user approved preserving the old repository privately and publishing a new
repository containing only the sanitized history.

- Public: `NotNull92/heraAgent`, repository ID `1409659092`.
- Private archive: `NotNull92/heraAgent-private-archive`, ID `1406773417`.
- Local `origin` fetch/push URL: `https://github.com/NotNull92/heraAgent.git`.
- Local `main` tracks `origin/main`; the reviewed public push helper verifies the
  public destination, owner, URLs, source/history scan and normal ancestry.
- Unauthenticated checks confirmed public access to the new repository, HTTP 404
  for the private archive, and HTTP 422 for the pre-sanitization tip in the new repo.
- Gitleaks scanned all 54 reachable commits after the fixture fix with no findings;
  all author/committer emails use the verified GitHub noreply address.

[Public CI 37722276930](https://github.com/NotNull92/heraAgent/actions/runs/37722276930)
passed all four jobs for commit `ceb3ca862a5171f79b8689962a329171129f4de0`:
Windows x64 and macOS arm64 offline checks (86 tests each), and independent
installation of the same Windows-built package on both platforms. Package checks
confirmed native initialization, settings preserved on reinstall, OS credential
persistence and launcher behavior. Package SHA-256:
`24cdae8f4c13d3f6cbe7e3395b7877f68e84b4e21dc6409527e653d8a1150b10`.

The first public run failed on an outdated private-repository test fixture; the
replacement above passed after correcting that fixture. No billing block occurred.
No live model calls, manual terminal checks, release/npm publication or license
grant were performed. Concurrent uncommitted local work was preserved and is not
covered by this CI result. This evidence-only follow-up does not require rerunning CI.
