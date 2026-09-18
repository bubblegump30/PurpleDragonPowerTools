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

## Transactional installation boundary

v2.2.0 keeps update installation **manual-only**. Automatic download and automatic installation remain disabled.

The **Install Verified Update** action is available only when all of the following are true:

- PowerTools is running as an installed, packaged Windows build;
- the current process is not the Portable build;
- the staged package is the Setup installer, not the Portable executable;
- the target version is newer than the running version;
- package SHA-256 verification passed;
- the annotated release tag is GitHub-Verified;
- a signed release manifest is present and valid;
- the manifest SSH signature verifies locally;
- the manifest signing key matches the key embedded in the GitHub-Verified release-tag signature.

Immediately before installation, PowerTools hashes the staged installer again. Any change after staging locks installation and requires fresh verification.

### Transaction sequence

1. Ask for explicit user confirmation.
2. Copy the complete current installed application directory into the PowerTools rollback area.
3. Verify the backed-up application executable and bundled `resources/app.asar` hashes.
4. Write an immutable update transaction record and start an external PowerShell helper.
5. Close PowerTools.
6. The helper re-hashes the transaction record and installer package.
7. Run the verified NSIS Setup installer silently.
8. Start the newly installed PowerTools with the transaction ID.
9. Require the target version to load its renderer, retain writable user data, and report a post-update health marker.
10. If the health marker is not produced before the timeout, stop the failed new process, restore the prior application files, verify the restored executable and `app.asar`, and relaunch the previous build.

User data is not overwritten by the rollback process.

### Rollback scope

Automatic rollback restores the previous **application installation files**, including the backed-up executable, resources, and bundled uninstaller files. It does not attempt to reconstruct arbitrary Windows registry state.

Because the NSIS installer may update Windows **Apps & Features** metadata before a health-check failure occurs, a file rollback can leave version/display metadata temporarily inconsistent with the restored binary. The restored PowerTools application remains the authoritative runtime version; installer metadata can be reconciled by a later successful install or repair.

Rollback snapshots are retained after a successful update when **Keep rollback package** is enabled.

### Unsupported transaction cases

Transactional installation is intentionally blocked for:

- source/development runs;
- non-Windows platforms;
- Portable PowerTools sessions;
- Portable release packages;
- same-version or downgrade packages;
- releases without the full signed-manifest trust chain.

These builds may still inspect and verify releases, but they cannot invoke the transactional installer.

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
