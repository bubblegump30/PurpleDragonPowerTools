# Official Stable Release Signing

Purple Dragon PowerTools uses a dedicated **Ed25519 SSH signing key** to identify official Stable releases.

This release key serves two related purposes:

1. sign the annotated Stable Git tag that GitHub must report as **Verified**;
2. sign `release-manifest.json` with an OpenSSH SSHSIG detached signature.

Using the same release key for both lets Update & Release Center verify that a downloaded release manifest was signed by the same identity GitHub verified on the release tag.

This signing system is separate from Windows Authenticode/code signing.

## Release key

The dedicated key is:

- local private-key path: `$HOME\.ssh\purple_dragon_release_signing`
- GitHub Actions secret: `STABLE_TAG_SIGNING_KEY`

The private key must never be committed to the repository, attached to a release, written to diagnostics, or pasted into source code.

The public key should remain registered in the GitHub account as an SSH **Signing Key** so GitHub can verify signed annotated release tags.

## One-time key setup

On a trusted Windows computer:

```powershell
ssh-keygen -t ed25519 -C "49097353+bubblegump30@users.noreply.github.com" -f "$HOME\.ssh\purple_dragon_release_signing"
```

For unattended GitHub Actions publishing, the dedicated release key must be usable non-interactively.

Register the public key in GitHub:

1. Open **Settings → SSH and GPG keys**.
2. Choose **New SSH key**.
3. Set the type to **Signing Key**.
4. Paste `purple_dragon_release_signing.pub`.
5. Save it.

Store the private key as the repository Actions secret:

1. Open the repository **Settings → Secrets and variables → Actions**.
2. Create or update `STABLE_TAG_SIGNING_KEY`.
3. Paste the complete contents of `purple_dragon_release_signing`.
4. Save it.

## v2.2.0 Stable publisher

The v2.2.0 workflow is:

`.github/workflows/publish-v2.2.0-stable.yml`

It is intentionally **workflow_dispatch only**. It has no automatic push trigger.

After v2.2.0 is merged to `main`, publication requires manually running the workflow from `main` and entering the exact confirmation:

```text
PUBLISH-v2.2.0
```

The publisher refuses to continue if:

- it is not dispatched from `main`;
- the package version is not exactly `2.2.0`;
- the release notes or trust files are missing;
- updater/transaction tests fail;
- production dependency audit fails;
- the v2.2.0 tag or release already exists;
- `STABLE_TAG_SIGNING_KEY` is missing or is not Ed25519;
- the generated manifest contents do not match the built artifacts;
- local manifest signature verification fails;
- local annotated-tag verification fails;
- GitHub does not report the pushed annotated tag as Verified;
- the signed tag does not target the exact workflow commit;
- final published trust metadata does not match what the workflow signed.

## Official v2.2.0 release sequence

The publisher performs the following sequence:

1. Build Setup and Portable executables from the exact `main` commit.
2. Run updater, transaction, and Stable-publisher policy tests.
3. Run production dependency audits.
4. Generate `SHA256SUMS.txt`.
5. Move only the unsigned build bundle between jobs.
6. Load the private release key only in the publishing job.
7. Derive the Ed25519 public key and SHA-256 SSH fingerprint.
8. Generate `release-manifest.json` with the actual release-key fingerprint.
9. Verify manifest asset hashes against `SHA256SUMS.txt`.
10. Sign the manifest using `ssh-keygen -Y sign -n file`.
11. Verify the detached manifest signature locally.
12. Sign the annotated `v2.2.0` Git tag using the same private key.
13. Verify the annotated tag locally.
14. Push the tag.
15. Require GitHub tag-object verification to report `verified: true`.
16. Require the signed tag to target the exact workflow commit.
17. Publish the GitHub Stable Release with five official assets.
18. Verify the published release asset set and GitHub-reported digests.
19. Re-download `SHA256SUMS.txt`, `release-manifest.json`, and `release-manifest.json.sig`.
20. Byte-compare the downloaded trust metadata against the originals and verify the downloaded manifest signature again.

If publication fails after the workflow has established that no pre-existing v2.2.0 tag/release exists, the workflow attempts to remove the release and tag created by that run. The cleanup guard prevents an existing external tag or release from being deleted merely because the “already exists” check failed.

The private key is removed from the runner in an `always()` cleanup step.

## Official release assets

The v2.2.0 Stable release must contain exactly one of each required trust/application asset:

- `Purple-Dragon-PowerTools-Setup-2.2.0-x64.exe`
- `Purple-Dragon-PowerTools-Portable-2.2.0-x64.exe`
- `SHA256SUMS.txt`
- `release-manifest.json`
- `release-manifest.json.sig`

Update & Release Center uses these assets to distinguish an official Purple Dragon package from an arbitrary community build.

## Windows Authenticode

SSH release signing does not make a Windows executable Authenticode-signed.

The release-tag/manifest chain identifies an official Purple Dragon release. Windows Authenticode separately identifies the executable publisher to Windows and SmartScreen.

Until a suitable Windows code-signing certificate is available, release documentation must not claim the Setup or Portable executables are Authenticode-signed.
