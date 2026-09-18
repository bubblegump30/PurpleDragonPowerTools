# Stable Git Tag Signing

The final `v2.1.0` Stable publisher refuses to create a GitHub Release unless GitHub confirms that the `v2.1.0` annotated Git tag has a **Verified** cryptographic signature.

Purple Dragon PowerTools uses a dedicated **SSH signing key** for this tag. This is separate from Windows Authenticode/code signing.

## One-time account setup

Generate a dedicated Ed25519 signing key on a trusted computer. In PowerShell:

```powershell
ssh-keygen -t ed25519 -C "49097353+bubblegump30@users.noreply.github.com" -f "$HOME\.ssh\purple_dragon_release_signing"
```

For unattended GitHub Actions signing, use a dedicated key without a passphrase. Protect the private key as a release credential and do not reuse it for SSH authentication.

This creates:

- `purple_dragon_release_signing` — private key
- `purple_dragon_release_signing.pub` — public key

### 1. Register the public key with GitHub

In GitHub:

1. Open **Settings**
2. Open **SSH and GPG keys**
3. Choose **New SSH key**
4. Set the key type to **Signing Key**
5. Give it a descriptive title such as `Purple Dragon Stable Release Signing`
6. Paste the contents of `purple_dragon_release_signing.pub`
7. Save it

### 2. Add the private key to the repository's Actions secrets

Open the PurpleDragonPowerTools repository:

1. **Settings**
2. **Secrets and variables**
3. **Actions**
4. **New repository secret**
5. Name: `STABLE_TAG_SIGNING_KEY`
6. Paste the complete contents of the private key file `purple_dragon_release_signing`
7. Save it

Do **not** paste the private key into issues, source files, release notes, commits, or chat.

## Publisher safeguards

The Stable release workflow:

1. builds Setup and Portable from committed dependency locks;
2. runs production dependency audits;
3. generates SHA-256 checksums;
4. requires `STABLE_TAG_SIGNING_KEY`;
5. derives the public key from the private key;
6. checks that the derived key is registered in the GitHub account's public SSH signing-key list;
7. creates a signed annotated `v2.1.0` tag;
8. verifies the signature locally;
9. pushes the tag;
10. checks GitHub's tag-object verification result;
11. deletes the remote tag if GitHub does not report `verified: true`;
12. publishes the Stable GitHub Release only after verification succeeds.

This prevents the final Stable tag from being intentionally left in an Unverified state.
