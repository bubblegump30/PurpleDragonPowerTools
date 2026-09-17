# Purple Dragon PowerTools v2.1.0 — Release Candidate Checklist

The authoritative release gate is [PUBLIC_RELEASE_READINESS.md](PUBLIC_RELEASE_READINESS.md).

## Repository

- [x] Public-release branch exists
- [x] README uses Release Candidate / prerelease wording
- [x] SECURITY.md exists
- [x] .gitignore includes build/dependency/credential hygiene
- [x] Bug-report template exists
- [x] Feature-request template exists
- [x] Pull-request template exists
- [x] Release notes prepared
- [x] Code-signing status documented
- [ ] Final LICENSE selected

## Security / privacy

- [x] BrowserWindow isolation reviewed
- [x] Renderer navigation/new-window hardening added
- [x] CSP retained
- [x] safeStorage-only credential policy reviewed
- [x] External destinations use allowlists/validation
- [x] Diagnostics redaction added
- [x] Support-report privacy reduction added
- [ ] Real Windows exported report manually reviewed

## Build / distribution

- [x] Windows release-readiness workflow configured
- [x] NSIS installer build configured
- [x] Portable build configured
- [x] SHA-256 generation configured
- [x] Dependency lock generation configured
- [x] Git-history credential-pattern scan configured
- [ ] CI passes on final RC commit
- [ ] Root lockfile committed
- [ ] Runtime lockfile committed
- [ ] Installer tested
- [ ] Uninstaller tested
- [ ] Portable build tested
- [ ] Windows smoke-test matrix completed
- [ ] GitHub prerelease published and tested

## Promotion rule

Do not merge/publish as Stable until the mandatory unchecked items in PUBLIC_RELEASE_READINESS.md are resolved or explicitly documented as deferred.
