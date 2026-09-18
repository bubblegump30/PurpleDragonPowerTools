'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const OFFICIAL_REPOSITORY = 'bubblegump30/PurpleDragonPowerTools';
const GITHUB_API_ROOT = 'https://api.github.com/repos/' + OFFICIAL_REPOSITORY;
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const MAX_METADATA_BYTES = 2 * 1024 * 1024;

function safeFilename(value) {
  const name = String(value || '');
  if (!name || name !== path.basename(name) || name.includes('\0') || /[\\/:*?"<>|]/.test(name)) throw new Error('Release asset has an unsafe filename.');
  return name;
}

function normalizeSha256(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/^sha256:/, '');
  return /^[0-9a-f]{64}$/.test(raw) ? raw : null;
}

function parseChecksums(text) {
  const out = new Map();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9a-fA-F]{64})\s+[*]?(.+)$/);
    if (!match) continue;
    const name = path.basename(match[2].trim());
    out.set(name.toLowerCase(), match[1].toLowerCase());
  }
  return out;
}

function packageKind(assetName) {
  const name = String(assetName || '');
  if (/setup.*\.exe$/i.test(name)) return 'installer';
  if (/portable.*\.exe$/i.test(name)) return 'portable';
  return null;
}

function selectPackageAsset(release, requestedKind, arch) {
  const kind = requestedKind === 'portable' ? 'portable' : 'installer';
  const architecture = arch === 'arm64' ? 'arm64' : arch === 'ia32' ? 'ia32' : 'x64';
  const assets = Array.isArray(release && release.assets) ? release.assets : [];
  const candidates = assets.filter(function(asset) {
    return packageKind(asset && asset.name) === kind && /\.exe$/i.test(String(asset && asset.name || ''));
  });
  const exact = candidates.find(function(asset) { return new RegExp('(?:-|_)' + architecture + '\\.exe$', 'i').test(asset.name); });
  return exact || (architecture === 'x64' ? candidates.find(function(asset) { return !/(?:-|_)(arm64|ia32)\.exe$/i.test(asset.name); }) : null) || null;
}

function findMetadataAsset(release, type) {
  const assets = Array.isArray(release && release.assets) ? release.assets : [];
  if (type === 'checksums') return assets.find(function(asset) { return /sha[-_ ]?256|checksums?/i.test(String(asset.name || '')); }) || null;
  if (type === 'manifest') return assets.find(function(asset) { return /manifest[^/]*\.json$/i.test(String(asset.name || '')); }) || null;
  if (type === 'signature') return assets.find(function(asset) { return /(^|[-_.])(signature|signed)([-_.]|$)|\.(sig|minisig)$/i.test(String(asset.name || '')); }) || null;
  return null;
}

function validateManifest(manifest, release, packageAsset) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { available: true, valid: false, errors: ['Manifest root must be an object.'], asset: null };
  if (manifest.schemaVersion !== 1) errors.push('Unsupported manifest schemaVersion.');
  if (manifest.product !== 'Purple Dragon PowerTools') errors.push('Manifest product does not match Purple Dragon PowerTools.');
  if (manifest.repository !== OFFICIAL_REPOSITORY) errors.push('Manifest repository does not match the official repository.');
  if (String(manifest.version || '') !== String(release.version || '')) errors.push('Manifest version does not match the GitHub release tag.');
  if (!['stable','preview'].includes(String(manifest.channel || ''))) errors.push('Manifest channel is invalid.');
  if (!/^[0-9a-f]{40}$/i.test(String(manifest.commit || ''))) errors.push('Manifest commit must be a 40-character Git SHA.');
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const item = assets.find(function(entry) { return entry && entry.name === packageAsset.name; }) || null;
  if (!item) errors.push('Manifest does not contain the selected package.');
  const sha256 = normalizeSha256(item && item.sha256);
  if (item && !sha256) errors.push('Manifest package SHA-256 is invalid.');
  if (item && (!Number.isInteger(item.sizeBytes) || item.sizeBytes <= 0)) errors.push('Manifest package size is invalid.');
  if (item && Number(packageAsset.sizeBytes || 0) > 0 && item.sizeBytes !== Number(packageAsset.sizeBytes)) errors.push('Manifest package size does not match GitHub release metadata.');
  return { available: true, valid: errors.length === 0, errors, asset: item ? { name:item.name, sha256, sizeBytes:item.sizeBytes, kind:item.kind || null } : null };
}

function allowedDownloadUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return false;
    if (url.hostname === 'github.com') return url.pathname.startsWith('/' + OFFICIAL_REPOSITORY + '/releases/download/');
    return url.hostname === 'release-assets.githubusercontent.com' || url.hostname === 'objects.githubusercontent.com' || url.hostname.endsWith('.githubusercontent.com');
  } catch { return false; }
}

async function githubJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, Math.max(3000, Number(timeoutMs) || 15000));
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept':'application/vnd.github+json', 'User-Agent':'PurpleDragonPowerTools/2.2.0', 'X-GitHub-Api-Version':'2022-11-28' },
      redirect: 'error',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('GitHub verification request failed with HTTP ' + response.status + '.');
    return await response.json();
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('GitHub verification request timed out.');
    throw error;
  } finally { clearTimeout(timer); }
}

async function verifySignedTag(tag) {
  const tagName = String(tag || '');
  if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tagName)) return { checked:true, verified:false, reason:'Invalid release tag.' };
  try {
    const ref = await githubJson(GITHUB_API_ROOT + '/git/ref/tags/' + encodeURIComponent(tagName), 15000);
    if (!ref || !ref.object || ref.object.type !== 'tag' || !/^[0-9a-f]{40}$/i.test(String(ref.object.sha || ''))) {
      return { checked:true, verified:false, reason:'Release tag is not a signed annotated tag object.' };
    }
    const object = await githubJson(GITHUB_API_ROOT + '/git/tags/' + ref.object.sha, 15000);
    const verification = object && object.verification || {};
    return {
      checked:true,
      verified:verification.verified === true,
      reason:String(verification.reason || (verification.verified ? 'verified' : 'unverified')),
      verifiedAt:verification.verified_at || null,
      tagObjectSha:String(ref.object.sha || '')
    };
  } catch (error) {
    return { checked:true, verified:false, reason:String(error && error.message || error) };
  }
}

function ensureStageDirectory(app, releaseVersion) {
  const safeVersion = String(releaseVersion || '').replace(/[^0-9A-Za-z.-]/g, '_');
  if (!safeVersion) throw new Error('Release version is unavailable.');
  const root = path.join(app.getPath('userData'), 'update-staging');
  const dir = path.join(root, safeVersion);
  fs.mkdirSync(root, { recursive:true });
  fs.rmSync(dir, { recursive:true, force:true });
  fs.mkdirSync(dir, { recursive:true });
  return dir;
}

async function downloadAsset(asset, stageDir, maxBytes, progress) {
  const name = safeFilename(asset && asset.name);
  const sourceUrl = String(asset && asset.downloadUrl || '');
  if (!allowedDownloadUrl(sourceUrl)) throw new Error('Release asset download URL is not allowlisted.');
  const expectedSize = Number(asset && asset.sizeBytes) || 0;
  if (expectedSize > maxBytes) throw new Error(name + ' exceeds the allowed download size.');
  const finalPath = path.join(stageDir, name);
  const tempPath = finalPath + '.part';
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 5 * 60 * 1000);
  let downloaded = 0;
  let lastProgressAt = 0;
  const hash = crypto.createHash('sha256');
  try {
    const response = await fetch(sourceUrl, {
      method:'GET',
      headers:{ 'Accept':'application/octet-stream', 'User-Agent':'PurpleDragonPowerTools/2.2.0' },
      redirect:'follow',
      signal:controller.signal
    });
    if (!response.ok) throw new Error('Download failed with HTTP ' + response.status + ' for ' + name + '.');
    if (!allowedDownloadUrl(response.url)) throw new Error('Release download redirected to a non-GitHub host.');
    if (!response.body) throw new Error('Release asset response has no body.');
    const meter = new Transform({
      transform:function(chunk, _encoding, callback) {
        downloaded += chunk.length;
        if (downloaded > maxBytes) return callback(new Error(name + ' exceeded the allowed download size.'));
        hash.update(chunk);
        const now = Date.now();
        if (typeof progress === 'function' && (now - lastProgressAt > 160 || downloaded === expectedSize)) {
          lastProgressAt = now;
          try { progress({ phase:'download', asset:name, downloadedBytes:downloaded, totalBytes:expectedSize || null }); } catch {}
        }
        callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(tempPath, { flags:'w' }));
    if (expectedSize && downloaded !== expectedSize) throw new Error(name + ' size does not match GitHub release metadata.');
    fs.renameSync(tempPath, finalPath);
    return { name, path:finalPath, sizeBytes:downloaded, sha256:hash.digest('hex') };
  } catch (error) {
    try { fs.rmSync(tempPath, { force:true }); } catch {}
    throw error && error.name === 'AbortError' ? new Error('Download timed out for ' + name + '.') : error;
  } finally { clearTimeout(timer); }
}

function expectedHashesForPackage(packageAsset, checksumMap, manifestResult) {
  const sources = [];
  const githubDigest = normalizeSha256(packageAsset && packageAsset.digest);
  if (githubDigest) sources.push({ source:'GitHub asset digest', sha256:githubDigest });
  const checksum = checksumMap && checksumMap.get(String(packageAsset.name || '').toLowerCase());
  if (checksum) sources.push({ source:'SHA256SUMS', sha256:checksum });
  if (manifestResult && manifestResult.valid && manifestResult.asset && manifestResult.asset.sha256) sources.push({ source:'Release manifest', sha256:manifestResult.asset.sha256 });
  return sources;
}

function createUpdateVerificationEngine(options) {
  const app = options.app;
  const logDiagnostic = options.logDiagnostic || function() {};
  const addActivity = options.addActivity || function() {};
  const progress = options.progress || function() {};
  let lastVerification = null;

  async function stageAndVerify(input) {
    const release = input && input.release;
    const settings = input && input.settings || {};
    const requestedKind = input && input.packageKind === 'portable' ? 'portable' : 'installer';
    if (!release || !release.tag || !release.version) return { ok:false, error:'No official release is available to verify.' };
    const packageAsset = selectPackageAsset(release, requestedKind, process.arch);
    if (!packageAsset) return { ok:false, error:'The selected Windows ' + requestedKind + ' package is not available for ' + process.arch + '.' };
    const stageDir = ensureStageDirectory(app, release.version);
    const checksumAsset = findMetadataAsset(release, 'checksums');
    const manifestAsset = findMetadataAsset(release, 'manifest');
    const signatureAsset = findMetadataAsset(release, 'signature');
    try {
      progress({ phase:'prepare', asset:packageAsset.name, downloadedBytes:0, totalBytes:Number(packageAsset.sizeBytes) || null });
      const tagPromise = verifySignedTag(release.tag);
      let checksumMap = new Map();
      let checksumFile = null;
      if (checksumAsset) {
        checksumFile = await downloadAsset(checksumAsset, stageDir, MAX_METADATA_BYTES, progress);
        checksumMap = parseChecksums(fs.readFileSync(checksumFile.path, 'utf8'));
      }
      let manifestResult = { available:false, valid:null, errors:[], asset:null };
      let manifestFile = null;
      if (manifestAsset) {
        manifestFile = await downloadAsset(manifestAsset, stageDir, MAX_METADATA_BYTES, progress);
        try { manifestResult = validateManifest(JSON.parse(fs.readFileSync(manifestFile.path, 'utf8')), release, packageAsset); }
        catch (error) { manifestResult = { available:true, valid:false, errors:['Manifest JSON could not be parsed: ' + String(error && error.message || error)], asset:null }; }
      }
      let signatureFile = null;
      if (signatureAsset) signatureFile = await downloadAsset(signatureAsset, stageDir, MAX_METADATA_BYTES, progress);
      const expectedHashes = expectedHashesForPackage(packageAsset, checksumMap, manifestResult);
      const distinctHashes = Array.from(new Set(expectedHashes.map(function(item) { return item.sha256; })));
      if (distinctHashes.length > 1) throw new Error('Release metadata disagrees about the selected package SHA-256.');
      if (settings.verifySha256 !== false && distinctHashes.length === 0) throw new Error('No trusted SHA-256 value is available for the selected package.');
      const packageFile = await downloadAsset(packageAsset, stageDir, MAX_PACKAGE_BYTES, progress);
      const shaVerified = distinctHashes.length > 0 && distinctHashes.every(function(hash) { return hash === packageFile.sha256; });
      const tagSignature = await tagPromise;
      const manifestGate = !manifestResult.available || manifestResult.valid === true;
      const shaGate = settings.verifySha256 === false || shaVerified;
      const signatureGate = settings.requireReleaseSignature === false || tagSignature.verified === true;
      const verificationPassed = Boolean(shaGate && signatureGate && manifestGate);
      const isUpdate = typeof input.compareVersions === 'function' ? input.compareVersions(release.version, app.getVersion()) > 0 : true;
      lastVerification = {
        ok:true,
        verified:verificationPassed,
        installUnlocked:false,
        installImplemented:false,
        isUpdate,
        version:release.version,
        tag:release.tag,
        package:{ kind:requestedKind, name:packageFile.name, sizeBytes:packageFile.sizeBytes, sha256:packageFile.sha256 },
        sha256:{ required:settings.verifySha256 !== false, verified:shaVerified, expected:distinctHashes[0] || null, sources:expectedHashes },
        tagSignature,
        manifest:manifestResult,
        manifestSignature:{ available:Boolean(signatureFile), verified:false, reason:signatureFile ? 'Detached manifest signature staged; pinned-key verification is not enabled yet.' : 'No detached manifest signature asset published.' },
        metadata:{ checksums:checksumFile ? checksumFile.name : null, manifest:manifestFile ? manifestFile.name : null, signature:signatureFile ? signatureFile.name : null },
        stage:{ label:'update-staging/' + release.version, retained:true },
        checkedAt:new Date().toISOString(),
        safety:'Package is staged only. Installation and execution remain locked.'
      };
      addActivity('Release package verified', 'v' + release.version + ' · ' + packageFile.name + ' · ' + (verificationPassed ? 'verification passed' : 'verification needs review'));
      progress({ phase:'complete', asset:packageFile.name, downloadedBytes:packageFile.sizeBytes, totalBytes:packageFile.sizeBytes, verified:verificationPassed });
      return lastVerification;
    } catch (error) {
      logDiagnostic('update release stage/verify', error);
      lastVerification = { ok:false, verified:false, installUnlocked:false, installImplemented:false, version:release.version, tag:release.tag, error:String(error && error.message || error), checkedAt:new Date().toISOString(), safety:'Installation remains locked.' };
      progress({ phase:'error', asset:packageAsset.name, error:lastVerification.error });
      return lastVerification;
    }
  }

  function clearStaging() {
    try {
      const root = path.join(app.getPath('userData'), 'update-staging');
      fs.rmSync(root, { recursive:true, force:true });
      lastVerification = null;
      addActivity('Update staging cleared', 'Downloaded update verification files removed');
      return { ok:true };
    } catch (error) { return { ok:false, error:String(error && error.message || error) }; }
  }

  return { stageAndVerify, getLastVerification:function() { return lastVerification; }, clearStaging };
}

module.exports = {
  createUpdateVerificationEngine,
  parseChecksums,
  validateManifest,
  selectPackageAsset,
  verifySignedTag,
  normalizeSha256
};
