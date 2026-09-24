# Contributing to Purple Dragon PowerTools

Thank you for considering a contribution to Purple Dragon PowerTools.

Purple Dragon PowerTools is a Windows Electron system utility and AI command center. Contributions should preserve reliability, security boundaries, release integrity, and the existing Purple Dragon interface.

## Development requirements

- Windows 11 recommended
- Node.js 22 or later
- npm
- PowerShell
- Git

## Set up a development copy

1. Fork the repository on GitHub.
2. Clone your fork.
3. Open PowerShell in the repository directory.
4. Install dependencies:

```powershell
npm ci
```

5. Start the application:

```powershell
npm start
```

The repository also includes the normal PowerShell launcher documented in the README.

## Before opening a pull request

For code changes, run the applicable validation commands:

```powershell
npm run verify:syntax
npm run test:update-verification
npm run test:update-transaction
npm run test:release-publisher
```

For Windows packaging changes, also test an unpacked build when applicable:

```powershell
npm run pack:win
```

For release/distribution work, use the full Windows build when applicable:

```powershell
npm run dist:win
```

Documentation-only pull requests do not need unrelated application tests.

## Contribution guidelines

- Keep each pull request focused on one logical change.
- Explain what changed and why.
- Include the testing you performed.
- Include screenshots for meaningful UI changes.
- Note compatibility, privilege, update, or security implications when relevant.
- Avoid unrelated refactoring in feature and bug-fix pull requests.
- Update documentation when behavior changes.
- Preserve the established Purple Dragon visual language and navigation patterns.
- Prefer root-cause fixes over temporary patches.
- Handle unsupported hardware or unavailable telemetry explicitly rather than inventing synthetic values.

## Security and privilege boundaries

Purple Dragon PowerTools interacts with Windows system functionality, Electron IPC, PowerShell, processes, networking, updates, local hardware telemetry, and optional AI providers.

Contributions must therefore follow these rules:

- Never commit passwords, API keys, access tokens, signing keys, activation codes, or other secrets.
- Do not include unsanitized diagnostic logs or private system information.
- Preserve Electron main/preload/renderer privilege boundaries.
- Validate privileged IPC and system-changing operations.
- Do not bypass update verification, signed release manifests, integrity checks, or release safeguards.
- Require appropriate confirmation for destructive or security-sensitive actions.
- Fail safely when a command, provider, device, or telemetry source is unavailable.
- Keep cloud-context and credential handling opt-in and explicit.

For vulnerabilities, follow [SECURITY.md](../SECURITY.md).

## Bug reports

Use the repository's existing GitHub issue templates when possible.

A useful bug report should include:

- Purple Dragon PowerTools version
- Windows version and architecture
- clear reproduction steps
- expected behavior
- observed behavior
- sanitized logs or screenshots when relevant

Do not include secrets or sensitive personal/system data.

## Pull requests

Before submitting a pull request:

- confirm the branch is based on the current default branch;
- verify the application starts when your change affects runtime behavior;
- run the relevant checks listed above;
- review the diff for accidental files, credentials, build output, or unrelated edits;
- complete the repository pull request template.

Maintainers may request revisions, additional testing, or a narrower scope before merging.

## Release-related changes

Changes to the update system, release manifests, signing, checksums, publishing workflow, installer, portable package, or release trust model require extra review because they can affect every user of the application.

Do not weaken release-verification controls for convenience.

## License

By contributing to this repository, you agree that your contribution may be distributed under the project's [MIT License](../LICENSE).
