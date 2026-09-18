# Purple Dragon PowerTools v2.2.0 — Update & Release Center 2.0

Purple Dragon PowerTools v2.2.0 introduces a cryptographically verified update pipeline while keeping source code public and official releases tightly controlled.

## Update & Release Center 2.0

- Added token-free checks against the official `bubblegump30/PurpleDragonPowerTools` GitHub Releases feed.
- Added Stable and Preview channels.
- Added Manual, Startup, 6-hour, 12-hour, Daily, and Weekly check policies.
- Added local update settings with atomic persistence.
- Added current/latest version comparison, release history, and packaged/source build-origin reporting.
- Added optional release notifications.

## Download & Verification Engine

- Added manual Setup or Portable package staging.
- Added streaming downloads into protected Electron user-data staging.
- Added GitHub release-host allowlisting, size limits, and progress reporting.
- Added SHA-256 verification using GitHub asset digests, `SHA256SUMS.txt`, and release-manifest hashes.
- Published hashes must agree; disagreement fails closed.
- Added GitHub-Verified signed annotated release-tag validation.
- Added signed `release-manifest.json` validation.
- Added local OpenSSH SSHSIG verification for `release-manifest.json.sig`.
- The manifest signing key must match the same Ed25519 key embedded in the GitHub-Verified release-tag signature.
- The manifest commit must match the commit targeted by the signed release tag.

## Transactional Setup installation

Installation remains manual-only. Automatic download and automatic install are disabled.

A Setup package can become install-ready only when:

- PowerTools is running as an installed packaged Windows build;
- the verified package is newer than the current version;
- SHA-256 verification passed;
- the release tag is GitHub-Verified;
- a signed release manifest is present and valid;
- the manifest signature verifies locally with the same release key.

Immediately before installation, the staged installer is hashed again.

## Rollback and post-update health

- Creates a rollback snapshot of the current installed application before running Setup.
- Verifies the backed-up application executable and `resources/app.asar`.
- Uses an external PowerShell helper so the transaction survives the PowerTools shutdown.
- Re-checks the transaction record and installer package after PowerTools exits.
- Launches the target version after installation and waits for a delayed health marker.
- Health requires the expected version, writable user data, intact runtime, a live renderer, zero renderer crashes, and no renderer error.
- Automatically restores the previous application files if the new build does not pass health checks.
- Verifies restored executable and `app.asar` hashes before relaunching the previous build.
- User data is preserved throughout rollback.

Rollback restores application files, not arbitrary Windows registry state. Apps & Features metadata can require later reconciliation after a failed installation followed by file rollback.

## Official release trust

Official v2.2.0 releases publish:

- `Purple-Dragon-PowerTools-Setup-2.2.0-x64.exe`
- `Purple-Dragon-PowerTools-Portable-2.2.0-x64.exe`
- `SHA256SUMS.txt`
- `release-manifest.json`
- `release-manifest.json.sig`

The annotated Git tag and detached release-manifest signature use the same dedicated Ed25519 release-signing key.

Windows Authenticode remains a separate trust layer and is not claimed for these binaries until a Windows code-signing certificate is available.
