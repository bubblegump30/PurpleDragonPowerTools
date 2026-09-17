# Purple Dragon PowerTools v2.1.0 — Stable Release Gate

**Current channel: Release Candidate / Prerelease**  
**Stable status: NOT YET APPROVED**

This file defines the promotion rule from v2.1.0 Release Candidate to Stable. It does not claim that the current branch is stable.

## Required before Stable

1. Release Readiness CI passes on the exact candidate commit.
2. Root and runtime package lockfiles are reviewed and committed.
3. The MIT software license is present and repository metadata matches it.
4. NSIS installer and portable artifacts build successfully.
5. Published SHA-256 checksums match the tested artifacts.
6. Standard-user startup works without elevation.
7. Administrator-required actions behave correctly when UAC is approved or declined.
8. Installer/uninstaller and portable modes are smoke-tested.
9. CPU/sensor unavailable states are truthful and do not show fabricated zero values.
10. Single-drive, multi-drive, NVMe/HDD/SSD, and USB storage paths are smoke-tested.
11. Network/offline states are smoke-tested.
12. NordVPN/ExpressVPN absence does not break Network PowerTools.
13. Available supported VPN clients are tested separately when accessible.
14. A real support report is reviewed for privacy/redaction.
15. Unsigned/code-signing status is clearly visible in release notes.
16. The GitHub prerelease is installed/tested before promotion.

## Stable invariants

- Electron remains pinned and security settings remain explicit.
- The renderer cannot create arbitrary windows or navigate away from the bundled UI.
- Credentials never fall back to plaintext storage.
- Cloud System-Aware context remains separately opt-in.
- AI remains review-first and cannot directly execute arbitrary system mutations.
- VPN provider/action controls remain allowlisted.
- External links and Windows tool targets remain allowlisted/validated.
- Diagnostics/support exports remain sanitized.
- Heavy hardware, VPN, GitHub, and cloud-provider discovery remains lazy where designed.

See [PUBLIC_RELEASE_READINESS.md](PUBLIC_RELEASE_READINESS.md) for the full checklist and [RELEASE_NOTES_v2.1.0-rc.1.md](RELEASE_NOTES_v2.1.0-rc.1.md) for prerelease notes.
