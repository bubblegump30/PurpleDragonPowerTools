# Update & Release Trust Model

Purple Dragon PowerTools uses an **open-source code, tightly controlled official releases** model.

The source repository may be public. An executable is not treated as an official install-ready update merely because it was built from the source tree.

## v2.2.0 trust chain

Update & Release Center 2.0 uses this verification chain:

1. Query the official `bubblegump30/PurpleDragonPowerTools` GitHub Releases feed over HTTPS.
2. Select only the expected Setup or Portable Windows package for the local architecture.
3. Download into the PowerTools user-data staging directory. The staged executable is **not executed**.
4. Compare SHA-256 values from every available authoritative release source:
   - GitHub release-asset digest;
   - `SHA256SUMS.txt`;
   - signed `release-manifest.json`.
5. Fail closed if published SHA-256 sources disagree.
6. Require the release Git tag to be an annotated tag whose signature GitHub reports as **Verified** when release-signature enforcement is enabled.
7. When a signed release manifest is published:
   - validate product, repository, version, commit, selected asset, size and SHA-256 metadata;
   - verify the detached OpenSSH SSHSIG signature locally;
   - require the manifest signature's embedded Ed25519 public key to match the same public key embedded in the GitHub-Verified release-tag signature.
8. Only report **verification passed** after the applicable hash, signed-tag and signed-manifest gates succeed.

## Installation boundary

The v2.2.0 verification phase does **not** install or launch staged executables.

- Automatic download: disabled.
- Automatic install: disabled.
- Installer execution from Update & Release Center: disabled.
- Rollback/transactional installation: not enabled until the next implementation phase.

A successful verification result therefore means only that the staged package passed the current release-trust checks.

## Release manifest

Generate a candidate manifest after the Windows packages have been built:

```powershell
.\scripts\New-ReleaseManifest.ps1 -Channel preview
```

For an official signed release, include signature metadata:

```powershell
.\scripts\New-ReleaseManifest.ps1 -Channel stable -IncludeSignatureMetadata
```

Then sign the manifest with the dedicated Purple Dragon release-signing key:

```powershell
.\scripts\Sign-ReleaseManifest.ps1
```

The helper uses OpenSSH `ssh-keygen -Y sign -n file` and expects the dedicated release key at `$HOME\.ssh\purple_dragon_release_signing` unless another key path is supplied.

The private key must never be committed to the repository, attached to a release, included in diagnostics, or copied into application data.

## Required official release assets

A future install-enabled official release should publish:

- Purple Dragon PowerTools Setup executable;
- Purple Dragon PowerTools Portable executable;
- `SHA256SUMS.txt`;
- `release-manifest.json`;
- `release-manifest.json.sig`.

The Git tag and release manifest should be signed using the same dedicated Ed25519 release-signing key.

## Windows Authenticode

SSH release signing and Windows Authenticode are separate trust layers.

The release tag / manifest chain identifies a Purple Dragon official release. Windows Authenticode identifies the publisher to Windows and SmartScreen. Authenticode remains pending until a suitable Windows code-signing certificate is available.

Do not disable Defender, SmartScreen, antivirus, or other Windows security controls to install Purple Dragon PowerTools.
