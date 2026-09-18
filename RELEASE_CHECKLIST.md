# Purple Dragon PowerTools v2.1.0 — Stable Release Checklist

The authoritative release gate is [PUBLIC_RELEASE_READINESS.md](PUBLIC_RELEASE_READINESS.md).

## Repository

- [x] Public-release branch exists
- [x] README uses Stable release wording
- [x] SECURITY.md exists
- [x] .gitignore includes build/dependency/credential hygiene
- [x] Bug-report template exists
- [x] Feature-request template exists
- [x] Pull-request template exists
- [x] Release notes prepared
- [x] Code-signing status documented
- [x] Final LICENSE selected (MIT)

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
- [x] Frozen read-only CI passes on verified RC build commit
- [x] Root lockfile committed
- [x] Runtime lockfile committed
- [ ] Installer tested
- [ ] Uninstaller tested
- [ ] Portable build tested
- [ ] Windows smoke-test matrix completed
- [x] GitHub prerelease published and owner-tested

## Promotion rule

Stable publication is approved with broader compatibility-matrix items explicitly deferred. The final public release must not be published until the `v2.1.0` Git tag is cryptographically signed and GitHub can mark it Verified.
