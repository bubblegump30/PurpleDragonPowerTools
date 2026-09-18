'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const TRANSACTION_VERSION = 1;
const HEALTH_TIMEOUT_SECONDS = 90;

function safeTransactionId(value) {
  const id = String(value || '');
  return /^upd-[0-9a-z]{6,24}-[0-9a-f]{12}$/.test(id) ? id : null;
}

function pathInside(root, target) {
  try {
    const rel = path.relative(path.resolve(root), path.resolve(target));
    return rel !== '' && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel);
  } catch { return false; }
}

async function sha256File(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function atomicJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive:true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function powershellExecutable() {
  const root = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const candidate = path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return fs.existsSync(candidate) ? candidate : 'powershell.exe';
}

function publicTransaction(tx, result, capability) {
  return {
    capability,
    active:Boolean(tx),
    id:tx?.id || null,
    status:result?.status || tx?.status || null,
    sourceVersion:tx?.sourceVersion || null,
    targetVersion:tx?.targetVersion || null,
    packageName:tx?.packageName || null,
    createdAt:tx?.createdAt || null,
    installedAt:result?.installedAt || null,
    completedAt:result?.completedAt || null,
    rollbackAttempted:Boolean(result?.rollbackAttempted),
    rollbackSucceeded:Boolean(result?.rollbackSucceeded),
    backupRetained:tx ? tx.keepBackup !== false : false,
    detail:result?.detail || null
  };
}

function helperScript() {
  return String.raw`param(
  [Parameter(Mandatory=$true)][string]$TransactionPath,
  [Parameter(Mandatory=$true)][string]$ExpectedTransactionSha256
)

$ErrorActionPreference = 'Stop'

function Save-Result {
  param([string]$Status,[string]$Detail,[bool]$RollbackAttempted=$false,[bool]$RollbackSucceeded=$false)
  $payload = [ordered]@{
    status = $Status
    detail = $Detail
    rollbackAttempted = $RollbackAttempted
    rollbackSucceeded = $RollbackSucceeded
    completedAt = [DateTime]::UtcNow.ToString('o')
  }
  $tmp = "$($tx.resultPath).tmp"
  [System.IO.File]::WriteAllText($tmp, ($payload | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tmp -Destination $tx.resultPath -Force
}

function Wait-ForExit {
  param([int]$ProcessId,[int]$TimeoutSeconds)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Remove-InstallTree {
  param([string]$InstallDir)
  for ($i=0; $i -lt 12; $i++) {
    try {
      if (Test-Path -LiteralPath $InstallDir) { Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction Stop }
      return
    } catch { Start-Sleep -Milliseconds 750 }
  }
  throw "Unable to remove failed install directory during rollback: $InstallDir"
}

function Restore-Backup {
  if (-not (Test-Path -LiteralPath $tx.backupDir)) { throw 'Rollback backup is missing.' }
  if ($script:newProcessId) {
    Stop-Process -Id $script:newProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  Remove-InstallTree -InstallDir $tx.installDir
  New-Item -ItemType Directory -Path $tx.installDir -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $tx.backupDir '*') -Destination $tx.installDir -Recurse -Force
  if (-not (Test-Path -LiteralPath $tx.appExePath)) { throw 'Restored application executable is missing.' }
  $restoredHash = (Get-FileHash -LiteralPath $tx.appExePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($restoredHash -ne $tx.sourceExeSha256) { throw 'Restored application executable hash does not match the rollback snapshot.' }
}

$tx = $null
$script:newProcessId = $null
try {
  if (-not (Test-Path -LiteralPath $TransactionPath)) { throw 'Update transaction file is missing.' }
  $actualTxHash = (Get-FileHash -LiteralPath $TransactionPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualTxHash -ne $ExpectedTransactionSha256.ToLowerInvariant()) { throw 'Update transaction file changed after preparation.' }
  $tx = Get-Content -LiteralPath $TransactionPath -Raw | ConvertFrom-Json
  if ($tx.transactionVersion -ne 1) { throw 'Unsupported update transaction version.' }
  if (-not (Test-Path -LiteralPath $tx.packagePath)) { throw 'Verified installer package is missing.' }
  if (-not (Test-Path -LiteralPath $tx.backupDir)) { throw 'Rollback backup is missing.' }
  $packageHash = (Get-FileHash -LiteralPath $tx.packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($packageHash -ne $tx.packageSha256) { throw 'Installer package changed after verification.' }
  if (-not (Wait-ForExit -ProcessId ([int]$tx.sourcePid) -TimeoutSeconds 60)) { throw 'PowerTools did not exit before the update timeout.' }

  $installer = Start-Process -FilePath $tx.packagePath -ArgumentList '/S' -Wait -PassThru
  if ($installer.ExitCode -ne 0) { throw "Installer exited with code $($installer.ExitCode)." }
  if (-not (Test-Path -LiteralPath $tx.appExePath)) { throw 'Updated application executable was not found after installation.' }

  $launched = Start-Process -FilePath $tx.appExePath -ArgumentList "--post-update-transaction=$($tx.id)" -PassThru
  $script:newProcessId = $launched.Id
  $deadline = (Get-Date).AddSeconds($tx.healthTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $tx.healthMarkerPath) {
      $health = Get-Content -LiteralPath $tx.healthMarkerPath -Raw | ConvertFrom-Json
      if ($health.ok -eq $true -and $health.version -eq $tx.targetVersion -and $health.transactionId -eq $tx.id) {
        if ($tx.keepBackup -ne $true) { Remove-Item -LiteralPath (Split-Path -Parent $tx.backupDir) -Recurse -Force -ErrorAction SilentlyContinue }
        Save-Result -Status 'succeeded' -Detail "Updated to v$($tx.targetVersion); post-update health check passed."
        exit 0
      }
    }
    if (-not (Get-Process -Id $script:newProcessId -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
  }
  throw 'Updated PowerTools did not pass the post-update health check before timeout.'
} catch {
  $reason = [string]$_.Exception.Message
  if ($null -eq $tx) { exit 20 }
  try {
    Restore-Backup
    $old = Start-Process -FilePath $tx.appExePath -ArgumentList "--rollback-recovered=$($tx.id)" -PassThru
    Save-Result -Status 'rolled-back' -Detail ("Update failed and the previous application files were restored. Reason: " + $reason) -RollbackAttempted $true -RollbackSucceeded $true
    exit 30
  } catch {
    $rollbackError = [string]$_.Exception.Message
    Save-Result -Status 'rollback-failed' -Detail ("Update failed: " + $reason + " Rollback also failed: " + $rollbackError) -RollbackAttempted $true -RollbackSucceeded $false
    exit 31
  }
}`;
}

function createUpdateTransactionManager(options) {
  const app = options.app;
  const dialog = options.dialog;
  const addActivity = options.addActivity || function() {};
  const logDiagnostic = options.logDiagnostic || function() {};
  const progress = options.progress || function() {};
  const getCandidate = options.getCandidate || function() { return null; };
  const getVerification = options.getVerification || function() { return null; };
  const compareVersions = options.compareVersions || function() { return 0; };

  function roots() {
    const userData = app.getPath('userData');
    return {
      userData,
      staging:path.join(userData, 'update-staging'),
      transactions:path.join(userData, 'update-transactions'),
      backups:path.join(userData, 'update-backups')
    };
  }

  function capability() {
    const candidate = getCandidate();
    const verification = getVerification();
    if (process.platform !== 'win32') return { canInstall:false, reason:'Transactional install is Windows-only.' };
    if (!app.isPackaged) return { canInstall:false, reason:'Transactional install is disabled for source/development builds.' };
    if (process.env.PORTABLE_EXECUTABLE_FILE) return { canInstall:false, reason:'Transactional install is disabled while running the Portable build.' };
    if (!candidate || !verification?.verified) return { canInstall:false, reason:'Stage and verify an official Setup package first.' };
    if (candidate.kind !== 'installer') return { canInstall:false, reason:'Transactional install requires the verified Setup installer.' };
    if (compareVersions(candidate.version, app.getVersion()) <= 0) return { canInstall:false, reason:'The verified package is not newer than the running version.' };
    if (!candidate.tagSignatureVerified || !candidate.signedManifestVerified) return { canInstall:false, reason:'A GitHub-Verified release tag and signed manifest are required for installation.' };
    const r = roots();
    if (!pathInside(r.staging, candidate.packagePath)) return { canInstall:false, reason:'Verified installer is outside the protected staging directory.' };
    return { canInstall:true, reason:'Verified Setup package is eligible for transactional installation.' };
  }

  function transactionDirectories(id) {
    const r = roots();
    const transactionDir = path.join(r.transactions, id);
    const backupRoot = path.join(r.backups, id);
    return {
      ...r, transactionDir, backupRoot, backupDir:path.join(backupRoot, 'app'),
      transactionPath:path.join(transactionDir, 'transaction.json'),
      helperPath:path.join(transactionDir, 'update-helper.ps1'),
      healthMarkerPath:path.join(transactionDir, 'health-ok.json'),
      resultPath:path.join(transactionDir, 'result.json')
    };
  }

  function findLatestTransaction() {
    try {
      const dir = roots().transactions;
      if (!fs.existsSync(dir)) return { tx:null, result:null };
      const entries = fs.readdirSync(dir, { withFileTypes:true }).filter(x => x.isDirectory() && safeTransactionId(x.name));
      const rows = entries.map(entry => {
        try {
          const txPath = path.join(dir, entry.name, 'transaction.json');
          const stat = fs.statSync(txPath);
          return { id:entry.name, txPath, mtimeMs:stat.mtimeMs };
        } catch { return null; }
      }).filter(Boolean).sort((a,b) => b.mtimeMs - a.mtimeMs);
      if (!rows.length) return { tx:null, result:null };
      const tx = JSON.parse(fs.readFileSync(rows[0].txPath, 'utf8'));
      const resultPath = path.join(path.dirname(rows[0].txPath), 'result.json');
      let result = null;
      try { if (fs.existsSync(resultPath)) result = JSON.parse(fs.readFileSync(resultPath, 'utf8')); } catch {}
      return { tx, result };
    } catch (error) { logDiagnostic('update transaction status', error); return { tx:null, result:null }; }
  }

  function getStatus() {
    const latest = findLatestTransaction();
    return publicTransaction(latest.tx, latest.result, capability());
  }

  async function verifyBackup(sourceExe, sourceAsar, backupDir, exeName) {
    const sourceExeSha256 = await sha256File(sourceExe);
    const backupExe = path.join(backupDir, exeName);
    if (!fs.existsSync(backupExe)) throw new Error('Rollback backup is missing the application executable.');
    const backupExeSha256 = await sha256File(backupExe);
    if (sourceExeSha256 !== backupExeSha256) throw new Error('Rollback backup executable hash mismatch.');
    let sourceAsarSha256 = null;
    if (sourceAsar && fs.existsSync(sourceAsar)) {
      const relative = path.relative(path.dirname(sourceExe), sourceAsar);
      const backupAsar = path.join(backupDir, relative);
      if (!fs.existsSync(backupAsar)) throw new Error('Rollback backup is missing app.asar.');
      sourceAsarSha256 = await sha256File(sourceAsar);
      const backupAsarSha256 = await sha256File(backupAsar);
      if (sourceAsarSha256 !== backupAsarSha256) throw new Error('Rollback backup app.asar hash mismatch.');
    }
    return { sourceExeSha256, sourceAsarSha256 };
  }

  async function prepareAndInstall(settings) {
    const cap = capability();
    if (!cap.canInstall) return { ok:false, error:cap.reason, transaction:getStatus() };
    const candidate = getCandidate();
    const verification = getVerification();
    const r = roots();
    if (!candidate || !pathInside(r.staging, candidate.packagePath) || !fs.existsSync(candidate.packagePath)) return { ok:false, error:'Verified installer is no longer available in staging.' };
    const freshHash = await sha256File(candidate.packagePath);
    if (freshHash !== candidate.packageSha256) return { ok:false, error:'Verified installer changed after staging. Re-run verification.' };

    const choice = await dialog.showMessageBox({
      type:'warning',
      buttons:['Cancel','Install Verified Update'],
      defaultId:0,
      cancelId:0,
      noLink:true,
      title:'Install verified Purple Dragon update?',
      message:`Install Purple Dragon PowerTools v${candidate.version}?`,
      detail:'PowerTools will create a rollback snapshot of the current installed application, close itself, run the verified Setup installer, then require the new version to pass a post-update health check. If the health check fails, the helper will restore the previous application files automatically. User data is preserved.'
    });
    if (choice.response !== 1) return { ok:false, canceled:true, transaction:getStatus() };

    const id = 'upd-' + Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');
    const d = transactionDirectories(id);
    const installDir = path.dirname(process.execPath);
    const appExePath = process.execPath;
    const exeName = path.basename(appExePath);
    const sourceAsar = path.join(installDir, 'resources', 'app.asar');
    if (!fs.existsSync(appExePath)) return { ok:false, error:'Installed application executable cannot be read for rollback.' };

    try {
      progress({ phase:'backup', asset:'Current Purple Dragon PowerTools installation', downloadedBytes:0, totalBytes:null });
      fs.mkdirSync(d.transactionDir, { recursive:true });
      fs.mkdirSync(d.backupRoot, { recursive:true });
      await fs.promises.cp(installDir, d.backupDir, { recursive:true, errorOnExist:true, force:false, verbatimSymlinks:true });
      const backupHashes = await verifyBackup(appExePath, sourceAsar, d.backupDir, exeName);
      const tx = {
        transactionVersion:TRANSACTION_VERSION,
        id,
        status:'prepared',
        sourcePid:process.pid,
        sourceVersion:app.getVersion(),
        targetVersion:candidate.version,
        packageName:candidate.packageName,
        packagePath:candidate.packagePath,
        packageSha256:candidate.packageSha256,
        packageSizeBytes:candidate.packageSizeBytes,
        installDir,
        appExePath,
        exeName,
        backupDir:d.backupDir,
        healthMarkerPath:d.healthMarkerPath,
        resultPath:d.resultPath,
        sourceExeSha256:backupHashes.sourceExeSha256,
        sourceAsarSha256:backupHashes.sourceAsarSha256,
        keepBackup:settings?.keepRollbackPackage !== false,
        healthTimeoutSeconds:HEALTH_TIMEOUT_SECONDS,
        releaseTag:candidate.tag,
        releaseCommit:candidate.releaseCommit,
        manifestCommit:candidate.manifestCommit,
        verifiedAt:candidate.verifiedAt,
        createdAt:new Date().toISOString()
      };
      atomicJson(d.transactionPath, tx);
      fs.writeFileSync(d.helperPath, helperScript(), 'utf8');
      const txHash = await sha256File(d.transactionPath);
      const child = spawn(powershellExecutable(), ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',d.helperPath,'-TransactionPath',d.transactionPath,'-ExpectedTransactionSha256',txHash], { detached:true, stdio:'ignore', windowsHide:true });
      child.unref();
      addActivity('Verified update installation prepared', `v${candidate.version} · rollback snapshot created`);
      progress({ phase:'install-prepared', asset:candidate.packageName, verified:true });
      return { ok:true, quitRequested:true, transaction:publicTransaction(tx, null, capability()), verification:{ verified:Boolean(verification?.verified), packageName:candidate.packageName, targetVersion:candidate.version } };
    } catch (error) {
      logDiagnostic('update transaction prepare', error);
      try { fs.rmSync(d.transactionDir, { recursive:true, force:true }); } catch {}
      try { fs.rmSync(d.backupRoot, { recursive:true, force:true }); } catch {}
      return { ok:false, error:String(error?.message || error), transaction:getStatus() };
    }
  }

  function launchArgument(prefix) {
    const match = process.argv.map(String).find(arg => arg.startsWith(prefix + '='));
    return match ? safeTransactionId(match.slice(prefix.length + 1)) : null;
  }

  function markPostUpdateHealthy() {
    const id = launchArgument('--post-update-transaction');
    if (!id) return { ok:false, skipped:true };
    try {
      const d = transactionDirectories(id);
      if (!fs.existsSync(d.transactionPath)) return { ok:false, error:'Update transaction record is missing.' };
      const tx = JSON.parse(fs.readFileSync(d.transactionPath, 'utf8'));
      const coreFiles = ['resources/app.asar'].map(rel => path.join(tx.installDir, rel));
      let userDataWritable = false;
      try { fs.accessSync(app.getPath('userData'), fs.constants.W_OK); userDataWritable = true; } catch {}
      const ok = app.getVersion() === tx.targetVersion && coreFiles.every(fs.existsSync) && userDataWritable;
      if (!ok) return { ok:false, error:'Post-update health requirements are not satisfied.' };
      atomicJson(d.healthMarkerPath, { ok:true, transactionId:id, version:app.getVersion(), rendererReady:true, userDataWritable, checkedAt:new Date().toISOString() });
      addActivity('Post-update health check passed', `v${app.getVersion()} · transaction ${id}`);
      return { ok:true };
    } catch (error) { logDiagnostic('post-update health marker', error); return { ok:false, error:String(error?.message || error) }; }
  }

  function noteRendererReady() {
    const id = launchArgument('--post-update-transaction');
    if (!id) return;
    setTimeout(() => markPostUpdateHealthy(), 5000);
  }

  function noteLaunchRecovery() {
    const rollbackId = launchArgument('--rollback-recovered');
    if (rollbackId) addActivity('Automatic update rollback completed', `Previous PowerTools application restored · ${rollbackId}`);
  }

  return { getStatus, prepareAndInstall, noteRendererReady, noteLaunchRecovery, markPostUpdateHealthy };
}

module.exports = {
  createUpdateTransactionManager,
  safeTransactionId,
  pathInside,
  sha256File,
  helperScript
};
