'use strict';

const assert = require('assert');
const fs = require('fs');

const workflowPath = '.github/workflows/publish-v2.2.0-stable.yml';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const manifestScript = fs.readFileSync('scripts/New-ReleaseManifest.ps1', 'utf8');

assert(workflow.includes('name: Publish v2.2.0 Stable'));
assert(workflow.includes('workflow_dispatch:'));
assert(!/\n\s+push:\s*\n/.test(workflow), 'Stable publisher must remain manual-only.');
assert(workflow.includes('PUBLISH-v2.2.0'));
assert(workflow.includes('refs/heads/main'));
assert(workflow.includes('TAG_NAME: v2.2.0'));
assert(workflow.includes('secrets.STABLE_TAG_SIGNING_KEY'));
assert(workflow.includes('ssh-keygen -Y sign'));
assert(workflow.includes('ssh-keygen -Y verify'));
assert(workflow.includes('git tag -s "$TAG_NAME"'));
assert(workflow.includes('test "$VERIFIED" = "true"'));
assert(workflow.includes('test "$TARGET_SHA" = "$GITHUB_SHA"'));
assert(workflow.includes('-KeyId $env:KEY_FINGERPRINT'));
assert(!workflow.includes("-KeyId '$env:KEY_FINGERPRINT'"));
assert(workflow.includes('SAFE_TO_CLEANUP=true'));
assert(workflow.includes('if [ "${SAFE_TO_CLEANUP:-}" != "true" ]'));
assert.strictEqual(workflow.split(String.raw`tr -d '\\r' < release-artifacts/SHA256SUMS.txt`).length - 1, 2, 'Both Linux checksum readers must normalize Windows CRLF line endings.');
assert(workflow.includes('release-artifacts/release-manifest.json'));
assert(workflow.includes('release-artifacts/release-manifest.json.sig'));

for (const name of [
  'Purple-Dragon-PowerTools-Setup-2.2.0-x64.exe',
  'Purple-Dragon-PowerTools-Portable-2.2.0-x64.exe',
  'SHA256SUMS.txt',
  'release-manifest.json',
  'release-manifest.json.sig'
]) {
  assert(workflow.includes(name), 'Publisher is missing expected release asset: ' + name);
}

assert(manifestScript.includes('[string]$KeyId'));
assert(manifestScript.includes('keyId = $KeyId'));

console.log('Stable publisher policy tests passed.');
