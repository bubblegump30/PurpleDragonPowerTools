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

function readUint32(buffer, offset) {
  if (offset + 4 > buffer.length) throw new Error('Invalid SSH signature encoding.');
  return buffer.readUInt32BE(offset);
}

function readSshString(buffer, state) {
  const length = readUint32(buffer, state.offset);
  state.offset += 4;
  if (length < 0 || state.offset + length > buffer.length) throw new Error('Invalid SSH signature string length.');
  const value = buffer.subarray(state.offset, state.offset + length);
  state.offset += length;
  return value;
}

function encodeSshString(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(buffer.length, 0);
  return Buffer.concat([length, buffer]);
}

function parseArmoredSshSignature(value) {
  const text = String(value || '').trim();
  const match = text.match(/^-----BEGIN SSH SIGNATURE-----\s+([A-Za-z0-9+/=\s]+)\s+-----END SSH SIGNATURE-----$/);
  if (!match) throw new Error('Detached signature is not an armored OpenSSH SSHSIG signature.');
  const blob = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  if (blob.length < 10 || blob.subarray(0, 6).toString('ascii') !== 'SSHSIG') throw new Error('Detached signature SSHSIG preamble is invalid.');
  const state = { offset:6 };
  const version = readUint32(blob, state.offset);state.offset += 4;
  if (version !== 1) throw new Error('Unsupported SSHSIG version.');
  const publicKeyBlob = readSshString(blob, state);
  const namespace = readSshString(blob, state).toString('utf8');
  const reserved = readSshString(blob, state);
  const hashAlgorithm = readSshString(blob, state).toString('ascii');
  const signatureBlob = readSshString(blob, state);
  const keyState = { offset:0 };
  const keyType = readSshString(publicKeyBlob, keyState).toString('ascii');
  const keyBytes = readSshString(publicKeyBlob, keyState);
  const sigState = { offset:0 };
  const signatureAlgorithm = readSshString(signatureBlob, sigState).toString('ascii');
  const signatureBytes = readSshString(signatureBlob, sigState);
  return { version, publicKeyBlob, namespace, reserved, hashAlgorithm, keyType, keyBytes, signatureAlgorithm, signatureBytes };
}

function sshKeyFingerprint(publicKeyBlob) {
  return 'SHA256:' + crypto.createHash('sha256').update(publicKeyBlob).digest('base64').replace(/=+$/g, '');
}

function ed25519PublicKeyObject(rawKey) {
  if (!Buffer.isBuffer(rawKey) || rawKey.length !== 32) throw new Error('Expected a 32-byte Ed25519 public key.');
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  return crypto.createPublicKey({ key:Buffer.concat([prefix, rawKey]), format:'der', type:'spki' });
}

function verifyManifestSshSignature(signatureText, manifestBuffer, expectedPublicKeyBlob) {
  try {
    const parsed = parseArmoredSshSignature(signatureText);
    if (parsed.namespace !== 'file') return { available:true, verified:false, reason:'Manifest SSH signature namespace must be file.' };
    if (!['sha256','sha512'].includes(parsed.hashAlgorithm)) return { available:true, verified:false, reason:'Manifest SSH signature hash algorithm is unsupported.' };
    if (parsed.keyType !== 'ssh-ed25519' || parsed.signatureAlgorithm !== 'ssh-ed25519') return { available:true, verified:false, reason:'Manifest signature must use the Purple Dragon Ed25519 release key.' };
    if (expectedPublicKeyBlob && !crypto.timingSafeEqual(parsed.publicKeyBlob, expectedPublicKeyBlob)) return { available:true, verified:false, reason:'Manifest signature key does not match the GitHub-verified release tag key.', keyFingerprint:sshKeyFingerprint(parsed.publicKeyBlob) };
    const digest = crypto.createHash(parsed.hashAlgorithm).update(manifestBuffer).digest();
    const signedData = Buffer.concat([
      Buffer.from('SSHSIG', 'ascii'),
      encodeSshString(parsed.namespace),
      encodeSshString(parsed.reserved),
      encodeSshString(parsed.hashAlgorithm),
      encodeSshString(digest)
    ]);
    const verified = crypto.verify(null, signedData, ed25519PublicKeyObject(parsed.keyBytes), parsed.signatureBytes);
    return { available:true, verified, reason:verified?'Detached manifest signature is valid and matches the GitHub-verified release key.':'Detached manifest signature cryptographic verification failed.', keyFingerprint:sshKeyFingerprint(parsed.publicKeyBlob) };
  } catch (error) {
    return { available:true, verified:false, reason:String(error && error.message || error) };
  }
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
  if (type === 'signature') return assets.find(function(asset) { return /manifest.*\.(sig|minisig)$/i.test(String(asset.name || '')); }) || assets.find(function(asset) { return /(^|[-_.])(signature|signed)([-_.]|$)|\.(sig|minisig)$/i.test(String(asset.name || '')); }) || null;
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
  if (!manifest.signature || typeof manifest.signature !== 'object') errors.push('Manifest signature metadata is required for an official signed release.');
  else {
    if (manifest.signature.algorithm !== 'ssh-ed25519') errors.push('Manifest signature algorithm must be ssh-ed25519.');
    if (manifest.signature.file !== 'release-manifest.json.sig') errors.push('Manifest signature filename must be release-manifest.json.sig.');
    if (!String(manifest.signature.keyId || '').trim()) errors.push('Manifest signature keyId is required.');
  }
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
    let parsedSignature = null;
    try { if (verification.signature) parsedSignature = parseArmoredSshSignature(verification.signature); } catch {}
    return {
      checked:true,
      verified:verification.verified === true,
      reason:String(verification.reason || (verification.verified ? 'verified' : 'unverified')),
      verifiedAt:verification.verified_at || null,
      tagObjectSha:String(ref.object.sha || ''),
      keyFingerprint:parsedSignature ? sshKeyFingerprint(parsedSignature.publicKeyBlob) : null,
      publicKeyBlob:parsedSignature ? parsedSignature.publicKeyBlob : null
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
      let manifestBuffer = null;
      if (manifestAsset) {
        manifestFile = await downloadAsset(manifestAsset, stageDir, MAX_METADATA_BYTES, progress);
        manifestBuffer = fs.readFileSync(manifestFile.path);
        try { manifestResult = validateManifest(JSON.parse(manifestBuffer.toString('utf8')), release, packageAsset); }
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
      const tagSignatureInternal = await tagPromise;
      const manifestSignature = manifestBuffer && signatureFile ? verifyManifestSshSignature(fs.readFileSync(signatureFile.path, 'utf8'), manifestBuffer, tagSignatureInternal.publicKeyBlob) : { available:Boolean(signatureFile), verified:false, reason:signatureFile?'Manifest signature cannot be verified without a valid manifest.':'No detached manifest signature asset published.' };
      const tagSignature = { checked:tagSignatureInternal.checked, verified:tagSignatureInternal.verified, reason:tagSignatureInternal.reason, verifiedAt:tagSignatureInternal.verifiedAt || null, tagObjectSha:tagSignatureInternal.tagObjectSha || null, keyFingerprint:tagSignatureInternal.keyFingerprint || null };
      const manifestGate = !manifestResult.available || (manifestResult.valid === true && manifestSignature.verified === true);
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
        manifestSignature,
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
  normalizeSha256,
  parseArmoredSshSignature,
  verifyManifestSshSignature,
  sshKeyFingerprint
};
