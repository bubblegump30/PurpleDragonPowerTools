'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { compareVersions } = require('../src/update-release');
const { parseChecksums, validateManifest, selectPackageAsset, normalizeSha256, verifyManifestSshSignature } = require('../src/update-verification');

assert(compareVersions('2.2.0','2.1.0') > 0);
assert(compareVersions('2.2.0','2.2.0-rc.1') > 0);
assert(compareVersions('2.2.0-rc.2','2.2.0-rc.10') < 0);
assert(compareVersions('2.2.0-rc.10','2.2.0-rc.2') > 0);

const sums = parseChecksums('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  Setup.exe\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB *Portable.exe\n');
assert.strictEqual(sums.get('setup.exe'),'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
assert.strictEqual(sums.get('portable.exe'),'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
assert.strictEqual(normalizeSha256('sha256:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'),'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');

const release = {
  version:'2.2.0',
  assets:[
    {name:'Purple-Dragon-PowerTools-Setup-2.2.0-x64.exe',sizeBytes:100,digest:'sha256:' + 'a'.repeat(64)},
    {name:'Purple-Dragon-PowerTools-Portable-2.2.0-x64.exe',sizeBytes:90,digest:'sha256:' + 'b'.repeat(64)}
  ]
};
assert.strictEqual(selectPackageAsset(release,'installer','x64').name,'Purple-Dragon-PowerTools-Setup-2.2.0-x64.exe');
assert.strictEqual(selectPackageAsset(release,'portable','x64').name,'Purple-Dragon-PowerTools-Portable-2.2.0-x64.exe');

const packageAsset = release.assets[0];
const manifest = {
  schemaVersion:1,
  product:'Purple Dragon PowerTools',
  version:'2.2.0',
  channel:'stable',
  repository:'bubblegump30/PurpleDragonPowerTools',
  commit:'1'.repeat(40),
  assets:[{name:packageAsset.name,sha256:'a'.repeat(64),sizeBytes:100,kind:'installer'}],
  signature:{algorithm:'ssh-ed25519',keyId:'test-release-key',file:'release-manifest.json.sig'}
};
const valid = validateManifest(manifest,release,packageAsset);
assert.strictEqual(valid.valid,true);
const invalid = validateManifest({...manifest,repository:'example/not-official'},release,packageAsset);
assert.strictEqual(invalid.valid,false);

function sshString(value){const b=Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8');const n=Buffer.alloc(4);n.writeUInt32BE(b.length,0);return Buffer.concat([n,b]);}
function makeSshsig(message){
  const pair=crypto.generateKeyPairSync('ed25519');
  const spki=pair.publicKey.export({format:'der',type:'spki'});
  const raw=spki.subarray(spki.length-32);
  const publicKeyBlob=Buffer.concat([sshString('ssh-ed25519'),sshString(raw)]);
  const namespace='file',reserved=Buffer.alloc(0),hashAlgorithm='sha512';
  const digest=crypto.createHash(hashAlgorithm).update(message).digest();
  const signedData=Buffer.concat([Buffer.from('SSHSIG','ascii'),sshString(namespace),sshString(reserved),sshString(hashAlgorithm),sshString(digest)]);
  const signature=crypto.sign(null,signedData,pair.privateKey);
  const signatureBlob=Buffer.concat([sshString('ssh-ed25519'),sshString(signature)]);
  const version=Buffer.alloc(4);version.writeUInt32BE(1,0);
  const blob=Buffer.concat([Buffer.from('SSHSIG','ascii'),version,sshString(publicKeyBlob),sshString(namespace),sshString(reserved),sshString(hashAlgorithm),sshString(signatureBlob)]);
  const base64=blob.toString('base64').match(/.{1,76}/g).join('\n');
  return {publicKeyBlob,armored:'-----BEGIN SSH SIGNATURE-----\n'+base64+'\n-----END SSH SIGNATURE-----\n'};
}
const signedManifest=Buffer.from(JSON.stringify(manifest));
const signed=makeSshsig(signedManifest);
const sigResult=verifyManifestSshSignature(signed.armored,signedManifest,signed.publicKeyBlob);
assert.strictEqual(sigResult.verified,true);
const other=makeSshsig(signedManifest);
const mismatch=verifyManifestSshSignature(signed.armored,signedManifest,other.publicKeyBlob);
assert.strictEqual(mismatch.verified,false);
const tampered=verifyManifestSshSignature(signed.armored,Buffer.from('tampered'),signed.publicKeyBlob);
assert.strictEqual(tampered.verified,false);

console.log('Update/release verification tests passed.');
