# Purple Dragon PowerTools v2.1.0 — Stable Release

**Channel:** Stable  
**Platform:** Windows x64  
**Publisher:** Purple Dragon Foundation Ltd  
**License:** MIT

Purple Dragon PowerTools v2.1.0 is the first Stable public release. It promotes the v2.1.0 release-candidate line after public-release hardening, reproducible Windows packaging, privacy/security review, startup-performance improvements, and owner acceptance testing.

## Highlights

- Stable Windows Setup and Portable builds
- Reproducible dependency locks and clean CI builds
- SHA-256 checksums for published executables
- Hardened Electron renderer boundaries
- Renderer-created windows and unexpected navigation blocked
- Sanitized diagnostics and support-report exports
- Credential storage requires Electron safeStorage
- Loopback-only custom local AI endpoints
- Cloud System-Aware context remains separately opt-in
- Improved startup responsiveness through staggered telemetry providers
- Hidden Performance/Network charts no longer redraw unnecessarily
- Multi-drive HDD / SSD / NVMe / USB storage support
- NordVPN and ExpressVPN Center
- AI Command Center with Direct Model, Dragon Router, and Dragon Council
- Automation Engine, Change Journal + Undo, Feature Lab, Security Center, Privacy & App Trust Intelligence, and GitHub Release Center

## Release integrity

The Stable release workflow is required to create a **cryptographically signed annotated Git tag** named `v2.1.0`.

After pushing the tag, the workflow asks GitHub for the tag object's verification status. If GitHub does not report the signature as verified, the workflow deletes the remote tag and stops before creating the release.

Published binaries are accompanied by `SHA256SUMS.txt`.

## Windows code-signing status

The Git tag signature and Windows executable signature are separate trust mechanisms.

The Stable Git tag is required to be GitHub-Verified. The Windows executables may still be unsigned until a Windows Authenticode code-signing certificate is available. Windows Defender SmartScreen can therefore display an Unknown Publisher/reputation warning.

Do not disable Windows security features to install Purple Dragon PowerTools.

## Compatibility

v2.1.0 has completed the project's release-candidate acceptance cycle. Broader compatibility testing across additional motherboard, VPN, storage, network, and Windows environments remains an ongoing post-release validation track.

Unsupported or inaccessible telemetry should report **Unavailable** or **Unsupported** rather than fabricated values.

## Privacy

- Credentials are not intentionally exported in diagnostics.
- Support exports redact local identifying data and common credential formats.
- Detailed per-process names, installed-application names, activity details, and user-folder analysis are omitted from public support reports.
- Users should still inspect diagnostics before posting them publicly.

## Verification

After downloading the release:

```powershell
Get-FileHash -Algorithm SHA256 .\Purple-Dragon-PowerTools-Setup-2.1.0-x64.exe
Get-FileHash -Algorithm SHA256 .\Purple-Dragon-PowerTools-Portable-2.1.0-x64.exe
```

Compare both results with `SHA256SUMS.txt`.

## Security reports

See [SECURITY.md](SECURITY.md). Do not publish passwords, API keys, tokens, signing keys, private paths, or unsanitized diagnostic information in a public issue.

## License

Purple Dragon PowerTools v2.1.0 is released under the **MIT License**.
