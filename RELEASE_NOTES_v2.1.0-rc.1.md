# Purple Dragon PowerTools v2.1.0-rc.1 — Release Candidate Notes

**Channel:** Prerelease / Release Candidate  
**Platform:** Windows x64  
**Publisher:** Purple Dragon Foundation Ltd  
**Stable release:** Not yet approved

v2.1.0-rc.1 is the first public-release-readiness build of Purple Dragon PowerTools. It combines the existing v2.1.0 feature set with security, privacy, packaging, diagnostics, and repository hardening intended for outside testing.

## Highlights

- Public-release readiness checklist and security-reporting policy
- Hardened Electron renderer navigation and window creation
- Existing renderer isolation retained: context isolation on, Node integration off, sandbox on
- Sanitized diagnostic logging and support-report exports
- Windows CI packaging for NSIS installer and portable executable
- SHA-256 checksum generation for release artifacts
- Git-history credential-pattern scan
- GitHub bug-report / feature-request templates
- Release Candidate labeling throughout the application
- Existing NordVPN + ExpressVPN Center retained
- Existing AI Command Center, Storage & Data Hub, Privacy & App Trust, Automation, Change Journal, Feature Lab, Security Center, and Reliability features retained

## Privacy changes

Support-report exports now redact or omit host/user identifiers, IP/MAC addresses, file paths, credentials, serial identifiers, detailed process/application names, activity details, and user-folder analysis.

Diagnostic logs redact common credential formats and local identifiers before they are written.

Users should still review any diagnostic file before sharing it publicly.

## Windows packages

The Release Readiness workflow is configured to produce:

- NSIS installer
- Portable Windows executable
- `SHA256SUMS.txt`

Treat CI artifacts as test builds until this release candidate passes the Windows smoke-test matrix.

## Verify a downloaded build

Compare the artifact against `SHA256SUMS.txt`. For example:

```powershell
(Get-FileHash .\Purple-Dragon-PowerTools-2.1.0-x64.exe -Algorithm SHA256).Hash
```

The returned hash must match the corresponding line in `SHA256SUMS.txt`.

## Code-signing status

This release candidate may be unsigned. Windows Defender SmartScreen can therefore show an unknown-publisher/reputation warning even when the checksum is correct.

Do not disable Windows security features to install PowerTools. See [CODE_SIGNING.md](CODE_SIGNING.md).

## Known release gates

The following must be resolved or explicitly documented before v2.1.0 is promoted to Stable:

- CI build must pass
- root and runtime dependency lockfiles must be reviewed and committed
- final software license must be selected
- Windows standard-user and administrator smoke tests must pass
- installer/uninstaller and portable-build tests must pass
- VPN-present and VPN-absent tests must pass
- single-drive, multi-drive, and USB-storage tests must pass
- offline startup must be tested
- real support-report exports must be inspected for privacy
- final code-signing status must be documented

## License status

The final source license has not yet been selected. Until a `LICENSE` file is added, no additional source-code reuse or redistribution permission is being granted by this repository documentation.

## Reporting problems

Use the repository bug-report template for reproducible issues. Remove credentials, private paths, usernames, IP addresses, and other sensitive information before posting logs or screenshots.
