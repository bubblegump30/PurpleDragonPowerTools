'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createUpdateTransactionManager, safeTransactionId, pathInside, sha256File, helperScript } = require('../src/update-transaction');

(async () => {
  assert.strictEqual(Boolean(safeTransactionId('upd-m123abc-0123456789ab')), true);
  assert.strictEqual(safeTransactionId('../bad'), null);
  assert.strictEqual(safeTransactionId('upd-short-bad'), null);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdpt-update-tx-'));
  const userData = path.join(temp, 'userdata');
  const staging = path.join(userData, 'update-staging', '2.3.0');
  fs.mkdirSync(staging, { recursive:true });
  const installer = path.join(staging, 'Purple-Dragon-PowerTools-Setup-2.3.0-x64.exe');
  fs.writeFileSync(installer, Buffer.from('verified-installer-test'));
  const digest = await sha256File(installer);
  assert.strictEqual(digest.length, 64);
  assert.strictEqual(pathInside(path.join(userData, 'update-staging'), installer), true);
  assert.strictEqual(pathInside(path.join(userData, 'update-staging'), path.join(temp, 'outside.exe')), false);

  const app = {
    isPackaged:true,
    getPath(name){ if(name!=='userData') throw new Error('unexpected path'); return userData; },
    getVersion(){ return '2.2.0'; }
  };
  const candidate = {
    version:'2.3.0',tag:'v2.3.0',kind:'installer',packagePath:installer,packageName:path.basename(installer),
    packageSha256:digest,packageSizeBytes:fs.statSync(installer).size,signedManifestVerified:true,tagSignatureVerified:true,
    manifestCommit:'1'.repeat(40),releaseCommit:'1'.repeat(40),verifiedAt:new Date().toISOString()
  };
  const manager = createUpdateTransactionManager({
    app,
    dialog:{async showMessageBox(){return {response:0};}},
    getCandidate:()=>candidate,
    getVerification:()=>({verified:true}),
    compareVersions:(a,b)=>a===b?0:1
  });
  const status = manager.getStatus();
  if (process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE) assert.strictEqual(status.capability.canInstall, true);
  else assert.strictEqual(status.capability.canInstall, false);

  const helper = helperScript();
  assert(helper.includes("-ArgumentList '/S'"));
  assert(helper.includes('Restore-Backup'));
  assert(helper.includes('healthMarkerPath'));
  assert(helper.includes('sourceAsarSha256'));
  assert(helper.includes('Installer package changed after verification.'));
  if (process.platform === 'win32') {
    const helperPath = path.join(temp, 'update-helper.ps1');
    fs.writeFileSync(helperPath, helper, 'utf8');
    const escaped = helperPath.replace(/'/g, "''");
    execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command', `$null=[scriptblock]::Create((Get-Content -LiteralPath '${escaped}' -Raw))`], { stdio:'pipe' });
  }

  fs.rmSync(temp, { recursive:true, force:true });
  console.log('Update transaction tests passed.');
})().catch(error => { console.error(error); process.exit(1); });
