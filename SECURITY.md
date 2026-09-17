# Security Policy

## Supported versions

Purple Dragon PowerTools is preparing for its first public release. Security fixes are currently targeted at the latest maintained release branch.

| Version | Supported |
| --- | --- |
| 2.1.x | Yes |
| Older development builds | No |

## Reporting a vulnerability

Do not publish sensitive vulnerability details, API credentials, private system information, or proof-of-concept material that could put users at risk in a public issue.

For non-sensitive security bugs, open a GitHub issue and clearly mark it as a security-related report.

For sensitive vulnerabilities, use GitHub's private vulnerability reporting feature when it is enabled for this repository.

Include:

- Purple Dragon PowerTools version and release channel
- Windows version and architecture
- A concise description of the vulnerability
- Reproduction steps
- Expected and observed behavior
- Whether administrator privileges are required
- Sanitized logs or screenshots when useful

Never include passwords, API keys, tokens, activation codes, private keys, IP addresses, or other secrets.

## Scope

Security-sensitive areas include:

- Electron main/preload/renderer privilege boundaries
- IPC validation and allowlists
- PowerShell and Windows command execution
- GitHub integration and credential storage
- AI provider credentials and cloud-context controls
- VPN provider launch/control paths
- Update and release mechanisms
- Diagnostics and log redaction
- File-system and process operations

## Disclosure

Please allow time for validation and remediation before publicly disclosing a sensitive issue.
