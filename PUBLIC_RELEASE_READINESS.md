# Purple Dragon PowerTools v2.1.0 — Public Release Readiness

This document is the release gate for the first public-ready build. A checked item means the requirement has been verified for the current release candidate, not merely implemented.

## 1. Repository and legal

- [x] Public-release branch created
- [x] .gitignore blocks local dependencies, build output, logs, environment files, and common credential containers
- [x] SECURITY.md added
- [ ] Final software license selected and added as LICENSE
- [ ] package.json license metadata matches LICENSE
- [x] README no longer describes the application as private
- [ ] Repository description matches the public-release positioning
- [ ] Copyright/organization naming reviewed for consistency

## 2. Dependency and build reproducibility

- [x] Root package-lock.json generated and committed
- [x] runtime/package-lock.json generated and committed
- [x] Clean clone builds successfully on Windows
- [x] npm dependency audit reviewed
- [x] electron-builder produces distinct NSIS and portable artifacts
- [ ] Build artifacts launch on a clean Windows account
- [ ] Installer uninstall path verified
- [x] Build SHA-256 hashes generated and independently verified

## 3. Security and privacy

- [x] Git-history credential-pattern scan passes for supported key/token/private-key patterns
- [x] Electron BrowserWindow security options reviewed
- [x] contextIsolation remains enabled
- [x] nodeIntegration remains disabled for renderer content
- [x] preload exposes only explicitly required APIs
- [ ] IPC handlers validate caller-controlled identifiers and actions
- [x] Credential storage uses Electron safeStorage without plaintext fallback
- [x] Local AI endpoints remain loopback-only
- [x] Cloud system context remains separately opt-in
- [x] Diagnostics redact usernames, hostnames, addresses, paths, tokens, and secrets
- [x] External URLs are allowlisted or validated before opening
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

- [x] Global unhandled-error path reviewed
- [ ] User-facing errors avoid raw internal exceptions where possible
- [x] Diagnostic export contains version/runtime/platform details
- [x] Diagnostic export excludes secrets and unnecessary personal information
- [ ] Log levels are consistent
- [ ] Clear-log behavior verified
- [ ] Troubleshooting instructions added to README/docs

## 6. Release automation

- [x] Release-readiness CI workflow added
- [x] Frozen read-only CI passes on the release branch
- [x] GitHub issue templates added
- [x] Pull-request template added
- [x] Release notes prepared
- [x] Git tag naming convention confirmed: v2.1.0-rc.1 for the first prerelease
- [ ] GitHub Release created as a prerelease first
- [ ] Installer and portable artifacts attached to the prerelease (CI now builds both)
- [ ] SHA-256 checksums attached to the prerelease (CI now generates SHA256SUMS.txt)
- [x] Code-signing status clearly documented

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


## Security review notes — 2026-09-17

The v2.1.0 release branch explicitly blocks renderer-created windows and renderer navigation away from the bundled local UI. The main BrowserWindow uses context isolation, disables renderer Node integration, and enables the Electron sandbox.

Credential stores for AI providers, GitHub, and Geo IPify require Electron safeStorage encryption and do not fall back to plaintext storage. Cloud AI endpoints, GitHub links, Geo IPify, VPN provider setup links, Privacy shortcuts, and Windows tools are constrained by fixed allowlists or validated identifiers.

Support-report export now applies a redaction pass and omits detailed per-process names, installed-application names, activity details, and user-folder analysis. Local diagnostic logging redacts local host/user identifiers, common credential formats, MAC addresses, and valid IPv4 addresses before writing to disk.

The renderer Content Security Policy remains: `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:;`.

Remaining security work is primarily Windows smoke testing, administrator/UAC behavior, and validating real exported reports across representative hardware.


## CI verification — 2026-09-17

Frozen read-only Release Readiness workflow run `35285512677` passed on commit `8006bd1c16afd4d78dbf81c8f24f619a3adb7d21`.

Verified gates:

- repository hygiene
- Git-history credential-pattern scan
- JavaScript syntax
- package metadata
- committed root/runtime lockfiles
- root `npm ci`
- runtime lock `npm ci --ignore-scripts`
- root/runtime production dependency audits
- NSIS + Portable Windows packaging
- distinct Setup/Portable artifact assertion
- SHA-256 checksum generation
- release-candidate artifact upload

The resulting CI archive contained:

- `Purple-Dragon-PowerTools-Setup-2.1.0-x64.exe`
- `Purple-Dragon-PowerTools-Portable-2.1.0-x64.exe`
- `Purple-Dragon-PowerTools-Setup-2.1.0-x64.exe.blockmap`
- `SHA256SUMS.txt`

The archive and both executable hashes were independently recomputed and matched the CI-published digests/checksum file.

This verifies build reproducibility and artifact integrity at CI level; it does not replace real interactive Windows smoke testing.
