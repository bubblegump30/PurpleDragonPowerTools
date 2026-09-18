'use strict';

const fs = require('fs');
const path = require('path');

const OFFICIAL_REPOSITORY = 'bubblegump30/PurpleDragonPowerTools';
const RELEASES_API = `https://api.github.com/repos/${OFFICIAL_REPOSITORY}/releases?per_page=20`;
const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 1,
  channel: 'stable',
  checkPolicy: 'daily',
  autoDownload: false,
  autoInstall: false,
  verifySha256: true,
  requireReleaseSignature: true,
  keepRollbackPackage: true,
  showNotifications: true,
  lastCheckAt: null,
  lastKnownVersion: null,
  lastKnownReleaseUrl: null,
  lastKnownPublishedAt: null,
  lastKnownTrust: null
});
const CHECK_INTERVALS = Object.freeze({
  manual: Infinity,
  startup: 0,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
});

function parseVersion(value) {
  const raw = String(value || '').trim().replace(/^v/i, '');
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    raw,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || ''
  };
}

function compareVersions(aValue, bValue) {
  const a = parseVersion(aValue);
  const b = parseVersion(bValue);
  if (!a || !b) return String(aValue || '').localeCompare(String(bValue || ''));
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true, sensitivity: 'base' });
}

function publicRelease(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const assetNames = assets.map(asset => String(asset?.name || '')).filter(Boolean);
  const manifest = assetNames.find(name => /(^|[-_.])manifest([-_.]|$).*\.json$/i.test(name)) || null;
  const checksum = assetNames.find(name => /sha[-_ ]?256|checksums?/i.test(name)) || null;
  const signature = assetNames.find(name => /(^|[-_.])(signature|signed)([-_.]|$)|\.(sig|minisig)$/i.test(name)) || null;
  return {
    id: Number(release?.id) || null,
    tag: String(release?.tag_name || ''),
    version: String(release?.tag_name || '').replace(/^v/i, ''),
    name: String(release?.name || release?.tag_name || 'Release'),
    prerelease: Boolean(release?.prerelease),
    draft: Boolean(release?.draft),
    publishedAt: release?.published_at || release?.created_at || null,
    url: String(release?.html_url || ''),
    body: String(release?.body || '').slice(0, 12000),
    assets: assetNames.map(name => ({ name })),
    trust: {
      manifestAvailable: Boolean(manifest),
      checksumAvailable: Boolean(checksum),
      signatureAvailable: Boolean(signature),
      manifest,
      checksum,
      signature
    }
  };
}

function createUpdateReleaseCenter({ app, shell, logDiagnostic = () => {}, addActivity = () => {} }) {
  let cache = null;
  let pending = null;

  function settingsPath() {
    return path.join(app.getPath('userData'), 'update-release-settings.json');
  }

  function sanitizeSettings(input = {}) {
    const channel = input.channel === 'preview' ? 'preview' : 'stable';
    const checkPolicy = Object.prototype.hasOwnProperty.call(CHECK_INTERVALS, input.checkPolicy) ? input.checkPolicy : DEFAULT_SETTINGS.checkPolicy;
    return {
      ...DEFAULT_SETTINGS,
      ...input,
      schemaVersion: 1,
      channel,
      checkPolicy,
      autoDownload: false,
      autoInstall: false,
      verifySha256: input.verifySha256 !== false,
      requireReleaseSignature: input.requireReleaseSignature !== false,
      keepRollbackPackage: input.keepRollbackPackage !== false,
      showNotifications: input.showNotifications !== false,
      lastCheckAt: input.lastCheckAt || null,
      lastKnownVersion: input.lastKnownVersion || null,
      lastKnownReleaseUrl: input.lastKnownReleaseUrl || null,
      lastKnownPublishedAt: input.lastKnownPublishedAt || null,
      lastKnownTrust: input.lastKnownTrust && typeof input.lastKnownTrust === 'object' ? input.lastKnownTrust : null
    };
  }

  function readSettings() {
    try {
      const file = settingsPath();
      if (!fs.existsSync(file)) return { ...DEFAULT_SETTINGS };
      return sanitizeSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
      logDiagnostic('update release settings read', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function writeSettings(next) {
    const clean = sanitizeSettings(next);
    const file = settingsPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(clean, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return clean;
  }

  function isDue(settings) {
    const policy = settings.checkPolicy;
    if (policy === 'manual') return false;
    if (policy === 'startup') return true;
    const interval = CHECK_INTERVALS[policy] ?? CHECK_INTERVALS.daily;
    const last = Date.parse(settings.lastCheckAt || '');
    return !Number.isFinite(last) || Date.now() - last >= interval;
  }

  function stateFromSettings(settings, extra = {}) {
    const currentVersion = app.getVersion();
    const latest = settings.lastKnownVersion;
    return {
      ok: true,
      repository: OFFICIAL_REPOSITORY,
      currentVersion,
      channel: settings.channel,
      checkPolicy: settings.checkPolicy,
      updateAvailable: latest ? compareVersions(latest, currentVersion) > 0 : false,
      latestVersion: latest,
      latestReleaseUrl: settings.lastKnownReleaseUrl,
      latestPublishedAt: settings.lastKnownPublishedAt,
      trust: settings.lastKnownTrust,
      lastCheckAt: settings.lastCheckAt,
      build: {
        packaged: app.isPackaged,
        type: app.isPackaged ? 'Packaged build' : 'Source / development build',
        platform: process.platform,
        arch: process.arch
      },
      settings: {
        channel: settings.channel,
        checkPolicy: settings.checkPolicy,
        autoDownload: false,
        autoInstall: false,
        verifySha256: settings.verifySha256,
        requireReleaseSignature: settings.requireReleaseSignature,
        keepRollbackPackage: settings.keepRollbackPackage,
        showNotifications: settings.showNotifications
      },
      releases: [],
      ...extra
    };
  }

  async function fetchReleases() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(RELEASES_API, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `PurpleDragonPowerTools/${app.getVersion()}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        redirect: 'error',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`GitHub release check failed with HTTP ${response.status}.`);
      const json = await response.json();
      if (!Array.isArray(json)) throw new Error('GitHub returned an invalid releases response.');
      return json;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('GitHub release check timed out.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkForUpdates({ force = false } = {}) {
    if (pending) return pending;
    const settings = readSettings();
    if (!force && !isDue(settings)) return cache || stateFromSettings(settings, { skipped: true, reason: 'Update check is not due yet.' });

    pending = (async () => {
      try {
        const raw = await fetchReleases();
        const releases = raw.map(publicRelease).filter(release => !release.draft && parseVersion(release.version));
        const eligible = releases
          .filter(release => settings.channel === 'preview' || !release.prerelease)
          .sort((a, b) => compareVersions(b.version, a.version));
        const latest = eligible[0] || null;
        const checkedAt = new Date().toISOString();
        const nextSettings = writeSettings({
          ...settings,
          lastCheckAt: checkedAt,
          lastKnownVersion: latest?.version || null,
          lastKnownReleaseUrl: latest?.url || null,
          lastKnownPublishedAt: latest?.publishedAt || null,
          lastKnownTrust: latest?.trust || null
        });
        const state = stateFromSettings(nextSettings, {
          checkedAt,
          latestVersion: latest?.version || null,
          latestReleaseUrl: latest?.url || null,
          latestPublishedAt: latest?.publishedAt || null,
          updateAvailable: latest ? compareVersions(latest.version, app.getVersion()) > 0 : false,
          trust: latest?.trust || null,
          releases: eligible.slice(0, 8)
        });
        cache = state;
        addActivity('Update check completed', latest ? `Latest ${settings.channel} release: v${latest.version}` : 'No eligible GitHub release found');
        return state;
      } catch (error) {
        logDiagnostic('update release check', error);
        const failed = stateFromSettings(settings, { ok: false, error: String(error?.message || error), releases: [] });
        cache = failed;
        return failed;
      } finally {
        pending = null;
      }
    })();
    return pending;
  }

  function getState() {
    return cache || stateFromSettings(readSettings());
  }

  function getSettings() {
    return getState().settings;
  }

  function saveSettings(input = {}) {
    const current = readSettings();
    const next = writeSettings({
      ...current,
      channel: input.channel ?? current.channel,
      checkPolicy: input.checkPolicy ?? current.checkPolicy,
      verifySha256: input.verifySha256 ?? current.verifySha256,
      requireReleaseSignature: input.requireReleaseSignature ?? current.requireReleaseSignature,
      keepRollbackPackage: input.keepRollbackPackage ?? current.keepRollbackPackage,
      showNotifications: input.showNotifications ?? current.showNotifications
    });
    cache = stateFromSettings(next);
    addActivity('Update settings changed', `${next.channel} channel · ${next.checkPolicy} checks`);
    return { ok: true, settings: cache.settings, state: cache };
  }

  async function openRelease(urlValue) {
    try {
      const url = new URL(String(urlValue || ''));
      const prefix = `/${OFFICIAL_REPOSITORY}/releases/`;
      if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith(prefix)) {
        return { ok: false, error: 'Only official Purple Dragon PowerTools GitHub release links are allowed.' };
      }
      await shell.openExternal(url.toString());
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  }

  return {
    repository: OFFICIAL_REPOSITORY,
    getState,
    getSettings,
    saveSettings,
    checkForUpdates,
    shouldCheckOnStartup: () => isDue(readSettings()),
    openRelease
  };
}

module.exports = {
  createUpdateReleaseCenter,
  compareVersions,
  parseVersion,
  OFFICIAL_REPOSITORY
};
