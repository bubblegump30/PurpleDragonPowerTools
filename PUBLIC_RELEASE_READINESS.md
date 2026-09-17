# Purple Dragon PowerTools v2.1.0 — Public Release Readiness

This document is the release gate for the first public-ready build. A checked item means the requirement has been verified for the current release candidate, not merely implemented.

## 1. Repository and legal

- [x] Public-release branch created
- [x] .gitignore blocks local dependencies, build output, logs, environment files, and common credential containers
- [x] SECURITY.md added
- [ ] Final software license selected and added as LICENSE
- [ ] package.json license metadata matches LICENSE
- [ ] README no longer describes the application as private
- [ ] Repository description matches the public-release positioning
- [ ] Copyright/organization naming reviewed for consistency

## 2. Dependency and build reproducibility

- [ ] Root package-lock.json generated and committed
- [ ] runtime/package-lock.json generated and committed
- [ ] Clean clone builds successfully on Windows
- [ ] npm dependency audit reviewed
- [ ] electron-builder produces NSIS and portable artifacts
- [ ] Build artifacts launch on a clean Windows account
- [ ] Installer uninstall path verified
- [ ] Build SHA-256 hashes generated

## 3. Security and privacy

- [ ] No API keys, GitHub tokens, provider credentials, or private keys tracked in Git history
- [ ] Electron BrowserWindow security options reviewed
- [ ] contextIsolation remains enabled
- [ ] nodeIntegration remains disabled for renderer content
- [ ] preload exposes only explicitly required APIs
- [ ] IPC handlers validate caller-controlled identifiers and actions
- [ ] Credential storage uses Electron safeStorage without plaintext fallback
- [ ] Local AI endpoints remain loopback-only
- [ ] Cloud system context remains separately opt-in
- [ ] Diagnostics redact usernames, hostnames, addresses, paths, tokens, and secrets
- [ ] External URLs are allowlisted or validated before opening
- [ ] Dangerous system mutations require explicit user action

## 4. Reliability and compatibility

- [ ] Startup succeeds without administrator privileges
- [ ] Administrator-required actions fail gracefully when declined
- [ ] Unsupported hardware reports Unsupported/Unavailable rather than fake values
- [ ] CPU temperature fallback state verified
- [ ] HDD/SSD/NVMe/USB storage enumeration verified
- [ ] Multi-drive usage calculations verified
- [ ] Network adapter and offline states verified
- [ ] VPN providers absent: UI remains functional
- [ ] NordVPN installed: smoke test completed
- [ ] ExpressVPN installed: smoke test completed
- [ ] Safe handling verified when provider CLI is unavailable
- [ ] No hidden page continuously performs unnecessary high-frequency polling
- [ ] Application exits without orphaned helper processes

## 5. Diagnostics and supportability

- [ ] Global unhandled-error path reviewed
- [ ] User-facing errors avoid raw internal exceptions where possible
- [ ] Diagnostic export contains version/runtime/platform details
- [ ] Diagnostic export excludes secrets and unnecessary personal information
- [ ] Log levels are consistent
- [ ] Clear-log behavior verified
- [ ] Troubleshooting instructions added to README/docs

## 6. Release automation

- [x] Release-readiness CI workflow added
- [ ] CI passes on the release branch
- [ ] GitHub issue templates added
- [ ] Pull-request template added
- [ ] Release notes prepared
- [ ] Git tag naming convention confirmed
- [ ] GitHub Release created as a prerelease first
- [ ] Installer and portable artifacts attached to the prerelease
- [ ] SHA-256 checksums attached to the prerelease
- [ ] Code-signing status clearly documented

## 7. Windows smoke-test matrix

Run at minimum on:

- [ ] Windows 11 x64, standard user
- [ ] Windows 11 x64, administrator-approved actions
- [ ] System without NordVPN/ExpressVPN
- [ ] System with at least one supported VPN client
- [ ] Single-drive system
- [ ] Multi-drive system
- [ ] USB storage attached
- [ ] Offline/no-internet startup

## Release decision

Do not mark v2.1.0 as Stable until all mandatory items above are complete or explicitly documented as deferred with a user-visible limitation.

Current target channel: **Release Candidate / Prerelease**
