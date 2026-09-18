'use strict';

const assert = require('assert');
const { compareVersions } = require('../src/update-release');
const { parseChecksums, validateManifest, selectPackageAsset, normalizeSha256 } = require('../src/update-verification');

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
  assets:[{name:packageAsset.name,sha256:'a'.repeat(64),sizeBytes:100,kind:'installer'}]
};
const valid = validateManifest(manifest,release,packageAsset);
assert.strictEqual(valid.valid,true);
const invalid = validateManifest({...manifest,repository:'example/not-official'},release,packageAsset);
assert.strictEqual(invalid.valid,false);

console.log('Update/release verification tests passed.');
