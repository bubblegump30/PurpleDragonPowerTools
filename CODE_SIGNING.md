# Code Signing and Windows Trust

Purple Dragon PowerTools v2.1.0 release-candidate builds are prepared to support Windows code signing, but a signing certificate is not currently required for CI to produce test artifacts.

## Current status

- Release candidate packaging: supported
- SHA-256 artifact checksums: supported
- Authenticode signing: pending certificate availability
- Microsoft Defender SmartScreen reputation: not established for unsigned/new builds

## What users may see

An unsigned executable can display an **Unknown publisher** or Microsoft Defender SmartScreen reputation warning. That warning does not by itself prove that a file is malicious; it means Windows cannot establish publisher identity/reputation through an accepted signature.

Users should not disable Defender, SmartScreen, antivirus software, or other Windows security controls to run PowerTools.

## Verification

Release artifacts should be distributed with `SHA256SUMS.txt`.

Verify a file with:

```powershell
Get-FileHash -Algorithm SHA256 .\<artifact-name>
```

Compare the result exactly with the published checksum.

## Future signing pipeline

When a suitable code-signing certificate is available, the release pipeline should:

1. keep certificate/private-key material outside the repository;
2. expose signing credentials only to the protected release job;
3. sign the application executable and installer;
4. timestamp the signature with the certificate provider's supported timestamp service;
5. verify Authenticode signatures after packaging;
6. generate SHA-256 checksums after signing;
7. publish only the signed, verified artifacts.

No certificate, private key, password, or signing token should ever be committed to Git.
