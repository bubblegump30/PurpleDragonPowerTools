const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Notification, screen, safeStorage } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const dns = require('dns').promises;
const { execFile, spawn } = require('child_process');
const { createUpdateReleaseCenter } = require('./update-release');
const BOOT_AT = Date.now();
const SESSION_ID = `${process.pid}-${BOOT_AT}`;
let rendererReadyAt = 0;
let rendererCrashCount = 0;
let rendererUnresponsiveCount = 0;
let lastRendererError = null;
let windowStateSaveTimer = null;
let loadRecoveryAttempts = 0;
let previousSessionState = null;
let currentSessionState = null;

let mainWindow;
let previousCpuSamples = null;
let cachedStaticInfo = null;
let cachedStaticAt = 0;
let activityLog = [];
let nvidiaCache = { at: 0, data: null, pending: null };
let winPerfCache = { at: 0, data: null, pending: null };
let startupCache = { at: 0, data: [], pending: null };
let securityCache = { at: 0, data: null, pending: null };
let storageInventoryCache = { at: 0, data: null, pending: null };
let storageAnalysisCache = { at: 0, data: null, pending: null, token: 0 };
let cleanupPreviewCache = { at: 0, data: null, pending: null };
let processCenterCache = { at: 0, data: [], pending: null, samples: new Map() };
let installedAppsCache = { at: 0, data: [], pending: null };
let processCenterLastSnapshot = null;
let networkCenterCache = { at: 0, data: null, pending: null };
let vpnCenterCache = { at: 0, data: null, pending: null, internal: new Map() };
let networkLastDiagnostics = [];
let networkIpGeoLastResult = null;
let modelCenterCache = { at: 0, key: '', data: null, pending: null };
let featureLabCache = { at: 0, data: null, pending: null, elevated: false };
let aiSystemContextCache = { at: 0, key: '', data: null };
let githubCenterCache = { at: 0, data: null, pending: null };
let githubSourceSelection = [];
let githubReleaseAssets = [];
const updateReleaseCenter = createUpdateReleaseCenter({
  app,
  shell,
  logDiagnostic: writeDiagnostic,
  addActivity,
  notify: (title, body) => {
    try { if (Notification.isSupported()) new Notification({ title, body }).show(); } catch {}
  },
  progress: (payload) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:progress', payload || {});
    } catch {}
  }
});

// v1.7.0 — Change Journal + Undo. The journal is local-only, capped, and
// intentionally excludes credentials, prompts, IP/geolocation data, and file contents.
let changeJournal = [];
let changeJournalLoaded = false;
let journalUndoInProgress = false;
const CHANGE_JOURNAL_MAX = 250;
const JOURNAL_GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let sensorBridgeState = { lastValid: null, lastValidAt: 0, lastError: null, needsElevation: false, elevationAttempted: false, launchInFlight: false, lastLaunchAt: 0 };



function changeJournalPath() {
  try { return path.join(app.getPath('userData'), 'change-journal.json'); }
  catch { return null; }
}
function loadChangeJournal() {
  if (changeJournalLoaded) return changeJournal;
  changeJournalLoaded = true;
  try {
    const file = changeJournalPath();
    if (!file || !fs.existsSync(file)) { changeJournal=[]; return changeJournal; }
    const raw = JSON.parse(fs.readFileSync(file,'utf8'));
    changeJournal = (Array.isArray(raw)?raw:[]).filter(x=>x&&typeof x==='object').slice(0,CHANGE_JOURNAL_MAX);
  } catch (error) { changeJournal=[]; writeDiagnostic('change journal load',error); }
  return changeJournal;
}
function persistChangeJournal() {
  try {
    const file=changeJournalPath(); if(!file)return false;
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const tmp=`${file}.tmp`;
    fs.writeFileSync(tmp,JSON.stringify(changeJournal.slice(0,CHANGE_JOURNAL_MAX),null,2),'utf8');
    fs.renameSync(tmp,file); return true;
  } catch(error){writeDiagnostic('change journal write',error);return false;}
}
function journalPublicEntry(entry) {
  return {
    id:String(entry.id||''),at:String(entry.at||''),category:String(entry.category||'PowerTools'),
    title:String(entry.title||'Change'),summary:String(entry.summary||''),source:String(entry.source||'PowerTools'),
    reversible:Boolean(entry.reversible&&entry.undo),undone:Boolean(entry.undone),undoneAt:entry.undoneAt||null,
    restartRequired:Boolean(entry.restartRequired),risk:String(entry.risk||'Low')
  };
}
function addChangeJournalEntry(input={}) {
  if (journalUndoInProgress) return null;
  loadChangeJournal();
  const entry={
    id:`chg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    at:new Date().toISOString(),category:String(input.category||'PowerTools').slice(0,60),
    title:String(input.title||'PowerTools change').slice(0,120),summary:String(input.summary||'').slice(0,500),
    source:String(input.source||'PowerTools').slice(0,80),risk:String(input.risk||'Low').slice(0,20),
    restartRequired:Boolean(input.restartRequired),reversible:Boolean(input.undo),undo:input.undo||null,
    undone:false,undoneAt:null
  };
  changeJournal.unshift(entry); changeJournal=changeJournal.slice(0,CHANGE_JOURNAL_MAX); persistChangeJournal();
  return journalPublicEntry(entry);
}
function getChangeJournalState() {
  loadChangeJournal();
  const entries=changeJournal.map(journalPublicEntry);
  const activeUndo=entries.filter(x=>x.reversible&&!x.undone).length;
  return {generatedAt:new Date().toISOString(),count:entries.length,reversibleCount:activeUndo,undoneCount:entries.filter(x=>x.undone).length,entries};
}
function restoreAutomationRuleSnapshot(snapshot) {
  if(!snapshot||typeof snapshot!=='object'||!snapshot.id)return {ok:false,error:'Journal rule snapshot is invalid.'};
  const cloned=JSON.parse(JSON.stringify(snapshot));
  const i=automationRules.findIndex(r=>r.id===cloned.id);
  if(i>=0)automationRules[i]=cloned;else automationRules.unshift(cloned);
  automationRules=automationRules.slice(0,AUTOMATION_MAX_RULES); automationRuntime.delete(cloned.id);
  persistAutomationRules(); reconcileAutomationEngine(); return {ok:true};
}
async function performJournalUndo(entry) {
  const u=entry?.undo; if(!u||typeof u!=='object')return {ok:false,error:'This entry has no supported undo operation.'};
  journalUndoInProgress=true;
  try {
    if(u.type==='automation-create'){
      await initializeAutomationEngine(); automationRules=automationRules.filter(r=>r.id!==String(u.id||'')); automationRuntime.delete(String(u.id||''));persistAutomationRules();reconcileAutomationEngine();return {ok:true,detail:'Created automation rule removed.'};
    }
    if(u.type==='automation-restore'){
      await initializeAutomationEngine(); const r=restoreAutomationRuleSnapshot(u.snapshot);return r.ok?{ok:true,detail:'Previous automation rule restored.'}:r;
    }
    if(u.type==='automation-toggle'){
      await initializeAutomationEngine();const rule=automationRules.find(r=>r.id===String(u.id||''));if(!rule)return {ok:false,error:'Automation rule no longer exists.'};rule.enabled=Boolean(u.enabled);rule.updatedAt=new Date().toISOString();automationRuntime.delete(rule.id);persistAutomationRules();reconcileAutomationEngine();return {ok:true,detail:`Automation rule ${rule.enabled?'enabled':'disabled'}.`};
    }
    if(u.type==='automation-delete'){
      await initializeAutomationEngine();if(automationRules.some(r=>r.id===u.snapshot?.id))return {ok:false,error:'A rule with this journal ID already exists.'};const r=restoreAutomationRuleSnapshot(u.snapshot);return r.ok?{ok:true,detail:'Deleted automation rule restored.'}:r;
    }
    if(u.type==='automation-master'){
      await initializeAutomationEngine();automationSettings.masterEnabled=Boolean(u.enabled);persistAutomationSettings();reconcileAutomationEngine();return {ok:true,detail:`Automation Engine ${automationSettings.masterEnabled?'enabled':'paused'}.`};
    }
    if(u.type==='performance-guid'){
      const guid=String(u.guid||'').toLowerCase();if(process.platform!=='win32'||!JOURNAL_GUID_RE.test(guid))return {ok:false,error:'Previous Windows power scheme is unavailable.'};const out=await runExec('powercfg.exe',['/setactive',guid]);return out.ok?{ok:true,detail:'Previous Windows power scheme restored.'}:{ok:false,error:out.stderr||'Windows rejected the previous power scheme.'};
    }
    if(u.type==='featurelab'){
      const action=String(u.action||'');if(!['enable','disable'].includes(action))return {ok:false,error:'Unsupported Feature Lab undo action.'};const out=await applyFeatureLabAction(String(u.featureId||''),action,{skipConfirm:true,journal:false});return out.ok?{ok:true,detail:`${out.label||'Windows feature'} restored${out.restartRequired?' · restart may be required':''}.`}:out;
    }
    return {ok:false,error:'This journal entry uses an unsupported undo operation.'};
  } finally { journalUndoInProgress=false; }
}
async function undoChangeJournalEntry(id) {
  loadChangeJournal();const entry=changeJournal.find(x=>x.id===String(id||''));
  if(!entry)return {ok:false,error:'Change Journal entry not found.'};
  if(entry.undone)return {ok:false,error:'This change has already been undone.'};
  if(!entry.reversible||!entry.undo)return {ok:false,error:'This change is recorded for audit only and cannot be undone automatically.'};
  const choice=await dialog.showMessageBox(mainWindow,{type:entry.risk==='Medium'?'warning':'question',buttons:['Cancel','Undo Change'],defaultId:0,cancelId:0,noLink:true,title:'Undo recorded change?',message:entry.title,detail:`${entry.summary}\n\nPowerTools will run only the fixed inverse operation saved with this journal entry.${entry.restartRequired?' A Windows restart may still be required.':''}`});
  if(choice.response!==1)return {ok:false,canceled:true};
  const out=await performJournalUndo(entry);if(!out.ok)return out;
  entry.undone=true;entry.undoneAt=new Date().toISOString();persistChangeJournal();
  addActivity('Change Journal undo',`${entry.title} · ${out.detail||'restored'}`);
  return {ok:true,detail:out.detail||'Change undone.',state:getChangeJournalState()};
}
async function clearChangeJournal() {
  loadChangeJournal();
  const choice=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancel','Clear Journal'],defaultId:0,cancelId:0,noLink:true,title:'Clear Change Journal?',message:'Clear the local PowerTools change history?',detail:'This removes journal history only. It does not undo any Windows, automation, performance, or GitHub changes.'});
  if(choice.response!==1)return {ok:false,canceled:true};
  changeJournal=[];persistChangeJournal();return {ok:true,state:getChangeJournalState()};
}

// v0.8.0 — Automation Engine. Rules are local-only and actions are strictly allowlisted.
let automationRules = [];
let automationHistory = [];
let automationSettings = { masterEnabled: true };
let automationInitialized = false;
let automationEngineTimer = null;
let automationEvaluating = false;
let automationCpuSamples = null;
let automationProcessCache = { at: 0, names: new Set(), pending: null };
let automationBatteryCache = { at: 0, data: null, pending: null };
let automationRuntime = new Map();
const AUTOMATION_TICK_MS = 3000;
const AUTOMATION_SESSION_STARTED_AT = Date.now();
const AUTOMATION_MAX_RULES = 64;
const AUTOMATION_MAX_HISTORY = 100;
const AUTOMATION_TRIGGER_TYPES = new Set([
  'cpuAbove', 'gpuAbove', 'ramAbove', 'diskFreeBelow', 'processStarted',
  'processStopped', 'networkDisconnected', 'batteryBelow', 'dailyTime', 'systemStartup'
]);
const AUTOMATION_ACTION_TYPES = new Set(['notification', 'activity', 'profile', 'navigate', 'windowsTool']);
const AUTOMATION_VIEWS = new Set(['dashboard', 'models', 'performance', 'system', 'featurelab', 'data', 'apps', 'network', 'privacy', 'security', 'automation', 'journal', 'settings']);
const AUTOMATION_WINDOWS_TARGETS = new Set(['taskmanager', 'resmon', 'storage', 'network', 'defender', 'eventviewer', 'updates']);

const POWER_SCHEMES = {
  eco: { name: 'Eco', guid: 'a1841308-3541-4fab-bc81-f71556f20b4a' },
  balanced: { name: 'Balanced', guid: '381b4222-f694-41f0-9685-ff5bb260df2e' },
  performance: { name: 'Performance', guid: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c' }
};


function windowStatePath() {
  try { return path.join(app.getPath('userData'), 'window-state.json'); }
  catch { return null; }
}

function diagnosticsPath() {
  try { return path.join(app.getPath('userData'), 'powertools-diagnostics.log'); }
  catch { return null; }
}

function readWindowState() {
  const fallback = { width: 1540, height: 980, maximized: false };
  try {
    const file = windowStatePath();
    if (!file || !fs.existsSync(file)) return fallback;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const width = Math.max(1180, Math.min(3840, Number(data.width) || fallback.width));
    const height = Math.max(760, Math.min(2160, Number(data.height) || fallback.height));
    const x = Number.isFinite(Number(data.x)) ? Number(data.x) : undefined;
    const y = Number.isFinite(Number(data.y)) ? Number(data.y) : undefined;
    if (x !== undefined && y !== undefined && screen?.getAllDisplays) {
      const visible = screen.getAllDisplays().some(display => {
        const b = display.workArea;
        return x + 120 >= b.x && y + 80 >= b.y && x <= b.x + b.width - 80 && y <= b.y + b.height - 60;
      });
      if (!visible) return { width, height, maximized: Boolean(data.maximized) };
    }
    return { width, height, x, y, maximized: Boolean(data.maximized) };
  } catch (error) {
    writeDiagnostic('window state load', error);
    return fallback;
  }
}

function saveWindowStateNow() {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const file = windowStatePath();
    if (!file) return;
    const bounds = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    fs.writeFileSync(file, JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized(), savedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (error) { writeDiagnostic('window state save', error); }
}

function queueWindowStateSave() {
  clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(saveWindowStateNow, 280);
}

function sessionStatePath() {
  try { return path.join(app.getPath('userData'), 'session-state.json'); }
  catch { return null; }
}

function beginSessionState() {
  try {
    const file = sessionStatePath();
    if (!file) return;
    if (fs.existsSync(file)) {
      try { previousSessionState = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { previousSessionState = null; }
    }
    currentSessionState = {
      sessionId: SESSION_ID,
      version: app.getVersion(),
      startedAt: new Date(BOOT_AT).toISOString(),
      cleanShutdown: false
    };
    fs.writeFileSync(file, JSON.stringify(currentSessionState, null, 2), 'utf8');
  } catch (error) { writeDiagnostic('session state start', error); }
}

function finishSessionState() {
  try {
    const file = sessionStatePath();
    if (!file) return;
    currentSessionState = {
      ...(currentSessionState || { sessionId: SESSION_ID, version: app.getVersion(), startedAt: new Date(BOOT_AT).toISOString() }),
      cleanShutdown: true,
      endedAt: new Date().toISOString()
    };
    fs.writeFileSync(file, JSON.stringify(currentSessionState, null, 2), 'utf8');
  } catch (error) { writeDiagnostic('session state finish', error); }
}

function reliabilitySummaryText(status) {
  const checks = Array.isArray(status?.checks) ? status.checks : [];
  return [
    'Purple Dragon PowerTools Reliability Summary',
    `Version: ${status?.version || app.getVersion()}`,
    `Session: ${status?.sessionId || SESSION_ID}`,
    `Renderer: ${status?.renderer?.state || 'unknown'}`,
    `UI ready: ${status?.boot?.uiReadyMs == null ? 'pending' : `${status.boot.uiReadyMs} ms`}`,
    `Renderer crashes: ${status?.renderer?.crashCount || 0}`,
    `Unresponsive events: ${status?.renderer?.unresponsiveCount || 0}`,
    `Diagnostics: ${status?.diagnostics?.sizeBytes || 0} bytes`,
    `Static cache: ${status?.cache?.staticPresent ? 'present' : 'not created yet'}`,
    '',
    ...checks.map(c => `${c.ok ? 'PASS' : c.optional ? 'INFO' : 'WARN'} — ${c.label}: ${c.detail}`)
  ].join('\n');
}

function getReliabilityStatus() {
  const diag = diagnosticsPath();
  const cache = staticCachePath();
  let diagStat = null;
  try { if (diag && fs.existsSync(diag)) diagStat = fs.statSync(diag); } catch { }
  let cacheStat = null;
  try { if (cache && fs.existsSync(cache)) cacheStat = fs.statSync(cache); } catch { }
  const sensorDir = sensorBridgeDirectory();
  const sensorDll = path.join(sensorDir, 'LibreHardwareMonitorLib.dll');
  const sensorScript = path.join(sensorDir, 'hardware-sensor-bridge.ps1');
  const ps = powerShellExe();
  let userDataWritable = false;
  try { fs.accessSync(app.getPath('userData'), fs.constants.W_OK); userDataWritable = true; } catch { }
  const checks = [
    { id:'renderer', label:'Renderer process', ok:Boolean(rendererReadyAt && mainWindow && !mainWindow.isDestroyed()), detail:rendererReadyAt ? 'UI bridge connected.' : 'Waiting for renderer ready signal.' },
    { id:'userdata', label:'Local data directory', ok:userDataWritable, detail:app.getPath('userData') },
    { id:'powershell', label:'Windows PowerShell', ok:process.platform !== 'win32' || fs.existsSync(ps) || ps === 'powershell.exe', optional:process.platform !== 'win32', detail:process.platform === 'win32' ? ps : 'Windows-only provider' },
    { id:'sensor', label:'CPU sensor runtime', ok:fs.existsSync(sensorDll) && fs.existsSync(sensorScript), optional:true, detail:fs.existsSync(sensorDll) && fs.existsSync(sensorScript) ? 'Bundled sensor bridge files are present.' : 'Sensor bridge is optional until enabled.' },
    { id:'cache', label:'Static hardware cache', ok:Boolean(cacheStat), optional:true, detail:cacheStat ? `Cached ${Math.round((Date.now()-cacheStat.mtimeMs)/1000)} sec ago.` : 'Will be created after hardware identity is collected.' }
  ];
  return {
    version: app.getVersion(), sessionId: SESSION_ID, generatedAt: new Date().toISOString(),
    boot: { processStartedAt: new Date(BOOT_AT).toISOString(), uiReadyMs: rendererReadyAt ? rendererReadyAt - BOOT_AT : null, sessionUptimeMs: Date.now() - BOOT_AT, fastBoot: true },
    renderer: { state: mainWindow && !mainWindow.isDestroyed() ? (rendererReadyAt ? 'Ready' : 'Starting') : 'No window', readyAt: rendererReadyAt ? new Date(rendererReadyAt).toISOString() : null, crashCount: rendererCrashCount, unresponsiveCount: rendererUnresponsiveCount, lastError: lastRendererError },
    diagnostics: { path: diag, exists:Boolean(diagStat), sizeBytes:diagStat?.size || 0, modifiedAt:diagStat?.mtime?.toISOString?.() || null },
    cache: { staticPresent:Boolean(cacheStat), staticBytes:cacheStat?.size || 0, inMemory:Boolean(cachedStaticInfo), ageMs:cachedStaticAt ? Date.now()-cachedStaticAt : null },
    providers: { nvidiaCached:Boolean(nvidiaCache.data), windowsPerfCached:Boolean(winPerfCache.data), sensorBridgeRunning:Boolean(sensorBridgeState.lastValid || sensorBridgeState.launchInFlight), automationInitialized },
    previousSession: previousSessionState ? { version: previousSessionState.version || null, startedAt: previousSessionState.startedAt || null, endedAt: previousSessionState.endedAt || null, cleanShutdown: previousSessionState.cleanShutdown === true } : null,
    checks
  };
}

function stableReleaseSummaryText(status) {
  const checks = Array.isArray(status?.checks) ? status.checks : [];
  return [
    'Purple Dragon PowerTools Stable Release',
    `Version: ${status?.version || app.getVersion()}`,
    `Channel: ${status?.channel || 'Stable'}`,
    `Status: ${status?.ready ? 'READY' : 'REVIEW'}`,
    `Passed: ${status?.passed || 0}`,
    `Warnings: ${status?.warnings || 0}`,
    `Previous shutdown: ${status?.previousSession?.available ? (status.previousSession.cleanShutdown ? 'clean' : 'not confirmed clean') : 'first recorded session'}`,
    '',
    ...checks.map(c => `${c.ok ? 'PASS' : c.optional ? 'INFO' : 'WARN'} — ${c.label}: ${c.detail}`)
  ].join('\n');
}

function getStableReleaseStatus() {
  const userData = app.getPath('userData');
  let writable = false;
  try { fs.accessSync(userData, fs.constants.W_OK); writable = true; } catch { }
  const runtimeFiles = ['index.html','preload.js','renderer.js','styles.css'].map(name => path.join(__dirname, name));
  const automationFiles = ['automation-settings.json','automation-rules.json','automation-history.json'].map(name => path.join(userData, name));
  let automationDataHealthy = true;
  let automationChecked = 0;
  for (const file of automationFiles) {
    if (!fs.existsSync(file)) continue;
    automationChecked += 1;
    try { JSON.parse(fs.readFileSync(file, 'utf8')); } catch { automationDataHealthy = false; }
  }
  const diag = diagnosticsPath();
  let diagSize = 0;
  try { if (diag && fs.existsSync(diag)) diagSize = fs.statSync(diag).size; } catch { }
  const sensorDir = sensorBridgeDirectory();
  const sensorPresent = fs.existsSync(path.join(sensorDir,'LibreHardwareMonitorLib.dll')) && fs.existsSync(path.join(sensorDir,'hardware-sensor-bridge.ps1'));
  const checks = [
    { id:'version', label:'Stable version', ok:app.getVersion()==='2.2.0', detail:`Runtime version ${app.getVersion()}` },
    { id:'renderer', label:'Renderer bridge', ok:Boolean(rendererReadyAt && mainWindow && !mainWindow.isDestroyed()), detail:rendererReadyAt ? 'UI-ready handshake received.' : 'Waiting for renderer ready signal.' },
    { id:'userdata', label:'Local data directory', ok:writable, detail:writable ? 'PowerTools local data directory is writable.' : 'PowerTools local data directory is not writable.' },
    { id:'runtime', label:'Core runtime files', ok:runtimeFiles.every(fs.existsSync), detail:runtimeFiles.every(fs.existsSync) ? 'HTML, preload, renderer, and styles are present.' : 'One or more required UI runtime files are missing.' },
    { id:'single', label:'Single-instance guard', ok:true, detail:'Application owns the active single-instance lock.' },
    { id:'automation-data', label:'Automation data', ok:automationDataHealthy, optional:automationChecked===0, detail:automationChecked ? `${automationChecked} local automation data file(s) parsed successfully.` : 'No persisted automation files yet.' },
    { id:'diagnostics', label:'Diagnostics rotation', ok:diagSize <= 2 * 1024 * 1024, detail:`Active diagnostics log: ${diagSize} bytes.` },
    { id:'sensor', label:'CPU sensor runtime', ok:sensorPresent, optional:true, detail:sensorPresent ? 'Optional LibreHardwareMonitor bridge is bundled.' : 'Optional CPU sensor bridge is not present.' },
    { id:'previous-session', label:'Previous session shutdown', ok:!previousSessionState || previousSessionState.cleanShutdown===true, optional:true, detail:previousSessionState ? (previousSessionState.cleanShutdown===true ? 'Previous PowerTools session closed cleanly.' : 'Previous session did not record a clean-shutdown marker. Informational only; review diagnostics if unexpected.') : `No previous v${app.getVersion()} session marker yet.` }
  ];
  const blocking = checks.filter(c => !c.ok && !c.optional);
  const passed = checks.filter(c => c.ok).length;
  return {
    version: app.getVersion(),
    channel: 'Stable',
    generatedAt: new Date().toISOString(),
    ready: blocking.length === 0,
    passed,
    total: checks.length,
    warnings: blocking.length,
    informational: checks.filter(c => !c.ok && c.optional).length,
    previousSession: previousSessionState ? { available:true, version:previousSessionState.version || null, cleanShutdown:previousSessionState.cleanShutdown===true, startedAt:previousSessionState.startedAt || null, endedAt:previousSessionState.endedAt || null } : { available:false, cleanShutdown:null },
    checks
  };
}

function createWindow() {
  const savedWindow = readWindowState();
  mainWindow = new BrowserWindow({
    width: savedWindow.width || 1540,
    height: savedWindow.height || 980,
    ...(Number.isFinite(savedWindow.x) && Number.isFinite(savedWindow.y) ? { x:savedWindow.x, y:savedWindow.y } : {}),
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#070512',
    icon: path.join(__dirname, 'assets', 'purple-dragon-foundation-mark.png'),
    frame: false,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Public-release hardening: the renderer UI is bundled locally. External
  // destinations must go through explicit, allowlisted main-process actions.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
    writeDiagnostic('blocked renderer navigation', 'Renderer navigation outside the bundled UI was blocked.');
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(error => {
    writeDiagnostic('loadFile', error);
  });
  // v1.4.0 Stable: keep first paint independent from hardware/security/process/release-readiness/cloud-AI queries.
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow?.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
    if (savedWindow.maximized && !mainWindow.isMaximized()) mainWindow.maximize();
  });
  mainWindow.on('move', queueWindowStateSave);
  mainWindow.on('resize', queueWindowStateSave);
  mainWindow.on('maximize', queueWindowStateSave);
  mainWindow.on('unmaximize', queueWindowStateSave);
  mainWindow.on('close', () => { saveWindowStateNow(); finishSessionState(); });
  mainWindow.on('unresponsive', () => { rendererUnresponsiveCount += 1; writeDiagnostic('renderer unresponsive', `count=${rendererUnresponsiveCount}`); });
  mainWindow.on('responsive', () => addActivity('Renderer recovered', 'The PowerTools interface became responsive again'));
  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    lastRendererError = `Load failed ${code}: ${description}`;
    writeDiagnostic('renderer did-fail-load', `${code} ${description} ${validatedURL || ''}`);
    if (loadRecoveryAttempts < 1 && code !== -3) {
      loadRecoveryAttempts += 1;
      setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload(); }, 450);
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (details?.reason === 'clean-exit') return;
    rendererCrashCount += 1;
    rendererReadyAt = 0;
    lastRendererError = `Renderer exited: ${details?.reason || 'unknown'} (${details?.exitCode ?? 'n/a'})`;
    writeDiagnostic('render-process-gone', lastRendererError);
    setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload(); }, 650);
  });
  addActivity('Application started', `Purple Dragon PowerTools v${app.getVersion()} is ready`);
}

function timesTotal(times) {
  return times.user + times.nice + times.sys + times.idle + times.irq;
}

function cpuUsageBundle() {
  const cpus = os.cpus();
  const current = cpus.map(cpu => ({ ...cpu.times }));
  if (!previousCpuSamples || previousCpuSamples.length !== current.length) {
    previousCpuSamples = current;
    return { overall: 0, perCore: current.map(() => 0) };
  }

  let totalDelta = 0;
  let idleDelta = 0;
  const perCore = current.map((times, index) => {
    const prev = previousCpuSamples[index];
    const delta = timesTotal(times) - timesTotal(prev);
    const idle = times.idle - prev.idle;
    totalDelta += delta;
    idleDelta += idle;
    if (delta <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((1 - idle / delta) * 100)));
  });

  previousCpuSamples = current;
  const overall = totalDelta > 0
    ? Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
    : 0;
  return { overall, perCore };
}

function averageCpuClockMHz() {
  const cpus = os.cpus();
  if (!cpus.length) return null;
  const values = cpus.map(cpu => Number(cpu.speed)).filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function rootDrive() {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    return path.parse(systemRoot).root;
  }
  return '/';
}

function storageStats() {
  try {
    const root = rootDrive();
    const st = fs.statfsSync(root);
    const total = Number(st.blocks) * Number(st.bsize);
    const free = Number(st.bavail) * Number(st.bsize);
    const used = Math.max(0, total - free);
    return {
      root,
      total,
      used,
      free,
      percent: total ? Math.round((used / total) * 100) : 0
    };
  } catch {
    return { root: rootDrive(), total: 0, used: 0, free: 0, percent: 0 };
  }
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}

function redactSensitiveText(value) {
  let text = String(value ?? '');
  const localValues = [];
  try { localValues.push(os.homedir()); } catch { }
  try { localValues.push(os.hostname()); } catch { }
  try { localValues.push(os.userInfo()?.username); } catch { }
  for (const localValue of localValues.filter(Boolean).sort((a,b)=>String(b).length-String(a).length)) {
    const pattern = escapeRegExp(localValue);
    if (pattern) text = text.replace(new RegExp(pattern, 'gi'), '[REDACTED]');
  }
  text = text.replace(/([?&](?:api[_-]?key|key|token|access[_-]?token|password|secret)=)[^&\s]+/gi, '$1[REDACTED]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+\/=:-]{8,}/gi, 'Bearer [REDACTED]');
  text = text.replace(/\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,})\b/g, '[REDACTED-CREDENTIAL]');
  text = text.replace(/\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, '[REDACTED-MAC]');
  text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, match => match.split('.').every(part => Number(part) >= 0 && Number(part) <= 255) ? '[REDACTED-IP]' : match);
  return text;
}

const PUBLIC_REPORT_REDACTED_KEYS = new Set([
  'hostname','computername','username','userdomain','mac','macaddress','ipv4','ipv6',
  'gateway','gateways','dnsserver','dnsservers','ipaddress','publicip','localip',
  'profilename','ssid','filepath','absolutepath','path','executablepath','commandline',
  'installlocation','workingdirectory','homedirectory','token','apikey','secret',
  'password','credential','ciphertext','serial','serialnumber','uuid','target'
]);

function sanitizePublicReportValue(value, key = '') {
  const normalizedKey = String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (PUBLIC_REPORT_REDACTED_KEYS.has(normalizedKey)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => sanitizePublicReportValue(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) out[childKey] = sanitizePublicReportValue(childValue, childKey);
    return out;
  }
  if (typeof value === 'string') return redactSensitiveText(value);
  return value;
}

function writeDiagnostic(area, error) {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'powertools-diagnostics.log');
    const previous = path.join(dir, 'powertools-diagnostics.previous.log');
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) {
        if (fs.existsSync(previous)) fs.unlinkSync(previous);
        fs.renameSync(file, previous);
      }
    } catch { }
    const raw = String(error?.stack || error?.message || error || 'unknown error');
    const line = `[${new Date().toISOString()}] ${redactSensitiveText(area)}: ${redactSensitiveText(raw).slice(0, 16000)}\n`;
    fs.appendFileSync(file, line, 'utf8');
  } catch { }
}

function staticCachePath() {
  try { return path.join(app.getPath('userData'), 'static-system-cache.json'); }
  catch { return null; }
}

function loadStaticCacheFromDisk() {
  try {
    const file = staticCachePath();
    if (!file || !fs.existsSync(file)) return;
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!payload || typeof payload !== 'object' || !payload.data) return;
    cachedStaticInfo = payload.data;
    // Treat persisted hardware identity as warm immediately; a delayed refresh will verify it.
    cachedStaticAt = Date.now();
  } catch (error) {
    writeDiagnostic('static cache load', error);
  }
}

function saveStaticCacheToDisk(data) {
  try {
    const file = staticCachePath();
    if (!file || !data) return;
    fs.writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString(), data }), 'utf8');
  } catch (error) {
    writeDiagnostic('static cache save', error);
  }
}

function windowsExecutable(name) {
  if (process.platform !== 'win32') return name;
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const direct = path.join(systemRoot, 'System32', name);
  if (fs.existsSync(direct)) return direct;
  return name;
}

function powerShellExe() {
  if (process.platform !== 'win32') return 'powershell.exe';
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const candidates = [
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(systemRoot, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || 'powershell.exe';
}

function runPowerShell(script, timeout = 6000) {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      powerShellExe(),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          writeDiagnostic('PowerShell', `${error.message || error}; stderr=${String(stderr || '').trim()}`);
          return resolve(null);
        }
        const text = String(stdout || '').trim();
        if (!text) return resolve(null);
        try { resolve(JSON.parse(text)); }
        catch (parseError) {
          writeDiagnostic('PowerShell JSON parse', `${parseError.message}; output=${text.slice(0, 1200)}`);
          resolve(text);
        }
      }
    );
  });
}

function runExec(file, args, timeout = 5000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim() });
    });
  });
}

function numberOrNull(value) {
  const n = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}


function sensorBridgeDirectory() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'sensor-bridge');
  return path.join(__dirname, 'vendor', 'sensor-bridge');
}

function sensorBridgeOutputPath() {
  const dir = app.getPath('userData');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { }
  return path.join(dir, 'cpu-sensor-bridge.json');
}

function readSensorBridgeFile() {
  const output = sensorBridgeOutputPath();
  try {
    if (!fs.existsSync(output)) return null;
    const stat = fs.statSync(output);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > 15000) return null;
    const data = JSON.parse(fs.readFileSync(output, 'utf8'));
    const temp = Number(data?.cpuTemperatureC);
    if (data?.error) sensorBridgeState.lastError = String(data.error).slice(0, 500);
    sensorBridgeState.needsElevation = data?.needsElevation === true;
    if (data?.ok === true && Number.isFinite(temp) && temp > 0 && temp < 130) {
      sensorBridgeState.lastValid = {
        cpuTemperatureC: Math.round(temp * 10) / 10,
        cpuTemperatureSource: String(data.cpuTemperatureSource || 'LibreHardwareMonitor / CPU Package'),
        cpuSensorName: String(data.cpuSensorName || 'CPU Package'),
        provider: String(data.provider || 'LibreHardwareMonitor')
      };
      sensorBridgeState.lastValidAt = Date.now();
      sensorBridgeState.lastError = null;
      sensorBridgeState.needsElevation = false;
      return { ...sensorBridgeState.lastValid, stale: ageMs > 3500, ageMs };
    }
  } catch (error) {
    sensorBridgeState.lastError = String(error?.message || error || 'Unable to read sensor bridge output');
  }
  if (sensorBridgeState.lastValid && Date.now() - sensorBridgeState.lastValidAt < 20000) {
    return { ...sensorBridgeState.lastValid, stale: true, ageMs: Date.now() - sensorBridgeState.lastValidAt };
  }
  return null;
}

async function enableHardwareSensorBridge() {
  if (process.platform !== 'win32') return { ok: false, error: 'CPU sensor bridge is Windows-only.' };
  if (sensorBridgeState.launchInFlight) return { ok: true, requested: true };
  const dir = sensorBridgeDirectory();
  const bridge = path.join(dir, 'hardware-sensor-bridge.ps1');
  const launcher = path.join(dir, 'launch-elevated-sensor.ps1');
  const dll = path.join(dir, 'LibreHardwareMonitorLib.dll');
  if (!fs.existsSync(bridge) || !fs.existsSync(launcher) || !fs.existsSync(dll)) {
    const error = 'Hardware sensor bridge files are missing.';
    sensorBridgeState.lastError = error;
    return { ok: false, error };
  }

  sensorBridgeState.launchInFlight = true;
  sensorBridgeState.elevationAttempted = true;
  sensorBridgeState.lastLaunchAt = Date.now();
  sensorBridgeState.lastError = null;
  const output = sensorBridgeOutputPath();
  try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch { }

  return await new Promise(resolve => {
    const args = [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', launcher,
      '-BridgeScript', bridge,
      '-OutputPath', output,
      '-OwnerPid', String(process.pid),
      '-WorkingDirectory', dir
    ];
    execFile(powerShellExe(), args, { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      sensorBridgeState.launchInFlight = false;
      if (error) {
        const message = String(stderr || error.message || error || 'Sensor helper was not started').trim();
        sensorBridgeState.lastError = message.slice(0, 500);
        writeDiagnostic('CPU sensor launcher', message);
        return resolve({ ok: false, error: sensorBridgeState.lastError });
      }
      resolve({ ok: true, requested: true });
    });
  });
}

function getHardwareSensorSnapshot() {
  return readSensorBridgeFile();
}

function getHardwareSensorStatus() {
  const snapshot = readSensorBridgeFile();
  return {
    available: Boolean(snapshot?.cpuTemperatureC),
    running: Boolean(snapshot) || (sensorBridgeState.elevationAttempted && Date.now() - sensorBridgeState.lastLaunchAt < 10000),
    elevationAttempted: sensorBridgeState.elevationAttempted,
    needsElevation: sensorBridgeState.needsElevation,
    error: sensorBridgeState.lastError || null,
    snapshot
  };
}

async function queryNvidiaMetrics(force = false) {
  if (process.platform !== 'win32') return null;
  const now = Date.now();
  if (!force && now - nvidiaCache.at < 3500) return nvidiaCache.data;
  if (nvidiaCache.pending) return nvidiaCache.pending;

  nvidiaCache.pending = new Promise((resolve) => {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const candidate = path.join(systemRoot, 'System32', 'nvidia-smi.exe');
    const exe = fs.existsSync(candidate) ? candidate : 'nvidia-smi.exe';
    const query = 'name,utilization.gpu,temperature.gpu,memory.used,memory.total,clocks.gr,clocks.mem,fan.speed,power.draw,power.limit';
    execFile(
      exe,
      [`--query-gpu=${query}`, '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 4000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error || !stdout) {
          nvidiaCache.data = null;
          nvidiaCache.at = Date.now();
          nvidiaCache.pending = null;
          return resolve(null);
        }
        const first = String(stdout).trim().split(/\r?\n/)[0];
        const parts = first.split(',').map(s => s.trim());
        const data = {
          provider: 'NVIDIA NVML',
          name: parts[0] || null,
          utilization: numberOrNull(parts[1]),
          temperatureC: numberOrNull(parts[2]),
          memoryUsedMB: numberOrNull(parts[3]),
          memoryTotalMB: numberOrNull(parts[4]),
          coreClockMHz: numberOrNull(parts[5]),
          memoryClockMHz: numberOrNull(parts[6]),
          fanPercent: numberOrNull(parts[7]),
          powerDrawW: numberOrNull(parts[8]),
          powerLimitW: numberOrNull(parts[9])
        };
        nvidiaCache.data = data;
        nvidiaCache.at = Date.now();
        nvidiaCache.pending = null;
        resolve(data);
      }
    );
  });

  return nvidiaCache.pending;
}

async function queryWindowsPerf(force = false) {
  if (process.platform !== 'win32') return null;
  const now = Date.now();
  if (!force && now - winPerfCache.at < 7000) return winPerfCache.data;
  if (winPerfCache.pending) return winPerfCache.pending;

  const script = `
$ErrorActionPreference='SilentlyContinue'
$net = @(Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface)
$rx = ($net | Measure-Object -Property BytesReceivedPersec -Sum).Sum
$tx = ($net | Measure-Object -Property BytesSentPersec -Sum).Sum
$disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object {$_.Name -eq '_Total'} | Select-Object -First 1
$cpuTemp = $null
$cpuTempSource = $null
# v0.3.3 uses the persistent LibreHardwareMonitor bridge first; ACPI is fallback only.
try {
  $temps = @(Get-CimInstance -Namespace 'root\WMI' -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop |
    ForEach-Object { ($_.CurrentTemperature / 10) - 273.15 } |
    Where-Object { $_ -gt 0 -and $_ -lt 130 })
  if ($temps.Count -gt 0) {
    $cpuTemp = [math]::Round(($temps | Measure-Object -Average).Average, 1)
    $cpuTempSource = 'Windows ACPI thermal zone'
  }
} catch {}
if ($null -eq $rx) { $rx = 0 }
if ($null -eq $tx) { $tx = 0 }
$diskRead = 0
$diskWrite = 0
$diskBusy = 0
if ($null -ne $disk) {
  $diskRead = [double]$disk.DiskReadBytesPersec
  $diskWrite = [double]$disk.DiskWriteBytesPersec
  $diskBusy = [double]$disk.PercentDiskTime
}
[PSCustomObject]@{
  networkRxBps = [double]$rx
  networkTxBps = [double]$tx
  diskReadBps = $diskRead
  diskWriteBps = $diskWrite
  diskBusyPercent = $diskBusy
  cpuTemperatureC = $cpuTemp
  cpuTemperatureSource = $cpuTempSource
} | ConvertTo-Json -Compress
`;

  winPerfCache.pending = (async () => {
    const data = await runPowerShell(script, 6000);
    winPerfCache.data = data && typeof data === 'object' ? data : null;
    winPerfCache.at = Date.now();
    winPerfCache.pending = null;
    return winPerfCache.data;
  })();

  return winPerfCache.pending;
}

async function getStaticInfo(force = false) {
  const now = Date.now();
  // Static hardware/firmware identity changes very rarely. Keep it warm for 5 minutes.
  if (!force && cachedStaticInfo && now - cachedStaticAt < 5 * 60 * 1000) return cachedStaticInfo;

  const cpus = os.cpus();
  const base = {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'Unknown CPU',
    cpuCores: cpus.length,
    cpuPhysicalCores: null,
    cpuMaxClockMHz: null,
    totalMemory: os.totalmem(),
    gpu: null,
    gpus: [],
    osCaption: process.platform === 'win32' ? 'Windows' : os.type(),
    osVersion: os.release(),
    osBuildNumber: null,
    osDisplayVersion: null,
    osEdition: null,
    system: null,
    motherboard: null,
    bios: null,
    memoryModules: [],
    bootMode: null,
    secureBoot: null,
    secureBootSource: null,
    tpm: null,
    tpmInfo: null,
    tpmSource: null,
    lastBootUpTime: null,
    installDate: null,
    defender: null,
    firewall: null
  };

  if (process.platform === 'win32') {
    // One PowerShell process gathers static identity. Defender/firewall are intentionally
    // excluded and lazy-loaded by getSecurityInfo() so they cannot hold up startup.
    const script = `
$ErrorActionPreference='SilentlyContinue'
$gpus = @(Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor)
$gpu = $gpus | Sort-Object AdapterRAM -Descending | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture,LastBootUpTime,InstallDate
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name,Manufacturer,MaxClockSpeed,NumberOfCores,NumberOfLogicalProcessors
$cs = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,SystemType,HypervisorPresent
$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1 Manufacturer,Product,Version
$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1 Manufacturer,SMBIOSBIOSVersion,ReleaseDate
if ($os.LastBootUpTime) { $os.LastBootUpTime = ([datetime]$os.LastBootUpTime).ToString('o') }
if ($os.InstallDate) { $os.InstallDate = ([datetime]$os.InstallDate).ToString('o') }
if ($bios.ReleaseDate) { $bios.ReleaseDate = ([datetime]$bios.ReleaseDate).ToString('o') }
$ram = @(Get-CimInstance Win32_PhysicalMemory | Select-Object Manufacturer,PartNumber,Capacity,Speed,ConfiguredClockSpeed,DeviceLocator)
$cv = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'

# Boot mode: use the native GetFirmwareType API first; no elevation is required.
$bootMode = 'Unknown'
try {
  if (-not ('PurpleDragon.NativeFirmware' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace PurpleDragon {
  public static class NativeFirmware {
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool GetFirmwareType(out uint firmwareType);
  }
}
'@ -ErrorAction Stop
  }
  [uint32]$firmwareType = 0
  if ([PurpleDragon.NativeFirmware]::GetFirmwareType([ref]$firmwareType)) {
    if ($firmwareType -eq 2) { $bootMode = 'UEFI' }
    elseif ($firmwareType -eq 1) { $bootMode = 'Legacy BIOS' }
  }
} catch {}
if ($bootMode -eq 'Unknown') {
  try {
    $bcd = (& "$env:SystemRoot\\System32\\bcdedit.exe" /enum '{current}' 2>$null | Out-String)
    if ($bcd -match 'winload\\.efi') { $bootMode = 'UEFI' }
    elseif ($bcd -match 'winload\\.exe') { $bootMode = 'Legacy BIOS' }
  } catch {}
}

# Secure Boot: registry state is readable on normal Windows sessions and avoids
# Confirm-SecureBootUEFI permission errors. Confirm-SecureBootUEFI remains fallback.
$secureBoot = $null
$secureBootSource = $null
try {
  $sb = Get-ItemPropertyValue -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State' -Name UEFISecureBootEnabled -ErrorAction Stop
  if ($null -ne $sb) {
    $secureBoot = ([int]$sb -eq 1)
    $secureBootSource = 'Windows SecureBoot registry'
  }
} catch {}
if ($null -eq $secureBoot -and $bootMode -eq 'UEFI') {
  try {
    $secureBoot = [bool](Confirm-SecureBootUEFI -ErrorAction Stop)
    $secureBootSource = 'Confirm-SecureBootUEFI'
  } catch {}
}
if ($null -eq $secureBoot -and $bootMode -eq 'Legacy BIOS') {
  $secureBoot = $false
  $secureBootSource = 'Legacy BIOS mode'
}

# TPM: query both the TPM cmdlet and the correct MicrosoftTpm CIM namespace.
$tpm = $null
$tpmInfo = $null
$tpmSource = $null
try {
  $tpm = Get-Tpm -ErrorAction Stop | Select-Object TpmPresent,TpmReady,TpmEnabled,TpmActivated,ManufacturerIdTxt,ManufacturerVersion,AutoProvisioning
  if ($tpm) { $tpmSource = 'Get-Tpm' }
} catch {}
try {
  $tpmInfo = Get-CimInstance -Namespace 'root\\cimv2\\Security\\MicrosoftTpm' -ClassName Win32_Tpm -ErrorAction Stop |
    Select-Object ManufacturerIdTxt,ManufacturerVersion,SpecVersion,IsEnabled_InitialValue,IsActivated_InitialValue,IsOwned_InitialValue
  if ($tpmInfo -and -not $tpmSource) { $tpmSource = 'Win32_Tpm' }
} catch {}

# PnP fallback can still establish TPM presence if the TPM provider/cmdlet is restricted.
if ($null -eq $tpm) {
  try {
    $pnpTpm = Get-CimInstance Win32_PnPEntity -ErrorAction Stop |
      Where-Object { $_.Name -match 'Trusted Platform Module|TPM 2\\.0' } |
      Select-Object -First 1
    if ($pnpTpm) {
      $tpm = [PSCustomObject]@{ TpmPresent=$true; TpmReady=$null; TpmEnabled=$null; TpmActivated=$null; ManufacturerIdTxt=$null; ManufacturerVersion=$null; AutoProvisioning=$null }
      $tpmSource = 'Windows PnP security device'
      if ($null -eq $tpmInfo -and $pnpTpm.Name -match '2\\.0') {
        $tpmInfo = [PSCustomObject]@{ ManufacturerIdTxt=$null; ManufacturerVersion=$null; SpecVersion='2.0'; IsEnabled_InitialValue=$null; IsActivated_InitialValue=$null; IsOwned_InitialValue=$null }
      }
    }
  } catch {}
}

# Last-resort TPM presence/readiness fallback from the built-in tpmtool output.
if (($null -eq $tpm -or $null -eq $tpm.TpmReady) -and (Test-Path "$env:SystemRoot\\System32\\tpmtool.exe")) {
  try {
    $text = (& "$env:SystemRoot\\System32\\tpmtool.exe" getdeviceinformation 2>$null | Out-String)
    if ($text) {
      $present = $null; $ready = $null; $version = $null
      if ($text -match '(?im)TPM Present\\s*:\\s*(True|False)') { $present = [bool]::Parse($matches[1]) }
      if ($text -match '(?im)(?:TPM Ready|Is Initialized|Ready For Storage)\\s*:\\s*(True|False)') { $ready = [bool]::Parse($matches[1]) }
      if ($text -match '(?im)TPM Version\\s*:\\s*([^\\r\\n]+)') { $version = $matches[1].Trim() }
      if ($null -ne $present -or $null -ne $ready) {
        $knownPresent = if ($null -ne $tpm -and $null -ne $tpm.TpmPresent) { $tpm.TpmPresent } else { $present }
        $knownReady = if ($null -ne $tpm -and $null -ne $tpm.TpmReady) { $tpm.TpmReady } else { $ready }
        $tpm = [PSCustomObject]@{ TpmPresent=$knownPresent; TpmReady=$knownReady; TpmEnabled=$null; TpmActivated=$null; ManufacturerIdTxt=$null; ManufacturerVersion=$null; AutoProvisioning=$null }
        if (-not $tpmSource) { $tpmSource = 'tpmtool' }
      }
      if ($version -and $null -eq $tpmInfo) {
        $tpmInfo = [PSCustomObject]@{ ManufacturerIdTxt=$null; ManufacturerVersion=$null; SpecVersion=$version; IsEnabled_InitialValue=$null; IsActivated_InitialValue=$null; IsOwned_InitialValue=$null }
      }
    }
  } catch {}
}

[PSCustomObject]@{
  gpu=$gpu;gpus=$gpus;os=$os;cpu=$cpu;system=$cs;board=$board;bios=$bios;ram=$ram;
  currentVersion=[PSCustomObject]@{DisplayVersion=$cv.DisplayVersion;EditionID=$cv.EditionID;ProductName=$cv.ProductName;CurrentBuildNumber=$cv.CurrentBuildNumber;UBR=$cv.UBR};
  secureBoot=$secureBoot;secureBootSource=$secureBootSource;bootMode=$bootMode;tpm=$tpm;tpmInfo=$tpmInfo;tpmSource=$tpmSource
} | ConvertTo-Json -Depth 7 -Compress
`;
    const extra = await runPowerShell(script, 7000);
    if (extra && typeof extra === 'object') {
      base.gpu = extra.gpu || null;
      base.gpus = Array.isArray(extra.gpus) ? extra.gpus : (extra.gpus ? [extra.gpus] : []);
      base.osCaption = extra.os?.Caption || extra.currentVersion?.ProductName || base.osCaption;
      base.osVersion = extra.os?.Version || base.osVersion;
      base.osBuildNumber = extra.os?.BuildNumber || extra.currentVersion?.CurrentBuildNumber || null;
      base.osDisplayVersion = extra.currentVersion?.DisplayVersion || null;
      base.osEdition = extra.currentVersion?.EditionID || null;
      if (base.osBuildNumber && extra.currentVersion?.UBR !== undefined && extra.currentVersion?.UBR !== null) {
        base.osBuildNumber = `${base.osBuildNumber}.${extra.currentVersion.UBR}`;
      }
      base.lastBootUpTime = extra.os?.LastBootUpTime || null;
      base.installDate = extra.os?.InstallDate || null;
      base.system = extra.system || null;
      base.cpuPhysicalCores = extra.cpu?.NumberOfCores ?? null;
      base.cpuMaxClockMHz = extra.cpu?.MaxClockSpeed ?? null;
      base.motherboard = extra.board || null;
      base.bios = extra.bios || null;
      base.memoryModules = Array.isArray(extra.ram) ? extra.ram : (extra.ram ? [extra.ram] : []);
      base.bootMode = extra.bootMode || null;
      base.secureBoot = typeof extra.secureBoot === 'boolean' ? extra.secureBoot : null;
      base.secureBootSource = extra.secureBootSource || null;
      base.tpm = extra.tpm || null;
      base.tpmInfo = extra.tpmInfo || null;
      base.tpmSource = extra.tpmSource || null;
    }
  }

  cachedStaticInfo = base;
  cachedStaticAt = Date.now();
  saveStaticCacheToDisk(base);
  return base;
}

async function getSecurityInfo(force = false) {
  if (process.platform !== 'win32') return {
    defender: null, firewall: [], antivirusProducts: [], recentEvents: [],
    uac: null, smartScreen: null, bitLocker: null,
    update: { latestHotfix: null, rebootPending: null },
    providerStatus: {}
  };

  const now = Date.now();
  // v1.4.0: Security Center remains fully lazy. Each provider is isolated so a
  // slow/blocked Windows API cannot erase otherwise-valid security data.
  if (!force && securityCache.data && now - securityCache.at < 30 * 1000) return securityCache.data;
  if (securityCache.pending) return securityCache.pending;

  const defenderScript = `
$ErrorActionPreference='Stop'
$result = $null
$source = $null
try {
  if (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue) {
    $result = Get-MpComputerStatus -ErrorAction Stop | Select-Object AntivirusEnabled,AntispywareEnabled,RealTimeProtectionEnabled,BehaviorMonitorEnabled,IoavProtectionEnabled,NISEnabled,AntivirusSignatureAge,AntivirusSignatureLastUpdated,QuickScanAge,FullScanAge,IsTamperProtected,AMRunningMode,DefenderSignaturesOutOfDate,RebootRequired
    $source = 'Get-MpComputerStatus'
  }
} catch {}
if ($null -eq $result) {
  try {
    $result = Get-CimInstance -Namespace 'root\\Microsoft\\Windows\\Defender' -ClassName MSFT_MpComputerStatus -ErrorAction Stop | Select-Object AntivirusEnabled,AntispywareEnabled,RealTimeProtectionEnabled,BehaviorMonitorEnabled,IoavProtectionEnabled,NISEnabled,AntivirusSignatureAge,AntivirusSignatureLastUpdated,QuickScanAge,FullScanAge,IsTamperProtected,AMRunningMode,DefenderSignaturesOutOfDate,RebootRequired
    $source = 'MSFT_MpComputerStatus'
  } catch {}
}
[PSCustomObject]@{ data=$result; source=$source } | ConvertTo-Json -Depth 5 -Compress
`;

  const firewallScript = `
$ErrorActionPreference='SilentlyContinue'
$profiles = @()
$source = $null
try {
  $profiles = @(Get-NetFirewallProfile -ErrorAction Stop | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction)
  if ($profiles.Count -gt 0) { $source = 'Get-NetFirewallProfile' }
} catch {}
if ($profiles.Count -eq 0) {
  $map = @(
    @{ Name='Domain'; Key='DomainProfile' },
    @{ Name='Private'; Key='StandardProfile' },
    @{ Name='Public'; Key='PublicProfile' }
  )
  foreach ($item in $map) {
    try {
      $v = Get-ItemPropertyValue -Path ("HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\" + $item.Key) -Name EnableFirewall -ErrorAction Stop
      $profiles += [PSCustomObject]@{ Name=$item.Name; Enabled=([int]$v -ne 0); DefaultInboundAction=$null; DefaultOutboundAction=$null }
    } catch {}
  }
  if ($profiles.Count -gt 0) { $source = 'Windows Firewall registry' }
}
[PSCustomObject]@{ data=$profiles; source=$source } | ConvertTo-Json -Depth 5 -Compress
`;

  const antivirusScript = `
$ErrorActionPreference='SilentlyContinue'
$items = @()
try {
  $items = @(Get-CimInstance -Namespace 'root\\SecurityCenter2' -ClassName AntivirusProduct -ErrorAction Stop | ForEach-Object {
    [PSCustomObject]@{
      displayName=[string]$_.displayName
      productState=if ($null -ne $_.productState) { [int]$_.productState } else { $null }
      timestamp=if ($_.timestamp) { [string]$_.timestamp } else { $null }
      instanceGuid=if ($_.instanceGuid) { [string]$_.instanceGuid } else { $null }
      pathToSignedProductExe=if ($_.pathToSignedProductExe) { [string]$_.pathToSignedProductExe } else { $null }
      source='SecurityCenter2'
    }
  })
} catch {}
$items | ConvertTo-Json -Depth 5 -Compress
`;

  const platformScript = `
$ErrorActionPreference='SilentlyContinue'
$uac = $null
$smart = $null
$rebootPending = $false
try {
  $u = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -ErrorAction Stop
  $uac = [PSCustomObject]@{
    enabled = ([int]$u.EnableLUA -eq 1)
    consentPromptBehaviorAdmin = if ($null -ne $u.ConsentPromptBehaviorAdmin) { [int]$u.ConsentPromptBehaviorAdmin } else { $null }
    promptOnSecureDesktop = if ($null -ne $u.PromptOnSecureDesktop) { ([int]$u.PromptOnSecureDesktop -eq 1) } else { $null }
  }
} catch {}

$explorer = $null
$appHost = $null
$policyEnabled = $null
$policyLevel = $null
try { $explorer = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer' -Name SmartScreenEnabled -ErrorAction Stop).SmartScreenEnabled } catch {}
if ($null -eq $explorer) {
  try { $explorer = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer' -Name SmartScreenEnabled -ErrorAction Stop).SmartScreenEnabled } catch {}
}
try { $appHost = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AppHost' -Name EnableWebContentEvaluation -ErrorAction Stop).EnableWebContentEvaluation } catch {}
try {
  $p = Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -ErrorAction Stop
  if ($null -ne $p.EnableSmartScreen) { $policyEnabled = ([int]$p.EnableSmartScreen -ne 0) }
  if ($null -ne $p.ShellSmartScreenLevel) { $policyLevel = [string]$p.ShellSmartScreenLevel }
} catch {}
$smart = [PSCustomObject]@{
  explorer = if ($null -ne $explorer) { [string]$explorer } elseif ($policyEnabled -eq $false) { 'Off' } elseif ($policyEnabled -eq $true -and $policyLevel) { $policyLevel } elseif ($policyEnabled -eq $true) { 'On' } else { $null }
  appHostEnabled = if ($null -ne $appHost) { ([int]$appHost -ne 0) } else { $null }
  policyEnabled = $policyEnabled
  policyLevel = $policyLevel
}

try {
  $rebootPending = (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') -or
                   (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired')
  try {
    $pfro = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager' -Name PendingFileRenameOperations -ErrorAction Stop).PendingFileRenameOperations
    if ($pfro) { $rebootPending = $true }
  } catch {}
} catch {}

[PSCustomObject]@{
  uac=$uac
  smartScreen=$smart
  rebootPending=[bool]$rebootPending
} | ConvertTo-Json -Depth 6 -Compress
`;

  const bitLockerScript = `
$ErrorActionPreference='SilentlyContinue'
$result = $null
$supported = $null
$source = $null
try {
  if (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue) {
    $supported = $true
    $bl = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop | Select-Object -First 1
    if ($bl) {
      $result = [PSCustomObject]@{
        supported=$true
        mountPoint=[string]$bl.MountPoint
        volumeStatus=[string]$bl.VolumeStatus
        protectionStatus=[string]$bl.ProtectionStatus
        encryptionPercentage=if ($null -ne $bl.EncryptionPercentage) { [double]$bl.EncryptionPercentage } else { $null }
        encryptionMethod=[string]$bl.EncryptionMethod
        lockStatus=[string]$bl.LockStatus
      }
      $source = 'Get-BitLockerVolume'
    }
  }
} catch {}

if ($null -eq $result) {
  try {
    $manageBde = "$env:SystemRoot\\System32\\manage-bde.exe"
    if (Test-Path $manageBde) {
      $text = (& $manageBde -status $env:SystemDrive 2>$null | Out-String)
      if ($LASTEXITCODE -eq 0 -and $text) {
        $supported = $true
        $conversion = $null; $percent = $null; $protection = $null; $method = $null; $lock = $null
        if ($text -match '(?im)^\\s*Conversion Status:\\s*(.+?)\\s*$') { $conversion = $matches[1].Trim() }
        if ($text -match '(?im)^\\s*Percentage Encrypted:\\s*([0-9.]+)%') { $percent = [double]$matches[1] }
        if ($text -match '(?im)^\\s*Protection Status:\\s*(.+?)\\s*$') { $protection = $matches[1].Trim() }
        if ($text -match '(?im)^\\s*Encryption Method:\\s*(.+?)\\s*$') { $method = $matches[1].Trim() }
        if ($text -match '(?im)^\\s*Lock Status:\\s*(.+?)\\s*$') { $lock = $matches[1].Trim() }
        $result = [PSCustomObject]@{
          supported=$true
          mountPoint=[string]$env:SystemDrive
          volumeStatus=$conversion
          protectionStatus=$protection
          encryptionPercentage=$percent
          encryptionMethod=$method
          lockStatus=$lock
        }
        $source = 'manage-bde'
      }
    }
  } catch {}
}

if ($null -eq $supported) { $supported = $false }
[PSCustomObject]@{ data=$result; supported=[bool]$supported; source=$source } | ConvertTo-Json -Depth 5 -Compress
`;

  const hotfixScript = `
$ErrorActionPreference='SilentlyContinue'
$latest = $null
try {
  $latest = Get-CimInstance Win32_QuickFixEngineering -ErrorAction Stop |
    Where-Object { $_.HotFixID } |
    Sort-Object @{Expression={
      try { [datetime]$_.InstalledOn } catch { [datetime]::MinValue }
    }} -Descending |
    Select-Object -First 1 HotFixID,Description,@{N='InstalledOn';E={
      try { ([datetime]$_.InstalledOn).ToString('o') } catch { [string]$_.InstalledOn }
    }}
} catch {}
$latest | ConvertTo-Json -Depth 4 -Compress
`;

  const eventsScript = `
$ErrorActionPreference='SilentlyContinue'
$items = @()
try {
  $items = @(Get-WinEvent -FilterHashtable @{
      LogName='Microsoft-Windows-Windows Defender/Operational'
      StartTime=(Get-Date).AddDays(-7)
      Id=@(1000,1001,1116,1117,5007)
    } -MaxEvents 12 -ErrorAction Stop |
    Select-Object -First 12 @{N='id';E={$_.Id}},@{N='timeCreated';E={$_.TimeCreated.ToString('o')}},@{N='level';E={$_.LevelDisplayName}})
} catch {}
$items | ConvertTo-Json -Depth 5 -Compress
`;

  securityCache.pending = (async () => {
    const started = Date.now();
    const [defWrap, fwWrap, avResult, platformResult, blWrap, latestHotfix, recentEvents] = await Promise.all([
      runPowerShell(defenderScript, 6000),
      runPowerShell(firewallScript, 4500),
      runPowerShell(antivirusScript, 4500),
      runPowerShell(platformScript, 3000),
      runPowerShell(bitLockerScript, 5000),
      runPowerShell(hotfixScript, 4500),
      runPowerShell(eventsScript, 3500)
    ]);

    const defender = defWrap && typeof defWrap === 'object' ? (defWrap.data || null) : null;
    const firewallRaw = fwWrap && typeof fwWrap === 'object' ? fwWrap.data : null;
    const firewall = Array.isArray(firewallRaw) ? firewallRaw : (firewallRaw ? [firewallRaw] : []);
    let antivirusProducts = Array.isArray(avResult) ? avResult : (avResult ? [avResult] : []);
    const platform = platformResult && typeof platformResult === 'object' ? platformResult : {};
    const bitLocker = blWrap && typeof blWrap === 'object' ? (blWrap.data || (blWrap.supported === false ? { supported: false } : null)) : null;
    const events = Array.isArray(recentEvents) ? recentEvents : (recentEvents ? [recentEvents] : []);

    // If SecurityCenter2 is blocked but Microsoft Defender itself answered, surface
    // Defender as an observed provider without pretending SecurityCenter2 returned it.
    if (!antivirusProducts.length && defender && typeof defender.AntivirusEnabled === 'boolean') {
      antivirusProducts = [{
        displayName: 'Microsoft Defender Antivirus',
        productState: null,
        timestamp: null,
        source: 'Microsoft Defender status',
        registeredWithSecurityCenter: false
      }];
    }

    const data = {
      defender,
      firewall,
      antivirusProducts,
      uac: platform.uac || null,
      smartScreen: platform.smartScreen || null,
      bitLocker,
      update: {
        latestHotfix: latestHotfix && typeof latestHotfix === 'object' ? latestHotfix : null,
        rebootPending: typeof platform.rebootPending === 'boolean' ? platform.rebootPending : null
      },
      recentEvents: events,
      queryDurationMs: Date.now() - started,
      source: 'Independent local Windows security providers',
      providerStatus: {
        defender: { ok: Boolean(defender), source: defWrap?.source || null },
        firewall: { ok: firewall.length > 0, source: fwWrap?.source || null },
        antivirus: { ok: antivirusProducts.length > 0, source: antivirusProducts[0]?.source || 'SecurityCenter2' },
        platform: { ok: Boolean(platform.uac || platform.smartScreen || typeof platform.rebootPending === 'boolean') },
        bitLocker: { ok: Boolean(bitLocker), source: blWrap?.source || null, supported: blWrap?.supported ?? bitLocker?.supported ?? null },
        hotfix: { ok: Boolean(latestHotfix && latestHotfix.HotFixID) },
        events: { ok: Array.isArray(events) }
      }
    };

    securityCache.data = data;
    securityCache.at = Date.now();
    return data;
  })().finally(() => {
    securityCache.pending = null;
  });

  return securityCache.pending;
}

function securitySummaryText(security, info) {
  const def = security?.defender || {};
  const fw = Array.isArray(security?.firewall) ? security.firewall : [];
  const tpm = info?.tpm || {};
  const bl = security?.bitLocker || null;
  const lines = [
    'Purple Dragon PowerTools - Security Summary',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    `Microsoft Defender: ${def.RealTimeProtectionEnabled === true ? 'Real-time protection ON' : def.RealTimeProtectionEnabled === false ? 'Real-time protection OFF' : 'Unavailable'}`,
    `Defender signatures: ${def.DefenderSignaturesOutOfDate === true ? 'Out of date' : def.DefenderSignaturesOutOfDate === false ? 'Current' : 'Unavailable'}`,
    `Firewall: ${fw.length ? fw.map(p => `${p.Name}=${p.Enabled ? 'On' : 'Off'}`).join(', ') : 'Unavailable'}`,
    `Secure Boot: ${info?.secureBoot === true ? 'Enabled' : info?.secureBoot === false ? 'Disabled' : 'Unavailable'}`,
    `TPM: ${tpm.TpmReady === true ? 'Ready' : tpm.TpmPresent === true ? 'Present / not ready' : tpm.TpmPresent === false ? 'Not present' : 'Unavailable'}`,
    `UAC: ${security?.uac?.enabled === true ? 'Enabled' : security?.uac?.enabled === false ? 'Disabled' : 'Unavailable'}`,
    `BitLocker (${bl?.mountPoint || rootDrive()}): ${bl?.supported === false ? 'Not supported on this Windows installation' : bl ? `${bl.protectionStatus || 'Unknown'} / ${bl.volumeStatus || 'Unknown'}` : 'Unavailable'}`,
    `Restart pending: ${security?.update?.rebootPending === true ? 'Yes' : security?.update?.rebootPending === false ? 'No' : 'Unavailable'}`
  ];
  return lines.join('\n');
}

async function getStartupItems(force = false) {
  if (process.platform !== 'win32') return [];
  const now = Date.now();
  if (!force && now - startupCache.at < 15000) return startupCache.data;
  if (startupCache.pending) return startupCache.pending;

  const script = `
$ErrorActionPreference='SilentlyContinue'
function Get-ApprovalState([string]$name) {
  $paths = @(
    'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
    'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder',
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32',
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'
  )
  foreach ($rp in $paths) {
    try {
      $value = (Get-ItemProperty -LiteralPath $rp -Name $name -ErrorAction Stop).$name
      if ($value -is [byte[]] -and $value.Length -gt 0) {
        if ($value[0] -eq 2) { return 'Enabled' }
        if ($value[0] -in @(3,6,7)) { return 'Disabled' }
      }
    } catch {}
  }
  return 'Unknown'
}
function Get-ExePath([string]$command) {
  if ([string]::IsNullOrWhiteSpace($command)) { return $null }
  $expanded = [Environment]::ExpandEnvironmentVariables($command.Trim())
  if ($expanded -match '^"([^\"]+?\\.exe)"') { return $matches[1] }
  if ($expanded -match '^([^\\s]+?\\.exe)(?:\\s|$)') { return $matches[1] }
  return $null
}
$items = @(Get-CimInstance Win32_StartupCommand | ForEach-Object {
  $exe = Get-ExePath ([string]$_.Command)
  $publisher = $null
  if ($exe -and (Test-Path -LiteralPath $exe)) {
    try { $publisher = (Get-Item -LiteralPath $exe).VersionInfo.CompanyName } catch {}
  }
  [PSCustomObject]@{
    Name = [string]$_.Name
    Publisher = if ($publisher) { [string]$publisher } else { 'Unknown' }
    Command = [string]$_.Command
    Location = [string]$_.Location
    User = [string]$_.User
    State = Get-ApprovalState ([string]$_.Name)
  }
} | Sort-Object Name)
@($items) | ConvertTo-Json -Depth 4 -Compress
`;

  startupCache.pending = (async () => {
    const result = await runPowerShell(script, 10000);
    const items = Array.isArray(result) ? result : (result && typeof result === 'object' ? [result] : []);
    startupCache.data = items.slice(0, 100);
    startupCache.at = Date.now();
    startupCache.pending = null;
    return startupCache.data;
  })();
  return startupCache.pending;
}




// v0.5.0 — Process & App Center ---------------------------------------------
// This module is completely lazy: no process/app inventory is collected during boot.
const PROTECTED_PROCESS_NAMES = new Set([
  'system','registry','smss.exe','csrss.exe','wininit.exe','services.exe','lsass.exe',
  'winlogon.exe','fontdrvhost.exe','dwm.exe','svchost.exe','taskhostw.exe','sihost.exe',
  'shellexperiencehost.exe','startmenuexperiencehost.exe','memory compression','secure system'
]);

function normalizeProcessName(name) {
  return String(name || '').trim().toLowerCase();
}

function isProtectedProcessRecord(item) {
  if (!item) return true;
  const pid = Number(item.pid || item.Pid || 0);
  const name = normalizeProcessName(item.name || item.Name);
  if (!Number.isInteger(pid) || pid <= 4) return true;
  if (PROTECTED_PROCESS_NAMES.has(name)) return true;
  const exe = String(item.path || item.Path || '').toLowerCase();
  const ownExe = String(process.execPath || '').toLowerCase();
  if (exe && ownExe && exe === ownExe) return true;
  if (name.includes('purple dragon powertools')) return true;
  return false;
}

function publicProcessRecord(item) {
  if (!item) return null;
  const protectedProcess = isProtectedProcessRecord(item);
  return {
    pid: Number(item.pid) || 0,
    name: String(item.name || 'Unknown process'),
    cpuPercent: Math.max(0, Math.min(100, Number(item.cpuPercent) || 0)),
    sampleReady: item.sampleReady !== false,
    memoryBytes: Math.max(0, Number(item.memoryBytes) || 0),
    ioReadBps: Math.max(0, Number(item.ioReadBps) || 0),
    ioWriteBps: Math.max(0, Number(item.ioWriteBps) || 0),
    threads: Math.max(0, Number(item.threads) || 0),
    handles: Math.max(0, Number(item.handles) || 0),
    path: item.path ? String(item.path) : null,
    startTime: item.startTime || null,
    protected: protectedProcess,
    canTerminate: !protectedProcess,
    canRestart: !protectedProcess && Boolean(item.path),
    canReveal: Boolean(item.path)
  };
}

async function getProcessSnapshot(force = false) {
  if (process.platform !== 'win32') return { generatedAt: new Date().toISOString(), processes: [], summary: { count: 0, totalMemoryBytes: 0 } };
  const now = Date.now();
  if (!force && processCenterLastSnapshot && now - processCenterCache.at < 1200) return processCenterLastSnapshot;
  if (processCenterCache.pending) return processCenterCache.pending;

  const script = `
$ErrorActionPreference='SilentlyContinue'
$gp = @{}
Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $gp[[int]$_.Id] = $_ }
$items = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
  $pidValue = [int]$_.ProcessId
  $p = $gp[$pidValue]
  $cpu = $null; $ws = 0; $threads = 0; $handles = 0; $started = $null
  if ($p) {
    try { $cpu = [double]$p.CPU } catch {}
    try { $ws = [double]$p.WorkingSet64 } catch {}
    try { $threads = [int]$p.Threads.Count } catch {}
    try { $handles = [int]$p.HandleCount } catch {}
    try { if ($p.StartTime) { $started = ([datetime]$p.StartTime).ToString('o') } } catch {}
  }
  [PSCustomObject]@{
    Pid=$pidValue
    Name=[string]$_.Name
    CpuSeconds=$cpu
    MemoryBytes=$ws
    ReadBytes=[double]($_.ReadTransferCount)
    WriteBytes=[double]($_.WriteTransferCount)
    Threads=$threads
    Handles=$handles
    Path=if ($_.ExecutablePath) { [string]$_.ExecutablePath } else { $null }
    StartTime=$started
  }
})
@($items) | ConvertTo-Json -Depth 4 -Compress
`;

  processCenterCache.pending = (async () => {
    const queryStarted = Date.now();
    const result = await runPowerShell(script, 7000);
    const raw = Array.isArray(result) ? result : (result && typeof result === 'object' ? [result] : []);
    const sampleAt = Date.now();
    const nextSamples = new Map();
    const logicalCores = Math.max(1, os.cpus().length);
    const processes = raw.map(row => {
      const pid = Number(row.Pid) || 0;
      const cpuSeconds = Number(row.CpuSeconds);
      const readBytes = Number(row.ReadBytes);
      const writeBytes = Number(row.WriteBytes);
      const previous = processCenterCache.samples.get(pid);
      let cpuPercent = 0, ioReadBps = 0, ioWriteBps = 0;
      if (previous) {
        const elapsed = Math.max(0.2, (sampleAt - previous.at) / 1000);
        if (Number.isFinite(cpuSeconds) && Number.isFinite(previous.cpuSeconds)) {
          cpuPercent = Math.max(0, Math.min(100, ((cpuSeconds - previous.cpuSeconds) / elapsed / logicalCores) * 100));
        }
        if (Number.isFinite(readBytes) && Number.isFinite(previous.readBytes)) ioReadBps = Math.max(0, (readBytes - previous.readBytes) / elapsed);
        if (Number.isFinite(writeBytes) && Number.isFinite(previous.writeBytes)) ioWriteBps = Math.max(0, (writeBytes - previous.writeBytes) / elapsed);
      }
      nextSamples.set(pid, { at: sampleAt, cpuSeconds: Number.isFinite(cpuSeconds) ? cpuSeconds : 0, readBytes: Number.isFinite(readBytes) ? readBytes : 0, writeBytes: Number.isFinite(writeBytes) ? writeBytes : 0 });
      return publicProcessRecord({
        pid, name: row.Name, cpuPercent, sampleReady: Boolean(previous), memoryBytes: Number(row.MemoryBytes) || 0,
        ioReadBps, ioWriteBps, threads: row.Threads, handles: row.Handles,
        path: row.Path || null, startTime: row.StartTime || null
      });
    }).filter(Boolean);
    processCenterCache.samples = nextSamples;
    processes.sort((a,b) => (b.cpuPercent - a.cpuPercent) || (b.memoryBytes - a.memoryBytes) || a.name.localeCompare(b.name));
    const summary = {
      count: processes.length,
      totalMemoryBytes: processes.reduce((sum,p)=>sum+p.memoryBytes,0),
      totalIoReadBps: processes.reduce((sum,p)=>sum+p.ioReadBps,0),
      totalIoWriteBps: processes.reduce((sum,p)=>sum+p.ioWriteBps,0),
      protectedCount: processes.filter(p=>p.protected).length,
      queryMs: Date.now() - queryStarted
    };
    processCenterLastSnapshot = { generatedAt: new Date().toISOString(), processes: processes.slice(0, 300), summary };
    processCenterCache.data = processCenterLastSnapshot.processes;
    processCenterCache.at = Date.now();
    processCenterCache.pending = null;
    return processCenterLastSnapshot;
  })().catch(error => {
    processCenterCache.pending = null;
    writeDiagnostic('Process Center inventory', error);
    return { generatedAt: new Date().toISOString(), processes: [], summary: { count: 0, totalMemoryBytes: 0, queryMs: Date.now() - now }, error: String(error?.message || error) };
  });
  return processCenterCache.pending;
}

function cachedProcessByPid(pid) {
  const n = Number(pid);
  return processCenterLastSnapshot?.processes?.find(p => p.pid === n) || null;
}

async function revealProcessFile(pid) {
  const item = cachedProcessByPid(pid);
  if (!item?.path || !fs.existsSync(item.path)) return { ok: false, error: 'Executable path is unavailable.' };
  shell.showItemInFolder(item.path);
  addActivity('Process file revealed', `${item.name} · PID ${item.pid}`);
  return { ok: true };
}

function copyProcessPath(pid) {
  const item = cachedProcessByPid(pid);
  if (!item?.path) return { ok: false, error: 'Executable path is unavailable.' };
  clipboard.writeText(item.path);
  return { ok: true };
}

async function endProcess(pid) {
  const item = cachedProcessByPid(pid);
  if (!item) return { ok: false, error: 'Process is no longer in the current snapshot.' };
  if (isProtectedProcessRecord(item)) return { ok: false, error: 'PowerTools blocks termination of protected Windows/PowerTools processes.' };
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: 'warning', title: 'End Process',
    message: `End ${item.name}?`,
    detail: `PID ${item.pid}. Unsaved work in this application may be lost. PowerTools does not force-kill protected Windows processes.`,
    buttons: ['Cancel', 'End Process'], defaultId: 0, cancelId: 0, noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };
  const result = await runExec(windowsExecutable('taskkill.exe'), ['/PID', String(item.pid), '/T'], 5000);
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout || 'Windows did not end the process.' };
  addActivity('Process ended', `${item.name} · PID ${item.pid}`);
  addChangeJournalEntry({category:'Process & Apps',title:'Process ended',summary:`${item.name} · PID ${item.pid}`,source:'Process & App Center',risk:'Medium'});
  processCenterCache.at = 0;
  return { ok: true };
}

async function restartProcess(pid) {
  const item = cachedProcessByPid(pid);
  if (!item) return { ok: false, error: 'Process is no longer in the current snapshot.' };
  if (isProtectedProcessRecord(item)) return { ok: false, error: 'PowerTools blocks restart of protected Windows/PowerTools processes.' };
  if (!item.path || !fs.existsSync(item.path)) return { ok: false, error: 'This process does not expose a restartable executable path.' };
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: 'warning', title: 'Restart Process',
    message: `Restart ${item.name}?`,
    detail: `PID ${item.pid} will be closed, then ${path.basename(item.path)} will be started again without the original command-line arguments. Unsaved work may be lost.`,
    buttons: ['Cancel', 'Restart'], defaultId: 0, cancelId: 0, noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };
  const killed = await runExec(windowsExecutable('taskkill.exe'), ['/PID', String(item.pid), '/T'], 5000);
  if (!killed.ok) return { ok: false, error: killed.stderr || killed.stdout || 'Windows did not stop the process.' };
  await new Promise(resolve => setTimeout(resolve, 450));
  try {
    const child = spawn(item.path, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    addActivity('Process restarted', `${item.name} · previous PID ${item.pid}`);
    addChangeJournalEntry({category:'Process & Apps',title:'Process restarted',summary:`${item.name} · previous PID ${item.pid}`,source:'Process & App Center',risk:'Medium'});
    processCenterCache.at = 0;
    return { ok: true };
  } catch (error) {
    writeDiagnostic('Process restart', error);
    return { ok: false, error: String(error?.message || error) };
  }
}

function parseInstallDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{8}$/.test(text)) return text || null;
  return `${text.slice(0,4)}-${text.slice(4,6)}-${text.slice(6,8)}`;
}

async function getInstalledApps(force = false) {
  if (process.platform !== 'win32') return { generatedAt: new Date().toISOString(), apps: [], summary: { count: 0 } };
  const now = Date.now();
  if (!force && installedAppsCache.data?.length && now - installedAppsCache.at < 2 * 60 * 1000) {
    return { generatedAt: new Date(installedAppsCache.at).toISOString(), apps: installedAppsCache.data, summary: { count: installedAppsCache.data.length, estimatedBytes: installedAppsCache.data.reduce((sum,a)=>sum+(Number(a.estimatedSizeBytes)||0),0) } };
  }
  if (installedAppsCache.pending) return installedAppsCache.pending;
  const script = `
$ErrorActionPreference='SilentlyContinue'
$roots = @(
  @{Path='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Scope='Machine x64'},
  @{Path='HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Scope='Machine x86'},
  @{Path='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Scope='Current user'}
)
$all = foreach ($root in $roots) {
  Get-ItemProperty $root.Path -ErrorAction SilentlyContinue | Where-Object {
    $_.DisplayName -and $_.SystemComponent -ne 1 -and $_.ReleaseType -notmatch 'Update|Hotfix|Security Update'
  } | ForEach-Object {
    [PSCustomObject]@{
      Name=[string]$_.DisplayName
      Version=[string]$_.DisplayVersion
      Publisher=[string]$_.Publisher
      InstallDate=[string]$_.InstallDate
      EstimatedSizeKB=if ($_.EstimatedSize) { [double]$_.EstimatedSize } else { 0 }
      InstallLocation=[string]$_.InstallLocation
      DisplayIcon=[string]$_.DisplayIcon
      UninstallString=[string]$_.UninstallString
      QuietUninstallString=[string]$_.QuietUninstallString
      Scope=$root.Scope
      RegistryKey=[string]$_.PSChildName
    }
  }
}
@($all | Sort-Object Name,Version,Publisher -Unique) | ConvertTo-Json -Depth 4 -Compress
`;
  installedAppsCache.pending = (async () => {
    const result = await runPowerShell(script, 9000);
    const raw = Array.isArray(result) ? result : (result && typeof result === 'object' ? [result] : []);
    const apps = raw.map((a,index) => ({
      id: index,
      name: String(a.Name || 'Unnamed application'),
      version: String(a.Version || ''), publisher: String(a.Publisher || ''),
      installDate: parseInstallDate(a.InstallDate),
      estimatedSizeBytes: Math.max(0, Number(a.EstimatedSizeKB) || 0) * 1024,
      installLocation: String(a.InstallLocation || ''), displayIcon: String(a.DisplayIcon || ''),
      scope: String(a.Scope || ''), registryKey: String(a.RegistryKey || '')
    })).filter(a=>a.name).sort((a,b)=>a.name.localeCompare(b.name, undefined, {sensitivity:'base'}));
    installedAppsCache.data = apps.slice(0, 700);
    installedAppsCache.at = Date.now(); installedAppsCache.pending = null;
    return { generatedAt: new Date().toISOString(), apps: installedAppsCache.data, summary: { count: installedAppsCache.data.length, estimatedBytes: installedAppsCache.data.reduce((sum,a)=>sum+a.estimatedSizeBytes,0) } };
  })().catch(error => {
    installedAppsCache.pending = null; writeDiagnostic('Installed Apps inventory', error);
    return { generatedAt: new Date().toISOString(), apps: [], summary: { count: 0 }, error: String(error?.message || error) };
  });
  return installedAppsCache.pending;
}

function cachedInstalledApp(index) {
  const n = Number(index);
  return Number.isInteger(n) ? (installedAppsCache.data?.find(app => Number(app.id) === n) || null) : null;
}

function cleanDisplayIconPath(value) {
  let text = String(value || '').trim();
  if (!text) return null;
  if (text.startsWith('"')) {
    const end = text.indexOf('"', 1);
    if (end > 1) text = text.slice(1, end);
  } else {
    text = text.replace(/,\s*-?\d+\s*$/, '');
  }
  text = text.replace(/^"|"$/g,'').trim();
  return text && fs.existsSync(text) ? text : null;
}

async function revealInstalledApp(index) {
  const item = cachedInstalledApp(index);
  if (!item) return { ok: false, error: 'Application inventory is stale. Refresh Apps and try again.' };
  let target = item.installLocation && fs.existsSync(item.installLocation) ? item.installLocation : null;
  if (!target) target = cleanDisplayIconPath(item.displayIcon);
  if (!target) return { ok: false, error: 'Windows did not expose an installation location for this app.' };
  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      const result = await shell.openPath(target);
      if (result) return { ok: false, error: result };
    } else shell.showItemInFolder(target);
    addActivity('Application location opened', item.name);
    return { ok: true };
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}

async function openInstalledAppsSettings() {
  await shell.openExternal('ms-settings:appsfeatures');
  addActivity('Installed Apps opened', 'Windows Settings');
  return { ok: true };
}

// v0.4.0 — Storage & Data Hub -------------------------------------------------
// Everything in this section is lazy/on-demand. Nothing here runs during app boot.
function storagePublicPath(kind) {
  const allowed = {
    downloads: 'downloads',
    documents: 'documents',
    pictures: 'pictures',
    videos: 'videos',
    desktop: 'desktop',
    temp: 'temp'
  };
  if (kind === 'system') return rootDrive();
  const appKey = allowed[String(kind || '')];
  if (!appKey) return null;
  try { return app.getPath(appKey); } catch { return null; }
}

function storageAnalysisTargets() {
  const candidates = [
    ['Downloads', 'downloads'],
    ['Documents', 'documents'],
    ['Pictures', 'pictures'],
    ['Videos', 'videos'],
    ['Desktop', 'desktop']
  ];
  const seen = new Set();
  const out = [];
  for (const [label, key] of candidates) {
    let value = null;
    try { value = app.getPath(key); } catch { }
    if (!value) continue;
    const normalized = path.resolve(value).toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ id: key, label, path: value });
  }
  return out;
}

function publicCleanupPreview(data) {
  if (!data) return null;
  return {
    generatedAt: data.generatedAt,
    totalBytes: data.totalBytes,
    totalFiles: data.totalFiles,
    durationMs: data.durationMs,
    incomplete: Boolean(data.incomplete),
    categories: (data.categories || []).map(c => ({
      id: c.id, label: c.label, description: c.description,
      bytes: c.bytes, files: c.files, incomplete: Boolean(c.incomplete)
    }))
  };
}

async function getStorageInventory(force = false) {
  const now = Date.now();
  if (!force && storageInventoryCache.data && now - storageInventoryCache.at < 30 * 1000) return storageInventoryCache.data;
  if (storageInventoryCache.pending) return storageInventoryCache.pending;

  storageInventoryCache.pending = (async () => {
    let data = null;
    if (process.platform === 'win32') {
      // v2.0.3: Win32_LogicalDisk is the primary volume enumerator. It reliably
      // exposes secondary fixed disks and removable USB volumes on systems where
      // the modern Storage cmdlets only report the system volume.
      const script = `
$ErrorActionPreference='SilentlyContinue'
$physicalRaw = @()
$physical = @()
try {
  $physicalRaw = @(Get-PhysicalDisk -ErrorAction Stop)
  $physical = @($physicalRaw | Select-Object DeviceId,FriendlyName,MediaType,BusType,HealthStatus,OperationalStatus,Size,SpindleSpeed)
} catch {}
$volumeMap = @{}
try {
  @(Get-Volume -ErrorAction Stop | Where-Object { $_.DriveLetter }) | ForEach-Object {
    $volumeMap[([string]$_.DriveLetter).ToUpperInvariant()] = $_
  }
} catch {}
$logical = @()
try {
  # DriveType 2 = removable, 3 = local/fixed. USB HDDs/SSDs commonly report as 3.
  $logical = @(Get-CimInstance Win32_LogicalDisk -ErrorAction Stop | Where-Object {
    $_.DeviceID -match '^[A-Za-z]:$' -and ([int]$_.DriveType -eq 2 -or [int]$_.DriveType -eq 3) -and [double]$_.Size -gt 0
  })
} catch {}
$volumes = @()
foreach ($v in $logical) {
  $letter = ([string]$v.DeviceID).TrimEnd(':').ToUpperInvariant()
  $disk = $null; $pd = $null; $pdRaw = $null; $rel = $null; $diskDrive = $null; $diskNumber = $null; $temperature = $null
  $volumeInfo = if ($volumeMap.ContainsKey($letter)) { $volumeMap[$letter] } else { $null }
  try {
    $part = Get-Partition -DriveLetter $letter -ErrorAction Stop | Select-Object -First 1
    if ($part) {
      $diskNumber = [int]$part.DiskNumber
      $disk = Get-Disk -Number $diskNumber -ErrorAction Stop
    }
  } catch {}
  # CIM association fallback covers USB/removable devices and older storage stacks.
  try {
    $partCim = Get-CimAssociatedInstance -InputObject $v -Association Win32_LogicalDiskToPartition -ErrorAction Stop | Select-Object -First 1
    if ($partCim) {
      $diskDrive = Get-CimAssociatedInstance -InputObject $partCim -Association Win32_DiskDriveToDiskPartition -ErrorAction Stop | Select-Object -First 1
      if ($null -eq $diskNumber -and $diskDrive -and $null -ne $diskDrive.Index) { $diskNumber = [int]$diskDrive.Index }
    }
  } catch {}
  if (-not $disk -and $null -ne $diskNumber) {
    try { $disk = Get-Disk -Number $diskNumber -ErrorAction Stop } catch {}
  }
  if ($disk) {
    $pd = $physical | Where-Object { $_.FriendlyName -eq $disk.FriendlyName } | Select-Object -First 1
    if (-not $pd -and $null -ne $disk.Number) { $pd = $physical | Where-Object { [string]$_.DeviceId -eq [string]$disk.Number } | Select-Object -First 1 }
  }
  if (-not $pd -and $diskDrive) {
    $pd = $physical | Where-Object { $_.FriendlyName -eq $diskDrive.Model } | Select-Object -First 1
  }
  if ($pd) {
    try {
      $pdRaw = $physicalRaw | Where-Object { [string]$_.DeviceId -eq [string]$pd.DeviceId } | Select-Object -First 1
      if ($pdRaw) { $rel = Get-StorageReliabilityCounter -PhysicalDisk $pdRaw -ErrorAction Stop }
      if ($rel -and $rel.Temperature -gt 0 -and $rel.Temperature -lt 130) { $temperature = [double]$rel.Temperature }
    } catch {}
  }
  $size = [double]$v.Size
  $free = [double]$v.FreeSpace
  # Avoid Math.Max overload binding with multi-terabyte Double values.
  # Explicit subtraction keeps Used/Percent accurate on large HDD/SSD/USB volumes.
  $used = [double]$size - [double]$free
  if ($used -lt 0) { $used = [double]0 }
  $pct = if ($size -gt 0) { [math]::Round(([double]$used / [double]$size) * 100, 1) } else { 0 }
  $model = if ($disk) { [string]$disk.FriendlyName } elseif ($diskDrive) { [string]$diskDrive.Model } else { $null }
  $busType = if ($disk -and [string]$disk.BusType) { [string]$disk.BusType } elseif ($pd -and [string]$pd.BusType) { [string]$pd.BusType } elseif ($diskDrive) { [string]$diskDrive.InterfaceType } else { $null }
  $interfaceType = if ($diskDrive) { [string]$diskDrive.InterfaceType } else { $null }
  $pnpId = if ($diskDrive) { [string]$diskDrive.PNPDeviceID } else { $null }
  $isUsb = ([string]$busType -match '(?i)USB') -or ([string]$interfaceType -match '(?i)USB') -or ([string]$pnpId -match '(?i)USB')
  $isRemovable = ([int]$v.DriveType -eq 2)
  $mediaRaw = if ($pd) { [string]$pd.MediaType } else { $null }
  $spindle = if ($pd -and $null -ne $pd.SpindleSpeed) { [double]$pd.SpindleSpeed } else { $null }
  $mediaClass = 'Unknown'
  if ($mediaRaw -match '(?i)^SSD$|Solid State') { $mediaClass = 'SSD' }
  elseif ($mediaRaw -match '(?i)^HDD$') { $mediaClass = 'HDD' }
  elseif ($model -match '(?i)SSD|Solid State|NVMe') { $mediaClass = 'SSD' }
  elseif ($null -ne $spindle -and $spindle -gt 0) { $mediaClass = 'HDD' }
  $connectionType = if ($isUsb) { 'USB' } elseif ($busType) { [string]$busType } elseif ($interfaceType) { [string]$interfaceType } else { 'Internal' }
  $health = if ($volumeInfo -and $volumeInfo.HealthStatus) { [string]$volumeInfo.HealthStatus } elseif ($disk -and $disk.HealthStatus) { [string]$disk.HealthStatus } elseif ($pd) { [string]$pd.HealthStatus } else { $null }
  $operational = if ($volumeInfo -and $volumeInfo.OperationalStatus) { [string]($volumeInfo.OperationalStatus -join ', ') } elseif ($disk -and $disk.OperationalStatus) { [string]($disk.OperationalStatus -join ', ') } elseif ($pd) { [string]($pd.OperationalStatus -join ', ') } else { $null }
  $volumes += [PSCustomObject]@{
    DriveLetter = $letter
    Label = [string]$v.VolumeName
    FileSystem = [string]$v.FileSystem
    DriveType = if ([int]$v.DriveType -eq 2) { 'Removable' } else { 'Fixed' }
    DriveTypeCode = [int]$v.DriveType
    Size = $size
    Free = $free
    Used = $used
    Percent = $pct
    DiskNumber = $diskNumber
    DiskModel = $model
    MediaType = $mediaRaw
    MediaClass = $mediaClass
    BusType = $busType
    InterfaceType = $interfaceType
    ConnectionType = $connectionType
    IsUsb = [bool]$isUsb
    IsRemovable = [bool]$isRemovable
    HealthStatus = $health
    OperationalStatus = $operational
    TemperatureC = $temperature
  }
}

# Last-chance provider if CIM logical-disk enumeration is unavailable.
if ($volumes.Count -eq 0) {
  try {
    @(Get-Volume -ErrorAction Stop | Where-Object { $_.DriveLetter -and $_.Size -gt 0 -and ([string]$_.DriveType -match 'Fixed|Removable') }) | ForEach-Object {
      $size=[double]$_.Size; $free=[double]$_.SizeRemaining; $used=[double]$size-[double]$free; if($used -lt 0){$used=[double]0}
      $pct=if($size -gt 0){[math]::Round(([double]$used/[double]$size)*100,1)}else{0}
      $volumes += [PSCustomObject]@{DriveLetter=[string]$_.DriveLetter;Label=[string]$_.FileSystemLabel;FileSystem=[string]$_.FileSystem;DriveType=[string]$_.DriveType;DriveTypeCode=$null;Size=$size;Free=$free;Used=$used;Percent=$pct;DiskNumber=$null;DiskModel=$null;MediaType=$null;MediaClass='Unknown';BusType=$null;InterfaceType=$null;ConnectionType=if([string]$_.DriveType -match 'Removable'){'USB / Removable'}else{'Internal'};IsUsb=$false;IsRemovable=([string]$_.DriveType -match 'Removable');HealthStatus=[string]$_.HealthStatus;OperationalStatus=[string]($_.OperationalStatus -join ', ');TemperatureC=$null}
    }
  } catch {}
}

[PSCustomObject]@{
  volumes = @($volumes | Sort-Object DriveLetter)
  physicalDisks = @($physical)
} | ConvertTo-Json -Depth 7 -Compress
`;
      const result = await runPowerShell(script, 12000);
      if (result && typeof result === 'object') data = result;
    }

    let volumes = Array.isArray(data?.volumes) ? data.volumes : (data?.volumes ? [data.volumes] : []);
    if (!volumes.length) {
      const st = storageStats();
      volumes = [{
        DriveLetter: process.platform === 'win32' ? String(st.root || 'C:').replace(/[\\:]/g, '') : st.root,
        Label: 'System', FileSystem: null, DriveType: 'Fixed', DriveTypeCode: 3, Size: st.total, Free: st.free,
        Used: st.used, Percent: st.percent, DiskNumber: null, DiskModel: null, MediaType: null, MediaClass: 'Unknown',
        BusType: null, InterfaceType: null, ConnectionType: 'Internal', IsUsb: false, IsRemovable: false,
        HealthStatus: null, OperationalStatus: null, TemperatureC: null
      }];
    }
    volumes = volumes.map(v => {
      // Capacity and free-space are the authoritative Windows values. Derive Used
      // and Percent here instead of trusting provider-computed fields so one
      // PowerShell/provider numeric quirk cannot render every drive as 0% used.
      const size = Math.max(0, Number(v.Size) || 0);
      const freeRaw = Number(v.Free);
      const free = Number.isFinite(freeRaw) ? Math.max(0, Math.min(size, freeRaw)) : 0;
      const used = Math.max(0, size - free);
      const percent = size > 0 ? Math.max(0, Math.min(100, (used / size) * 100)) : 0;
      return {
        driveLetter: String(v.DriveLetter || '').replace(':', ''),
        label: String(v.Label || ''),
        fileSystem: String(v.FileSystem || ''),
        driveType: String(v.DriveType || ''),
        driveTypeCode: Number.isFinite(Number(v.DriveTypeCode)) ? Number(v.DriveTypeCode) : null,
        size,
        free,
        used,
        percent,
        diskNumber: v.DiskNumber === null || v.DiskNumber === undefined ? null : Number(v.DiskNumber),
        model: v.DiskModel ? String(v.DiskModel) : null,
        mediaType: v.MediaType ? String(v.MediaType) : null,
        mediaClass: ['SSD','HDD'].includes(String(v.MediaClass || '').toUpperCase()) ? String(v.MediaClass).toUpperCase() : 'Unknown',
        busType: v.BusType ? String(v.BusType) : null,
        interfaceType: v.InterfaceType ? String(v.InterfaceType) : null,
        connectionType: v.ConnectionType ? String(v.ConnectionType) : null,
        isUsb: Boolean(v.IsUsb),
        isRemovable: Boolean(v.IsRemovable),
        health: v.HealthStatus ? String(v.HealthStatus) : null,
        operationalStatus: v.OperationalStatus ? String(v.OperationalStatus) : null,
        temperatureC: Number.isFinite(Number(v.TemperatureC)) && Number(v.TemperatureC) > 0 ? Number(v.TemperatureC) : null
      };
    }).filter(v => v.size > 0 && v.driveLetter);

    const totalBytes = volumes.reduce((sum, v) => sum + v.size, 0);
    const freeBytes = volumes.reduce((sum, v) => sum + v.free, 0);
    const usedBytes = volumes.reduce((sum, v) => sum + v.used, 0);
    const sysLetter = process.platform === 'win32' ? path.parse(rootDrive()).root.replace(/[\\:]/g, '').toUpperCase() : rootDrive();
    const systemDrive = volumes.find(v => String(v.driveLetter).toUpperCase() === sysLetter) || volumes[0] || null;
    const lowSpaceDrives = volumes.filter(v => v.size > 0 && (v.free / v.size) < 0.10).length;
    const usbDrives = volumes.filter(v => v.isUsb || /^usb/i.test(String(v.connectionType || ''))).length;
    const removableDrives = volumes.filter(v => v.isRemovable).length;
    const ssdDrives = volumes.filter(v => v.mediaClass === 'SSD').length;
    const hddDrives = volumes.filter(v => v.mediaClass === 'HDD').length;
    const inventory = {
      generatedAt: new Date().toISOString(),
      volumes,
      physicalDisks: Array.isArray(data?.physicalDisks) ? data.physicalDisks : (data?.physicalDisks ? [data.physicalDisks] : []),
      summary: { driveCount: volumes.length, totalBytes, freeBytes, usedBytes, systemDrive, lowSpaceDrives, usbDrives, removableDrives, ssdDrives, hddDrives }
    };
    storageInventoryCache.data = inventory;
    storageInventoryCache.at = Date.now();
    storageInventoryCache.pending = null;
    return inventory;
  })().catch(error => {
    storageInventoryCache.pending = null;
    writeDiagnostic('Storage inventory', error);
    throw error;
  });

  return storageInventoryCache.pending;
}

async function scanUserFolder(target, token, deadline) {
  const result = { id: target.id, label: target.label, path: target.path, bytes: 0, files: 0, folders: 0, unreadable: 0, incomplete: false, largeFiles: [] };
  const stack = [target.path];
  let steps = 0;
  const MAX_FILES = 250000;
  const LARGE_THRESHOLD = 250 * 1024 * 1024;
  while (stack.length) {
    if (token !== storageAnalysisCache.token) { result.incomplete = true; result.cancelled = true; break; }
    if (Date.now() > deadline || result.files >= MAX_FILES) { result.incomplete = true; break; }
    const dir = stack.pop();
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { result.unreadable += 1; continue; }
    result.folders += 1;
    for (const entry of entries) {
      if (token !== storageAnalysisCache.token) { result.incomplete = true; result.cancelled = true; break; }
      if (Date.now() > deadline || result.files >= MAX_FILES) { result.incomplete = true; break; }
      const full = path.join(dir, entry.name);
      try {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) { stack.push(full); continue; }
        if (!entry.isFile()) continue;
        const stat = await fs.promises.stat(full);
        const size = Number(stat.size) || 0;
        result.files += 1;
        result.bytes += size;
        if (size >= LARGE_THRESHOLD) {
          result.largeFiles.push({ name: entry.name, path: full, size, modifiedAt: stat.mtime?.toISOString?.() || null, category: target.label });
          if (result.largeFiles.length > 160) result.largeFiles = result.largeFiles.sort((a,b)=>b.size-a.size).slice(0,100);
        }
      } catch { result.unreadable += 1; }
      steps += 1;
      if (steps % 200 === 0) await new Promise(resolve => setImmediate(resolve));
    }
  }
  result.largeFiles = result.largeFiles.sort((a,b)=>b.size-a.size).slice(0,100);
  return result;
}

async function analyzeUserStorage() {
  if (storageAnalysisCache.pending) return storageAnalysisCache.pending;
  const token = ++storageAnalysisCache.token;
  const started = Date.now();
  const deadline = started + 60 * 1000;
  storageAnalysisCache.pending = (async () => {
    const targets = storageAnalysisTargets();
    const categories = [];
    let largeFiles = [];
    for (const target of targets) {
      if (token !== storageAnalysisCache.token || Date.now() > deadline) break;
      const result = await scanUserFolder(target, token, deadline);
      categories.push({ ...result, largeFiles: undefined });
      largeFiles = largeFiles.concat(result.largeFiles || []);
      if (result.cancelled) break;
    }
    largeFiles = largeFiles.sort((a,b)=>b.size-a.size).slice(0,100);
    const analysis = {
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      categories,
      largeFiles,
      totalBytes: categories.reduce((sum,c)=>sum+c.bytes,0),
      totalFiles: categories.reduce((sum,c)=>sum+c.files,0),
      incomplete: categories.some(c=>c.incomplete) || categories.length < targets.length,
      cancelled: token !== storageAnalysisCache.token
    };
    if (!analysis.cancelled) { storageAnalysisCache.data = analysis; storageAnalysisCache.at = Date.now(); }
    storageAnalysisCache.pending = null;
    return analysis;
  })().catch(error => {
    storageAnalysisCache.pending = null;
    writeDiagnostic('Storage analysis', error);
    throw error;
  });
  return storageAnalysisCache.pending;
}

function cancelUserStorageAnalysis() {
  storageAnalysisCache.token += 1;
  return { ok: true };
}

async function collectCleanupCandidates(root, cutoffMs, deadline, maxFiles = 75000) {
  const files = [];
  const dirs = [];
  let bytes = 0;
  let incomplete = false;
  if (!root || !fs.existsSync(root)) return { files, dirs, bytes, incomplete };
  const resolvedRoot = path.resolve(root);
  const stack = [resolvedRoot];
  let steps = 0;
  while (stack.length) {
    if (Date.now() > deadline || files.length >= maxFiles) { incomplete = true; break; }
    const dir = stack.pop();
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { continue; }
    dirs.push(dir);
    for (const entry of entries) {
      if (Date.now() > deadline || files.length >= maxFiles) { incomplete = true; break; }
      const full = path.join(dir, entry.name);
      try {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) { stack.push(full); continue; }
        if (!entry.isFile()) continue;
        const stat = await fs.promises.stat(full);
        if (stat.mtimeMs > cutoffMs) continue;
        files.push(full);
        bytes += Number(stat.size) || 0;
      } catch { }
      steps += 1;
      if (steps % 250 === 0) await new Promise(resolve => setImmediate(resolve));
    }
  }
  return { files, dirs, bytes, incomplete };
}

async function previewStorageCleanup(force = false) {
  const now = Date.now();
  if (!force && cleanupPreviewCache.data && now - cleanupPreviewCache.at < 2 * 60 * 1000) return publicCleanupPreview(cleanupPreviewCache.data);
  if (cleanupPreviewCache.pending) return cleanupPreviewCache.pending;
  cleanupPreviewCache.pending = (async () => {
    const started = Date.now();
    const deadline = started + 25 * 1000;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const tempRoot = os.tmpdir();
    const temp = await collectCleanupCandidates(tempRoot, cutoff, deadline);
    const categories = [{
      id: 'user-temp', label: 'User temporary files',
      description: 'Files in your Windows user TEMP folder that have not changed for at least 24 hours.',
      bytes: temp.bytes, files: temp.files.length, incomplete: temp.incomplete,
      candidates: temp.files, dirs: temp.dirs, root: tempRoot
    }];

    let diagnosticCandidates = [];
    let diagnosticBytes = 0;
    try {
      const diagnostic = path.join(app.getPath('userData'), 'powertools-diagnostics.log');
      if (fs.existsSync(diagnostic)) {
        const st = fs.statSync(diagnostic);
        diagnosticCandidates = [diagnostic]; diagnosticBytes = Number(st.size) || 0;
      }
    } catch { }
    categories.push({
      id: 'diagnostics', label: 'PowerTools diagnostics log',
      description: 'The local PowerTools diagnostic log only. Settings, caches, reports, and sensor files are not touched.',
      bytes: diagnosticBytes, files: diagnosticCandidates.length, incomplete: false,
      candidates: diagnosticCandidates, dirs: [], root: app.getPath('userData')
    });

    const data = {
      generatedAt: new Date().toISOString(), categories,
      totalBytes: categories.reduce((sum,c)=>sum+c.bytes,0),
      totalFiles: categories.reduce((sum,c)=>sum+c.files,0),
      durationMs: Date.now() - started,
      incomplete: categories.some(c=>c.incomplete)
    };
    cleanupPreviewCache.data = data;
    cleanupPreviewCache.at = Date.now();
    cleanupPreviewCache.pending = null;
    return publicCleanupPreview(data);
  })().catch(error => {
    cleanupPreviewCache.pending = null;
    writeDiagnostic('Cleanup preview', error);
    throw error;
  });
  return cleanupPreviewCache.pending;
}

function pathIsWithin(root, candidate) {
  try {
    const a = path.resolve(root).toLowerCase();
    const b = path.resolve(candidate).toLowerCase();
    return b === a || b.startsWith(a + path.sep.toLowerCase());
  } catch { return false; }
}

async function runStorageCleanup(categoryIds) {
  const preview = cleanupPreviewCache.data;
  if (!preview) return { ok: false, error: 'Create a cleanup preview first.' };
  const allowedIds = new Set(['user-temp', 'diagnostics']);
  const requested = [...new Set((Array.isArray(categoryIds) ? categoryIds : []).map(String))].filter(id => allowedIds.has(id));
  const selected = preview.categories.filter(c => requested.includes(c.id) && c.files > 0);
  if (!selected.length) return { ok: false, error: 'No previewed files are selected.' };
  const totalFiles = selected.reduce((sum,c)=>sum+c.files,0);
  const totalBytes = selected.reduce((sum,c)=>sum+c.bytes,0);
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Confirm Storage Cleanup',
    message: `Delete ${totalFiles.toLocaleString()} previewed file${totalFiles===1?'':'s'}?`,
    detail: `PowerTools will delete only the selected, previously previewed files (${(totalBytes / (1024**2)).toFixed(totalBytes >= 1024**3 ? 0 : 1)} MB shown before cleanup). User TEMP candidates are at least 24 hours old. This action cannot be undone.`,
    buttons: ['Cancel', 'Clean Now'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };

  let deletedFiles = 0, deletedBytes = 0, failed = 0;
  const dirs = new Set();
  for (const category of selected) {
    for (const file of category.candidates || []) {
      if (!pathIsWithin(category.root, file)) { failed += 1; continue; }
      try {
        const st = await fs.promises.stat(file).catch(()=>null);
        await fs.promises.unlink(file);
        deletedFiles += 1;
        deletedBytes += Number(st?.size) || 0;
        dirs.add(path.dirname(file));
      } catch { failed += 1; }
    }
    for (const d of category.dirs || []) if (pathIsWithin(category.root, d)) dirs.add(d);
  }
  const sortedDirs = [...dirs].sort((a,b)=>b.length-a.length);
  for (const d of sortedDirs) {
    if (selected.some(c => path.resolve(d).toLowerCase() === path.resolve(c.root).toLowerCase())) continue;
    try { await fs.promises.rmdir(d); } catch { }
  }
  cleanupPreviewCache.data = null; cleanupPreviewCache.at = 0;
  addActivity('Storage cleanup completed', `${deletedFiles} files · ${Math.round(deletedBytes / (1024**2))} MB reclaimed`);
  addChangeJournalEntry({category:'Storage',title:'Storage cleanup completed',summary:`${deletedFiles} files · ${Math.round(deletedBytes / (1024**2))} MB reclaimed · ${failed} failed`,source:'Storage & Data Hub',risk:'Medium'});
  return { ok: true, deletedFiles, deletedBytes, failed };
}

async function openStorageFolder(kind) {
  const folder = storagePublicPath(kind);
  if (!folder) return { ok: false };
  const result = await shell.openPath(folder);
  if (result) return { ok: false, error: result };
  addActivity('Storage location opened', String(kind));
  return { ok: true };
}

async function openStorageDrive(letter) {
  const inventory = await getStorageInventory(false);
  const clean = String(letter || '').replace(/[^a-z]/gi, '').slice(0,1).toUpperCase();
  if (!clean || !inventory.volumes.some(v => String(v.driveLetter).toUpperCase() === clean)) return { ok: false };
  const target = `${clean}:\\`;
  const result = await shell.openPath(target);
  if (result) return { ok: false, error: result };
  addActivity('Drive opened', target);
  return { ok: true };
}

async function revealAnalyzedLargeFile(index) {
  const analysis = storageAnalysisCache.data;
  const item = analysis?.largeFiles?.[Number(index)];
  if (!item?.path) return { ok: false };
  const allowed = storageAnalysisTargets().some(target => pathIsWithin(target.path, item.path));
  if (!allowed) return { ok: false };
  shell.showItemInFolder(item.path);
  return { ok: true };
}


function automationDataPath(name) {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, name);
  } catch { return null; }
}

function readAutomationJson(name, fallback) {
  try {
    const file = automationDataPath(name);
    if (!file || !fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed ?? fallback;
  } catch (error) {
    writeDiagnostic(`automation read ${name}`, error);
    return fallback;
  }
}

function writeAutomationJson(name, value) {
  try {
    const file = automationDataPath(name);
    if (!file) return false;
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (error) {
    writeDiagnostic(`automation write ${name}`, error);
    return false;
  }
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function automationId() {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeAutomationProcessName(value) {
  return String(value || '').trim().replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase().slice(0, 120);
}

function sanitizeAutomationRule(input, existing = null) {
  const raw = input && typeof input === 'object' ? input : {};
  const triggerRaw = raw.trigger && typeof raw.trigger === 'object' ? raw.trigger : {};
  const actionRaw = raw.action && typeof raw.action === 'object' ? raw.action : {};
  const triggerType = AUTOMATION_TRIGGER_TYPES.has(String(triggerRaw.type || '')) ? String(triggerRaw.type) : 'cpuAbove';
  const actionType = AUTOMATION_ACTION_TYPES.has(String(actionRaw.type || '')) ? String(actionRaw.type) : 'notification';
  const now = new Date().toISOString();
  const rule = {
    id: existing?.id || String(raw.id || '').slice(0, 80) || automationId(),
    name: String(raw.name || existing?.name || 'Automation rule').trim().slice(0, 80) || 'Automation rule',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : (existing ? existing.enabled !== false : true),
    trigger: { type: triggerType },
    action: { type: actionType },
    cooldownSec: Math.round(clampNumber(raw.cooldownSec, 30, 86400, 300)),
    createdAt: existing?.createdAt || String(raw.createdAt || now),
    updatedAt: now,
    lastTriggeredAt: existing?.lastTriggeredAt || raw.lastTriggeredAt || null,
    runCount: Math.max(0, Math.round(Number(existing?.runCount ?? raw.runCount ?? 0) || 0))
  };

  if (['cpuAbove', 'gpuAbove', 'ramAbove', 'batteryBelow'].includes(triggerType)) {
    rule.trigger.threshold = Math.round(clampNumber(triggerRaw.threshold, 1, 100, triggerType === 'batteryBelow' ? 20 : 85));
    rule.trigger.durationSec = Math.round(clampNumber(triggerRaw.durationSec, 0, 900, triggerType === 'batteryBelow' ? 30 : 15));
  } else if (triggerType === 'diskFreeBelow') {
    rule.trigger.threshold = Math.round(clampNumber(triggerRaw.threshold, 1, 99, 10));
    rule.trigger.durationSec = Math.round(clampNumber(triggerRaw.durationSec, 0, 900, 30));
  } else if (['processStarted', 'processStopped'].includes(triggerType)) {
    rule.trigger.processName = normalizeAutomationProcessName(triggerRaw.processName);
    if (!rule.trigger.processName) return { error: 'Enter an application/process name for this trigger.' };
  } else if (triggerType === 'networkDisconnected') {
    rule.trigger.durationSec = Math.round(clampNumber(triggerRaw.durationSec, 0, 300, 10));
  } else if (triggerType === 'dailyTime') {
    const time = String(triggerRaw.time || '').trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Daily time must use HH:MM in 24-hour format.' };
    rule.trigger.time = time;
  }

  if (['notification', 'activity'].includes(actionType)) {
    rule.action.message = String(actionRaw.message || '').trim().slice(0, 220);
  } else if (actionType === 'profile') {
    const profile = String(actionRaw.profile || 'balanced');
    if (!POWER_SCHEMES[profile]) return { error: 'Choose a supported performance profile.' };
    rule.action.profile = profile;
  } else if (actionType === 'navigate') {
    const view = String(actionRaw.view || 'dashboard');
    if (!AUTOMATION_VIEWS.has(view)) return { error: 'Choose a supported PowerTools page.' };
    rule.action.view = view;
  } else if (actionType === 'windowsTool') {
    const target = String(actionRaw.target || 'taskmanager');
    if (!AUTOMATION_WINDOWS_TARGETS.has(target)) return { error: 'Choose an allowlisted Windows tool.' };
    rule.action.target = target;
  }
  return { rule };
}

function persistAutomationRules() { writeAutomationJson('automation-rules.json', automationRules); }
function persistAutomationHistory() { writeAutomationJson('automation-history.json', automationHistory.slice(0, AUTOMATION_MAX_HISTORY)); }
function persistAutomationSettings() { writeAutomationJson('automation-settings.json', automationSettings); }

function automationTriggerLabel(rule) {
  const t = rule?.trigger || {};
  if (t.type === 'cpuAbove') return `CPU above ${t.threshold}% for ${t.durationSec}s`;
  if (t.type === 'gpuAbove') return `GPU above ${t.threshold}% for ${t.durationSec}s`;
  if (t.type === 'ramAbove') return `RAM above ${t.threshold}% for ${t.durationSec}s`;
  if (t.type === 'diskFreeBelow') return `System drive free below ${t.threshold}% for ${t.durationSec}s`;
  if (t.type === 'processStarted') return `${t.processName}.exe starts`;
  if (t.type === 'processStopped') return `${t.processName}.exe closes`;
  if (t.type === 'networkDisconnected') return `Network disconnected for ${t.durationSec}s`;
  if (t.type === 'batteryBelow') return `Battery below ${t.threshold}% for ${t.durationSec}s`;
  if (t.type === 'dailyTime') return `Daily at ${t.time}`;
  if (t.type === 'systemStartup') return 'PowerTools startup';
  return 'Unknown trigger';
}

function automationActionLabel(rule) {
  const a = rule?.action || {};
  if (a.type === 'notification') return 'Windows notification';
  if (a.type === 'activity') return 'Write activity log';
  if (a.type === 'profile') return `Set ${POWER_SCHEMES[a.profile]?.name || a.profile} profile`;
  if (a.type === 'navigate') return `Open ${a.view} page`;
  if (a.type === 'windowsTool') return `Open Windows ${a.target}`;
  return 'Unknown action';
}

function nextAutomationScheduleAt() {
  const now = new Date();
  let best = null;
  for (const rule of automationRules) {
    if (!rule.enabled || rule.trigger?.type !== 'dailyTime') continue;
    const [h, m] = String(rule.trigger.time || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    const candidate = new Date(now);
    candidate.setHours(h, m, 0, 0);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    if (!best || candidate < best) best = candidate;
  }
  return best ? best.toISOString() : null;
}

function publicAutomationState() {
  const enabledCount = automationRules.filter(r => r.enabled).length;
  return {
    masterEnabled: automationSettings.masterEnabled !== false,
    running: Boolean(automationEngineTimer),
    tickMs: AUTOMATION_TICK_MS,
    ruleCount: automationRules.length,
    enabledCount,
    lastTriggeredAt: automationHistory[0]?.at || null,
    nextScheduledAt: nextAutomationScheduleAt(),
    rules: automationRules.map(r => ({ ...r, trigger: { ...r.trigger }, action: { ...r.action } })),
    history: automationHistory.slice(0, 50)
  };
}

function automationCpuUsage() {
  const cpus = os.cpus();
  const current = cpus.map(cpu => ({ ...cpu.times }));
  if (!automationCpuSamples || automationCpuSamples.length !== current.length) {
    automationCpuSamples = current;
    return null;
  }
  let totalDelta = 0, idleDelta = 0;
  for (let i = 0; i < current.length; i++) {
    totalDelta += timesTotal(current[i]) - timesTotal(automationCpuSamples[i]);
    idleDelta += current[i].idle - automationCpuSamples[i].idle;
  }
  automationCpuSamples = current;
  if (totalDelta <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
}

function automationHasNetwork() {
  const all = os.networkInterfaces();
  for (const entries of Object.values(all)) {
    for (const item of entries || []) {
      if (item.internal) continue;
      const address = String(item.address || '');
      if (!address || address.startsWith('169.254.')) continue;
      return true;
    }
  }
  return false;
}

async function automationProcessNames(force = false) {
  const now = Date.now();
  if (!force && now - automationProcessCache.at < 5000) return automationProcessCache.names;
  if (automationProcessCache.pending) return automationProcessCache.pending;
  if (process.platform !== 'win32') return new Set();
  automationProcessCache.pending = (async () => {
    const data = await runPowerShell(`$n=@(Get-Process -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName -Unique); $n | ConvertTo-Json -Compress`, 4500);
    const arr = Array.isArray(data) ? data : data ? [data] : [];
    automationProcessCache.names = new Set(arr.map(normalizeAutomationProcessName).filter(Boolean));
    automationProcessCache.at = Date.now();
    automationProcessCache.pending = null;
    return automationProcessCache.names;
  })().catch(error => {
    writeDiagnostic('automation process snapshot', error);
    automationProcessCache.pending = null;
    return automationProcessCache.names;
  });
  return automationProcessCache.pending;
}

async function automationBattery(force = false) {
  const now = Date.now();
  if (!force && now - automationBatteryCache.at < 30000) return automationBatteryCache.data;
  if (automationBatteryCache.pending) return automationBatteryCache.pending;
  if (process.platform !== 'win32') return null;
  automationBatteryCache.pending = (async () => {
    const data = await runPowerShell(`$b=Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus; if($b){$b|ConvertTo-Json -Compress}else{'null'}`, 5000);
    automationBatteryCache.data = data && typeof data === 'object' ? data : null;
    automationBatteryCache.at = Date.now();
    automationBatteryCache.pending = null;
    return automationBatteryCache.data;
  })().catch(error => {
    writeDiagnostic('automation battery snapshot', error);
    automationBatteryCache.pending = null;
    return automationBatteryCache.data;
  });
  return automationBatteryCache.pending;
}

function automationRuntimeFor(id) {
  if (!automationRuntime.has(id)) automationRuntime.set(id, {});
  return automationRuntime.get(id);
}

function automationCooldownReady(rule, runtime, now) {
  const last = Number(runtime.lastFiredAt || 0);
  return !last || now - last >= Math.max(30000, Number(rule.cooldownSec || 300) * 1000);
}

async function openAutomationWindowsTarget(target) {
  if (process.platform !== 'win32' || !AUTOMATION_WINDOWS_TARGETS.has(String(target || ''))) return { ok: false, error: 'Windows tool is not allowlisted.' };
  const t = String(target);
  try {
    if (t === 'taskmanager') execFile('taskmgr.exe', [], { windowsHide: false }, () => {});
    else if (t === 'resmon') execFile('resmon.exe', [], { windowsHide: false }, () => {});
    else if (t === 'eventviewer') execFile('mmc.exe', ['eventvwr.msc'], { windowsHide: false }, () => {});
    else {
      const uri = { storage:'ms-settings:storagesense', network:'ms-settings:network-status', defender:'windowsdefender:', updates:'ms-settings:windowsupdate' }[t];
      if (!uri) return { ok: false, error: 'Windows tool is not allowlisted.' };
      await shell.openExternal(uri);
    }
    return { ok: true };
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}

async function setAutomationPerformanceProfile(id) {
  const profile = POWER_SCHEMES[String(id || '')];
  if (!profile || process.platform !== 'win32') return { ok: false, error: 'Profile unavailable' };
  const current = await getPerformanceProfiles();
  if (!current.profiles.find(p => p.id === id)?.available) return { ok: false, error: `${profile.name} power plan is not installed.` };
  const result = await runExec('powercfg.exe', ['/setactive', profile.guid]);
  return result.ok ? { ok: true, detail: profile.name } : { ok: false, error: result.stderr || 'Windows rejected the power-plan change.' };
}

function recordAutomationHistory(rule, origin, triggerDetail, result) {
  const item = {
    id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ruleId: rule.id,
    ruleName: rule.name,
    trigger: automationTriggerLabel(rule),
    action: automationActionLabel(rule),
    triggerDetail: String(triggerDetail || ''),
    origin: origin === 'manual' ? 'Manual run' : 'Automation engine',
    ok: result?.ok !== false,
    detail: String(result?.detail || result?.error || '').slice(0, 300)
  };
  automationHistory.unshift(item);
  automationHistory = automationHistory.slice(0, AUTOMATION_MAX_HISTORY);
  persistAutomationHistory();
  try { mainWindow?.webContents?.send('automation:event', item); } catch { }
  return item;
}

async function executeAutomationAction(rule, triggerDetail, origin = 'engine') {
  let result = { ok: true, detail: '' };
  try {
    const action = rule.action || {};
    if (action.type === 'notification') {
      const body = action.message || `${rule.name}: ${triggerDetail || automationTriggerLabel(rule)}`;
      if (Notification?.isSupported?.()) new Notification({ title: 'Purple Dragon PowerTools', body }).show();
      result.detail = body;
    } else if (action.type === 'activity') {
      const message = action.message || triggerDetail || automationTriggerLabel(rule);
      addActivity(rule.name, message);
      result.detail = message;
    } else if (action.type === 'profile') {
      result = await setAutomationPerformanceProfile(action.profile);
    } else if (action.type === 'navigate') {
      if (!AUTOMATION_VIEWS.has(action.view)) result = { ok: false, error: 'PowerTools page is not allowlisted.' };
      else {
        if (mainWindow?.isMinimized()) mainWindow.restore();
        mainWindow?.show();
        mainWindow?.webContents?.send('automation:navigate', action.view);
        result.detail = `Opened ${action.view}`;
      }
    } else if (action.type === 'windowsTool') {
      result = await openAutomationWindowsTarget(action.target);
      if (result.ok) result.detail = `Opened ${action.target}`;
    } else result = { ok: false, error: 'Unsupported automation action.' };
  } catch (error) {
    result = { ok: false, error: String(error?.message || error || 'Automation action failed') };
    writeDiagnostic(`automation action ${rule.id}`, error);
  }

  rule.lastTriggeredAt = new Date().toISOString();
  rule.runCount = Math.max(0, Number(rule.runCount || 0)) + 1;
  rule.updatedAt = rule.updatedAt || rule.lastTriggeredAt;
  persistAutomationRules();
  if (rule.action?.type !== 'activity') addActivity('Automation rule fired', `${rule.name} · ${result.ok ? automationActionLabel(rule) : 'Action failed'}`);
  return recordAutomationHistory(rule, origin, triggerDetail, result);
}

async function maybeFireThresholdRule(rule, condition, detail, now) {
  const rt = automationRuntimeFor(rule.id);
  if (!condition) { rt.conditionSince = 0; return; }
  if (!rt.conditionSince) rt.conditionSince = now;
  const durationMs = Math.max(0, Number(rule.trigger?.durationSec || 0) * 1000);
  if (now - rt.conditionSince < durationMs) return;
  if (!automationCooldownReady(rule, rt, now)) return;
  rt.lastFiredAt = now;
  await executeAutomationAction(rule, detail, 'engine');
}

async function evaluateAutomationRules() {
  if (automationEvaluating || automationSettings.masterEnabled === false) return;
  const enabled = automationRules.filter(r => r.enabled);
  if (!enabled.length) return;
  automationEvaluating = true;
  try {
    const now = Date.now();
    const types = new Set(enabled.map(r => r.trigger?.type));
    const snapshot = { now };
    if (types.has('cpuAbove')) snapshot.cpu = automationCpuUsage();
    if (types.has('ramAbove')) snapshot.ram = Math.round(((os.totalmem() - os.freemem()) / Math.max(1, os.totalmem())) * 100);
    if (types.has('diskFreeBelow')) {
      const st = storageStats();
      snapshot.diskFreePercent = st.total ? Math.round((st.free / st.total) * 100) : null;
    }
    if (types.has('gpuAbove')) {
      const gpu = await queryNvidiaMetrics(false);
      snapshot.gpu = Number.isFinite(Number(gpu?.utilization)) ? Number(gpu.utilization) : null;
    }
    if (types.has('processStarted') || types.has('processStopped')) snapshot.processNames = await automationProcessNames(false);
    if (types.has('networkDisconnected')) snapshot.networkConnected = automationHasNetwork();
    if (types.has('batteryBelow')) {
      const battery = await automationBattery(false);
      snapshot.batteryPercent = Number.isFinite(Number(battery?.EstimatedChargeRemaining)) ? Number(battery.EstimatedChargeRemaining) : null;
    }

    for (const rule of enabled) {
      const t = rule.trigger || {};
      const rt = automationRuntimeFor(rule.id);
      if (t.type === 'cpuAbove' && snapshot.cpu !== null) await maybeFireThresholdRule(rule, snapshot.cpu >= t.threshold, `CPU ${snapshot.cpu}%`, now);
      else if (t.type === 'gpuAbove' && snapshot.gpu !== null) await maybeFireThresholdRule(rule, snapshot.gpu >= t.threshold, `GPU ${Math.round(snapshot.gpu)}%`, now);
      else if (t.type === 'ramAbove') await maybeFireThresholdRule(rule, snapshot.ram >= t.threshold, `RAM ${snapshot.ram}%`, now);
      else if (t.type === 'diskFreeBelow' && snapshot.diskFreePercent !== null) await maybeFireThresholdRule(rule, snapshot.diskFreePercent <= t.threshold, `System drive ${snapshot.diskFreePercent}% free`, now);
      else if (t.type === 'batteryBelow' && snapshot.batteryPercent !== null) await maybeFireThresholdRule(rule, snapshot.batteryPercent <= t.threshold, `Battery ${snapshot.batteryPercent}%`, now);
      else if (t.type === 'processStarted' || t.type === 'processStopped') {
        const present = snapshot.processNames?.has(normalizeAutomationProcessName(t.processName)) || false;
        if (typeof rt.processPresent !== 'boolean') { rt.processPresent = present; continue; }
        const fired = t.type === 'processStarted' ? (!rt.processPresent && present) : (rt.processPresent && !present);
        rt.processPresent = present;
        if (fired && automationCooldownReady(rule, rt, now)) {
          rt.lastFiredAt = now;
          await executeAutomationAction(rule, `${t.processName}.exe ${present ? 'started' : 'closed'}`, 'engine');
        }
      } else if (t.type === 'networkDisconnected') {
        const connected = Boolean(snapshot.networkConnected);
        if (typeof rt.networkConnected !== 'boolean') { rt.networkConnected = connected; rt.networkArmed = connected; continue; }
        if (connected) { rt.networkConnected = true; rt.networkArmed = true; rt.disconnectSince = 0; continue; }
        if (rt.networkConnected) { rt.disconnectSince = now; rt.networkConnected = false; }
        if (rt.networkArmed && rt.disconnectSince && now - rt.disconnectSince >= Math.max(0, Number(t.durationSec || 0) * 1000) && automationCooldownReady(rule, rt, now)) {
          rt.lastFiredAt = now; rt.networkArmed = false;
          await executeAutomationAction(rule, `Network disconnected for ${t.durationSec || 0}s`, 'engine');
        }
      } else if (t.type === 'dailyTime') {
        const d = new Date(now);
        const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}@${t.time}`;
        if (hhmm === t.time && rt.lastDailyKey !== dateKey && automationCooldownReady(rule, rt, now)) {
          rt.lastDailyKey = dateKey; rt.lastFiredAt = now;
          await executeAutomationAction(rule, `Scheduled time ${t.time}`, 'engine');
        }
      } else if (t.type === 'systemStartup') {
        const created = Date.parse(rule.createdAt || '') || now;
        const eligible = created < AUTOMATION_SESSION_STARTED_AT && now - AUTOMATION_SESSION_STARTED_AT < 120000;
        if (eligible && !rt.startupFired && automationCooldownReady(rule, rt, now)) {
          rt.startupFired = true; rt.lastFiredAt = now;
          await executeAutomationAction(rule, 'PowerTools started', 'engine');
        }
      }
    }
  } catch (error) {
    writeDiagnostic('automation evaluate', error);
  } finally { automationEvaluating = false; }
}

function reconcileAutomationEngine() {
  const shouldRun = automationInitialized && automationSettings.masterEnabled !== false && automationRules.some(r => r.enabled);
  if (shouldRun && !automationEngineTimer) {
    automationEngineTimer = setInterval(() => evaluateAutomationRules(), AUTOMATION_TICK_MS);
    setTimeout(() => evaluateAutomationRules(), 180);
  } else if (!shouldRun && automationEngineTimer) {
    clearInterval(automationEngineTimer);
    automationEngineTimer = null;
  }
}

async function initializeAutomationEngine() {
  if (automationInitialized) return publicAutomationState();
  const settings = readAutomationJson('automation-settings.json', { masterEnabled: true });
  automationSettings = { masterEnabled: settings?.masterEnabled !== false };
  const rawRules = readAutomationJson('automation-rules.json', []);
  automationRules = (Array.isArray(rawRules) ? rawRules : []).slice(0, AUTOMATION_MAX_RULES).map(raw => sanitizeAutomationRule(raw, raw)?.rule).filter(Boolean);
  const rawHistory = readAutomationJson('automation-history.json', []);
  automationHistory = (Array.isArray(rawHistory) ? rawHistory : []).slice(0, AUTOMATION_MAX_HISTORY);
  automationInitialized = true;
  reconcileAutomationEngine();
  return publicAutomationState();
}

async function saveAutomationRule(input) {
  await initializeAutomationEngine();
  const incomingId = String(input?.id || '');
  const existing = automationRules.find(r => r.id === incomingId) || null;
  if (!existing && automationRules.length >= AUTOMATION_MAX_RULES) return { ok: false, error: `Maximum ${AUTOMATION_MAX_RULES} rules reached.` };
  const sanitized = sanitizeAutomationRule(input, existing);
  if (sanitized.error) return { ok: false, error: sanitized.error };
  if (existing) {
    const index = automationRules.findIndex(r => r.id === existing.id);
    automationRules[index] = sanitized.rule;
  } else automationRules.unshift(sanitized.rule);
  automationRuntime.delete(sanitized.rule.id);
  persistAutomationRules();
  reconcileAutomationEngine();
  addActivity(existing ? 'Automation rule updated' : 'Automation rule created', sanitized.rule.name);
  addChangeJournalEntry({category:'Automation',title:existing?'Automation rule updated':'Automation rule created',summary:sanitized.rule.name,source:'Automation Engine',undo:existing?{type:'automation-restore',snapshot:JSON.parse(JSON.stringify(existing))}:{type:'automation-create',id:sanitized.rule.id}});
  return { ok: true, state: publicAutomationState(), rule: sanitized.rule };
}

async function setAutomationRuleEnabled(id, enabled) {
  await initializeAutomationEngine();
  const rule = automationRules.find(r => r.id === String(id || ''));
  if (!rule) return { ok: false, error: 'Rule not found.' };
  const previousEnabled=rule.enabled !== false;
  rule.enabled = Boolean(enabled);
  rule.updatedAt = new Date().toISOString();
  automationRuntime.delete(rule.id);
  persistAutomationRules();
  reconcileAutomationEngine();
  addActivity('Automation rule toggled', `${rule.name} · ${rule.enabled ? 'Enabled' : 'Disabled'}`);
  if(previousEnabled!==rule.enabled)addChangeJournalEntry({category:'Automation',title:'Automation rule toggled',summary:`${rule.name} · ${rule.enabled?'Enabled':'Disabled'}`,source:'Automation Engine',undo:{type:'automation-toggle',id:rule.id,enabled:previousEnabled}});
  return { ok: true, state: publicAutomationState() };
}

async function deleteAutomationRule(id) {
  await initializeAutomationEngine();
  const rule = automationRules.find(r => r.id === String(id || ''));
  if (!rule) return { ok: false, error: 'Rule not found.' };
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'warning', buttons: ['Cancel', 'Delete Rule'], defaultId: 0, cancelId: 0,
    title: 'Delete automation rule?', message: rule.name,
    detail: 'This removes the local rule. It does not change Windows settings.'
  });
  if (choice.response !== 1) return { ok: false, canceled: true };
  automationRules = automationRules.filter(r => r.id !== rule.id);
  automationRuntime.delete(rule.id);
  persistAutomationRules();
  reconcileAutomationEngine();
  addActivity('Automation rule deleted', rule.name);
  addChangeJournalEntry({category:'Automation',title:'Automation rule deleted',summary:rule.name,source:'Automation Engine',undo:{type:'automation-delete',snapshot:JSON.parse(JSON.stringify(rule))}});
  return { ok: true, state: publicAutomationState() };
}

async function runAutomationRuleNow(id) {
  await initializeAutomationEngine();
  const rule = automationRules.find(r => r.id === String(id || ''));
  if (!rule) return { ok: false, error: 'Rule not found.' };
  const item = await executeAutomationAction(rule, 'Manual Run Now', 'manual');
  const rt = automationRuntimeFor(rule.id); rt.lastFiredAt = Date.now();
  return { ok: item.ok !== false, item, state: publicAutomationState(), error: item.ok === false ? item.detail : null };
}

async function setAutomationMasterEnabled(enabled) {
  await initializeAutomationEngine();
  const previousMasterEnabled=automationSettings.masterEnabled !== false;
  automationSettings.masterEnabled = Boolean(enabled);
  persistAutomationSettings();
  reconcileAutomationEngine();
  addActivity('Automation Engine', automationSettings.masterEnabled ? 'Enabled' : 'Paused');
  if(previousMasterEnabled!==automationSettings.masterEnabled)addChangeJournalEntry({category:'Automation',title:'Automation Engine state changed',summary:automationSettings.masterEnabled?'Engine enabled':'Engine paused',source:'Automation Engine',undo:{type:'automation-master',enabled:previousMasterEnabled}});
  return { ok: true, state: publicAutomationState() };
}

async function clearAutomationHistory() {
  await initializeAutomationEngine();
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question', buttons: ['Cancel', 'Clear History'], defaultId: 0, cancelId: 0,
    title: 'Clear automation history?', message: 'Clear local Automation Engine run history?',
    detail: 'Rules are kept. Only the local execution history is cleared.'
  });
  if (choice.response !== 1) return { ok: false, canceled: true };
  automationHistory = [];
  persistAutomationHistory();
  return { ok: true, state: publicAutomationState() };
}

function addActivity(title, detail) {
  activityLog.unshift({ id: Date.now() + Math.random(), title, detail, at: new Date().toISOString() });
  activityLog = activityLog.slice(0, 40);
}

async function getLiveMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const storage = storageStats();
  const cpuBundle = cpuUsageBundle();
  const memory = totalMemory ? Math.round((usedMemory / totalMemory) * 100) : 0;

  // v0.4.0 fast path: return CPU/RAM/storage immediately. Slow Windows/NVIDIA
  // providers refresh their caches in the background and appear on the next sample.
  const gpu = nvidiaCache.data;
  const windowsPerf = winPerfCache.data;
  const sinceBoot = Date.now() - BOOT_AT;
  // Stagger optional providers so first paint/static identity are not competing
  // with two extra Windows processes at the same time.
  if (sinceBoot >= 2500 && !nvidiaCache.pending && Date.now() - nvidiaCache.at >= 4000) {
    queryNvidiaMetrics().catch(error => writeDiagnostic('NVIDIA telemetry', error));
  }
  if (sinceBoot >= 5000 && !winPerfCache.pending && Date.now() - winPerfCache.at >= 8000) {
    queryWindowsPerf().catch(error => writeDiagnostic('Windows perf telemetry', error));
  }
  const gpuLoad = gpu?.utilization ?? null;
  const hardwareSensor = getHardwareSensorSnapshot();
  const fallbackCpuTemp = Number.isFinite(Number(windowsPerf?.cpuTemperatureC)) && windowsPerf?.cpuTemperatureC !== null ? Number(windowsPerf.cpuTemperatureC) : null;
  const cpuTemp = hardwareSensor?.cpuTemperatureC ?? fallbackCpuTemp;
  const cpuTempSource = hardwareSensor?.cpuTemperatureSource || windowsPerf?.cpuTemperatureSource || null;
  const gpuTemp = gpu?.temperatureC ?? null;

  let thermalPenalty = 0;
  if (Number.isFinite(cpuTemp)) thermalPenalty += Math.max(0, cpuTemp - 65) * 0.18;
  if (Number.isFinite(gpuTemp)) thermalPenalty += Math.max(0, gpuTemp - 70) * 0.16;
  const health = Math.max(1, Math.min(100, Math.round(
    100 - cpuBundle.overall * 0.12 - memory * 0.07 - storage.percent * 0.035 - thermalPenalty
  )));

  return {
    cpu: cpuBundle.overall,
    perCore: cpuBundle.perCore,
    cpuClockMHz: averageCpuClockMHz(),
    cpuTemperatureC: cpuTemp,
    cpuTemperatureSource: cpuTempSource,
    cpuTemperatureProvider: hardwareSensor?.provider || (fallbackCpuTemp !== null ? 'Windows' : null),
    cpuTemperatureSensorName: hardwareSensor?.cpuSensorName || null,
    cpuTemperatureStale: Boolean(hardwareSensor?.stale),
    cpuTemperatureBridgeRunning: Boolean(hardwareSensor) || (sensorBridgeState.elevationAttempted && Date.now() - sensorBridgeState.lastLaunchAt < 10000),
    cpuTemperatureBridgeElevationAttempted: Boolean(sensorBridgeState.elevationAttempted),
    cpuTemperatureBridgeNeedsElevation: Boolean(sensorBridgeState.needsElevation),
    cpuTemperatureBridgeError: sensorBridgeState.lastError || null,
    memory,
    storage,
    health,
    usedMemory,
    totalMemory,
    uptime: os.uptime(),
    gpu: gpu ? {
      provider: gpu.provider,
      name: gpu.name,
      load: gpuLoad,
      temperatureC: gpuTemp,
      memoryUsedMB: gpu.memoryUsedMB,
      memoryTotalMB: gpu.memoryTotalMB,
      coreClockMHz: gpu.coreClockMHz,
      memoryClockMHz: gpu.memoryClockMHz,
      fanPercent: gpu.fanPercent,
      powerDrawW: gpu.powerDrawW,
      powerLimitW: gpu.powerLimitW
    } : null,
    diskReadBps: Number(windowsPerf?.diskReadBps) || 0,
    diskWriteBps: Number(windowsPerf?.diskWriteBps) || 0,
    diskBusyPercent: Math.max(0, Math.min(100, Number(windowsPerf?.diskBusyPercent) || 0)),
    networkRxBps: Number(windowsPerf?.networkRxBps) || 0,
    networkTxBps: Number(windowsPerf?.networkTxBps) || 0,
    timestamp: Date.now()
  };
}



// v0.6.0 — Network PowerTools
// This entire module is lazy/on-demand. No adapter inventory, DNS lookup, ping,
// connectivity test, ipconfig capture, or maintenance action runs during app boot.
function normalizeNetworkTarget(value) {
  const target = String(value || '').trim();
  if (!target || target.length > 253) return null;
  // execFile is used (no shell), but reject switch-like / whitespace-bearing values anyway.
  if (target.startsWith('-') || target.startsWith('/') || /\s/.test(target)) return null;
  if (!/^[A-Za-z0-9._:%-]+$/.test(target)) return null;
  return target;
}

function fallbackNetworkOverview() {
  const adapters = [];
  const interfaces = os.networkInterfaces();
  for (const [name, list] of Object.entries(interfaces || {})) {
    const rows = Array.isArray(list) ? list : [];
    const ipv4 = rows.filter(x => x && x.family === 'IPv4' && !x.internal).map(x => x.address);
    const ipv6 = rows.filter(x => x && x.family === 'IPv6' && !x.internal).map(x => x.address);
    if (!ipv4.length && !ipv6.length) continue;
    adapters.push({
      name, description: name, status: 'Up', linkSpeed: null, macAddress: rows.find(x=>x?.mac)?.mac || null,
      mediaType: null, physicalMediaType: null, interfaceIndex: null, ipv4, ipv6,
      gateways: [], dnsServers: [], profileName: null, networkCategory: null,
      receivedBytes: null, sentBytes: null, dhcpEnabled: null
    });
  }
  return {
    generatedAt: new Date().toISOString(), adapters,
    summary: { adapterCount: adapters.length, activeCount: adapters.length, activeAdapter: adapters[0] || null },
    source: process.platform === 'win32' ? 'Node fallback' : 'Node networkInterfaces'
  };
}

async function getNetworkOverview(force = false) {
  const now = Date.now();
  if (!force && networkCenterCache.data && now - networkCenterCache.at < 15000) return networkCenterCache.data;
  if (networkCenterCache.pending) return networkCenterCache.pending;
  if (process.platform !== 'win32') return fallbackNetworkOverview();

  const script = `
$ErrorActionPreference='SilentlyContinue'
$adapters = @(Get-NetAdapter | Sort-Object @{Expression={if($_.Status -eq 'Up'){0}else{1}}}, Name)
$configs = @(Get-NetIPConfiguration)
$profiles = @(Get-NetConnectionProfile)
$dnsRows = @(Get-DnsClientServerAddress)
$statsRows = @(Get-NetAdapterStatistics)
$ipIf = @(Get-NetIPInterface -AddressFamily IPv4)
$result = foreach ($a in $adapters) {
  $cfg = $configs | Where-Object {$_.InterfaceIndex -eq $a.ifIndex} | Select-Object -First 1
  $prof = $profiles | Where-Object {$_.InterfaceIndex -eq $a.ifIndex} | Select-Object -First 1
  $dns = @($dnsRows | Where-Object {$_.InterfaceIndex -eq $a.ifIndex} | ForEach-Object {$_.ServerAddresses} | Where-Object {$_})
  $stats = $statsRows | Where-Object {$_.InterfaceIndex -eq $a.ifIndex} | Select-Object -First 1
  $if4 = $ipIf | Where-Object {$_.InterfaceIndex -eq $a.ifIndex} | Sort-Object InterfaceMetric | Select-Object -First 1
  [PSCustomObject]@{
    name = [string]$a.Name
    description = [string]$a.InterfaceDescription
    status = [string]$a.Status
    linkSpeed = [string]$a.LinkSpeed
    macAddress = [string]$a.MacAddress
    mediaType = [string]$a.MediaType
    physicalMediaType = [string]$a.PhysicalMediaType
    interfaceIndex = [int]$a.ifIndex
    ipv4 = @($cfg.IPv4Address | ForEach-Object {$_.IPAddress})
    ipv6 = @($cfg.IPv6Address | ForEach-Object {$_.IPAddress})
    gateways = @($cfg.IPv4DefaultGateway | ForEach-Object {$_.NextHop})
    dnsServers = @($dns)
    profileName = if($prof){[string]$prof.Name}else{$null}
    networkCategory = if($prof){[string]$prof.NetworkCategory}else{$null}
    connectivity = if($prof){[string]$prof.IPv4Connectivity}else{$null}
    receivedBytes = if($stats){[double]$stats.ReceivedBytes}else{$null}
    sentBytes = if($stats){[double]$stats.SentBytes}else{$null}
    dhcpEnabled = if($if4){[string]$if4.Dhcp}else{$null}
    metric = if($if4){[int]$if4.InterfaceMetric}else{$null}
  }
}
$active = $result | Where-Object {$_.status -eq 'Up' -and ($_.ipv4.Count -gt 0 -or $_.ipv6.Count -gt 0)} | Sort-Object @{Expression={if($_.gateways.Count -gt 0){0}else{1}}}, metric | Select-Object -First 1
[PSCustomObject]@{
  generatedAt = (Get-Date).ToString('o')
  adapters = @($result)
  summary = [PSCustomObject]@{
    adapterCount = @($result).Count
    activeCount = @($result | Where-Object {$_.status -eq 'Up'}).Count
    activeAdapter = $active
  }
  source = 'Windows NetTCPIP / NetAdapter'
} | ConvertTo-Json -Depth 8 -Compress
`;

  networkCenterCache.pending = (async () => {
    try {
      const data = await runPowerShell(script, 8000);
      const overview = data && typeof data === 'object' ? data : fallbackNetworkOverview();
      overview.adapters = Array.isArray(overview.adapters) ? overview.adapters : (overview.adapters ? [overview.adapters] : []);
      networkCenterCache.data = overview;
      networkCenterCache.at = Date.now();
      networkCenterCache.pending = null;
      return overview;
    } catch (error) {
      writeDiagnostic('network overview', error);
      networkCenterCache.pending = null;
      return fallbackNetworkOverview();
    }
  })();
  return networkCenterCache.pending;
}

function parsePingOutput(text) {
  const raw = String(text || '');
  const avg = raw.match(/Average\s*=\s*(\d+)ms/i) || raw.match(/Average\s*=\s*(\d+)\s*ms/i);
  const loss = raw.match(/\((\d+)%\s*loss\)/i);
  const times = [...raw.matchAll(/time[=<]\s*(\d+)ms/ig)].map(m => Number(m[1])).filter(Number.isFinite);
  return {
    averageMs: avg ? Number(avg[1]) : (times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : null),
    packetLossPercent: loss ? Number(loss[1]) : null,
    replies: times.length
  };
}

async function networkPing(targetValue) {
  const target = normalizeNetworkTarget(targetValue);
  if (!target) return { ok: false, error: 'Enter a valid hostname or IP address.' };
  if (process.platform !== 'win32') return { ok: false, error: 'Ping diagnostics are Windows-only in this build.' };
  const result = await runExec(windowsExecutable('ping.exe'), ['-n','4','-w','1500',target], 9000);
  const parsed = parsePingOutput(`${result.stdout}\n${result.stderr}`);
  const entry = { type:'ping', target, at:new Date().toISOString(), ok:result.ok || parsed.replies>0, ...parsed };
  networkLastDiagnostics.unshift(entry); networkLastDiagnostics = networkLastDiagnostics.slice(0,20);
  addActivity('Network ping completed', `${target}${Number.isFinite(parsed.averageMs)?` · ${parsed.averageMs} ms`:''}`);
  return { ...entry, raw: result.stdout || result.stderr || '' };
}

async function networkDnsLookup(targetValue) {
  const target = normalizeNetworkTarget(targetValue);
  if (!target) return { ok:false, error:'Enter a valid hostname or IP address.' };
  if (process.platform !== 'win32') return { ok:false, error:'DNS diagnostics are Windows-only in this build.' };
  const result = await runExec(windowsExecutable('nslookup.exe'), [target], 8000);
  const lines = String(result.stdout || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const addresses = [];
  let inAnswer = false;
  for (const line of lines) {
    if (/^Name:/i.test(line)) inAnswer = true;
    const m = line.match(/^Address(?:es)?:\s*(.+)$/i);
    if (m && inAnswer) {
      for (const part of m[1].split(/\s+/)) if (part && !addresses.includes(part)) addresses.push(part);
    }
  }
  const entry = {type:'dns',target,at:new Date().toISOString(),ok:result.ok,addresses:addresses.slice(0,12)};
  networkLastDiagnostics.unshift(entry); networkLastDiagnostics=networkLastDiagnostics.slice(0,20);
  addActivity('DNS lookup completed', target);
  return {...entry,raw:result.stdout || result.stderr || ''};
}

async function networkConnectivityTest() {
  if (process.platform !== 'win32') return {ok:false,error:'Connectivity diagnostics are Windows-only in this build.'};
  const script = `
$ErrorActionPreference='SilentlyContinue'
$dnsOk=$false; $dnsAddress=$null
try { $d=Resolve-DnsName 'www.microsoft.com' -Type A -ErrorAction Stop | Where-Object {$_.IPAddress} | Select-Object -First 1; if($d){$dnsOk=$true;$dnsAddress=[string]$d.IPAddress} } catch {}
$tcpOk=$false
try { $tcpOk=[bool](Test-NetConnection -ComputerName 'www.microsoft.com' -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue) } catch {}
$gateway=$null; $gatewayPing=$null
try { $gateway=(Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway} | Sort-Object InterfaceMetric | Select-Object -First 1).IPv4DefaultGateway.NextHop } catch {}
if($gateway){ try { $r=Test-Connection -ComputerName $gateway -Count 1 -ErrorAction Stop | Select-Object -First 1; if($r){$gatewayPing=[double]$r.ResponseTime} } catch {} }
[PSCustomObject]@{dnsOk=$dnsOk;dnsAddress=$dnsAddress;tcp443=$tcpOk;gateway=$gateway;gatewayPingMs=$gatewayPing;testedAt=(Get-Date).ToString('o')} | ConvertTo-Json -Compress
`;
  const data = await runPowerShell(script, 12000);
  if (!data || typeof data !== 'object') return {ok:false,error:'Windows connectivity test did not return usable data.'};
  const out = {ok:Boolean(data.dnsOk && data.tcp443),...data};
  networkLastDiagnostics.unshift({type:'connectivity',at:new Date().toISOString(),...out}); networkLastDiagnostics=networkLastDiagnostics.slice(0,20);
  addActivity('Connectivity test completed', out.ok ? 'DNS and HTTPS connectivity passed' : 'One or more connectivity checks need attention');
  return out;
}

async function networkFlushDns() {
  if (process.platform !== 'win32') return {ok:false,error:'Windows-only action'};
  const result = await runExec(windowsExecutable('ipconfig.exe'), ['/flushdns'], 7000);
  if (result.ok){addActivity('DNS resolver cache flushed', 'Windows ipconfig /flushdns');addChangeJournalEntry({category:'Network',title:'DNS resolver cache flushed',summary:'Windows DNS resolver cache cleared',source:'Network PowerTools'});}
  return {ok:result.ok, output:result.stdout || result.stderr, error:result.ok?null:(result.stderr || result.stdout || 'Windows rejected the DNS flush.')};
}

async function networkRenewDhcp() {
  if (process.platform !== 'win32') return {ok:false,error:'Windows-only action'};
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type:'warning', buttons:['Renew DHCP','Cancel'], defaultId:1, cancelId:1,
    title:'Renew network configuration?',
    message:'Renew DHCP leases for network adapters?',
    detail:'This can briefly interrupt network connectivity. PowerTools will run the standard Windows ipconfig /renew command.'
  });
  if (confirmation.response !== 0) return {ok:false,canceled:true};
  const result = await runExec(windowsExecutable('ipconfig.exe'), ['/renew'], 30000);
  networkCenterCache.at = 0;
  if (result.ok){addActivity('DHCP lease renewed', 'Windows ipconfig /renew');addChangeJournalEntry({category:'Network',title:'DHCP lease renewed',summary:'Windows DHCP leases renewed',source:'Network PowerTools',risk:'Medium'});}
  return {ok:result.ok, output:result.stdout || result.stderr, error:result.ok?null:(result.stderr || result.stdout || 'Windows rejected the DHCP renewal.')};
}

async function networkCopyIpConfig() {
  if (process.platform !== 'win32') return {ok:false,error:'Windows-only action'};
  const result = await runExec(windowsExecutable('ipconfig.exe'), ['/all'], 8000);
  if (!result.stdout) return {ok:false,error:result.stderr || 'ipconfig returned no data.'};
  clipboard.writeText(result.stdout);
  addActivity('IP configuration copied', 'ipconfig /all copied to clipboard');
  return {ok:true};
}

// v2.1.0 — VPN Center
// Detection is lazy and limited to two explicitly supported Windows clients.
// Executable paths and Start-menu IDs stay in the main process and are never
// exposed to the renderer, reports, diagnostics, or System-Aware AI context.
const VPN_PROVIDER_META = Object.freeze({
  nordvpn: {
    id:'nordvpn', name:'NordVPN', shortName:'Nord', adapterPattern:'nord|nordlynx',
    processPattern:'^nordvpn$|^nordvpn-service$|^nordvpnservice$',
    downloadUrl:'https://nordvpn.com/download/', requiresElevation:false
  },
  expressvpn: {
    id:'expressvpn', name:'ExpressVPN', shortName:'Express', adapterPattern:'expressvpn|lightway',
    processPattern:'^expressvpn$|^expressvpn-ui$|^expressvpn-service$|^expressvpnd$',
    downloadUrl:'https://www.expressvpn.com/setup#Windows', requiresElevation:true
  }
});

function publicVpnProvider(provider) {
  if (!provider) return null;
  return {
    id:provider.id, name:provider.name, installed:Boolean(provider.installed),
    running:Boolean(provider.running), connected:Boolean(provider.connected),
    state:provider.connected?'Connected':provider.running?'Client running':provider.installed?'Ready':'Not installed',
    adapterName:provider.connected ? (provider.adapterName || 'VPN tunnel') : null,
    cliAvailable:Boolean(provider.cliPath), launchAvailable:Boolean(provider.appId || provider.guiPath || provider.cliPath),
    requiresElevation:Boolean(provider.requiresElevation), detection:provider.detection || 'Windows local inventory'
  };
}

function fallbackVpnCenter() {
  const providers=Object.values(VPN_PROVIDER_META).map(meta=>publicVpnProvider({...meta,installed:false,running:false,connected:false,cliPath:null,guiPath:null,appId:null}));
  return {generatedAt:new Date().toISOString(),platform:process.platform,summary:{providerCount:providers.length,installedCount:0,runningCount:0,connectedCount:0},providers};
}

async function getVpnCenter(force=false) {
  const now=Date.now();
  if(!force&&vpnCenterCache.data&&now-vpnCenterCache.at<5000)return vpnCenterCache.data;
  if(vpnCenterCache.pending)return vpnCenterCache.pending;
  if(process.platform!=='win32')return fallbackVpnCenter();
  const script=`
$ErrorActionPreference='SilentlyContinue'
$pf=$env:ProgramFiles
$pf86=${'$'}{env:ProgramFiles(x86)}
$local=$env:LOCALAPPDATA
$starts=@(Get-StartApps)
$processes=@(Get-Process | ForEach-Object {[string]$_.ProcessName})
$adapters=@(Get-NetAdapter | Where-Object {$_.Status -eq 'Up'})
function First-File([string[]]$Candidates){foreach($candidate in $Candidates){if($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)){return $candidate}};return $null}
function Find-InRoots([string[]]$Roots,[string]$Name){foreach($root in $Roots){if($root -and (Test-Path -LiteralPath $root -PathType Container)){${'$'}hit=Get-ChildItem -LiteralPath $root -Filter $Name -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1;if($hit){return [string]$hit.FullName}}};return $null}
$nordStart=$starts | Where-Object {$_.Name -match '^NordVPN'} | Select-Object -First 1
$expressStart=$starts | Where-Object {$_.Name -match '^ExpressVPN'} | Select-Object -First 1
$nordRoots=@((Join-Path $pf 'NordVPN'),(Join-Path $pf86 'NordVPN'),(Join-Path $local 'NordVPN'),(Join-Path $local 'Programs\\NordVPN'))
$expressRoots=@((Join-Path $pf 'ExpressVPN'),(Join-Path $pf86 'ExpressVPN'),(Join-Path $local 'ExpressVPN'),(Join-Path $local 'Programs\\ExpressVPN'))
$nordGui=First-File @((Join-Path $pf 'NordVPN\\NordVPN.exe'),(Join-Path $pf86 'NordVPN\\NordVPN.exe'),(Join-Path $local 'Programs\\NordVPN\\NordVPN.exe'))
if(-not $nordGui){$nordGui=Find-InRoots $nordRoots 'NordVPN.exe'}
$nordCli=First-File @((Join-Path $pf 'NordVPN\\nordvpn.exe'),(Join-Path $pf86 'NordVPN\\nordvpn.exe'))
if(-not $nordCli){$nordCli=Find-InRoots $nordRoots 'nordvpn.exe'}
$expressGui=Find-InRoots $expressRoots 'ExpressVPN.exe'
$expressCli=First-File @((Join-Path $pf86 'ExpressVPN\\services\\expressvpnctl.exe'),(Join-Path $pf 'ExpressVPN\\expressvpnctl.exe'),(Join-Path $pf 'ExpressVPN\\services\\expressvpnctl.exe'))
if(-not $expressCli){$expressCli=Find-InRoots $expressRoots 'expressvpnctl.exe'}
function Adapter-Match([string]$Pattern){return $adapters | Where-Object {([string]$_.Name+' '+[string]$_.InterfaceDescription) -match $Pattern} | Select-Object -First 1}
$nordAdapter=Adapter-Match 'nord|nordlynx'
$expressAdapter=Adapter-Match 'expressvpn|lightway'
[PSCustomObject]@{
  generatedAt=(Get-Date).ToString('o')
  providers=@(
    [PSCustomObject]@{id='nordvpn';name='NordVPN';installed=[bool]($nordStart -or $nordGui -or $nordCli);running=[bool]($processes -match '^nordvpn$|^nordvpn-service$|^nordvpnservice$');connected=[bool]$nordAdapter;adapterName=if($nordAdapter){[string]$nordAdapter.Name}else{$null};appId=if($nordStart){[string]$nordStart.AppID}else{$null};guiPath=$nordGui;cliPath=$nordCli;requiresElevation=$false;detection='Windows app, process, and adapter inventory'}
    [PSCustomObject]@{id='expressvpn';name='ExpressVPN';installed=[bool]($expressStart -or $expressGui -or $expressCli);running=[bool]($processes -match '^expressvpn$|^expressvpn-ui$|^expressvpn-service$|^expressvpnd$');connected=[bool]$expressAdapter;adapterName=if($expressAdapter){[string]$expressAdapter.Name}else{$null};appId=if($expressStart){[string]$expressStart.AppID}else{$null};guiPath=$expressGui;cliPath=$expressCli;requiresElevation=$true;detection='Windows app, process, and adapter inventory'}
  )
} | ConvertTo-Json -Depth 5 -Compress
`;
  vpnCenterCache.pending=(async()=>{
    try{
      const raw=await runPowerShell(script,10000);
      const rows=Array.isArray(raw?.providers)?raw.providers:(raw?.providers?[raw.providers]:[]);
      const internal=new Map();
      for(const row of rows){const meta=VPN_PROVIDER_META[String(row?.id||'')];if(meta)internal.set(meta.id,{...meta,...row});}
      for(const meta of Object.values(VPN_PROVIDER_META))if(!internal.has(meta.id))internal.set(meta.id,{...meta,installed:false,running:false,connected:false});
      vpnCenterCache.internal=internal;
      const providers=[...internal.values()].map(publicVpnProvider);
      const data={generatedAt:raw?.generatedAt||new Date().toISOString(),platform:'win32',summary:{providerCount:providers.length,installedCount:providers.filter(x=>x.installed).length,runningCount:providers.filter(x=>x.running).length,connectedCount:providers.filter(x=>x.connected).length},providers};
      vpnCenterCache.data=data;vpnCenterCache.at=Date.now();return data;
    }catch(error){writeDiagnostic('VPN Center inventory',error);return fallbackVpnCenter();}
    finally{vpnCenterCache.pending=null;}
  })();
  return vpnCenterCache.pending;
}

async function runElevatedVpnCli(file,args) {
  const safeFile=String(file||'').replace(/'/g,"''");
  const safeArgs=(args||[]).map(value=>`'${String(value).replace(/'/g,"''")}'`).join(',');
  const script=`$ErrorActionPreference='Stop';$p=Start-Process -FilePath '${safeFile}' -ArgumentList @(${safeArgs}) -Verb RunAs -Wait -PassThru;[PSCustomObject]@{ok=($p.ExitCode -eq 0);exitCode=[int]$p.ExitCode}|ConvertTo-Json -Compress`;
  const out=await runPowerShell(script,60000);
  return out&&typeof out==='object'?{ok:Boolean(out.ok),exitCode:Number(out.exitCode)}:{ok:false,error:'Administrator approval was canceled or the VPN client did not complete.'};
}

async function vpnProviderAction(providerId,actionValue) {
  const providerKey=String(providerId||'').toLowerCase();
  const action=String(actionValue||'').toLowerCase();
  if(!Object.hasOwn(VPN_PROVIDER_META,providerKey)||!['launch','connect','disconnect','install'].includes(action))return {ok:false,error:'Unsupported VPN provider or action.'};
  await getVpnCenter(true);
  const provider=vpnCenterCache.internal.get(providerKey);
  if(action==='install'){
    await shell.openExternal(VPN_PROVIDER_META[providerKey].downloadUrl);
    addActivity(`${provider.name} setup opened`,'Official provider download page');return {ok:true};
  }
  if(!provider?.installed)return {ok:false,error:`${VPN_PROVIDER_META[providerKey].name} is not installed.`};
  if(action==='launch'){
    let result='';
    if(provider.appId)result=(await runExec(windowsExecutable('explorer.exe'),[`shell:AppsFolder\\${provider.appId}`],8000)).stderr;
    else result=await shell.openPath(provider.guiPath||provider.cliPath);
    if(result)return {ok:false,error:String(result)};
    addActivity(`${provider.name} opened`,'VPN Center client launcher');return {ok:true};
  }
  if(!provider.cliPath)return {ok:false,error:`${provider.name} command-line control was not detected. Open the client to ${action}.`};
  if(action==='disconnect'){
    const choice=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancel','Disconnect VPN'],defaultId:0,cancelId:0,noLink:true,title:`Disconnect ${provider.name}?`,message:`Disconnect the active ${provider.name} tunnel?`,detail:'Your public network route may change immediately. If the provider kill switch is enabled, Internet access may stay blocked until you reconnect.'});
    if(choice.response!==1)return {ok:false,canceled:true};
  }
  const args=providerKey==='nordvpn'?[action==='connect'?'--connect':'--disconnect']:[action];
  const result=provider.requiresElevation?await runElevatedVpnCli(provider.cliPath,args):await runExec(provider.cliPath,args,45000);
  if(!result.ok)return {ok:false,error:result.error||result.stderr||result.stdout||`${provider.name} did not accept the ${action} request.`};
  vpnCenterCache.at=0;
  addActivity(`${provider.name} ${action} requested`,'VPN Center · provider CLI');
  addChangeJournalEntry({category:'Network',title:`${provider.name} ${action} requested`,summary:`Provider-approved command-line control requested VPN ${action}`,source:'VPN Center',risk:'Medium'});
  return {ok:true,detail:`${provider.name} ${action} requested.`};
}

async function getPerformanceProfiles() {
  if (process.platform !== 'win32') {
    return { activeGuid: null, activeName: 'Unavailable', profiles: Object.entries(POWER_SCHEMES).map(([id, p]) => ({ id, ...p, available: false })) };
  }
  const [list, active] = await Promise.all([
    runExec('powercfg.exe', ['/list']),
    runExec('powercfg.exe', ['/getactivescheme'])
  ]);
  const listText = list.stdout.toLowerCase();
  const activeMatch = active.stdout.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const activeGuid = activeMatch ? activeMatch[0].toLowerCase() : null;
  const profiles = Object.entries(POWER_SCHEMES).map(([id, p]) => ({
    id,
    ...p,
    available: listText.includes(p.guid)
  }));
  const activeProfile = profiles.find(p => p.guid === activeGuid);
  let activeName = activeProfile?.name || 'Custom';
  const nameMatch = active.stdout.match(/\(([^)]+)\)\s*$/);
  if (!activeProfile && nameMatch) activeName = nameMatch[1];
  return { activeGuid, activeName, profiles };
}

function normalizeLocalModelEndpoint(raw) {
  const input=String(raw||'').trim(); if(!input)return '';
  let url; try{url=new URL(input);}catch{throw new Error('Enter a valid local http:// or https:// endpoint.');}
  if(!['http:','https:'].includes(url.protocol))throw new Error('Only HTTP/HTTPS local model endpoints are supported.');
  const host=String(url.hostname||'').toLowerCase().replace(/^\[|\]$/g,'');
  if(!['localhost','127.0.0.1','::1'].includes(host))throw new Error('Custom local endpoints must use localhost / 127.0.0.1 / ::1.');
  if(url.username||url.password)throw new Error('Credentials must not be embedded in the endpoint URL.');
  url.hash=''; url.search='';
  return url.toString().replace(/\/$/,'');
}
function openAiLocalUrl(endpoint, leaf) {
  const base=normalizeLocalModelEndpoint(endpoint); const u=new URL(base);
  let p=u.pathname.replace(/\/+$/,'');
  if(!p || p==='/')p='/v1';
  u.pathname=`${p}/${leaf.replace(/^\/+/, '')}`; return u.toString();
}
async function localModelJson(url, options={}, timeoutMs=4500) {
  const checked=normalizeLocalModelEndpoint(url); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(checked,{...options,redirect:'error',signal:controller.signal,headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
    const text=await res.text(); if(!res.ok)throw new Error(`HTTP ${res.status}${text?` — ${text.slice(0,180)}`:''}`);
    try{return text?JSON.parse(text):{};}catch{throw new Error('Local provider returned invalid JSON.');}
  }catch(error){if(error?.name==='AbortError')throw new Error('Local provider timed out.');throw error;}finally{clearTimeout(timer);}
}


// v1.5.3 — Optional Geo IPify IP Geolocation ---------------------------------
// Nothing here runs at boot or when Network PowerTools is merely opened. The
// third-party service is contacted only after the user explicitly requests a
// lookup. The API key is encrypted with Electron safeStorage and is never sent
// to the renderer, report export, activity log, or AI system context.
function geoIpifySecretsPath() {
  try{return path.join(app.getPath('userData'),'network-service-secrets.json');}catch{return null;}
}
function readNetworkSecretStore() {
  const file=geoIpifySecretsPath(); if(!file||!fs.existsSync(file))return {version:1,secrets:{}};
  try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return {version:1,secrets:(data&&typeof data.secrets==='object'&&data.secrets)||{}};}catch(error){writeDiagnostic('Network credential store read',error);return {version:1,secrets:{}};}
}
function writeNetworkSecretStore(store) {
  const file=geoIpifySecretsPath(); if(!file)throw new Error('PowerTools user-data path is unavailable.');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({version:1,secrets:store.secrets||{}},null,2),'utf8');
  try{if(process.platform!=='win32')fs.chmodSync(file,0o600);}catch{}
}
function loadGeoIpifyCredential() {
  const entry=readNetworkSecretStore().secrets.geoipify;
  if(!entry?.ciphertext||!aiEncryptionAvailable())return null;
  try{return safeStorage.decryptString(Buffer.from(String(entry.ciphertext),'base64'));}catch(error){writeDiagnostic('Geo IPify credential decrypt',error);return null;}
}
function geoIpifyCredentialStatus() {
  const store=readNetworkSecretStore();
  return {configured:Boolean(store.secrets?.geoipify?.ciphertext),encryptionAvailable:aiEncryptionAvailable(),storage:'Electron safeStorage / Windows DPAPI',provider:'Geo IPify'};
}
function saveGeoIpifyCredential(key) {
  const value=String(key||'').trim();
  if(value.length<8||value.length>4096)return {ok:false,error:'Enter a valid Geo IPify API key.'};
  if(!aiEncryptionAvailable())return {ok:false,error:'Secure credential encryption is unavailable. PowerTools will not store API keys as plaintext.'};
  try{
    const store=readNetworkSecretStore();
    store.secrets.geoipify={ciphertext:safeStorage.encryptString(value).toString('base64'),updatedAt:new Date().toISOString()};
    writeNetworkSecretStore(store);
    addActivity('IP geolocation configured','Geo IPify API key stored in the encrypted PowerTools vault');
    return {ok:true,status:geoIpifyCredentialStatus()};
  }catch(error){writeDiagnostic('Geo IPify credential save',error);return {ok:false,error:String(error?.message||error)};}
}
function removeGeoIpifyCredential() {
  try{const store=readNetworkSecretStore();delete store.secrets.geoipify;writeNetworkSecretStore(store);networkIpGeoLastResult=null;addActivity('IP geolocation credential removed','Geo IPify');return {ok:true,status:geoIpifyCredentialStatus()};}
  catch(error){writeDiagnostic('Geo IPify credential remove',error);return {ok:false,error:String(error?.message||error)};}
}
async function geoIpifyJson(url, timeoutMs=12000) {
  let checked; try{checked=new URL(String(url||''));}catch{throw new Error('Invalid Geo IPify endpoint.');}
  if(checked.protocol!=='https:'||String(checked.hostname||'').toLowerCase()!=='geo.ipify.org')throw new Error('IP geolocation endpoint is not allowlisted.');
  if(checked.username||checked.password)throw new Error('Credentials must not be embedded in endpoint URLs.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(checked.toString(),{redirect:'error',signal:controller.signal,headers:{'Accept':'application/json'}});
    const text=await res.text();
    if(!res.ok){let detail=text.slice(0,180);try{const parsed=JSON.parse(text);detail=parsed?.messages?.join?.(' ')||parsed?.message||parsed?.error||detail;}catch{}throw new Error(`Geo IPify HTTP ${res.status}${detail?` — ${detail}`:''}`);}
    try{return text?JSON.parse(text):{};}catch{throw new Error('Geo IPify returned invalid JSON.');}
  }catch(error){if(error?.name==='AbortError')throw new Error('Geo IPify request timed out.');throw error;}finally{clearTimeout(timer);}
}
async function lookupIpGeolocation(ipValue='') {
  const key=loadGeoIpifyCredential();
  if(!key)return {ok:false,error:'Geo IPify API key is not configured.',needsConfiguration:true,status:geoIpifyCredentialStatus()};
  const input=String(ipValue||'').trim();
  if(input && !net.isIP(input))return {ok:false,error:'Enter a valid IPv4 or IPv6 address, or leave the field blank to locate this connection\'s public IP.'};
  const endpoint=new URL('https://geo.ipify.org/api/v2/country,city');
  endpoint.searchParams.set('apiKey',key);
  if(input)endpoint.searchParams.set('ipAddress',input);
  try{
    const data=await geoIpifyJson(endpoint.toString());
    const loc=data?.location||{}; const asn=data?.as||{};
    const result={
      ok:true, provider:'Geo IPify', lookedUpAt:new Date().toISOString(), requestedIp:input||null,
      ip:String(data?.ip||''), country:String(loc.country||''), region:String(loc.region||''), city:String(loc.city||''),
      latitude:Number.isFinite(Number(loc.lat))?Number(loc.lat):null, longitude:Number.isFinite(Number(loc.lng))?Number(loc.lng):null,
      postalCode:String(loc.postalCode||''), timezone:String(loc.timezone||''), isp:String(data?.isp||''),
      asn:Number.isFinite(Number(asn.asn))?Number(asn.asn):null, asName:String(asn.name||''), route:String(asn.route||''), asType:String(asn.type||'')
    };
    networkIpGeoLastResult=result;
    addActivity('IP geolocation lookup completed',input?'Specified public IP':'Current public IP');
    return result;
  }catch(error){writeDiagnostic('Geo IPify lookup',error);return {ok:false,error:String(error?.message||error),status:geoIpifyCredentialStatus()};}
}


// v1.5.3 — Privacy Intelligence ------------------------------------------------
// Self-audit utilities only. These tools do not scrape people-search sources,
// aggregate private personal data, or perform background lookups. Username
// shortcuts only open allowlisted public profile URLs on explicit request.
const PRIVACY_PROFILE_SITES = Object.freeze({
  github: username => `https://github.com/${encodeURIComponent(username)}`,
  reddit: username => `https://www.reddit.com/user/${encodeURIComponent(username)}/`,
  youtube: username => `https://www.youtube.com/@${encodeURIComponent(username)}`,
  tiktok: username => `https://www.tiktok.com/@${encodeURIComponent(username)}`,
  instagram: username => `https://www.instagram.com/${encodeURIComponent(username)}/`
});
const PRIVACY_RESOURCES = Object.freeze({
  hibp: 'https://haveibeenpwned.com/'
});
function normalizePrivacyUsername(raw) {
  const value=String(raw||'').trim();
  if(!/^[A-Za-z0-9._-]{1,64}$/.test(value))throw new Error('Use 1–64 letters, numbers, dots, underscores, or hyphens.');
  return value;
}
function normalizePrivacyDomain(raw) {
  const input=String(raw||'').trim();
  if(!input)throw new Error('Enter a domain name.');
  if(input.length>253)throw new Error('Domain name is too long.');
  if(/[\\/@?#:]/.test(input))throw new Error('Enter only a domain name, without a URL path, port, or credentials.');
  let parsed; try{parsed=new URL(`http://${input}`);}catch{throw new Error('Enter a valid domain name.');}
  const host=String(parsed.hostname||'').toLowerCase();
  if(!host || net.isIP(host) || !host.includes('.'))throw new Error('Enter a public domain such as example.com.');
  if(!/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.') || host.includes('..'))throw new Error('Enter a valid domain name.');
  return host;
}
async function privacyResolve(promise, timeoutMs=6000) {
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS lookup timed out.')),timeoutMs);})]);}
  finally{clearTimeout(timer);}
}
async function privacyDnsRecords(domainValue) {
  let domain;try{domain=normalizePrivacyDomain(domainValue);}catch(error){return {ok:false,error:String(error?.message||error)};}
  const get=async fn=>{try{return await privacyResolve(fn());}catch(error){if(['ENODATA','ENOTFOUND','ESERVFAIL','EREFUSED'].includes(error?.code))return [];throw error;}};
  try{
    const [a,aaaa,mx,ns,txt]=await Promise.all([
      get(()=>dns.resolve4(domain)),get(()=>dns.resolve6(domain)),get(()=>dns.resolveMx(domain)),get(()=>dns.resolveNs(domain)),get(()=>dns.resolveTxt(domain))
    ]);
    const result={
      ok:true,domain,checkedAt:new Date().toISOString(),
      records:{
        a:(a||[]).slice(0,12),aaaa:(aaaa||[]).slice(0,12),
        mx:(mx||[]).slice(0,12).map(x=>({exchange:String(x.exchange||''),priority:Number(x.priority)||0})),
        ns:(ns||[]).slice(0,12),
        txt:(txt||[]).slice(0,12).map(parts=>Array.isArray(parts)?parts.join(''):String(parts||'')).map(x=>x.slice(0,400))
      }
    };
    addActivity('Privacy DNS inspection completed','Domain DNS records checked on demand');
    return result;
  }catch(error){writeDiagnostic('Privacy DNS inspection',error);return {ok:false,error:String(error?.message||error)};}
}
function privacyReadPrefix(filePath,maxBytes=8*1024*1024) {
  const stat=fs.statSync(filePath);const size=Math.min(stat.size,maxBytes);const fd=fs.openSync(filePath,'r');
  try{const buf=Buffer.alloc(size);const read=fs.readSync(fd,buf,0,size,0);return {stat,buffer:buf.subarray(0,read)};}finally{fs.closeSync(fd);}
}
function privacyParseTiff(buffer,start=0) {
  const out={exif:false,gps:false,author:false,comments:false,copyright:false};
  try{
    if(start<0||start+8>buffer.length)return out;
    const endian=buffer.toString('ascii',start,start+2);const le=endian==='II';if(!le&&endian!=='MM')return out;
    const u16=o=>{if(o<start||o+2>buffer.length)throw new Error('TIFF range');return le?buffer.readUInt16LE(o):buffer.readUInt16BE(o);};
    const u32=o=>{if(o<start||o+4>buffer.length)throw new Error('TIFF range');return le?buffer.readUInt32LE(o):buffer.readUInt32BE(o);};
    if(u16(start+2)!==42)return out;out.exif=true;
    const seen=new Set();
    const walk=(rel,kind='ifd',depth=0)=>{
      if(depth>4||!Number.isFinite(rel)||rel<=0||seen.has(`${kind}:${rel}`))return;seen.add(`${kind}:${rel}`);
      const off=start+rel;if(off+2>buffer.length)return;const count=Math.min(u16(off),512);
      for(let i=0;i<count;i++){
        const e=off+2+i*12;if(e+12>buffer.length)break;const tag=u16(e);const value=u32(e+8);
        if(tag===0x8825){out.gps=true;walk(value,'gps',depth+1);}
        else if(tag===0x8769)walk(value,'exif',depth+1);
        else if(tag===0x013B)out.author=true;
        else if(tag===0x010E||tag===0x9286||tag===0x9C9C)out.comments=true;
        else if(tag===0x8298)out.copyright=true;
        if(kind==='gps')out.gps=true;
      }
    };
    walk(u32(start+4));
  }catch{}
  return out;
}
function privacyMetadataSignals(buffer,fileName='') {
  const signals={exif:false,gps:false,author:false,comments:false,xmp:false,copyright:false};
  const merge=x=>Object.keys(signals).forEach(k=>{if(x?.[k])signals[k]=true;});
  try{
    if(buffer.length>=4&&buffer[0]===0xFF&&buffer[1]===0xD8){
      let p=2;while(p+4<=buffer.length){if(buffer[p]!==0xFF){p++;continue;}const marker=buffer[p+1];p+=2;if(marker===0xD9||marker===0xDA)break;if(p+2>buffer.length)break;const len=buffer.readUInt16BE(p);if(len<2||p+len>buffer.length)break;if(marker===0xE1){const data=p+2;if(buffer.toString('ascii',data,data+6)==='Exif\u0000\u0000')merge(privacyParseTiff(buffer,data+6));const ascii=buffer.toString('utf8',data,Math.min(p+len,buffer.length));if(/<x:xmpmeta|http:\/\/ns\.adobe\.com\/xap/i.test(ascii))signals.xmp=true;}p+=len;}
    } else if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
      let p=8;while(p+12<=buffer.length){const len=buffer.readUInt32BE(p);const type=buffer.toString('ascii',p+4,p+8);const data=p+8;if(data+len+4>buffer.length)break;if(type==='eXIf')merge(privacyParseTiff(buffer,data));if(['tEXt','iTXt','zTXt'].includes(type)){const text=buffer.toString('utf8',data,data+len);if(/author|artist|creator/i.test(text))signals.author=true;if(/comment|description|caption/i.test(text))signals.comments=true;if(/gps|latitude|longitude/i.test(text))signals.gps=true;if(/xmp/i.test(text))signals.xmp=true;}p=data+len+4;if(type==='IEND')break;}
    }
    const sample=buffer.subarray(0,Math.min(buffer.length,2*1024*1024)).toString('latin1');
    if(/GPSLatitude|GPSLongitude|gps:latitude|gps:longitude/i.test(sample))signals.gps=true;
    if(/<dc:creator|photoshop:AuthorsPosition|\bArtist\x00|\bAuthor\x00/i.test(sample))signals.author=true;
    if(/UserComment|ImageDescription|\bComment\x00/i.test(sample))signals.comments=true;
    if(/<x:xmpmeta|xmpmeta|http:\/\/ns\.adobe\.com\/xap/i.test(sample))signals.xmp=true;
    if(/Copyright\x00|dc:rights/i.test(sample))signals.copyright=true;
  }catch{}
  return signals;
}
async function privacyInspectFile() {
  try{
    const pick=await dialog.showOpenDialog(mainWindow,{title:'Privacy Intelligence — Inspect file metadata',properties:['openFile'],filters:[{name:'Common files',extensions:['jpg','jpeg','png','webp','gif','pdf','docx','xlsx','pptx','txt','json']},{name:'All files',extensions:['*']}]});
    if(pick.canceled||!pick.filePaths?.[0])return {ok:false,canceled:true};
    const filePath=pick.filePaths[0];const {stat,buffer}=privacyReadPrefix(filePath);const name=path.basename(filePath);const ext=path.extname(name).toLowerCase().replace(/^\./,'')||'none';const signals=privacyMetadataSignals(buffer,name);
    let score=0;if(signals.gps)score+=70;if(signals.author)score+=15;if(signals.comments)score+=10;if(signals.xmp)score+=8;if(signals.copyright)score+=5;score=Math.min(100,score);
    const risk=score>=60?'High':score>=20?'Moderate':score>0?'Low':'No obvious metadata exposure found';
    addActivity('Privacy metadata inspection completed',`Local file metadata checked · ${risk}`);
    return {ok:true,name,extension:ext,sizeBytes:stat.size,modifiedAt:stat.mtime?.toISOString?.()||'',scannedBytes:buffer.length,signals,risk,score,partial:stat.size>buffer.length};
  }catch(error){writeDiagnostic('Privacy metadata inspection',error);return {ok:false,error:String(error?.message||error)};}
}
async function privacyOpenProfile(platformValue,usernameValue) {
  const platform=String(platformValue||'').toLowerCase();const build=PRIVACY_PROFILE_SITES[platform];if(!build)return {ok:false,error:'Profile shortcut is not allowlisted.'};
  let username;try{username=normalizePrivacyUsername(usernameValue);}catch(error){return {ok:false,error:String(error?.message||error)};}
  try{await shell.openExternal(build(username));addActivity('Privacy profile shortcut opened',platform);return {ok:true};}catch(error){return {ok:false,error:String(error?.message||error)};}
}
async function privacyOpenResource(resourceValue) {
  const id=String(resourceValue||'').toLowerCase();const url=PRIVACY_RESOURCES[id];if(!url)return {ok:false,error:'Privacy resource is not allowlisted.'};
  try{await shell.openExternal(url);addActivity('Privacy resource opened',id);return {ok:true};}catch(error){return {ok:false,error:String(error?.message||error)};}
}


// v2.0.0 — Privacy & App Trust Intelligence ----------------------------------
// App-trust scans are explicit and local. PowerTools does not upload selected
// files. The optional VirusTotal shortcut sends only the SHA-256 hash after the
// user clicks the external reputation button.
function privacyPowerShellQuote(value) { return `'${String(value ?? '').replace(/'/g,"''")}'`; }
function privacyCompactCertificateName(value) {
  const text=String(value||'').trim(); if(!text)return '';
  const match=text.match(/(?:^|,\s*)CN=([^,]+)/i); return (match?.[1]||text).slice(0,160);
}
function privacyPathClass(filePath) {
  try {
    const resolved=path.resolve(filePath).toLowerCase();
    const systemRoot=path.resolve(process.env.SystemRoot||process.env.WINDIR||'C:\\Windows').toLowerCase();
    const pf=String(process.env.ProgramFiles||'C:\\Program Files').toLowerCase();
    const pf86=String(process.env['ProgramFiles(x86)']||'C:\\Program Files (x86)').toLowerCase();
    const home=String(os.homedir()||'').toLowerCase();
    const temp=String(os.tmpdir()||'').toLowerCase();
    if(resolved===systemRoot||resolved.startsWith(systemRoot+path.sep))return 'Windows system directory';
    if(resolved===pf||resolved.startsWith(pf+path.sep)||resolved===pf86||resolved.startsWith(pf86+path.sep))return 'Program Files';
    if(temp&&(resolved===temp||resolved.startsWith(temp+path.sep)))return 'Temporary files';
    if(home&&resolved.startsWith(path.join(home,'downloads').toLowerCase()+path.sep))return 'Downloads';
    if(home&&(resolved===home||resolved.startsWith(home+path.sep)))return 'User profile';
  } catch {}
  return 'Other local location';
}
function privacyFileSha256(filePath) {
  return new Promise((resolve,reject)=>{
    const hash=crypto.createHash('sha256'); const stream=fs.createReadStream(filePath);
    stream.on('error',reject); stream.on('data',chunk=>hash.update(chunk)); stream.on('end',()=>resolve(hash.digest('hex')));
  });
}
function privacyZoneLabel(zoneId) {
  if(zoneId===null||zoneId===undefined||String(zoneId)==='')return 'No Mark of the Web detected';
  const id=Number(zoneId); return ({0:'Local machine',1:'Local intranet',2:'Trusted sites',3:'Internet',4:'Restricted sites'})[id]||'Unknown Windows zone';
}
function privacyTrustAssessment(signatureStatus, signer, locationClass, zoneId) {
  const status=String(signatureStatus||'Unknown'); const lower=status.toLowerCase();
  let score=35, verdict='Review', tone='review'; const reasons=[];
  if(lower==='valid') { score=88; verdict='Higher confidence'; tone='trusted'; reasons.push('Windows reports a valid Authenticode signature.'); }
  else if(lower==='notsigned') { score=45; reasons.push('The file is not Authenticode-signed. Unsigned does not automatically mean unsafe.'); }
  else if(['hashmismatch','nottrusted','notvalid','unknownerror'].includes(lower)) { score=12; verdict='Warning'; tone='warning'; reasons.push(`Windows signature status is ${status}.`); }
  else reasons.push(`Windows signature status is ${status}.`);
  if(/microsoft/i.test(String(signer||'')) && lower==='valid') { score=Math.min(96,score+6); reasons.push('The valid signature identifies Microsoft as the signer.'); }
  if(Number(zoneId)>=3) { score=Math.max(0,score-4); reasons.push(`Windows marks the file as originating from ${privacyZoneLabel(zoneId).toLowerCase()}.`); }
  if(['Temporary files','Downloads'].includes(locationClass) && lower!=='valid') { score=Math.max(0,score-8); reasons.push(`The file is in ${locationClass.toLowerCase()}, so an unsigned item deserves extra review.`); }
  reasons.push('This score is a local trust heuristic, not a malware verdict.');
  return {score,verdict,tone,reasons};
}
async function privacyInspectAppTrustPath(filePath, sourceLabel='Selected local file', displayName='') {
  try {
    if(process.platform!=='win32')return {ok:false,error:'App Trust Intelligence requires Windows.'};
    const stat=fs.statSync(filePath); if(!stat.isFile())return {ok:false,error:'Select a file, not a folder.'};
    const sha256=await privacyFileSha256(filePath); const q=privacyPowerShellQuote(filePath);
    const ps=`
$ErrorActionPreference='SilentlyContinue'
$p=${q}
$sig=Get-AuthenticodeSignature -LiteralPath $p -ErrorAction SilentlyContinue
$item=Get-Item -LiteralPath $p -ErrorAction SilentlyContinue
$v=$item.VersionInfo
$zone=$null
try {
  $stream=Get-Content -LiteralPath $p -Stream Zone.Identifier -ErrorAction Stop
  $line=$stream | Where-Object { $_ -match '^ZoneId=' } | Select-Object -First 1
  if($line){ $zone=[int]($line -replace '^ZoneId=','') }
} catch {}
[PSCustomObject]@{
  SignatureStatus=if($sig){[string]$sig.Status}else{'Unknown'}
  StatusMessage=if($sig){[string]$sig.StatusMessage}else{''}
  SignerSubject=if($sig.SignerCertificate){[string]$sig.SignerCertificate.Subject}else{''}
  Issuer=if($sig.SignerCertificate){[string]$sig.SignerCertificate.Issuer}else{''}
  CertificateNotAfter=if($sig.SignerCertificate){$sig.SignerCertificate.NotAfter.ToUniversalTime().ToString('o')}else{$null}
  ProductName=if($v){[string]$v.ProductName}else{''}
  FileVersion=if($v){[string]$v.FileVersion}else{''}
  CompanyName=if($v){[string]$v.CompanyName}else{''}
  OriginalFilename=if($v){[string]$v.OriginalFilename}else{''}
  ZoneId=$zone
} | ConvertTo-Json -Depth 4 -Compress
`;
    const details=await runPowerShell(ps,12000); const d=(details&&typeof details==='object')?details:{};
    const signer=privacyCompactCertificateName(d.SignerSubject); const issuer=privacyCompactCertificateName(d.Issuer);
    const locationClass=privacyPathClass(filePath); const hasZone=d.ZoneId!==null&&d.ZoneId!==undefined&&String(d.ZoneId)!==''; const zoneId=hasZone&&Number.isFinite(Number(d.ZoneId))?Number(d.ZoneId):null;
    const assessment=privacyTrustAssessment(d.SignatureStatus,signer,locationClass,zoneId);
    addActivity('App Trust inspection completed',`${assessment.verdict} · ${String(d.SignatureStatus||'Unknown')}`);
    return {ok:true,source:sourceLabel,name:String(displayName||path.basename(filePath)).slice(0,220),extension:(path.extname(filePath).replace(/^\./,'')||'file').toLowerCase(),sizeBytes:stat.size,modifiedAt:stat.mtime?.toISOString?.()||'',sha256,signature:{status:String(d.SignatureStatus||'Unknown'),message:String(d.StatusMessage||'').slice(0,240),signer,issuer,certificateNotAfter:d.CertificateNotAfter||null},fileInfo:{productName:String(d.ProductName||'').slice(0,160),fileVersion:String(d.FileVersion||'').slice(0,100),companyName:String(d.CompanyName||'').slice(0,160),originalFilename:String(d.OriginalFilename||'').slice(0,160)},origin:{zoneId,zoneLabel:privacyZoneLabel(zoneId),locationClass},assessment};
  } catch(error){writeDiagnostic('Privacy App Trust inspection',error);return {ok:false,error:String(error?.message||error)};}
}
async function privacySelectAppTrustFile() {
  try {
    const pick=await dialog.showOpenDialog(mainWindow,{title:'App Trust Intelligence — Select local app or package',properties:['openFile'],filters:[{name:'Windows apps and packages',extensions:['exe','msi','msix','appx','dll','ps1','bat','cmd','com','scr']},{name:'All files',extensions:['*']}]});
    if(pick.canceled||!pick.filePaths?.[0])return {ok:false,canceled:true};
    return privacyInspectAppTrustPath(pick.filePaths[0],'Selected local file');
  } catch(error){return {ok:false,error:String(error?.message||error)};}
}
async function privacyGetAppTrustInventory(force=false) {
  const snapshot=await getInstalledApps(Boolean(force)); const apps=Array.isArray(snapshot?.apps)?snapshot.apps:[];
  const rows=apps.map(a=>({id:Number(a.id),name:String(a.name||'Unnamed application'),version:String(a.version||''),publisher:String(a.publisher||''),scope:String(a.scope||''),installDate:a.installDate||null,inspectable:Boolean(cleanDisplayIconPath(a.displayIcon))}));
  const withPublisher=rows.filter(a=>a.publisher.trim()).length; const inspectable=rows.filter(a=>a.inspectable).length;
  return {ok:true,generatedAt:new Date().toISOString(),summary:{count:rows.length,withPublisher,missingPublisher:rows.length-withPublisher,inspectable,publisherCoverage:rows.length?Math.round(withPublisher/rows.length*100):0},apps:rows};
}
async function privacyInspectInstalledApp(index) {
  if(!installedAppsCache.data?.length)await getInstalledApps(false);
  const item=cachedInstalledApp(index); if(!item)return {ok:false,error:'Installed-app inventory is stale. Refresh the inventory and try again.'};
  const target=cleanDisplayIconPath(item.displayIcon); if(!target)return {ok:false,error:'Windows did not expose a usable app entry file for this application.'};
  return privacyInspectAppTrustPath(target,'Installed application',item.name);
}
async function privacyGetAppProtectionStatus() {
  if(process.platform!=='win32')return {ok:false,error:'Windows app-protection status requires Windows.'};
  const ps=`
$ErrorActionPreference='SilentlyContinue'
$explorer=$null;$appHost=$null;$policyEnabled=$null;$policyLevel=$null;$sac=$null
try{$explorer=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer' -Name SmartScreenEnabled -ErrorAction Stop).SmartScreenEnabled}catch{}
if($null -eq $explorer){try{$explorer=(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer' -Name SmartScreenEnabled -ErrorAction Stop).SmartScreenEnabled}catch{}}
try{$appHost=(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AppHost' -Name EnableWebContentEvaluation -ErrorAction Stop).EnableWebContentEvaluation}catch{}
try{$p=Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -ErrorAction Stop;if($null -ne $p.EnableSmartScreen){$policyEnabled=([int]$p.EnableSmartScreen -ne 0)};if($null -ne $p.ShellSmartScreenLevel){$policyLevel=[string]$p.ShellSmartScreenLevel}}catch{}
try{$sac=(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy' -Name VerifiedAndReputablePolicyState -ErrorAction Stop).VerifiedAndReputablePolicyState}catch{}
[PSCustomObject]@{Explorer=if($null -ne $explorer){[string]$explorer}elseif($policyEnabled -eq $false){'Off'}elseif($policyEnabled -eq $true -and $policyLevel){$policyLevel}elseif($policyEnabled -eq $true){'On'}else{$null};AppHostEnabled=if($null -ne $appHost){([int]$appHost -ne 0)}else{$null};PolicyEnabled=$policyEnabled;PolicyLevel=$policyLevel;SmartAppControl=if($null -ne $sac){[int]$sac}else{$null}} | ConvertTo-Json -Depth 4 -Compress
`;
  const d=await runPowerShell(ps,7000)||{}; const hasSac=d.SmartAppControl!==null&&d.SmartAppControl!==undefined&&String(d.SmartAppControl)!==''; const raw=hasSac?Number(d.SmartAppControl):NaN; const sac=Number.isFinite(raw)?({0:'Off',1:'On',2:'Evaluation'})[raw]||`State ${raw}`:'Unavailable';
  addActivity('Windows app protection checked','SmartScreen and Smart App Control status inspected locally');
  return {ok:true,checkedAt:new Date().toISOString(),smartScreen:{explorer:d.Explorer??null,appHostEnabled:typeof d.AppHostEnabled==='boolean'?d.AppHostEnabled:null,policyEnabled:typeof d.PolicyEnabled==='boolean'?d.PolicyEnabled:null,policyLevel:d.PolicyLevel??null},smartAppControl:{state:Number.isFinite(raw)?raw:null,label:sac}};
}
async function privacyOpenHashReputation(hashValue) {
  const hash=String(hashValue||'').trim().toLowerCase(); if(!/^[a-f0-9]{64}$/.test(hash))return {ok:false,error:'A valid SHA-256 hash is required.'};
  try{await shell.openExternal(`https://www.virustotal.com/gui/file/${hash}`);addActivity('External hash reputation lookup opened','SHA-256 lookup opened manually');return {ok:true};}catch(error){return {ok:false,error:String(error?.message||error)};}
}


// v1.6.0 — GitHub Release Center ---------------------------------------------
// Private-use source/release publishing. GitHub is contacted only after the
// Integrations page is opened or the user explicitly performs an action. The
// personal access token stays in the Electron main process and is encrypted
// with safeStorage. No token is returned to the renderer, reports, AI context,
// or the activity log.
const GITHUB_API_HOSTS = new Set(['api.github.com','uploads.github.com']);
const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_SOURCE_MAX_FILES = 500;
const GITHUB_SOURCE_MAX_FILE_BYTES = 20 * 1024 * 1024;
const GITHUB_SOURCE_MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const GITHUB_ASSET_MAX_FILES = 12;
const GITHUB_ASSET_MAX_FILE_BYTES = 100 * 1024 * 1024;
const GITHUB_ASSET_MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const GITHUB_FOLDER_IGNORES = new Set(['.git','node_modules','runtime','dist','.idea','.vs','.vscode']);

function githubSecretsPath(){try{return path.join(app.getPath('userData'),'github-integration-secrets.json');}catch{return null;}}
function readGitHubSecretStore(){
  const file=githubSecretsPath();if(!file||!fs.existsSync(file))return {version:1,secrets:{}};
  try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return {version:1,secrets:(data&&typeof data.secrets==='object'&&data.secrets)||{}};}catch(error){writeDiagnostic('GitHub credential store read',error);return {version:1,secrets:{}};}
}
function writeGitHubSecretStore(store){
  const file=githubSecretsPath();if(!file)throw new Error('PowerTools user-data path is unavailable.');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({version:1,secrets:store.secrets||{}},null,2),'utf8');
  try{if(process.platform!=='win32')fs.chmodSync(file,0o600);}catch{}
}
function loadGitHubCredential(){
  const entry=readGitHubSecretStore().secrets.github;if(!entry?.ciphertext||!aiEncryptionAvailable())return null;
  try{return safeStorage.decryptString(Buffer.from(String(entry.ciphertext),'base64'));}catch(error){writeDiagnostic('GitHub credential decrypt',error);return null;}
}
function githubCredentialStatus(){
  const store=readGitHubSecretStore();const entry=store.secrets?.github;
  return {configured:Boolean(entry?.ciphertext),encryptionAvailable:aiEncryptionAvailable(),storage:'Electron safeStorage / Windows DPAPI',updatedAt:entry?.updatedAt||null,provider:'GitHub'};
}
function githubApiUrl(value){
  const raw=String(value||'').trim();let url;
  try{url=raw.startsWith('https://')?new URL(raw):new URL(`https://api.github.com${raw.startsWith('/')?'':'/'}${raw}`);}catch{throw new Error('Invalid GitHub API endpoint.');}
  if(url.protocol!=='https:'||!GITHUB_API_HOSTS.has(String(url.hostname||'').toLowerCase()))throw new Error('GitHub endpoint is not allowlisted.');
  if(url.username||url.password)throw new Error('Credentials must not be embedded in GitHub URLs.');
  return url;
}
async function githubRequest(endpoint,options={}){
  const url=githubApiUrl(endpoint);const token=String(options.token||loadGitHubCredential()||'').trim();if(!token)throw new Error('GitHub token is not configured.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(3000,Number(options.timeoutMs)||20000));
  try{
    const headers={
      'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':GITHUB_API_VERSION,
      'User-Agent':`PurpleDragonPowerTools/${app.getVersion()}`,...(options.headers||{})
    };
    let body;
    if(Buffer.isBuffer(options.rawBody)){body=options.rawBody;headers['Content-Type']=options.contentType||'application/octet-stream';headers['Content-Length']=String(body.length);}
    else if(options.body!==undefined&&options.body!==null){body=JSON.stringify(options.body);headers['Content-Type']='application/json';}
    const res=await fetch(url.toString(),{method:options.method||'GET',headers,body,redirect:'error',signal:controller.signal});
    const text=await res.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text||null;}
    const allowed=new Set(Array.isArray(options.allowStatuses)?options.allowStatuses:[]);
    if(!res.ok&&!allowed.has(res.status)){
      const detail=typeof data==='object'&&data?(data.message||data.error||''):String(text||'').slice(0,240);
      const error=new Error(`GitHub HTTP ${res.status}${detail?` — ${detail}`:''}`);error.status=res.status;error.data=data;throw error;
    }
    return {status:res.status,data};
  }catch(error){if(error?.name==='AbortError')throw new Error('GitHub request timed out.');throw error;}finally{clearTimeout(timer);}
}
function normalizeGitHubRepo(value){
  const repo=String(value||'').trim();if(!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repo))throw new Error('Select a valid GitHub repository.');return repo;
}
function normalizeGitHubBranch(value){
  const branch=String(value||'').trim();if(!branch||branch.length>240||branch.startsWith('/')||branch.endsWith('/')||branch.includes('..')||/[~^:?*\\\s]/.test(branch))throw new Error('Select a valid Git branch.');return branch;
}
function githubRefPath(branch){return normalizeGitHubBranch(branch).split('/').map(encodeURIComponent).join('/');}
function normalizeGitHubRepoPrefix(value){
  const raw=String(value||'').trim().replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');if(!raw)return '';
  if(raw.length>500||raw.split('/').some(x=>!x||x==='.'||x==='..'))throw new Error('Repository destination contains an invalid path.');
  if(/[\0:*?"<>|]/.test(raw))throw new Error('Repository destination contains unsupported characters.');return raw;
}
function normalizeGitHubRelativePath(value){
  const raw=String(value||'').replace(/\\/g,'/').replace(/^\/+/, '');if(!raw||raw.length>900||raw.split('/').some(x=>!x||x==='.'||x==='..'))throw new Error('Selected file has an invalid repository path.');return raw;
}
function githubSafeRepoUrl(repo){const full=normalizeGitHubRepo(repo);return `https://github.com/${full}`;}
function githubSelectionPublic(items){return (items||[]).map((x,index)=>({index,name:path.basename(x.absolutePath),relativePath:x.relativePath,sizeBytes:x.sizeBytes}));}

async function saveGitHubCredential(tokenValue){
  const token=String(tokenValue||'').trim();if(token.length<20||token.length>4096||/\s/.test(token))return {ok:false,error:'Enter a valid GitHub personal access token.'};
  if(!aiEncryptionAvailable())return {ok:false,error:'Secure credential encryption is unavailable. PowerTools will not store a GitHub token as plaintext.'};
  try{
    const test=await githubRequest('/user',{token,timeoutMs:12000});const profile=test.data||{};
    if(!profile.login)throw new Error('GitHub did not return an authenticated account.');
    const store=readGitHubSecretStore();store.secrets.github={ciphertext:safeStorage.encryptString(token).toString('base64'),updatedAt:new Date().toISOString(),login:String(profile.login)};writeGitHubSecretStore(store);
    githubCenterCache={at:0,data:null,pending:null};addActivity('GitHub Release Center connected',String(profile.login));
    return {ok:true,status:githubCredentialStatus(),profile:{login:String(profile.login),name:String(profile.name||''),avatarUrl:String(profile.avatar_url||''),htmlUrl:String(profile.html_url||'')}};
  }catch(error){writeDiagnostic('GitHub credential save/test',error);return {ok:false,error:String(error?.message||error)};}
}
function removeGitHubCredential(){
  try{const store=readGitHubSecretStore();delete store.secrets.github;writeGitHubSecretStore(store);githubCenterCache={at:0,data:null,pending:null};githubSourceSelection=[];githubReleaseAssets=[];addActivity('GitHub Release Center disconnected','Encrypted GitHub token removed');return {ok:true,status:githubCredentialStatus()};}
  catch(error){writeDiagnostic('GitHub credential remove',error);return {ok:false,error:String(error?.message||error)};}
}
async function getGitHubCenter(force=false){
  const credential=githubCredentialStatus();if(!credential.configured)return {configured:false,credential,profile:null,repositories:[],generatedAt:new Date().toISOString()};
  if(!force&&githubCenterCache.data&&Date.now()-githubCenterCache.at<60000)return githubCenterCache.data;
  if(githubCenterCache.pending)return githubCenterCache.pending;
  githubCenterCache.pending=(async()=>{
    try{
      const profile=(await githubRequest('/user',{timeoutMs:12000})).data||{};const repos=[];
      for(let page=1;page<=4;page++){
        const r=(await githubRequest(`/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner%2Ccollaborator%2Corganization_member`,{timeoutMs:15000})).data;
        const batch=Array.isArray(r)?r:[];repos.push(...batch);if(batch.length<100)break;
      }
      const data={configured:true,credential,profile:{login:String(profile.login||''),name:String(profile.name||''),avatarUrl:String(profile.avatar_url||''),htmlUrl:String(profile.html_url||'')},repositories:repos.map(r=>({id:Number(r.id)||null,name:String(r.name||''),fullName:String(r.full_name||''),owner:String(r.owner?.login||''),description:String(r.description||''),private:Boolean(r.private),visibility:String(r.visibility||(r.private?'private':'public')),archived:Boolean(r.archived),defaultBranch:String(r.default_branch||'main'),sizeKB:Number(r.size)||0,updatedAt:r.updated_at||null,pushedAt:r.pushed_at||null,htmlUrl:String(r.html_url||''),permissions:{admin:Boolean(r.permissions?.admin),maintain:Boolean(r.permissions?.maintain),push:Boolean(r.permissions?.push),pull:Boolean(r.permissions?.pull)}})).filter(r=>r.fullName),generatedAt:new Date().toISOString()};
      githubCenterCache={at:Date.now(),data,pending:null};return data;
    }catch(error){githubCenterCache.pending=null;writeDiagnostic('GitHub center refresh',error);return {configured:true,credential,profile:null,repositories:[],generatedAt:new Date().toISOString(),error:String(error?.message||error)};}
  })();return githubCenterCache.pending;
}
async function getGitHubRepoDetails(repoValue){
  let repo;try{repo=normalizeGitHubRepo(repoValue);}catch(error){return {ok:false,error:String(error?.message||error)};}
  try{
    const [metaRes,branchRes,commitRes,releaseRes]=await Promise.all([
      githubRequest(`/repos/${repo}`),
      githubRequest(`/repos/${repo}/branches?per_page=100`,{allowStatuses:[409]}),
      githubRequest(`/repos/${repo}/commits?per_page=8`,{allowStatuses:[409]}),
      githubRequest(`/repos/${repo}/releases?per_page=8`,{allowStatuses:[409]})
    ]);
    const meta=metaRes.data||{};const branches=Array.isArray(branchRes.data)?branchRes.data:[];const commits=Array.isArray(commitRes.data)?commitRes.data:[];const releases=Array.isArray(releaseRes.data)?releaseRes.data:[];
    const emptyRepository=branches.length===0&&(commitRes.status===409||commits.length===0);
    return {ok:true,emptyRepository,repository:{fullName:String(meta.full_name||repo),name:String(meta.name||repo.split('/')[1]),private:Boolean(meta.private),archived:Boolean(meta.archived),defaultBranch:String(meta.default_branch||'main'),htmlUrl:String(meta.html_url||githubSafeRepoUrl(repo)),permissions:{admin:Boolean(meta.permissions?.admin),maintain:Boolean(meta.permissions?.maintain),push:Boolean(meta.permissions?.push),pull:Boolean(meta.permissions?.pull)}},branches:branches.map(b=>({name:String(b.name||''),protected:Boolean(b.protected),sha:String(b.commit?.sha||'')})).filter(b=>b.name),commits:commits.map(c=>({sha:String(c.sha||''),shortSha:String(c.sha||'').slice(0,7),message:String(c.commit?.message||'').split('\n')[0].slice(0,180),author:String(c.commit?.author?.name||c.author?.login||''),date:c.commit?.author?.date||null,url:String(c.html_url||'')})),releases:releases.map(r=>({id:Number(r.id)||null,tag:String(r.tag_name||''),name:String(r.name||r.tag_name||''),draft:Boolean(r.draft),prerelease:Boolean(r.prerelease),publishedAt:r.published_at||r.created_at||null,url:String(r.html_url||''),assets:Array.isArray(r.assets)?r.assets.length:0}))};
  }catch(error){writeDiagnostic('GitHub repository details',error);return {ok:false,error:String(error?.message||error)};}
}
function githubWalkFolder(root){
  const out=[];let total=0;
  const walk=(dir,relative='')=>{
    const entries=fs.readdirSync(dir,{withFileTypes:true});
    for(const entry of entries){if(out.length>=GITHUB_SOURCE_MAX_FILES)throw new Error(`Folder selection exceeds ${GITHUB_SOURCE_MAX_FILES} files.`);if(entry.isDirectory()&&GITHUB_FOLDER_IGNORES.has(entry.name))continue;
      const abs=path.join(dir,entry.name);const rel=relative?`${relative}/${entry.name}`:entry.name;
      if(entry.isDirectory()){walk(abs,rel);continue;}if(!entry.isFile())continue;
      const stat=fs.statSync(abs);if(stat.size>GITHUB_SOURCE_MAX_FILE_BYTES)throw new Error(`${entry.name} exceeds the 20 MB source-upload limit.`);total+=stat.size;if(total>GITHUB_SOURCE_MAX_TOTAL_BYTES)throw new Error('Selected source folder exceeds the 100 MB PowerTools upload limit.');out.push({absolutePath:abs,relativePath:normalizeGitHubRelativePath(rel),sizeBytes:stat.size});
    }
  };walk(root);return out;
}
async function selectGitHubSource(kindValue){
  const kind=String(kindValue||'files').toLowerCase()==='folder'?'folder':'files';
  try{
    const pick=await dialog.showOpenDialog(mainWindow,{title:kind==='folder'?'GitHub Release Center — Select source folder':'GitHub Release Center — Select source files',properties:kind==='folder'?['openDirectory']:['openFile','multiSelections']});
    if(pick.canceled||!pick.filePaths?.length)return {ok:false,canceled:true,files:githubSelectionPublic(githubSourceSelection)};
    let items=[];
    if(kind==='folder'){items=githubWalkFolder(pick.filePaths[0]);}
    else {let total=0;items=pick.filePaths.map(file=>{const stat=fs.statSync(file);if(!stat.isFile())throw new Error('Only regular files can be uploaded.');if(stat.size>GITHUB_SOURCE_MAX_FILE_BYTES)throw new Error(`${path.basename(file)} exceeds the 20 MB source-upload limit.`);total+=stat.size;if(total>GITHUB_SOURCE_MAX_TOTAL_BYTES)throw new Error('Selected source files exceed the 100 MB PowerTools upload limit.');return {absolutePath:file,relativePath:path.basename(file),sizeBytes:stat.size};});}
    githubSourceSelection=items;return {ok:true,kind,files:githubSelectionPublic(items),totalBytes:items.reduce((a,b)=>a+b.sizeBytes,0)};
  }catch(error){writeDiagnostic('GitHub source selection',error);return {ok:false,error:String(error?.message||error),files:githubSelectionPublic(githubSourceSelection)};}
}
function clearGitHubSource(){githubSourceSelection=[];return {ok:true,files:[]};}
async function createGitHubSourceCommit(payload={}){
  let repo,branch,prefix;try{repo=normalizeGitHubRepo(payload.repo);branch=normalizeGitHubBranch(payload.branch);prefix=normalizeGitHubRepoPrefix(payload.prefix);}catch(error){return {ok:false,error:String(error?.message||error)};}
  const message=String(payload.message||'').trim();if(message.length<3||message.length>500)return {ok:false,error:'Enter a commit message between 3 and 500 characters.'};if(!githubSourceSelection.length)return {ok:false,error:'Select files or a source folder first.'};
  const targets=[];const seen=new Set();
  try{for(const item of githubSourceSelection){const rel=normalizeGitHubRelativePath(item.relativePath);const dest=normalizeGitHubRelativePath(prefix?`${prefix}/${rel}`:rel);if(seen.has(dest.toLowerCase()))throw new Error(`Duplicate repository path: ${dest}`);seen.add(dest.toLowerCase());targets.push({...item,dest});}}catch(error){return {ok:false,error:String(error?.message||error)};}
  const choice=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancel','Commit & Upload'],defaultId:0,cancelId:0,title:'Commit files to GitHub?',message:`Commit ${targets.length} file${targets.length===1?'':'s'} to ${repo}?`,detail:`Branch: ${branch}\nCommit: ${message}\n\nThis writes directly to the selected GitHub repository. Protected branches may reject the update.`});
  if(choice.response!==1)return {ok:false,canceled:true};
  try{
    const meta=(await githubRequest(`/repos/${repo}`,{timeoutMs:12000})).data||{};
    const defaultBranch=normalizeGitHubBranch(meta.default_branch||'main');
    const branchesRes=await githubRequest(`/repos/${repo}/branches?per_page=1`,{allowStatuses:[409],timeoutMs:12000});
    const branchList=Array.isArray(branchesRes.data)?branchesRes.data:[];
    let initializedEmptyRepository=false;
    let workingTargets=targets.slice();
    let headSha='';

    if(branchList.length===0){
      const preferred=workingTargets.find(x=>/^readme(?:\.[^/]+)?$/i.test(x.dest))
        || workingTargets.find(x=>/^package\.json$/i.test(x.dest))
        || workingTargets.slice().sort((a,b)=>a.sizeBytes-b.sizeBytes)[0];
      if(!preferred)throw new Error('No source file is available to initialize the empty repository.');

      const bootstrapBuffer=fs.readFileSync(preferred.absolutePath);
      const encodedPath=preferred.dest.split('/').map(encodeURIComponent).join('/');
      const init=await githubRequest(`/repos/${repo}/contents/${encodedPath}`,{
        method:'PUT',
        body:{message:`${message} (initialize repository)`,content:bootstrapBuffer.toString('base64')},
        timeoutMs:30000
      });
      headSha=String(init.data?.commit?.sha||'');
      if(!headSha)throw new Error('GitHub initialized the repository but did not return the first commit SHA.');
      initializedEmptyRepository=true;
      workingTargets=workingTargets.filter(x=>x!==preferred);

      if(branch!==defaultBranch){
        await githubRequest(`/repos/${repo}/git/refs`,{
          method:'POST',
          body:{ref:`refs/heads/${branch}`,sha:headSha},
          timeoutMs:30000
        });
      }
    }

    if(!headSha){
      const ref=(await githubRequest(`/repos/${repo}/git/ref/heads/${githubRefPath(branch)}`)).data;
      headSha=String(ref?.object?.sha||'');
      if(!headSha)throw new Error('Unable to resolve the selected branch head.');
    }

    if(!workingTargets.length){
      githubCenterCache={at:0,data:null,pending:null};addActivity('GitHub source update published',`${repo} · ${branch} · ${targets.length} files`);addChangeJournalEntry({category:'GitHub',title:'GitHub source update published',summary:`${repo} · ${branch} · ${targets.length} files`,source:'GitHub Release Center',risk:'Medium'});
      return {ok:true,repo,branch,commitSha:headSha,commitUrl:`https://github.com/${repo}/commit/${headSha}`,files:targets.length,message,initializedEmptyRepository};
    }

    const head=(await githubRequest(`/repos/${repo}/git/commits/${encodeURIComponent(headSha)}`)).data;const baseTree=String(head?.tree?.sha||'');if(!baseTree)throw new Error('Unable to resolve the branch tree.');
    const tree=[];
    for(const item of workingTargets){const buffer=fs.readFileSync(item.absolutePath);const blob=(await githubRequest(`/repos/${repo}/git/blobs`,{method:'POST',body:{content:buffer.toString('base64'),encoding:'base64'},timeoutMs:30000})).data;if(!blob?.sha)throw new Error(`GitHub did not create a blob for ${item.dest}.`);tree.push({path:item.dest,mode:'100644',type:'blob',sha:blob.sha});}
    const newTree=(await githubRequest(`/repos/${repo}/git/trees`,{method:'POST',body:{base_tree:baseTree,tree},timeoutMs:30000})).data;if(!newTree?.sha)throw new Error('GitHub did not create the update tree.');
    const commit=(await githubRequest(`/repos/${repo}/git/commits`,{method:'POST',body:{message,tree:newTree.sha,parents:[headSha]},timeoutMs:30000})).data;if(!commit?.sha)throw new Error('GitHub did not create the commit.');
    await githubRequest(`/repos/${repo}/git/refs/heads/${githubRefPath(branch)}`,{method:'PATCH',body:{sha:commit.sha,force:false},timeoutMs:30000});
    githubCenterCache={at:0,data:null,pending:null};addActivity('GitHub source update published',`${repo} · ${branch} · ${targets.length} files${initializedEmptyRepository?' · repository initialized':''}`);addChangeJournalEntry({category:'GitHub',title:'GitHub source update published',summary:`${repo} · ${branch} · ${targets.length} files${initializedEmptyRepository?' · repository initialized':''}`,source:'GitHub Release Center',risk:'Medium'});
    return {ok:true,repo,branch,commitSha:String(commit.sha),commitUrl:`https://github.com/${repo}/commit/${commit.sha}`,files:targets.length,message,initializedEmptyRepository};
  }catch(error){
    writeDiagnostic('GitHub source commit',error);
    const status=Number(error?.status)||0;
    const raw=String(error?.message||error);
    if(status===409)return {ok:false,error:'GitHub reported a repository conflict (HTTP 409). Refresh the repository and try again. Empty repositories are initialized automatically.'};
    return {ok:false,error:raw};
  }
}
async function selectGitHubReleaseAssets(){
  try{const pick=await dialog.showOpenDialog(mainWindow,{title:'GitHub Release Center — Select release assets',properties:['openFile','multiSelections']});if(pick.canceled||!pick.filePaths?.length)return {ok:false,canceled:true,files:githubSelectionPublic(githubReleaseAssets)};
    let total=0;const items=pick.filePaths.slice(0,GITHUB_ASSET_MAX_FILES).map(file=>{const stat=fs.statSync(file);if(!stat.isFile())throw new Error('Only regular files can be release assets.');if(stat.size>GITHUB_ASSET_MAX_FILE_BYTES)throw new Error(`${path.basename(file)} exceeds the 100 MB PowerTools release-asset limit.`);total+=stat.size;if(total>GITHUB_ASSET_MAX_TOTAL_BYTES)throw new Error('Selected release assets exceed the 250 MB PowerTools upload limit.');return {absolutePath:file,relativePath:path.basename(file),sizeBytes:stat.size};});
    const names=new Set();for(const item of items){const key=item.relativePath.toLowerCase();if(names.has(key))throw new Error(`Duplicate release asset name: ${item.relativePath}`);names.add(key);}githubReleaseAssets=items;return {ok:true,files:githubSelectionPublic(items),totalBytes:total};
  }catch(error){writeDiagnostic('GitHub release asset selection',error);return {ok:false,error:String(error?.message||error),files:githubSelectionPublic(githubReleaseAssets)};}
}
function clearGitHubReleaseAssets(){githubReleaseAssets=[];return {ok:true,files:[]};}
function normalizeGitHubTag(value){const tag=String(value||'').trim();if(!tag||tag.length>128||tag.startsWith('-')||tag.includes('..')||/\s/.test(tag)||!/^[-A-Za-z0-9._+\/]+$/.test(tag))throw new Error('Enter a valid Git tag, for example v2.0.0.');return tag;}
async function generateGitHubReleaseNotes(payload={}){
  let repo,branch,tag;try{repo=normalizeGitHubRepo(payload.repo);branch=normalizeGitHubBranch(payload.branch);tag=normalizeGitHubTag(payload.tag);}catch(error){return {ok:false,error:String(error?.message||error)};}
  try{const out=(await githubRequest(`/repos/${repo}/releases/generate-notes`,{method:'POST',body:{tag_name:tag,target_commitish:branch},timeoutMs:20000})).data||{};return {ok:true,name:String(out.name||tag),body:String(out.body||'')};}
  catch(error){writeDiagnostic('GitHub generate release notes',error);return {ok:false,error:String(error?.message||error)};}
}
async function publishGitHubRelease(payload={}){
  let repo,branch,tag;try{repo=normalizeGitHubRepo(payload.repo);branch=normalizeGitHubBranch(payload.branch);tag=normalizeGitHubTag(payload.tag);}catch(error){return {ok:false,error:String(error?.message||error)};}
  const name=String(payload.name||tag).trim().slice(0,200)||tag;const body=String(payload.body||'').slice(0,50000);const draft=Boolean(payload.draft);const prerelease=Boolean(payload.prerelease);const updateExisting=Boolean(payload.updateExisting);const replaceAssets=Boolean(payload.replaceAssets);
  const choice=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancel',updateExisting?'Publish / Update Release':'Publish Release'],defaultId:0,cancelId:0,title:'Publish GitHub release?',message:`${updateExisting?'Publish or update':'Publish'} ${tag} in ${repo}?`,detail:`Target branch: ${branch}\nAssets: ${githubReleaseAssets.length}\nDraft: ${draft?'Yes':'No'} · Pre-release: ${prerelease?'Yes':'No'}\n\nThis writes release metadata and selected assets to GitHub.`});if(choice.response!==1)return {ok:false,canceled:true};
  try{
    const existingRes=await githubRequest(`/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,{allowStatuses:[404]});let release=existingRes.status===200?existingRes.data:null;
    if(release&&!updateExisting)return {ok:false,error:`Release ${tag} already exists. Enable “Update existing release” to modify it.`};
    if(release){release=(await githubRequest(`/repos/${repo}/releases/${release.id}`,{method:'PATCH',body:{tag_name:tag,target_commitish:branch,name,body,draft,prerelease},timeoutMs:20000})).data;}
    else {release=(await githubRequest(`/repos/${repo}/releases`,{method:'POST',body:{tag_name:tag,target_commitish:branch,name,body,draft,prerelease},timeoutMs:20000})).data;}
    if(!release?.id)throw new Error('GitHub did not return a release ID.');
    const assetList=(await githubRequest(`/repos/${repo}/releases/${release.id}/assets?per_page=100`,{timeoutMs:20000})).data;
    const currentAssets=Array.isArray(assetList)?assetList:[];const uploaded=[];
    for(const item of githubReleaseAssets){const assetName=path.basename(item.absolutePath);const duplicate=currentAssets.find(a=>String(a.name||'').toLowerCase()===assetName.toLowerCase());if(duplicate){if(!replaceAssets)throw new Error(`Release asset “${assetName}” already exists. Enable “Replace same-named assets” to replace it.`);await githubRequest(`/repos/${repo}/releases/assets/${duplicate.id}`,{method:'DELETE',timeoutMs:20000});}
      const buffer=fs.readFileSync(item.absolutePath);const uploadUrl=`https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`;const asset=(await githubRequest(uploadUrl,{method:'POST',rawBody:buffer,contentType:'application/octet-stream',timeoutMs:120000})).data;uploaded.push({name:assetName,url:String(asset?.browser_download_url||''),sizeBytes:item.sizeBytes});}
    githubCenterCache={at:0,data:null,pending:null};addActivity('GitHub release published',`${repo} · ${tag} · ${uploaded.length} assets`);addChangeJournalEntry({category:'GitHub',title:'GitHub release published',summary:`${repo} · ${tag} · ${uploaded.length} assets`,source:'GitHub Release Center',risk:'Medium'});
    return {ok:true,repo,tag,releaseId:Number(release.id),releaseUrl:String(release.html_url||`https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`),draft:Boolean(release.draft),prerelease:Boolean(release.prerelease),uploaded};
  }catch(error){writeDiagnostic('GitHub release publish',error);return {ok:false,error:String(error?.message||error)};}
}
async function openGitHubLink(value){
  try{const url=new URL(String(value||''));if(url.protocol!=='https:'||url.hostname!=='github.com')throw new Error('Only github.com links can be opened here.');await shell.openExternal(url.toString());return {ok:true};}catch(error){return {ok:false,error:String(error?.message||error)};}
}
async function openGitHubTokenSettings(){try{await shell.openExternal('https://github.com/settings/personal-access-tokens/new');return {ok:true};}catch(error){return {ok:false,error:String(error?.message||error)};}}

const AI_CREDENTIAL_IDS = new Set(['openai','anthropic','gemini']);
const CLOUD_AI_HOSTS = new Set(['api.openai.com','api.anthropic.com','generativelanguage.googleapis.com']);
function credentialProviderId(provider) {
  const id=String(provider||'').toLowerCase();
  if(id==='codex')return 'openai';
  if(id==='claude')return 'anthropic';
  return id;
}
function aiSecretsPath() {
  try{return path.join(app.getPath('userData'),'ai-provider-secrets.json');}catch{return null;}
}
function readAiSecretStore() {
  const file=aiSecretsPath(); if(!file||!fs.existsSync(file))return {version:1,secrets:{}};
  try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return {version:1,secrets:(data&&typeof data.secrets==='object'&&data.secrets)||{}};}catch(error){writeDiagnostic('AI credential store read',error);return {version:1,secrets:{}};}
}
function writeAiSecretStore(store) {
  const file=aiSecretsPath(); if(!file)throw new Error('PowerTools user-data path is unavailable.');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({version:1,secrets:store.secrets||{}},null,2),'utf8');
  try{if(process.platform!=='win32')fs.chmodSync(file,0o600);}catch{}
}
function aiEncryptionAvailable() { try{return Boolean(safeStorage?.isEncryptionAvailable?.());}catch{return false;} }
function loadAiCredential(provider) {
  const id=credentialProviderId(provider); if(!AI_CREDENTIAL_IDS.has(id))return null;
  const entry=readAiSecretStore().secrets[id]; if(!entry?.ciphertext||!aiEncryptionAvailable())return null;
  try{return safeStorage.decryptString(Buffer.from(String(entry.ciphertext),'base64'));}catch(error){writeDiagnostic(`AI credential decrypt ${id}`,error);return null;}
}
function aiCredentialStatus() {
  const store=readAiSecretStore();
  const configured=id=>Boolean(store.secrets?.[id]?.ciphertext);
  return {encryptionAvailable:aiEncryptionAvailable(),storage:'Electron safeStorage / Windows DPAPI',openai:configured('openai'),anthropic:configured('anthropic'),gemini:configured('gemini')};
}
function saveAiCredential(provider,key) {
  const id=credentialProviderId(provider); const value=String(key||'').trim();
  if(!AI_CREDENTIAL_IDS.has(id))return {ok:false,error:'Unsupported AI provider.'};
  if(value.length<12||value.length>4096)return {ok:false,error:'Enter a valid API key.'};
  if(!aiEncryptionAvailable())return {ok:false,error:'Secure credential encryption is unavailable. PowerTools will not store API keys as plaintext.'};
  try{
    const store=readAiSecretStore(); store.secrets[id]={ciphertext:safeStorage.encryptString(value).toString('base64'),updatedAt:new Date().toISOString()}; writeAiSecretStore(store);
    modelCenterCache={at:0,key:'',data:null,pending:null}; addActivity('AI provider configured',id==='openai'?'OpenAI / Codex':id==='anthropic'?'Claude':'Gemini');
    return {ok:true,status:aiCredentialStatus()};
  }catch(error){writeDiagnostic(`AI credential save ${id}`,error);return {ok:false,error:String(error?.message||error)};}
}
function removeAiCredential(provider) {
  const id=credentialProviderId(provider); if(!AI_CREDENTIAL_IDS.has(id))return {ok:false,error:'Unsupported AI provider.'};
  try{const store=readAiSecretStore();delete store.secrets[id];writeAiSecretStore(store);modelCenterCache={at:0,key:'',data:null,pending:null};addActivity('AI provider credential removed',id==='openai'?'OpenAI / Codex':id==='anthropic'?'Claude':'Gemini');return {ok:true,status:aiCredentialStatus()};}
  catch(error){writeDiagnostic(`AI credential remove ${id}`,error);return {ok:false,error:String(error?.message||error)};}
}
async function cloudAiJson(url, options={}, timeoutMs=15000) {
  let checked; try{checked=new URL(String(url||''));}catch{throw new Error('Invalid cloud AI endpoint.');}
  if(checked.protocol!=='https:'||!CLOUD_AI_HOSTS.has(String(checked.hostname||'').toLowerCase()))throw new Error('Cloud AI endpoint is not allowlisted.');
  if(checked.username||checked.password)throw new Error('Credentials must not be embedded in cloud endpoint URLs.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(checked.toString(),{...options,redirect:'error',signal:controller.signal,headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
    const text=await res.text();
    if(!res.ok){let detail=text.slice(0,220);try{const parsed=JSON.parse(text);detail=parsed?.error?.message||parsed?.error?.type||parsed?.message||detail;}catch{}throw new Error(`HTTP ${res.status}${detail?` — ${detail}`:''}`);}
    try{return text?JSON.parse(text):{};}catch{throw new Error('AI provider returned invalid JSON.');}
  }catch(error){if(error?.name==='AbortError')throw new Error('AI provider timed out.');throw error;}finally{clearTimeout(timer);}
}
function isOpenAiInteractiveModel(id) {
  const x=String(id||'').toLowerCase(); if(!x)return false;
  if(['embedding','moderation','image','audio','tts','whisper','transcribe','realtime','search-preview'].some(t=>x.includes(t)))return false;
  return x.startsWith('gpt-')||x.startsWith('o1')||x.startsWith('o3')||x.startsWith('o4')||x.startsWith('o5')||x.includes('codex')||x.startsWith('chatgpt-');
}
function isGeminiInteractiveModel(id) {
  const x=String(id||'').toLowerCase(); if(!x.startsWith('gemini-'))return false;
  return !['embedding','imagen','veo','tts','transcribe','robotics'].some(t=>x.includes(t));
}
async function probeOllama() {
  const endpoint='http://127.0.0.1:11434'; const started=Date.now();
  try{const data=await localModelJson(`${endpoint}/api/tags`,{},3500);const models=(Array.isArray(data?.models)?data.models:[]).map(m=>({key:`ollama::${m.name||m.model}`,provider:'ollama',providerName:'Ollama',scope:'local',id:String(m.name||m.model||''),name:String(m.name||m.model||'Unnamed model'),size:Number(m.size)||null,modifiedAt:m.modified_at||null,digest:m.digest||null,details:m.details||null,endpoint})).filter(m=>m.id);return {provider:{id:'ollama',name:'Ollama',scope:'local',endpoint,configured:true,online:true,modelsCount:models.length,latencyMs:Date.now()-started},models};}
  catch(error){return {provider:{id:'ollama',name:'Ollama',scope:'local',endpoint,configured:true,online:false,modelsCount:0,latencyMs:Date.now()-started,error:String(error?.message||error)},models:[]};}
}
async function probeOpenAiLocal(id,name,endpoint) {
  const started=Date.now();
  try{const base=normalizeLocalModelEndpoint(endpoint);const data=await localModelJson(openAiLocalUrl(base,'models'),{},3500);const models=(Array.isArray(data?.data)?data.data:[]).map(m=>({key:`${id}::${m.id}`,provider:id,providerName:name,scope:'local',id:String(m.id||''),name:String(m.id||'Unnamed model'),ownedBy:m.owned_by||null,created:m.created||null,endpoint:base})).filter(m=>m.id);return {provider:{id,name,scope:'local',endpoint:base,configured:true,online:true,modelsCount:models.length,latencyMs:Date.now()-started},models};}
  catch(error){return {provider:{id,name,scope:'local',endpoint:String(endpoint||''),configured:true,online:false,modelsCount:0,latencyMs:Date.now()-started,error:String(error?.message||error)},models:[]};}
}
async function probeOpenAICloud() {
  const key=loadAiCredential('openai'); const started=Date.now();
  if(!key)return {providers:[{id:'openai',name:'OpenAI / ChatGPT',scope:'cloud',configured:false,online:false,modelsCount:0},{id:'codex',name:'Codex',scope:'cloud',configured:false,online:false,modelsCount:0,sharedCredential:'openai'}],models:[]};
  try{
    const data=await cloudAiJson('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`}},12000);
    const raw=(Array.isArray(data?.data)?data.data:[]).filter(m=>isOpenAiInteractiveModel(m?.id));
    const models=raw.map(m=>{const id=String(m.id||'');const codex=id.toLowerCase().includes('codex');return {key:`${codex?'codex':'openai'}::${id}`,provider:codex?'codex':'openai',providerName:codex?'Codex':'OpenAI / ChatGPT',scope:'cloud',id,name:id,created:m.created||null,ownedBy:m.owned_by||null,endpoint:'https://api.openai.com/v1'};}).slice(0,250);
    const latencyMs=Date.now()-started; const g=models.filter(m=>m.provider==='openai').length,c=models.filter(m=>m.provider==='codex').length;
    return {providers:[{id:'openai',name:'OpenAI / ChatGPT',scope:'cloud',configured:true,online:true,modelsCount:g,latencyMs},{id:'codex',name:'Codex',scope:'cloud',configured:true,online:true,modelsCount:c,latencyMs,sharedCredential:'openai'}],models};
  }catch(error){const err=String(error?.message||error);return {providers:[{id:'openai',name:'OpenAI / ChatGPT',scope:'cloud',configured:true,online:false,modelsCount:0,error:err},{id:'codex',name:'Codex',scope:'cloud',configured:true,online:false,modelsCount:0,error:err,sharedCredential:'openai'}],models:[]};}
}
async function probeClaudeCloud() {
  const key=loadAiCredential('anthropic'); const started=Date.now();
  if(!key)return {provider:{id:'claude',name:'Claude',scope:'cloud',configured:false,online:false,modelsCount:0},models:[]};
  try{
    const data=await cloudAiJson('https://api.anthropic.com/v1/models?limit=100',{headers:{'x-api-key':key,'anthropic-version':'2023-06-01'}},12000);
    const rows=Array.isArray(data?.data)?data.data:[];
    const models=rows.map(m=>({key:`claude::${m.id}`,provider:'claude',providerName:'Claude',scope:'cloud',id:String(m.id||''),name:String(m.display_name||m.id||'Claude model'),createdAt:m.created_at||null,endpoint:'https://api.anthropic.com/v1'})).filter(m=>m.id).slice(0,120);
    return {provider:{id:'claude',name:'Claude',scope:'cloud',configured:true,online:true,modelsCount:models.length,latencyMs:Date.now()-started},models};
  }catch(error){return {provider:{id:'claude',name:'Claude',scope:'cloud',configured:true,online:false,modelsCount:0,latencyMs:Date.now()-started,error:String(error?.message||error)},models:[]};}
}
async function probeGeminiCloud() {
  const key=loadAiCredential('gemini'); const started=Date.now();
  if(!key)return {provider:{id:'gemini',name:'Gemini',scope:'cloud',configured:false,online:false,modelsCount:0},models:[]};
  try{
    const data=await cloudAiJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':key,'x-goog-api-client':`purple-dragon-powertools/${app.getVersion()}`}},12000);
    const rows=Array.isArray(data?.models)?data.models:[];
    const models=rows.map(m=>{const id=String(m.name||'').replace(/^models\//,'');return {key:`gemini::${id}`,provider:'gemini',providerName:'Gemini',scope:'cloud',id,name:String(m.displayName||id||'Gemini model'),description:m.description||null,inputTokenLimit:m.inputTokenLimit||null,outputTokenLimit:m.outputTokenLimit||null,endpoint:'https://generativelanguage.googleapis.com/v1beta'};}).filter(m=>isGeminiInteractiveModel(m.id)).slice(0,180);
    return {provider:{id:'gemini',name:'Gemini',scope:'cloud',configured:true,online:true,modelsCount:models.length,latencyMs:Date.now()-started},models};
  }catch(error){return {provider:{id:'gemini',name:'Gemini',scope:'cloud',configured:true,online:false,modelsCount:0,latencyMs:Date.now()-started,error:String(error?.message||error)},models:[]};}
}
const DRAGON_ROUTER_PROFILES = new Set(['automatic','best-quality','fastest','cheapest','local-only','privacy-first']);
function dragonTaskClass(prompt) {
  const text=String(prompt||'').toLowerCase();
  const count=(terms)=>terms.reduce((n,t)=>n+(text.includes(t)?1:0),0);
  const scores={
    coding:count(['code','coding','javascript','typescript','python','powershell','script','function','class ','api ','bug','debug','compile','regex','html','css','electron','node.js','npm','github','repository','refactor']),
    windows:count(['windows','pc ','computer','cpu','gpu','ram','memory','disk','storage','driver','event id','event viewer','defender','firewall','registry','bios','tpm','secure boot','startup','service','process','network','wifi','ethernet','temperature','crash','bsod']),
    security:count(['security','malware','phishing','defender','firewall','vulnerability','secure boot','bitlocker','smartscreen','tamper','antivirus','threat']),
    analysis:count(['analyze','analysis','compare','summarize','summary','explain this log','log file','report','document','reason about','review','evaluate','investigate','root cause']),
  };
  let id='general',best=0;for(const [k,v] of Object.entries(scores)){if(v>best){id=k;best=v;}}
  const labels={general:'General Assistant',coding:'Coding / Development',windows:'Windows / PC Diagnostics',security:'Security Analysis',analysis:'Deep Analysis'};
  return {id,label:labels[id],signals:best,confidence:best>=4?'high':best>=2?'medium':'normal'};
}
function dragonModelNameScore(model, taskId, profile) {
  const name=String(model?.id||model?.name||'').toLowerCase(); let score=0; const reasons=[];
  const has=(...xs)=>xs.some(x=>name.includes(x));
  if(taskId==='coding' && has('codex','coder','code','deepseek-coder','qwen2.5-coder','qwen3-coder')){score+=42;reasons.push('coding-specialized model');}
  if(taskId==='analysis' && has('opus','sonnet','pro','gpt-5','o3','o4')){score+=16;reasons.push('strong analysis-oriented model family');}
  if(taskId==='windows' && has('gpt-5','sonnet','pro','qwen','llama'))score+=8;
  if(taskId==='security' && has('gpt-5','sonnet','opus','pro'))score+=10;
  if(profile==='best-quality'){
    if(has('opus','pro','gpt-5','o3','o4','70b','72b','32b','34b')){score+=24;reasons.push('quality-oriented model tier/name');}
    if(has('mini','nano','flash-lite','haiku','1b','2b','3b'))score-=8;
  }
  if(profile==='fastest'){
    if(has('mini','nano','flash','haiku','1b','2b','3b','7b','8b')){score+=24;reasons.push('speed-oriented model tier/name');}
    if(has('opus','70b','72b'))score-=10;
  }
  if(profile==='cheapest'){
    if(model?.scope!=='cloud'){score+=55;reasons.push('local inference avoids cloud API usage');}
    if(has('mini','nano','flash','haiku','flash-lite')){score+=26;reasons.push('cost-oriented cloud model tier/name');}
    if(has('opus','pro','70b','72b'))score-=12;
  }
  if(Number(model?.size)>0){
    const gb=Number(model.size)/1024**3;
    if(profile==='fastest' && gb<=6)score+=Math.max(2,Math.round(10-gb));
    if(profile==='best-quality' && gb>=12)score+=6;
  }
  return {score,reasons};
}
function dragonProviderBase(provider, taskId) {
  const table={
    general:{openai:30,claude:28,gemini:27,codex:18,ollama:20,lmstudio:20,custom:19},
    coding:{codex:50,claude:31,openai:30,gemini:25,ollama:22,lmstudio:22,custom:21},
    windows:{openai:34,claude:31,gemini:29,codex:23,ollama:24,lmstudio:24,custom:23},
    security:{claude:34,openai:33,gemini:29,codex:19,ollama:23,lmstudio:23,custom:22},
    analysis:{claude:36,openai:34,gemini:33,codex:19,ollama:23,lmstudio:23,custom:22}
  };
  return table[taskId]?.[provider] ?? 15;
}
function dragonRouteCandidate(model, center, task, profile) {
  const p=(center.providers||[]).find(x=>x.id===model.provider)||{}; let score=dragonProviderBase(model.provider,task.id); const reasons=[];
  const named=dragonModelNameScore(model,task.id,profile);score+=named.score;reasons.push(...named.reasons);
  if(model.scope!=='cloud'){
    score+=profile==='privacy-first'?85:profile==='local-only'?100:profile==='automatic'?5:0;
    if(profile==='privacy-first')reasons.unshift('privacy-first prefers local execution');
    else if(profile==='automatic')reasons.push('local model available');
  } else {
    if(profile==='privacy-first')score-=70;
    if(profile==='local-only')score-=1000;
  }
  if(profile==='fastest' && Number.isFinite(Number(p.latencyMs))){const latency=Math.max(0,Number(p.latencyMs));score+=Math.max(-5,Math.round(22-Math.min(latency,2200)/100));if(latency<250)reasons.push('provider probe latency is low');}
  if(profile==='best-quality' && model.scope==='cloud')score+=8;
  if(profile==='automatic' && task.id==='coding' && model.provider==='codex')reasons.unshift('Codex is preferred for coding tasks');
  return {model,score,reasons:[...new Set(reasons)].slice(0,4),providerLatencyMs:Number.isFinite(Number(p.latencyMs))?Number(p.latencyMs):null};
}
async function routeDragonModel(payload={}) {
  const prompt=String(payload?.prompt||'').trim(); if(!prompt)return {ok:false,error:'Enter a prompt before routing.'}; if(prompt.length>24000)return {ok:false,error:'Prompt is too long (24,000 character limit).'};
  const requested=String(payload?.profile||'automatic');const profile=DRAGON_ROUTER_PROFILES.has(requested)?requested:'automatic';const allowCloud=payload?.allowCloud!==false;
  const center=await getModelCenter(false,payload?.customEndpoint||''); let candidates=Array.isArray(center?.models)?center.models.slice():[];
  if(profile==='local-only'||!allowCloud)candidates=candidates.filter(m=>m.scope!=='cloud');
  if(profile==='privacy-first'){
    const local=candidates.filter(m=>m.scope!=='cloud');
    if(local.length)candidates=local;
    else if(!allowCloud)return {ok:false,error:'Privacy First could not find a local model. Start Ollama/LM Studio or allow configured cloud fallback.'};
  }
  if(!candidates.length)return {ok:false,error:allowCloud?'No connected AI models are available. Configure a provider or start a local model server.':'No connected local models are available with cloud providers disabled.'};
  const task=dragonTaskClass(prompt);const ranked=candidates.map(m=>dragonRouteCandidate(m,center,task,profile)).sort((a,b)=>b.score-a.score||String(a.model.name||a.model.id).localeCompare(String(b.model.name||b.model.id)));
  const top=ranked[0],second=ranked[1];const margin=second?top.score-second.score:20;const confidence=Math.max(55,Math.min(97,Math.round(68+margin*1.6)));
  const selected={...top.model};const fallbackUsed=profile==='privacy-first'&&selected.scope==='cloud';
  const profileLabels={'automatic':'Automatic','best-quality':'Best Quality','fastest':'Fastest','cheapest':'Cheapest','local-only':'Local Only','privacy-first':'Privacy First'};
  const reason=[`Task classified as ${task.label}.`,...(top.reasons.length?top.reasons:['best available provider/model fit']),selected.scope==='cloud'?'Uses a configured cloud API.':'Runs through a local provider.'];
  addActivity('Dragon Router selected model',`${profileLabels[profile]} · ${task.label} → ${selected.providerName||selected.provider} / ${selected.name||selected.id}`);
  return {ok:true,profile,profileLabel:profileLabels[profile],task,selected,confidence,score:top.score,usedCloudFallback:fallbackUsed,allowCloud,reason,alternatives:ranked.slice(1,4).map(x=>({model:{...x.model},score:x.score,reasons:x.reasons})),considered:ranked.length,routedAt:new Date().toISOString()};
}
async function getModelCenter(force=false, customEndpoint='') {
  let custom=''; let customValidationError=null;
  if(String(customEndpoint||'').trim()){try{custom=normalizeLocalModelEndpoint(customEndpoint);}catch(error){customValidationError=String(error?.message||error);}}
  const creds=aiCredentialStatus();
  const key=[custom||String(customEndpoint||'').trim(),creds.openai?'o1':'o0',creds.anthropic?'a1':'a0',creds.gemini?'g1':'g0'].join('|'); const now=Date.now();
  if(!force && modelCenterCache.data && modelCenterCache.key===key && now-modelCenterCache.at<10000)return modelCenterCache.data;
  if(modelCenterCache.pending && modelCenterCache.key===key)return modelCenterCache.pending;
  modelCenterCache.key=key;
  modelCenterCache.pending=(async()=>{
    const tasks=[probeOllama(),probeOpenAiLocal('lmstudio','LM Studio','http://127.0.0.1:1234/v1'),probeOpenAICloud(),probeClaudeCloud(),probeGeminiCloud()];
    if(custom)tasks.push(probeOpenAiLocal('custom','Custom local',custom));
    const results=await Promise.all(tasks); const providers=[]; const models=[];
    for(const r of results){if(Array.isArray(r.providers))providers.push(...r.providers);else if(r.provider)providers.push(r.provider);models.push(...(r.models||[]));}
    if(customValidationError)providers.push({id:'custom',name:'Custom local',scope:'local',endpoint:String(customEndpoint||''),configured:true,online:false,modelsCount:0,error:customValidationError});
    const cloudConfigured=providers.filter(p=>p.scope==='cloud'&&p.configured).length;
    const data={generatedAt:new Date().toISOString(),localOnly:cloudConfigured===0,credentials:creds,providers,models,customEndpoint:custom,summary:{providerCount:providers.length,onlineProviders:providers.filter(p=>p.online).length,configuredCloudProviders:cloudConfigured,modelCount:models.length,localModels:models.filter(m=>m.scope!=='cloud').length,cloudModels:models.filter(m=>m.scope==='cloud').length}};
    modelCenterCache={at:Date.now(),key,data,pending:null}; return data;
  })();
  try{return await modelCenterCache.pending;}finally{if(modelCenterCache.pending)modelCenterCache.pending=null;}
}
function openAiResponseText(data) {
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const pieces=[];for(const item of Array.isArray(data?.output)?data.output:[]){for(const c of Array.isArray(item?.content)?item.content:[]){if(typeof c?.text==='string')pieces.push(c.text);}}
  return pieces.join('\n').trim();
}
function geminiInteractionText(data) {
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const pieces=[];for(const step of Array.isArray(data?.steps)?data.steps:[]){if(step?.type!=='model_output')continue;for(const c of Array.isArray(step?.content)?step.content:[]){if(c?.type==='text'&&typeof c.text==='string')pieces.push(c.text);}}
  return pieces.join('\n').trim();
}

// v1.5.1 — System-Aware AI ----------------------------------------------------
// Context is generated only after an explicit AI/context action. Core live/static
// facts may be refreshed on demand; expensive modules are cache-only here so
// System-Aware AI never turns Security/Storage/Process/Network scans into startup work.
function aiContextClean(value, max = 180) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}
function aiContextPercent(value) {
  const n = Number(value); return Number.isFinite(n) ? `${Math.max(0, Math.min(100, Math.round(n)))}%` : 'unavailable';
}
function aiContextTemp(value) {
  const n = Number(value); return Number.isFinite(n) ? `${Math.round(n)} C` : 'unavailable';
}
function aiContextBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return 'unavailable';
  const units = ['B','KB','MB','GB','TB']; let v=n, i=0;
  while(v>=1024 && i<units.length-1){v/=1024;i++;}
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
function aiContextRate(bytes) {
  const n=Number(bytes); return Number.isFinite(n) ? `${aiContextBytes(Math.max(0,n))}/s` : 'unavailable';
}
function aiContextTaskSections(prompt, mode) {
  const full = mode === 'full';
  const q = String(prompt || '').toLowerCase();
  const set = new Set(['system','performance','hardware']);
  const specific = /security|defender|firewall|secure boot|tpm|bitlocker|storage|disk|drive|network|internet|wifi|wi-fi|ethernet|dns|ping|gateway|process|app|program|feature lab|sandbox|wsl|hyper-v|hyperv|automation|rule|schedule|startup/.test(q);
  const broad = !q || (!specific && /health|slow|performance|problem|wrong|issue|diagnos|computer|pc|system|overall/.test(q));
  if(full || broad || /security|defender|firewall|secure boot|tpm|bitlocker|smartscreen|uac|virus|malware/.test(q)) set.add('security');
  if(full || broad || /storage|disk|drive|space|ssd|nvme|file|cleanup/.test(q)) set.add('storage');
  if(full || broad || /process|app|program|memory hog|cpu hog|task/.test(q)) set.add('processes');
  if(full || /network|internet|wifi|wi-fi|ethernet|dns|ping|gateway|connection/.test(q)) set.add('network');
  if(full || broad || /crash|reliability|freeze|hang|boot time|diagnostic/.test(q)) set.add('reliability');
  if(full || /feature lab|sandbox|wsl|hyper-v|hyperv|developer mode|hags|long paths|openssh/.test(q)) set.add('featureLab');
  if(full || /automation|rule|schedule|trigger/.test(q)) set.add('automation');
  if(full || /startup|boot app|login app/.test(q)) set.add('startup');
  return set;
}
async function buildAiSystemContext(payload = {}) {
  const requestedMode = String(payload?.mode || 'smart').toLowerCase();
  const mode = requestedMode === 'full' ? 'full' : 'smart';
  const prompt = String(payload?.prompt || '').slice(0, 24000);
  const force = Boolean(payload?.force);
  const taskSections = aiContextTaskSections(prompt, mode);
  const cacheKey = [mode,prompt.toLowerCase().slice(0,220),cachedStaticAt||0,securityCache.at||0,storageInventoryCache.at||0,processCenterLastSnapshot?.generatedAt||'',networkCenterCache.at||0,featureLabCache.at||0,automationInitialized?automationRules.length:-1].join('|');
  if(!force && aiSystemContextCache.data && aiSystemContextCache.key===cacheKey && Date.now()-aiSystemContextCache.at<1500)return aiSystemContextCache.data;
  const [live, info] = await Promise.all([getLiveMetrics(),cachedStaticInfo ? Promise.resolve(cachedStaticInfo) : getStaticInfo(false)]);
  const sections=[];const sources=['live metrics','static hardware identity'];const unavailable=[];
  const add=(id,title,lines)=>{const cleanLines=(lines||[]).map(x=>aiContextClean(x,420)).filter(Boolean);if(cleanLines.length)sections.push({id,title,lines:cleanLines});};
  if(taskSections.has('system'))add('system','SYSTEM',[`OS: ${aiContextClean(info?.osCaption||'Windows')} ${aiContextClean(info?.osDisplayVersion||info?.osVersion||'')} build ${aiContextClean(info?.osBuildNumber||'unavailable')} (${aiContextClean(info?.arch||process.arch)})`,`Boot: ${aiContextClean(info?.bootMode||'unavailable')}; Secure Boot ${info?.secureBoot===true?'enabled':info?.secureBoot===false?'disabled':'unavailable'}; TPM ${info?.tpm?.TpmReady===true?'ready':info?.tpm?.TpmPresent===true?'present/not confirmed ready':'unavailable'}`,`Uptime: ${Number.isFinite(Number(live?.uptime))?Math.round(Number(live.uptime)/60)+' minutes':'unavailable'}`]);
  if(taskSections.has('performance')){const gu=Number(live?.gpu?.memoryUsedMB),gt=Number(live?.gpu?.memoryTotalMB);add('performance','LIVE PERFORMANCE',[`CPU load ${aiContextPercent(live?.cpu)}; CPU temperature ${aiContextTemp(live?.cpuTemperatureC)}; clock ${Number.isFinite(Number(live?.cpuClockMHz))?Math.round(Number(live.cpuClockMHz))+' MHz':'unavailable'}`,`Memory ${aiContextPercent(live?.memory)} (${aiContextBytes(live?.usedMemory)} used of ${aiContextBytes(live?.totalMemory)})`,`GPU ${aiContextClean(live?.gpu?.name||info?.gpu?.Name||'unavailable')}; load ${aiContextPercent(live?.gpu?.load)}; temperature ${aiContextTemp(live?.gpu?.temperatureC)}; VRAM ${Number.isFinite(gu)&&gu>=0?aiContextBytes(gu*1048576):'unavailable'} / ${Number.isFinite(gt)&&gt>0?aiContextBytes(gt*1048576):'unavailable'}`,`System drive ${aiContextPercent(live?.storage?.percent)} used; disk ${aiContextRate(live?.diskReadBps)} read / ${aiContextRate(live?.diskWriteBps)} write; network ${aiContextRate(live?.networkRxBps)} receive / ${aiContextRate(live?.networkTxBps)} send`,`PowerTools health heuristic ${aiContextPercent(live?.health)}`]);}
  if(taskSections.has('hardware'))add('hardware','HARDWARE',[`CPU: ${aiContextClean(info?.cpuModel||'unavailable')}; ${Number(info?.cpuPhysicalCores)||'unknown'} physical / ${Number(info?.cpuCores)||'unknown'} logical cores`,`GPU: ${aiContextClean(live?.gpu?.name||info?.gpu?.Name||'unavailable')}${live?.gpu?.memoryTotalMB?`; ${aiContextBytes(Number(live.gpu.memoryTotalMB)*1048576)} VRAM`:''}`,`RAM installed: ${aiContextBytes(info?.totalMemory||live?.totalMemory)}`,`Motherboard: ${aiContextClean([info?.motherboard?.Manufacturer,info?.motherboard?.Product].filter(Boolean).join(' ')||'unavailable')}; BIOS ${aiContextClean(info?.bios?.SMBIOSBIOSVersion||'unavailable')}`]);
  if(taskSections.has('security')){const sec=securityCache.data;if(sec){sources.push('loaded Security Center cache');const fw=Array.isArray(sec.firewall)?sec.firewall:[];add('security','SECURITY',[`Defender antivirus ${sec?.defender?.AntivirusEnabled===true?'enabled':sec?.defender?.AntivirusEnabled===false?'disabled':'unavailable'}; real-time protection ${sec?.defender?.RealTimeProtectionEnabled===true?'enabled':sec?.defender?.RealTimeProtectionEnabled===false?'disabled':'unavailable'}; tamper protection ${sec?.defender?.IsTamperProtected===true?'enabled':sec?.defender?.IsTamperProtected===false?'disabled':'unavailable'}`,`Firewall profiles: ${fw.length?fw.map(x=>`${aiContextClean(x.Name||'Profile')}=${x.Enabled===true?'on':x.Enabled===false?'off':'unknown'}`).join(', '):'unavailable'}`,`UAC ${sec?.uac?.enabled===true?'enabled':sec?.uac?.enabled===false?'disabled':'unavailable'}; SmartScreen ${aiContextClean(sec?.smartScreen?.explorer||'unavailable')}; BitLocker ${aiContextClean(sec?.bitLocker?.protectionStatus||'unavailable')}`,`Windows Update restart pending: ${sec?.update?.rebootPending===true?'yes':sec?.update?.rebootPending===false?'no':'unknown'}${sec?.update?.latestHotfix?.HotFixID?`; latest hotfix ${aiContextClean(sec.update.latestHotfix.HotFixID)}`:''}`]);}else unavailable.push('Security Center cache not loaded');}
  if(taskSections.has('storage')){const inv=storageInventoryCache.data;if(inv){sources.push('loaded Storage Hub cache');const vols=Array.isArray(inv.volumes)?inv.volumes.slice(0,6):[];add('storage','STORAGE',[`Local drives: ${Number(inv?.summary?.driveCount)||vols.length}; free ${aiContextBytes(inv?.summary?.freeBytes)} of ${aiContextBytes(inv?.summary?.totalBytes)}`,...vols.map(v=>`${aiContextClean(v.driveLetter||'?')}: ${aiContextClean(v.mediaType||v.driveType||'drive')} ${aiContextPercent(v.percent)} used; health ${aiContextClean(v.health||v.operationalStatus||'unknown')}; temperature ${aiContextTemp(v.temperatureC)}`)]);}else unavailable.push('Storage Hub inventory not loaded');}
  if(taskSections.has('processes')){const snap=processCenterLastSnapshot;if(snap){sources.push('loaded Process Center cache');const procs=Array.isArray(snap.processes)?[...snap.processes].sort((a,b)=>(Number(b.cpuPercent)||0)-(Number(a.cpuPercent)||0)).slice(0,6):[];add('processes','PROCESSES',[`Processes observed: ${Number(snap?.summary?.count)||procs.length}; working-set total ${aiContextBytes(snap?.summary?.totalMemoryBytes)}`,...procs.map(p=>`${aiContextClean(p.name||'process')}: CPU ${aiContextPercent(p.cpuPercent)}, memory ${aiContextBytes(p.memoryBytes)}`)]);}else unavailable.push('Process Center cache not loaded');}
  if(taskSections.has('network')){const net=networkCenterCache.data;if(net){sources.push('loaded Network PowerTools cache');const a=net?.summary?.activeAdapter;add('network','NETWORK',[`Adapters: ${Number(net?.summary?.adapterCount)||0}; active ${Number(net?.summary?.activeCount)||0}`,a?`Active adapter: ${aiContextClean(a.name||a.description||'adapter')}; link ${aiContextClean(a.linkSpeed||'unknown')}; connectivity ${aiContextClean(a.connectivity||'unknown')}; DHCP ${aiContextClean(a.dhcpEnabled||'unknown')}`:'No active adapter details loaded',`Current aggregate traffic: ${aiContextRate(live?.networkRxBps)} receive / ${aiContextRate(live?.networkTxBps)} send`]);}else unavailable.push('Network PowerTools cache not loaded');}
  if(taskSections.has('reliability')){const rel=getReliabilityStatus();sources.push('Reliability Center');add('reliability','RELIABILITY',[`Renderer ${aiContextClean(rel?.renderer?.state||'unknown')}; UI ready ${rel?.boot?.uiReadyMs==null?'pending':Math.round(rel.boot.uiReadyMs)+' ms'}`,`Renderer crashes ${Number(rel?.renderer?.crashCount)||0}; unresponsive events ${Number(rel?.renderer?.unresponsiveCount)||0}; diagnostics ${aiContextBytes(rel?.diagnostics?.sizeBytes||0)}`]);}
  if(taskSections.has('featureLab')){const lab=featureLabCache.data;if(lab){sources.push('loaded Windows Feature Lab cache');const features=Array.isArray(lab.features)?lab.features.slice(0,18):[];add('featureLab','WINDOWS FEATURE LAB',[`Feature Lab: ${Number(lab?.summary?.supported)||0}/${Number(lab?.summary?.featureCount)||features.length} supported; ${Number(lab?.summary?.enabled)||0} enabled; ${Number(lab?.summary?.needsReview)||0} need review`,...features.map(f=>`${aiContextClean(f.title)}: ${aiContextClean(f.stateLabel||f.state||'unknown')} (${aiContextClean(f.compatibilityLabel||f.compatibility||'unknown')})`)]);}else unavailable.push('Windows Feature Lab cache not loaded');}
  if(taskSections.has('automation')){if(automationInitialized){const a=publicAutomationState();sources.push('Automation Engine state');add('automation','AUTOMATION',[`Engine ${a?.masterEnabled===false?'paused':a?.running?'active':'ready'}; ${Number(a?.enabledCount)||0} enabled rules of ${Number(a?.ruleCount)||0}; evaluation interval ${Number(a?.tickMs)||AUTOMATION_TICK_MS} ms`,a?.lastTriggeredAt?`Last trigger ${aiContextClean(a.lastTriggeredAt)}`:'No automation trigger recorded this session']);}else unavailable.push('Automation Engine not initialized');}
  if(taskSections.has('startup')){if(Array.isArray(startupCache.data)&&startupCache.data.length){sources.push('loaded Startup cache');add('startup','STARTUP',[`Startup entries loaded: ${startupCache.data.length}. Names/commands are intentionally omitted from AI context.`]);}else unavailable.push('Startup inventory not loaded');}
  const generatedAt=new Date().toISOString();const privacy={level:'redacted-safe',omitted:['hostname','Windows username','IP addresses','MAC addresses','file paths','API keys','automation rule names/commands'],note:'Optional heavy providers are cache-only; missing modules are not scanned just to answer an AI question.'};
  const text=['PURPLE DRAGON SYSTEM CONTEXT — OBSERVED LOCAL FACTS',`Generated: ${generatedAt}`,`Mode: ${mode==='full'?'Full loaded context':'Smart task-aware context'}`,'Privacy: redacted safe snapshot; do not infer values that are unavailable.','',...sections.flatMap(section=>[`[${section.title}]`,...section.lines,'']),unavailable.length?`[NOT LOADED]\n${unavailable.join('; ')}`:'','','Instruction: Treat this snapshot as time-bound evidence. Clearly distinguish observed facts, estimates, and unavailable data. Do not invent hardware, temperatures, security state, processes, or Windows settings.'].filter(Boolean).join('\n').slice(0,9000);
  const result={ok:true,generatedAt,mode,sections:sections.map(x=>x.id),sectionLabels:sections.map(x=>x.title),sources:[...new Set(sources)],unavailable:[...new Set(unavailable)],privacy,text};aiSystemContextCache={at:Date.now(),key:cacheKey,data:result};return result;
}
async function getAiSystemContext(payload={}){try{return await buildAiSystemContext(payload);}catch(error){writeDiagnostic('AI system context',error);return {ok:false,error:String(error?.message||error),generatedAt:new Date().toISOString(),sections:[],text:''};}}

async function runModelChat(payload) {
  const provider=String(payload?.provider||''); const model=String(payload?.model||'').trim(); const prompt=String(payload?.prompt||'').trim(); const system=String(payload?.system||'').trim();
  const cloudProvider=['openai','codex','claude','gemini'].includes(provider);
  if(!['ollama','lmstudio','custom','openai','codex','claude','gemini'].includes(provider))return {ok:false,error:'Unsupported AI provider.'};
  if(!model || model.length>300)return {ok:false,error:'Choose a valid model.'};
  if(!prompt)return {ok:false,error:'Enter a prompt.'}; if(prompt.length>24000)return {ok:false,error:'Prompt is too long (24,000 character limit).'}; if(system.length>6000)return {ok:false,error:'System instruction is too long.'};
  const aware=payload?.systemAware&&typeof payload.systemAware==='object'?payload.systemAware:{};const awareEnabled=aware.enabled===true&&String(aware.mode||'smart')!=='off';let effectiveSystem=system;let systemContext={attached:false,requested:awareEnabled,mode:String(aware.mode||'smart'),sections:[],generatedAt:null,reason:awareEnabled?'Context not attached.':'System-Aware AI disabled for this request.'};
  if(awareEnabled){if(cloudProvider&&aware.allowCloud!==true){systemContext.reason='Cloud privacy guard blocked automatic PC context. Enable cloud context explicitly to attach it.';}else{const ctx=await getAiSystemContext({mode:aware.mode,prompt,force:Boolean(aware.force)});if(ctx?.ok&&ctx.text){effectiveSystem=`${system}\n\n${ctx.text}`.trim();systemContext={attached:true,requested:true,mode:ctx.mode,sections:ctx.sections||[],sectionLabels:ctx.sectionLabels||[],generatedAt:ctx.generatedAt,privacy:ctx.privacy||null,reason:cloudProvider?'User explicitly allowed redacted system context for this cloud request.':'Redacted system context attached to local AI.'};}else systemContext.reason=ctx?.error||'System context could not be generated.';}}
  const started=Date.now();const activitySuffix=systemContext.attached?' · System-Aware':'';
  try{
    if(provider==='ollama'){const data=await localModelJson('http://127.0.0.1:11434/api/chat',{method:'POST',body:JSON.stringify({model,messages:[...(effectiveSystem?[{role:'system',content:effectiveSystem}]:[]),{role:'user',content:prompt}],stream:false})},180000);const text=String(data?.message?.content||'');if(!text)throw new Error('Ollama returned an empty response.');addActivity('Local AI request completed',`Ollama · ${model} · ${Date.now()-started} ms${activitySuffix}`);return {ok:true,text,provider,model,scope:'local',latencyMs:Date.now()-started,usage:{promptEvalCount:data?.prompt_eval_count??null,evalCount:data?.eval_count??null},systemContext};}
    if(provider==='lmstudio'||provider==='custom'){const endpoint=provider==='lmstudio'?'http://127.0.0.1:1234/v1':normalizeLocalModelEndpoint(payload?.customEndpoint||payload?.endpoint||'');const data=await localModelJson(openAiLocalUrl(endpoint,'chat/completions'),{method:'POST',body:JSON.stringify({model,messages:[...(effectiveSystem?[{role:'system',content:effectiveSystem}]:[]),{role:'user',content:prompt}],temperature:0.6,max_tokens:1600,stream:false})},180000);const text=String(data?.choices?.[0]?.message?.content||'');if(!text)throw new Error('Local OpenAI-compatible provider returned an empty response.');addActivity('Local AI request completed',`${provider==='lmstudio'?'LM Studio':'Custom local'} · ${model} · ${Date.now()-started} ms${activitySuffix}`);return {ok:true,text,provider,model,scope:'local',latencyMs:Date.now()-started,usage:data?.usage||null,systemContext};}
    if(provider==='openai'||provider==='codex'){const apiKey=loadAiCredential('openai');if(!apiKey)throw new Error('OpenAI API key is not configured.');const body={model,input:prompt,max_output_tokens:1600};if(effectiveSystem)body.instructions=effectiveSystem;const data=await cloudAiJson('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:JSON.stringify(body)},180000);const text=openAiResponseText(data);if(!text)throw new Error('OpenAI returned an empty response.');addActivity('Cloud AI request completed',`${provider==='codex'?'Codex':'OpenAI'} · ${model} · ${Date.now()-started} ms${activitySuffix}`);return {ok:true,text,provider,model,scope:'cloud',latencyMs:Date.now()-started,usage:data?.usage||null,systemContext};}
    if(provider==='claude'){const apiKey=loadAiCredential('anthropic');if(!apiKey)throw new Error('Claude API key is not configured.');const body={model,max_tokens:1600,messages:[{role:'user',content:prompt}]};if(effectiveSystem)body.system=effectiveSystem;const data=await cloudAiJson('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify(body)},180000);const text=(Array.isArray(data?.content)?data.content:[]).filter(x=>x?.type==='text').map(x=>String(x.text||'')).join('\n').trim();if(!text)throw new Error('Claude returned an empty response.');addActivity('Cloud AI request completed',`Claude · ${model} · ${Date.now()-started} ms${activitySuffix}`);return {ok:true,text,provider,model,scope:'cloud',latencyMs:Date.now()-started,usage:data?.usage||null,systemContext};}
    if(provider==='gemini'){const apiKey=loadAiCredential('gemini');if(!apiKey)throw new Error('Gemini API key is not configured.');const body={model,input:prompt};if(effectiveSystem)body.system_instruction=effectiveSystem;const data=await cloudAiJson('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':apiKey,'x-goog-api-client':`purple-dragon-powertools/${app.getVersion()}`},body:JSON.stringify(body)},180000);const text=geminiInteractionText(data);if(!text)throw new Error('Gemini returned an empty response.');addActivity('Cloud AI request completed',`Gemini · ${model} · ${Date.now()-started} ms${activitySuffix}`);return {ok:true,text,provider,model,scope:'cloud',latencyMs:Date.now()-started,usage:data?.usage||null,systemContext};}
  }catch(error){writeDiagnostic(`${provider} model chat`,error);return {ok:false,error:String(error?.message||error),provider,model,scope:cloudProvider?'cloud':'local',latencyMs:Date.now()-started,systemContext};}
}


// v1.4.0 — Windows Feature Lab ------------------------------------------------
// Feature Lab is fully lazy. Detection runs only when the page is opened. Any
// change is mapped to a fixed allowlist and confirmed in the main process.
const FEATURE_LAB_MUTATORS = Object.freeze({
  'sandbox': {kind:'optional', featureName:'Containers-DisposableClientVM', label:'Windows Sandbox', risk:'Medium', restart:true},
  'wsl': {kind:'optional', featureName:'Microsoft-Windows-Subsystem-Linux', label:'Windows Subsystem for Linux', risk:'Low', restart:true},
  'virtual-machine-platform': {kind:'optional', featureName:'VirtualMachinePlatform', label:'Virtual Machine Platform', risk:'Medium', restart:true},
  'windows-hypervisor-platform': {kind:'optional', featureName:'HypervisorPlatform', label:'Windows Hypervisor Platform', risk:'Medium', restart:true},
  'hyper-v': {kind:'optional', featureName:'Microsoft-Hyper-V-All', label:'Hyper-V', risk:'Medium', restart:true},
  'openssh-client': {kind:'capability', capability:'OpenSSH.Client~~~~0.0.1.0', label:'OpenSSH Client', risk:'Low', restart:false},
  'openssh-server': {kind:'capability', capability:'OpenSSH.Server~~~~0.0.1.0', label:'OpenSSH Server', risk:'Medium', restart:false},
  'long-paths': {kind:'registry', path:'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem', name:'LongPathsEnabled', label:'Win32 Long Paths', risk:'Low', restart:true},
  'ultimate-performance': {kind:'power', label:'Ultimate Performance', risk:'Low', restart:false}
});
const FEATURE_LAB_OPEN = Object.freeze({
  'sandbox': {type:'tool', file:'optionalfeatures.exe', args:[]},
  'wsl': {type:'tool', file:'optionalfeatures.exe', args:[]},
  'virtual-machine-platform': {type:'tool', file:'optionalfeatures.exe', args:[]},
  'windows-hypervisor-platform': {type:'tool', file:'optionalfeatures.exe', args:[]},
  'hyper-v': {type:'tool', file:'optionalfeatures.exe', args:[]},
  'openssh-client': {type:'uri', value:'ms-settings:optionalfeatures'},
  'openssh-server': {type:'uri', value:'ms-settings:optionalfeatures'},
  'developer-mode': {type:'uri', value:'ms-settings:developers'},
  'hags': {type:'uri', value:'ms-settings:display-advancedgraphics'},
  'memory-integrity': {type:'uri', value:'windowsdefender:'},
  'clipboard-history': {type:'uri', value:'ms-settings:clipboard'},
  'ultimate-performance': {type:'tool', file:'control.exe', args:['powercfg.cpl']}
});
function featureLabScanScript() {
  return `
$ErrorActionPreference='SilentlyContinue'
function Read-Dword([string]$Path,[string]$Name) {
  try { $v=(Get-ItemProperty -LiteralPath $Path -Name $Name -ErrorAction Stop).$Name; if($null -eq $v){ return $null }; return [int]$v } catch { return $null }
}
function Read-Optional([string]$Name) {
  try { $x=Get-WindowsOptionalFeature -Online -FeatureName $Name -ErrorAction Stop; return [PSCustomObject]@{ State=[string]$x.State; RestartRequired=[bool]$x.RestartRequired; Error=$null } }
  catch { return [PSCustomObject]@{ State=$null; RestartRequired=$false; Error=[string]$_.Exception.Message } }
}
function Read-Capability([string]$Name) {
  try { $x=Get-WindowsCapability -Online -Name $Name -ErrorAction Stop; return [PSCustomObject]@{ State=[string]$x.State; Error=$null } }
  catch { return [PSCustomObject]@{ State=$null; Error=[string]$_.Exception.Message } }
}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$cv=Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -ErrorAction SilentlyContinue
$cpu=Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
$cs=Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
$powerList=@(& powercfg.exe /list 2>$null)
$powerActive=@(& powercfg.exe /getactivescheme 2>$null)
$ultimateLine=$powerList | Where-Object { $_ -match '\\(Ultimate Performance\\)' } | Select-Object -First 1
$ultimateGuid=$null
if($ultimateLine -and ($ultimateLine -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')) { $ultimateGuid=$matches[1] }
$activeGuid=$null
$activeText=($powerActive -join ' ')
if($activeText -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') { $activeGuid=$matches[1] }
$sshClient=Read-Capability 'OpenSSH.Client~~~~0.0.1.0'
$sshServer=Read-Capability 'OpenSSH.Server~~~~0.0.1.0'
$wslFunctional=$false
if(Test-Path "$env:WINDIR\\System32\\wsl.exe") { try { & "$env:WINDIR\\System32\\wsl.exe" --status *> $null; $wslFunctional=($LASTEXITCODE -eq 0) } catch {} }
$pendingRename=$null
try { $pendingRename=(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager' -Name PendingFileRenameOperations -ErrorAction Stop).PendingFileRenameOperations } catch {}
$rebootPending=[bool]((Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') -or (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') -or $pendingRename)
$result=[PSCustomObject]@{
  IsAdmin=[bool]$isAdmin
  OS=[PSCustomObject]@{ ProductName=[string]$cv.ProductName; EditionID=[string]$cv.EditionID; DisplayVersion=[string]$cv.DisplayVersion; Build=[string]$cv.CurrentBuildNumber; UBR=$cv.UBR }
  CPU=[PSCustomObject]@{ VirtualizationFirmwareEnabled=$cpu.VirtualizationFirmwareEnabled; VMMonitorModeExtensions=$cpu.VMMonitorModeExtensions; SecondLevelAddressTranslationExtensions=$cpu.SecondLevelAddressTranslationExtensions; HypervisorPresent=$cs.HypervisorPresent }
  Optional=[PSCustomObject]@{
    Sandbox=(Read-Optional 'Containers-DisposableClientVM')
    WSL=(Read-Optional 'Microsoft-Windows-Subsystem-Linux')
    VMP=(Read-Optional 'VirtualMachinePlatform')
    WHP=(Read-Optional 'HypervisorPlatform')
    HyperV=(Read-Optional 'Microsoft-Hyper-V-All')
  }
  Capabilities=[PSCustomObject]@{ OpenSSHClient=$sshClient; OpenSSHServer=$sshServer }
  Settings=[PSCustomObject]@{
    DeveloperMode=(Read-Dword 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock' 'AllowDevelopmentWithoutDevLicense')
    HAGS=(Read-Dword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode')
    MemoryIntegrity=(Read-Dword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity' 'Enabled')
    LongPaths=(Read-Dword 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem' 'LongPathsEnabled')
    ClipboardHistory=(Read-Dword 'HKCU:\\Software\\Microsoft\\Clipboard' 'EnableClipboardHistory')
  }
  Fallback=[PSCustomObject]@{
    SandboxExe=(Test-Path "$env:WINDIR\\System32\\WindowsSandbox.exe")
    WslExe=(Test-Path "$env:WINDIR\\System32\\wsl.exe")
    WslFunctional=[bool]$wslFunctional
    SshExe=(Test-Path "$env:WINDIR\\System32\\OpenSSH\\ssh.exe")
    SshdService=[bool](Get-Service sshd -ErrorAction SilentlyContinue)
  }
  Power=[PSCustomObject]@{ UltimateExists=[bool]$ultimateGuid; UltimateGuid=$ultimateGuid; UltimateActive=[bool]($ultimateGuid -and $activeGuid -and ($ultimateGuid -ieq $activeGuid)); ActiveGuid=$activeGuid }
  RebootPending=[bool]$rebootPending
}
$result | ConvertTo-Json -Depth 8 -Compress
`;
}
function featureLabSingleQuote(value) { return `'${String(value ?? '').replace(/'/g,"''")}'`; }
async function runFeatureLabElevated(body, timeout=150000) {
  if(process.platform!=='win32')return {ok:false,error:'Windows-only action'};
  const dir=path.join(app.getPath('userData'),'feature-lab');
  try{fs.mkdirSync(dir,{recursive:true});}catch{}
  const token=`${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const scriptPath=path.join(dir,`elevated-${token}.ps1`), resultPath=path.join(dir,`result-${token}.json`), launcherPath=path.join(dir,`launch-${token}.ps1`);
  const payload=`param([string]$OutputPath)\n$ErrorActionPreference='Stop'\ntry {\n  $data = & {\n${body}\n  }\n  $wrapper=[PSCustomObject]@{ok=$true;data=$data}\n} catch {\n  $wrapper=[PSCustomObject]@{ok=$false;error=[string]$_.Exception.Message}\n}\n$wrapper | ConvertTo-Json -Depth 12 -Compress | Set-Content -LiteralPath $OutputPath -Encoding UTF8\n`;
  const exe=powerShellExe();
  const launcher=`$ErrorActionPreference='Stop'\n$exe=${featureLabSingleQuote(exe)}\n$script=${featureLabSingleQuote(scriptPath)}\n$out=${featureLabSingleQuote(resultPath)}\n$argLine='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $script + '" -OutputPath "' + $out + '"'\ntry { $p=Start-Process -FilePath $exe -ArgumentList $argLine -Verb RunAs -Wait -PassThru; exit $p.ExitCode } catch { Write-Error $_.Exception.Message; exit 1223 }\n`;
  try{fs.writeFileSync(scriptPath,payload,'utf8');fs.writeFileSync(launcherPath,launcher,'utf8');}
  catch(error){return {ok:false,error:String(error?.message||error)};}
  const launch=await runExec(exe,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcherPath],timeout);
  let parsed=null;
  try{if(fs.existsSync(resultPath)){const text=fs.readFileSync(resultPath,'utf8').replace(/^\uFEFF/,'').trim();if(text)parsed=JSON.parse(text);}}catch(error){writeDiagnostic('Feature Lab elevated result',error);}
  for(const file of [scriptPath,resultPath,launcherPath]){try{if(fs.existsSync(file))fs.unlinkSync(file);}catch{}}
  if(parsed?.ok)return {ok:true,data:parsed.data};
  if(parsed?.error)return {ok:false,error:String(parsed.error)};
  if(!launch.ok){const msg=launch.stderr||launch.stdout||'Administrator operation was canceled or failed.';return {ok:false,canceled:/cancel|1223|operation was canceled/i.test(msg),error:msg};}
  return {ok:false,error:'Administrator operation returned no result.'};
}
async function runFeatureLabElevatedScan() {
  const scan=featureLabScanScript();
  const body=scan.replace(/^\s*`|`\s*$/g,'').replace(/\$result \| ConvertTo-Json -Depth 8 -Compress\s*$/m,'$result');
  return runFeatureLabElevated(body,180000);
}
function optionalState(item) {
  const x=String(item?.State||'').toLowerCase();
  if(x.startsWith('enabled'))return 'enabled';
  if(x.startsWith('disabled'))return 'disabled';
  return 'unknown';
}
function capabilityState(item, fallback=false) {
  const x=String(item?.State||'').toLowerCase();
  if(x==='installed')return 'enabled';
  if(x==='notpresent'||x==='staged')return 'disabled';
  return fallback?'enabled':'unknown';
}
function featureLabBuild(raw={}, elevated=false) {
  const osInfo=raw.OS||{}; const cpu=raw.CPU||{}; const opt=raw.Optional||{}; const cap=raw.Capabilities||{}; const settings=raw.Settings||{}; const fallback=raw.Fallback||{}; const power=raw.Power||{};
  const edition=String(osInfo.EditionID||''); const proEdition=/professional|enterprise|education/i.test(edition); const virt=cpu.VirtualizationFirmwareEnabled===true; const slat=cpu.SecondLevelAddressTranslationExtensions!==false;
  const stateLabel=state=>({enabled:'Enabled',disabled:'Disabled',unknown:'Needs review','system-default':'System default'}[state]||'Needs review');
  const optional=(rawItem,fallbackEnabled=false)=>{const state=optionalState(rawItem);return state==='unknown'&&fallbackEnabled?'enabled':state;};
  const features=[];
  const push=(f)=>{f.stateLabel=stateLabel(f.state);f.compatibilityLabel=f.compatibility==='supported'?'Supported':f.compatibility==='unsupported'?'Not supported':'Needs review';features.push(f);};
  const optionalFeature=(id,title,category,categoryLabel,description,rawItem,extra={})=>{
    const state=optional(rawItem,Boolean(extra.fallbackEnabled)); const readable=Boolean(rawItem?.State); let compatibility=readable?'supported':(extra.unsupported?'unsupported':'unknown');
    if(extra.unsupported)compatibility='unsupported';
    const canChange=compatibility!=='unsupported';
    push({id,title,icon:extra.icon||'WF',category,categoryLabel,description,state,compatibility,compatibilityDetail:extra.compatibilityDetail||(readable?'Windows reports this optional component is available.':rawItem?.Error?'Optional-feature state needs an administrator scan.':'Feature availability was not confirmed.'),risk:extra.risk||'Medium',reversible:true,restartRequired:true,requiresAdmin:true,source:readable?'Windows Optional Features':extra.fallbackEnabled?'Installed executable fallback':'Feature inventory',requirements:extra.requirements||[],primaryAction:canChange?{type:state==='enabled'?'disable':'enable',label:state==='enabled'?'Disable':'Enable'}:null,openAvailable:true});
  };
  optionalFeature('sandbox','Windows Sandbox','virtualization','Virtualization & Dev','Disposable isolated Windows desktop for safely testing untrusted apps and files.',opt.Sandbox,{icon:'SB',fallbackEnabled:fallback.SandboxExe,unsupported:!proEdition,compatibilityDetail:!proEdition?'This Windows edition does not include Windows Sandbox.':(!virt?'CPU virtualization is disabled or could not be confirmed.':'Requires virtualization and a supported Windows edition.'),requirements:['Windows Pro / Enterprise / Education','CPU virtualization enabled','Restart usually required'],risk:'Medium'});
  optionalFeature('wsl','Windows Subsystem for Linux','virtualization','Virtualization & Dev','Run Linux distributions and Linux command-line tools directly on Windows.',opt.WSL,{icon:'WS',fallbackEnabled:fallback.WslFunctional,requirements:['Windows optional component','WSL 2 also uses Virtual Machine Platform'],risk:'Low'});
  optionalFeature('virtual-machine-platform','Virtual Machine Platform','virtualization','Virtualization & Dev','Windows virtualization foundation used by WSL 2 and other lightweight virtual-machine features.',opt.VMP,{icon:'VM',compatibilityDetail:virt?'CPU virtualization appears enabled.':'Enable CPU virtualization in firmware for VM workloads.',requirements:['CPU virtualization recommended','Restart required'],risk:'Medium'});
  optionalFeature('windows-hypervisor-platform','Windows Hypervisor Platform','virtualization','Virtualization & Dev','Windows hypervisor API layer used by compatible virtualization applications.',opt.WHP,{icon:'HP',compatibilityDetail:virt?'CPU virtualization appears enabled.':'CPU virtualization could not be confirmed as enabled.',requirements:['CPU virtualization','Compatible Windows build'],risk:'Medium'});
  optionalFeature('hyper-v','Hyper-V','virtualization','Virtualization & Dev','Microsoft hypervisor platform with virtual machines, virtual switches, and management components.',opt.HyperV,{icon:'HV',unsupported:!proEdition,compatibilityDetail:!proEdition?'Full Hyper-V is not included with this Windows edition.':(!virt?'CPU virtualization is disabled or unconfirmed.':'Windows edition supports Hyper-V.'),requirements:['Windows Pro / Enterprise / Education','Virtualization + SLAT','Restart required'],risk:'Medium'});
  const sshClientState=capabilityState(cap.OpenSSHClient,Boolean(fallback.SshExe));
  push({id:'openssh-client',title:'OpenSSH Client',icon:'SC',category:'developer',categoryLabel:'Developer & Remote',description:'Built-in SSH client for secure terminal and file-transfer connections.',state:sshClientState,compatibility:'supported',compatibilityDetail:cap.OpenSSHClient?.State?'Windows capability detected.':'Executable fallback used when capability inventory needs elevation.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:true,source:'Windows Capability',requirements:['Internet may be required when installing'],primaryAction:{type:sshClientState==='enabled'?'disable':'enable',label:sshClientState==='enabled'?'Remove':'Install'},openAvailable:true});
  const sshServerState=capabilityState(cap.OpenSSHServer,Boolean(fallback.SshdService));
  push({id:'openssh-server',title:'OpenSSH Server',icon:'SS',category:'developer',categoryLabel:'Developer & Remote',description:'Optional inbound SSH server capability. Install only when remote shell access is intentionally required.',state:sshServerState,compatibility:'supported',compatibilityDetail:'Inbound SSH service should remain disabled unless you need remote access.',risk:'Medium',reversible:true,restartRequired:false,requiresAdmin:true,source:'Windows Capability',requirements:['Administrator approval','Firewall/service configuration may be required'],primaryAction:{type:sshServerState==='enabled'?'disable':'enable',label:sshServerState==='enabled'?'Remove':'Install'},openAvailable:true});
  const devState=Number(settings.DeveloperMode)===1?'enabled':'disabled';
  push({id:'developer-mode',title:'Developer Mode',icon:'DV',category:'developer',categoryLabel:'Developer & Remote',description:'Unlocks Windows development features such as loose-file app deployment and additional developer tooling.',state:devState,compatibility:'supported',compatibilityDetail:'Managed through the official Windows Developer settings page.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:false,source:'Windows setting',requirements:['Use only when development features are needed'],primaryAction:null,openAvailable:true});
  const hags=Number(settings.HAGS); const hagsState=hags===2?'enabled':hags===1?'disabled':'system-default';
  push({id:'hags',title:'Hardware-Accelerated GPU Scheduling',icon:'GS',category:'performance',categoryLabel:'Performance',description:'Lets the GPU handle more of its own scheduling when supported by Windows and the graphics driver.',state:hagsState,compatibility:'unknown',compatibilityDetail:'Driver support determines whether Windows exposes this setting. Feature Lab opens the official Graphics settings page instead of forcing a registry value.',risk:'Low',reversible:true,restartRequired:true,requiresAdmin:false,source:'GraphicsDrivers policy state',requirements:['Compatible GPU + WDDM driver','Restart after changing'],primaryAction:null,openAvailable:true});
  push({id:'ultimate-performance',title:'Ultimate Performance Plan',icon:'UP',category:'performance',categoryLabel:'Performance',description:'Windows power scheme designed to reduce power-management latency on systems where maximum responsiveness matters.',state:power.UltimateActive?'enabled':(power.UltimateExists?'disabled':'disabled'),compatibility:'supported',compatibilityDetail:power.UltimateExists?'Ultimate Performance is already available on this PC.':'PowerTools can create the Microsoft Ultimate Performance scheme from its built-in template.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:true,source:'powercfg',requirements:['Higher power use and heat are possible','Best suited to desktops / plugged-in systems'],primaryAction:power.UltimateActive?null:{type:'activate',label:power.UltimateExists?'Activate':'Create & Activate'},openAvailable:true});
  const mi=Number(settings.MemoryIntegrity); const miState=mi===1?'enabled':mi===0?'disabled':'system-default';
  push({id:'memory-integrity',title:'Core Isolation / Memory Integrity',icon:'MI',category:'security',categoryLabel:'Security',description:'Virtualization-based security that hardens kernel memory against malicious or incompatible drivers.',state:miState,compatibility:'supported',compatibilityDetail:virt?'Firmware virtualization appears enabled.':'Windows Security will show whether this device can enable Memory Integrity.',risk:'Medium',reversible:true,restartRequired:true,requiresAdmin:false,source:'Device Guard state',requirements:['Compatible drivers','Virtualization-based security'],primaryAction:null,openAvailable:true});
  const longState=Number(settings.LongPaths)===1?'enabled':'disabled';
  push({id:'long-paths',title:'Win32 Long Paths',icon:'LP',category:'windows',categoryLabel:'Windows Core',description:'Allows compatible Win32 applications to use file-system paths beyond the legacy MAX_PATH limit.',state:longState,compatibility:'supported',compatibilityDetail:'This is a fixed Windows policy value; applications must also opt in to long-path awareness.',risk:'Low',reversible:true,restartRequired:true,requiresAdmin:true,source:'Windows FileSystem policy',requirements:['Long-path-aware applications','Sign-out/restart may be needed'],primaryAction:{type:longState==='enabled'?'disable':'enable',label:longState==='enabled'?'Disable':'Enable'},openAvailable:false});
  const clipState=Number(settings.ClipboardHistory)===1?'enabled':'disabled';
  push({id:'clipboard-history',title:'Clipboard History',icon:'CH',category:'windows',categoryLabel:'Windows Core',description:'Keeps multiple clipboard items available through Win + V, with optional cross-device sync controlled separately by Windows.',state:clipState,compatibility:'supported',compatibilityDetail:'Managed through the official Windows Clipboard settings page.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:false,source:'Current-user Windows setting',requirements:['Consider privacy on shared PCs'],primaryAction:null,openAvailable:true});
  const enabled=features.filter(f=>f.state==='enabled').length; const supported=features.filter(f=>f.compatibility==='supported').length; const unsupported=features.filter(f=>f.compatibility==='unsupported').length;
  const rebootPending=raw.RebootPending===true;
  const rawBuild=Number(osInfo.Build)||0;let productName=String(osInfo.ProductName||'Windows');if(rawBuild>=22000&&/Windows 10/i.test(productName))productName=productName.replace(/Windows 10/i,'Windows 11');
  return {generatedAt:new Date().toISOString(),elevated:Boolean(elevated||raw.IsAdmin),windows:{productName,editionId:edition||null,displayVersion:osInfo.DisplayVersion||null,build:osInfo.Build||null,ubr:osInfo.UBR??null},platform:{virtualizationFirmwareEnabled:cpu.VirtualizationFirmwareEnabled??null,slat:cpu.SecondLevelAddressTranslationExtensions??null,hypervisorPresent:cpu.HypervisorPresent??null},summary:{featureCount:features.length,supported,unsupported,enabled,needsReview:features.filter(f=>f.compatibility==='unknown'||f.state==='unknown').length,rebootPending},features};
}
async function getFeatureLab(force=false,elevated=false) {
  if(process.platform!=='win32')return featureLabBuild({},false);
  const now=Date.now();
  if(!force&&featureLabCache.data&&now-featureLabCache.at<30000)return featureLabCache.data;
  if(featureLabCache.pending)return featureLabCache.pending;
  featureLabCache.pending=(async()=>{
    let raw=null;let wasElevated=false;
    if(elevated){const out=await runFeatureLabElevatedScan();if(!out.ok)return {error:out.error||'Administrator scan failed.',canceled:Boolean(out.canceled),...featureLabBuild({},false)};raw=out.data;wasElevated=true;}
    else raw=await runPowerShell(featureLabScanScript(),18000);
    if(!raw||typeof raw!=='object')raw={};
    const data=featureLabBuild(raw,wasElevated||raw.IsAdmin===true);featureLabCache={at:Date.now(),data,pending:null,elevated:data.elevated};return data;
  })();
  try{return await featureLabCache.pending;}finally{if(featureLabCache.pending)featureLabCache.pending=null;}
}
async function applyFeatureLabAction(featureId, action, options={}) {
  const id=String(featureId||'');const mode=String(action||'');const mut=FEATURE_LAB_MUTATORS[id];
  if(!mut)return {ok:false,error:'This Feature Lab item is read-only.'};
  if(!['enable','disable','activate'].includes(mode))return {ok:false,error:'Unsupported Feature Lab action.'};
  if(mut.kind==='power'&&mode!=='activate')return {ok:false,error:'Ultimate Performance only supports guarded activation here.'};
  if(mut.kind!=='power'&&mode==='activate')return {ok:false,error:'Unsupported action for this feature.'};
  const verb=mode==='enable'?'Enable':mode==='disable'?'Disable':'Activate';
  let previousFeatureState=null;let previousPowerGuid=null;
  if(options.journal!==false){
    const cached=featureLabCache.data?.features?.find(f=>f.id===id);previousFeatureState=cached?.state||null;
    if(mut.kind==='power'){try{previousPowerGuid=(await getPerformanceProfiles()).activeGuid||null;}catch{}}
  }
  if(!options.skipConfirm){const confirmation=await dialog.showMessageBox(mainWindow,{type:mut.risk==='Medium'?'warning':'question',title:`${verb} ${mut.label}?`,message:`${verb} ${mut.label}?`,detail:`Feature Lab will run only the fixed, allowlisted Windows change for this item.${mut.restart?' A Windows restart may be required.':''}${mut.risk==='Medium'?' Review virtualization, security, or remote-access implications before continuing.':''}`,buttons:['Cancel',verb],defaultId:0,cancelId:0,noLink:true});
  if(confirmation.response!==1)return {ok:false,canceled:true};}
  let body='';
  if(mut.kind==='optional'){
    const cmd=mode==='enable'?'Enable-WindowsOptionalFeature':'Disable-WindowsOptionalFeature'; const all=mode==='enable'?' -All':'';
    body=`$x=${cmd} -Online -FeatureName ${featureLabSingleQuote(mut.featureName)}${all} -NoRestart -ErrorAction Stop\n[PSCustomObject]@{State=[string]$x.State;RestartNeeded=[bool]($x.RestartNeeded -or $x.RestartRequired)}`;
  } else if(mut.kind==='capability'){
    const cmd=mode==='enable'?'Add-WindowsCapability':'Remove-WindowsCapability';
    body=`$x=${cmd} -Online -Name ${featureLabSingleQuote(mut.capability)} -ErrorAction Stop\n[PSCustomObject]@{State=[string]$x.State;RestartNeeded=[bool]$x.RestartNeeded}`;
  } else if(mut.kind==='registry'){
    const value=mode==='enable'?1:0;
    body=`New-ItemProperty -LiteralPath ${featureLabSingleQuote(mut.path)} -Name ${featureLabSingleQuote(mut.name)} -PropertyType DWord -Value ${value} -Force -ErrorAction Stop | Out-Null\n[PSCustomObject]@{State=${featureLabSingleQuote(mode==='enable'?'Enabled':'Disabled')};RestartNeeded=$true}`;
  } else if(mut.kind==='power'){
    body=`$list=@(& powercfg.exe /list 2>$null)\n$line=$list | Where-Object { $_ -match '\\(Ultimate Performance\\)' } | Select-Object -First 1\n$guid=$null\nif($line -and ($line -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')){$guid=$matches[1]}\nif(-not $guid){$dup=@(& powercfg.exe /duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>&1);$txt=($dup -join ' ');if($LASTEXITCODE -ne 0){throw $txt};if($txt -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'){$guid=$matches[1]}}\nif(-not $guid){throw 'Windows did not return an Ultimate Performance scheme GUID.'}\n& powercfg.exe /setactive $guid | Out-Null\nif($LASTEXITCODE -ne 0){throw 'Windows rejected the power-scheme activation.'}\n[PSCustomObject]@{State='Enabled';RestartNeeded=$false;Guid=$guid}`;
  }
  const out=await runFeatureLabElevated(body,180000);
  if(!out.ok){writeDiagnostic(`Feature Lab ${id} ${mode}`,out.error||'failed');return {ok:false,canceled:Boolean(out.canceled),error:out.error||'Windows rejected the change.'};}
  featureLabCache={at:0,data:null,pending:null,elevated:false};
  const restart=Boolean(out.data?.RestartNeeded??out.data?.restartNeeded??mut.restart);
  addActivity('Windows Feature Lab change',`${verb} ${mut.label}${restart?' · restart may be required':''}`);
  if(options.journal!==false){
    let undo=null;
    if(mut.kind==='power'&&previousPowerGuid&&JOURNAL_GUID_RE.test(previousPowerGuid))undo={type:'performance-guid',guid:previousPowerGuid};
    else if((mode==='enable'&&previousFeatureState==='disabled')||(mode==='disable'&&previousFeatureState==='enabled'))undo={type:'featurelab',featureId:id,action:previousFeatureState==='enabled'?'enable':'disable'};
    addChangeJournalEntry({category:'Windows Feature Lab',title:`${mut.label} changed`,summary:`${verb} ${mut.label}${restart?' · restart may be required':''}`,source:'Feature Lab',risk:mut.risk,restartRequired:restart,undo});
  }
  return {ok:true,id,action:mode,label:mut.label,restartRequired:restart,result:out.data||null};
}
async function openFeatureLabItem(featureId) {
  const target=FEATURE_LAB_OPEN[String(featureId||'')];if(!target)return {ok:false,error:'No Windows settings shortcut is available for this item.'};
  try{if(target.type==='uri')await shell.openExternal(target.value);else execFile(target.file,target.args||[],{windowsHide:false},()=>{});addActivity('Feature Lab settings opened',String(featureId));return {ok:true};}
  catch(error){return {ok:false,error:String(error?.message||error)};}
}

ipcMain.handle('system:getLiveMetrics', getLiveMetrics);
ipcMain.handle('sensor:enable', enableHardwareSensorBridge);
ipcMain.handle('sensor:status', getHardwareSensorStatus);
ipcMain.handle('system:getStaticInfo', (_, force) => getStaticInfo(Boolean(force)));
ipcMain.handle('security:getInfo', (_, force) => getSecurityInfo(Boolean(force)));
ipcMain.handle('models:getCenter', (_, force, customEndpoint) => getModelCenter(Boolean(force), customEndpoint));
ipcMain.handle('models:chat', (_, payload) => runModelChat(payload));
ipcMain.handle('models:route', (_, payload) => routeDragonModel(payload));
ipcMain.handle('models:systemContext', (_, payload) => getAiSystemContext(payload || {}));
ipcMain.handle('models:credentials', () => aiCredentialStatus());
ipcMain.handle('models:saveCredential', (_, provider, key) => saveAiCredential(provider, key));
ipcMain.handle('models:removeCredential', (_, provider) => removeAiCredential(provider));
ipcMain.handle('featurelab:get', (_, force) => getFeatureLab(Boolean(force), false));
ipcMain.handle('featurelab:getAdmin', () => getFeatureLab(true, true));
ipcMain.handle('featurelab:apply', (_, featureId, action) => applyFeatureLabAction(featureId, action));
ipcMain.handle('featurelab:open', (_, featureId) => openFeatureLabItem(featureId));
ipcMain.handle('security:copySummary', async () => {
  const [security, info] = await Promise.all([getSecurityInfo(false), getStaticInfo(false)]);
  clipboard.writeText(securitySummaryText(security, info));
  addActivity('Security summary copied', 'Local security posture copied to clipboard');
  return { ok: true };
});
ipcMain.handle('startup:list', (_, force) => getStartupItems(Boolean(force)));
ipcMain.handle('performance:getProfiles', getPerformanceProfiles);
ipcMain.handle('performance:setProfile', async (_, id) => {
  const before=await getPerformanceProfiles();
  const result = await setAutomationPerformanceProfile(id);
  if (!result.ok) return result;
  addActivity('Performance profile changed', result.detail || String(id));
  const after=await getPerformanceProfiles();
  if(before.activeGuid&&before.activeGuid!==after.activeGuid)addChangeJournalEntry({category:'Performance',title:'Power profile changed',summary:`${before.activeName||'Previous'} → ${after.activeName||result.detail||id}`,source:'Performance Center',undo:{type:'performance-guid',guid:before.activeGuid}});
  return { ok: true, profile: after };
});


ipcMain.handle('network:getOverview', (_, force) => getNetworkOverview(Boolean(force)));
ipcMain.handle('network:ping', (_, target) => networkPing(target));
ipcMain.handle('network:dnsLookup', (_, target) => networkDnsLookup(target));
ipcMain.handle('network:connectivityTest', networkConnectivityTest);
ipcMain.handle('network:flushDns', networkFlushDns);
ipcMain.handle('network:renewDhcp', networkRenewDhcp);
ipcMain.handle('network:copyIpConfig', networkCopyIpConfig);
ipcMain.handle('vpn:getCenter', (_, force) => getVpnCenter(Boolean(force)));
ipcMain.handle('vpn:providerAction', (_, provider, action) => vpnProviderAction(provider, action));
ipcMain.handle('network:ipGeoStatus', () => geoIpifyCredentialStatus());
ipcMain.handle('network:saveIpGeoKey', (_, key) => saveGeoIpifyCredential(key));
ipcMain.handle('network:removeIpGeoKey', () => removeGeoIpifyCredential());
ipcMain.handle('network:ipGeoLookup', (_, ip) => lookupIpGeolocation(ip));
ipcMain.handle('network:openGeoIpify', () => shell.openExternal('https://geo.ipify.org/').then(()=>({ok:true})).catch(error=>({ok:false,error:String(error?.message||error)})));
ipcMain.handle('network:diagnosticsHistory', () => networkLastDiagnostics);

ipcMain.handle('apps:processes', (_, force) => getProcessSnapshot(Boolean(force)));
ipcMain.handle('apps:endProcess', (_, pid) => endProcess(pid));
ipcMain.handle('apps:restartProcess', (_, pid) => restartProcess(pid));
ipcMain.handle('apps:revealProcess', (_, pid) => revealProcessFile(pid));
ipcMain.handle('apps:copyProcessPath', (_, pid) => copyProcessPath(pid));
ipcMain.handle('apps:installed', (_, force) => getInstalledApps(Boolean(force)));
ipcMain.handle('apps:revealInstalled', (_, index) => revealInstalledApp(index));
ipcMain.handle('apps:openInstalledSettings', openInstalledAppsSettings);

ipcMain.handle('storage:getInventory', (_, force) => getStorageInventory(Boolean(force)));
ipcMain.handle('storage:analyzeUserFolders', analyzeUserStorage);
ipcMain.handle('storage:cancelAnalysis', cancelUserStorageAnalysis);
ipcMain.handle('storage:cleanupPreview', (_, force) => previewStorageCleanup(Boolean(force)));
ipcMain.handle('storage:cleanupRun', (_, categoryIds) => runStorageCleanup(categoryIds));
ipcMain.handle('storage:openFolder', (_, kind) => openStorageFolder(kind));
ipcMain.handle('storage:openDrive', (_, letter) => openStorageDrive(letter));
ipcMain.handle('storage:revealLargeFile', (_, index) => revealAnalyzedLargeFile(index));

ipcMain.handle('automation:getState', async () => initializeAutomationEngine());
ipcMain.handle('automation:saveRule', (_, rule) => saveAutomationRule(rule));
ipcMain.handle('automation:setRuleEnabled', (_, id, enabled) => setAutomationRuleEnabled(id, enabled));
ipcMain.handle('automation:deleteRule', (_, id) => deleteAutomationRule(id));
ipcMain.handle('automation:runRuleNow', (_, id) => runAutomationRuleNow(id));
ipcMain.handle('automation:setMasterEnabled', (_, enabled) => setAutomationMasterEnabled(enabled));
ipcMain.handle('automation:clearHistory', () => clearAutomationHistory());

ipcMain.handle('reliability:rendererReady', () => {
  if (!rendererReadyAt) rendererReadyAt = Date.now();
  loadRecoveryAttempts = 0;
  return getReliabilityStatus();
});
ipcMain.handle('reliability:rendererError', (_, payload) => {
  const message = String(payload?.message || payload || 'Renderer error').slice(0, 3000);
  lastRendererError = message;
  writeDiagnostic('renderer error', message);
  return { ok:true };
});
ipcMain.handle('privacy:dnsInspect', (_, domain) => privacyDnsRecords(domain));
ipcMain.handle('privacy:inspectFile', () => privacyInspectFile());
ipcMain.handle('privacy:openProfile', (_, platform, username) => privacyOpenProfile(platform, username));
ipcMain.handle('privacy:openResource', (_, resource) => privacyOpenResource(resource));
ipcMain.handle('privacy:appTrustInventory', (_, force) => privacyGetAppTrustInventory(Boolean(force)));
ipcMain.handle('privacy:appTrustSelect', () => privacySelectAppTrustFile());
ipcMain.handle('privacy:appTrustInstalled', (_, index) => privacyInspectInstalledApp(index));
ipcMain.handle('privacy:appProtectionStatus', () => privacyGetAppProtectionStatus());
ipcMain.handle('privacy:openHashReputation', (_, hash) => privacyOpenHashReputation(hash));
ipcMain.handle('updates:getState', () => updateReleaseCenter.getState());
ipcMain.handle('updates:check', (_, force) => updateReleaseCenter.checkForUpdates({force:Boolean(force)}));
ipcMain.handle('updates:saveSettings', (_, payload) => updateReleaseCenter.saveSettings(payload||{}));
ipcMain.handle('updates:stageVerify', (_, packageKind) => updateReleaseCenter.stageLatestPackage(packageKind));
ipcMain.handle('updates:clearStaging', () => updateReleaseCenter.clearStaging());
ipcMain.handle('updates:openRelease', (_, url) => updateReleaseCenter.openRelease(url));
ipcMain.handle('github:status', () => githubCredentialStatus());
ipcMain.handle('github:saveToken', (_, token) => saveGitHubCredential(token));
ipcMain.handle('github:removeToken', () => removeGitHubCredential());
ipcMain.handle('github:getCenter', (_, force) => getGitHubCenter(Boolean(force)));
ipcMain.handle('github:getRepoDetails', (_, repo) => getGitHubRepoDetails(repo));
ipcMain.handle('github:selectSource', (_, kind) => selectGitHubSource(kind));
ipcMain.handle('github:clearSource', () => clearGitHubSource());
ipcMain.handle('github:commitSource', (_, payload) => createGitHubSourceCommit(payload||{}));
ipcMain.handle('github:selectAssets', () => selectGitHubReleaseAssets());
ipcMain.handle('github:clearAssets', () => clearGitHubReleaseAssets());
ipcMain.handle('github:generateReleaseNotes', (_, payload) => generateGitHubReleaseNotes(payload||{}));
ipcMain.handle('github:publishRelease', (_, payload) => publishGitHubRelease(payload||{}));
ipcMain.handle('github:openLink', (_, url) => openGitHubLink(url));
ipcMain.handle('github:openTokenSettings', () => openGitHubTokenSettings());
ipcMain.handle('journal:getState', () => getChangeJournalState());
ipcMain.handle('journal:undo', (_, id) => undoChangeJournalEntry(id));
ipcMain.handle('journal:clear', () => clearChangeJournal());

ipcMain.handle('reliability:getStatus', () => getReliabilityStatus());
ipcMain.handle('stable:getStatus', () => getStableReleaseStatus());
ipcMain.handle('stable:copySummary', () => { const status=getStableReleaseStatus(); clipboard.writeText(stableReleaseSummaryText(status)); addActivity('Stable readiness summary copied', status.ready ? 'Stable preflight is ready' : 'Stable preflight has warnings'); return {ok:true,status}; });
ipcMain.handle('reliability:copySummary', () => {
  const status = getReliabilityStatus();
  clipboard.writeText(reliabilitySummaryText(status));
  addActivity('Reliability summary copied', 'Local startup and diagnostics status copied to clipboard');
  return { ok:true, status };
});
ipcMain.handle('reliability:openLogs', async () => {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, {recursive:true});
    const result = await shell.openPath(dir);
    return {ok:!result, error:result || null};
  } catch (error) { return {ok:false,error:String(error?.message || error)}; }
});
ipcMain.handle('reliability:clearDiagnostics', async () => {
  const choice = await dialog.showMessageBox(mainWindow, { type:'warning', buttons:['Cancel','Clear Diagnostics'], defaultId:0, cancelId:0, title:'Clear PowerTools Diagnostics?', message:'Clear the local diagnostics log?', detail:'This only clears PowerTools diagnostic text. It does not change Windows settings or system files.' });
  if (choice.response !== 1) return {ok:false,canceled:true};
  try { const file=diagnosticsPath(); if(file) fs.writeFileSync(file,'','utf8'); addActivity('Diagnostics log cleared','Local PowerTools diagnostics were cleared'); return {ok:true,status:getReliabilityStatus()}; }
  catch(error){ return {ok:false,error:String(error?.message||error)}; }
});
ipcMain.handle('reliability:resetStaticCache', async () => {
  const choice = await dialog.showMessageBox(mainWindow, { type:'question', buttons:['Cancel','Reset Cache'], defaultId:0, cancelId:0, title:'Reset Hardware Cache?', message:'Reset the local hardware identity cache?', detail:'PowerTools will rebuild CPU/GPU/BIOS/motherboard identity later. This does not change Windows.' });
  if (choice.response !== 1) return {ok:false,canceled:true};
  try { const file=staticCachePath(); if(file && fs.existsSync(file)) fs.unlinkSync(file); cachedStaticInfo=null; cachedStaticAt=0; addActivity('Hardware cache reset','Static system identity will be rebuilt lazily'); return {ok:true,status:getReliabilityStatus()}; }
  catch(error){ return {ok:false,error:String(error?.message||error)}; }
});

ipcMain.handle('app:getInfo', () => ({
  name: 'Purple Dragon PowerTools',
  version: app.getVersion(),
  edition: 'Stable Release',
  creator: 'Purple Dragon Foundation Ltd',
  company: 'Purple Dragon Foundation Ltd',
  tagline: 'Software Development · Innovation · Solutions',
  arch: process.arch,
  platform: process.platform,
  electronVersion: process.versions.electron || null,
  nodeVersion: process.versions.node || null
}));

ipcMain.handle('activity:list', () => activityLog);
ipcMain.handle('activity:add', (_, title, detail) => {
  addActivity(String(title || 'Activity'), String(detail || ''));
  return activityLog;
});

ipcMain.handle('report:export', async () => {
  const [live, info, security, profiles, startupItems, storageInventory] = await Promise.all([getLiveMetrics(), getStaticInfo(true), getSecurityInfo(true), getPerformanceProfiles(), getStartupItems(true), getStorageInventory(true)]);
  const report = {
    generatedAt: new Date().toISOString(),
    app: { name: 'Purple Dragon PowerTools', version: app.getVersion() },
    system: { ...info, defender: security?.defender || null, firewall: security?.firewall || null },
    securityCenter: security,
    metrics: live,
    performanceProfiles: profiles,
    startupItems,
    processAppCenter: {
      processSnapshot: processCenterLastSnapshot ? { generatedAt: processCenterLastSnapshot.generatedAt, summary: processCenterLastSnapshot.summary } : null,
      installedApps: installedAppsCache.data?.length ? { count: installedAppsCache.data.length } : null,
      privacy: 'Per-process names/paths and installed-application names are omitted from exported support reports.'
    },
    storageHub: {
      inventory: storageInventory,
      analysisLoaded: Boolean(storageAnalysisCache.data),
      cleanupPreviewLoaded: Boolean(cleanupPreviewCache.data),
      privacy: 'User-folder analysis and cleanup file details are omitted from exported support reports.'
    },
    networkPowerTools: { overview: networkCenterCache.data || null, vpnCenter: vpnCenterCache.data || null, diagnostics: networkLastDiagnostics.slice(0,20), ipGeolocation: { provider:'Geo IPify', configured:geoIpifyCredentialStatus().configured, privacy:'Lookup results and public IP are intentionally excluded from exported reports.' } },
    privacyIntelligence: { mode:'Self-audit only', exportedPersonalData:false, note:'Entered identifiers, profile shortcuts, DNS query values, file names/paths, and metadata findings are intentionally excluded from reports.' },
    windowsFeatureLab: featureLabCache.data || null,
    modelCenter: modelCenterCache.data ? { generatedAt:modelCenterCache.data.generatedAt, localOnly:modelCenterCache.data.localOnly, providers:modelCenterCache.data.providers.map(p=>({id:p.id,name:p.name,scope:p.scope,configured:Boolean(p.configured),online:Boolean(p.online),modelsCount:p.modelsCount||0,latencyMs:p.latencyMs??null})), models:modelCenterCache.data.models.map(m=>({provider:m.provider,providerName:m.providerName,scope:m.scope,id:m.id,name:m.name,size:m.size||null,modifiedAt:m.modifiedAt||null})) } : null,
    automationEngine: automationInitialized ? publicAutomationState() : { masterEnabled: true, running: false, ruleCount: 0, enabledCount: 0, rules: [], history: [] },
    reliability: getReliabilityStatus(),
    stableRelease: getStableReleaseStatus(),
    activity: { count: activityLog.length, privacy: 'Activity titles/details are omitted from exported support reports.' },
    exportPrivacy: {
      sanitized: true,
      omitted: ['host/user identity','IP/MAC addresses','file paths','credentials','serial numbers','per-process/app names','activity details','user-folder analysis']
    }
  };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export PowerTools Report',
    defaultPath: `Purple-Dragon-System-Report-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Report', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  const sanitizedReport = sanitizePublicReportValue(report);
  fs.writeFileSync(result.filePath, JSON.stringify(sanitizedReport, null, 2), 'utf8');
  addActivity('System report exported', path.basename(result.filePath));
  return { ok: true, path: result.filePath };
});

ipcMain.handle('system:open', async (_, target) => {
  const uriMap = {
    storage: 'ms-settings:storagesense',
    apps: 'ms-settings:appsfeatures',
    installedapps: 'ms-settings:appsfeatures',
    startup: 'ms-settings:startupapps',
    defender: 'windowsdefender:',
    updates: 'ms-settings:windowsupdate',
    network: 'ms-settings:network-status',
    about: 'ms-settings:about',
    advancednetwork: 'ms-settings:network-advancedsettings',
    firewallsettings: 'ms-settings:windowsdefender-firewall',
    virusprotection: 'windowsdefender:',
    accountprotection: 'windowsdefender:',
    deviceSecurity: 'windowsdefender:'
  };
  const toolMap = {
    taskmanager: { file: 'taskmgr.exe', args: [] },
    resmon: { file: 'resmon.exe', args: [] },
    poweroptions: { file: 'control.exe', args: ['powercfg.cpl'] },
    devicemanager: { file: 'mmc.exe', args: ['devmgmt.msc'] },
    services: { file: 'mmc.exe', args: ['services.msc'] },
    eventviewer: { file: 'mmc.exe', args: ['eventvwr.msc'] },
    diskmanagement: { file: 'mmc.exe', args: ['diskmgmt.msc'] },
    computermanagement: { file: 'mmc.exe', args: ['compmgmt.msc'] },
    registry: { file: 'regedit.exe', args: [] },
    systeminfo: { file: 'msinfo32.exe', args: [] },
    controlpanel: { file: 'control.exe', args: [] },
    systemproperties: { file: 'SystemPropertiesAdvanced.exe', args: [] },
    networkconnections: { file: 'control.exe', args: ['ncpa.cpl'] },
    firewall: { file: 'control.exe', args: ['firewall.cpl'] },
    uac: { file: 'UserAccountControlSettings.exe', args: [] },
    bitlocker: { file: 'control.exe', args: ['/name', 'Microsoft.BitLockerDriveEncryption'] }
  };
  try {
    if (process.platform !== 'win32') return { ok: false };
    if (toolMap[target]) {
      execFile(toolMap[target].file, toolMap[target].args, { windowsHide: false }, () => {});
    } else {
      const value = uriMap[target];
      if (!value) return { ok: false };
      await shell.openExternal(value);
    }
    addActivity('Windows tool opened', target);
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle('window:minimize' , () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow?.close());

process.on('uncaughtException', error => writeDiagnostic('uncaughtException', error));
process.on('unhandledRejection', error => writeDiagnostic('unhandledRejection', error));

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    addActivity('Existing instance focused', 'A second PowerTools launch was redirected to this window');
  });
  app.whenReady().then(() => {
    beginSessionState();
    loadStaticCacheFromDisk();
    createWindow();
    setTimeout(() => initializeAutomationEngine().catch(error => writeDiagnostic('automation init', error)), 4200);
    setTimeout(() => {
      if (!updateReleaseCenter.shouldCheckOnStartup()) return;
      updateReleaseCenter.checkForUpdates({force:false}).catch(error => writeDiagnostic('startup update check', error));
    }, 8000);
  }).catch(error => writeDiagnostic('app.whenReady', error));
}
app.on('before-quit', () => { finishSessionState(); if (automationEngineTimer) { clearInterval(automationEngineTimer); automationEngineTimer = null; } });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
