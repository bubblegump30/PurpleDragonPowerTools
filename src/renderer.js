(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const nativeApi = window.powerTools || null;
  const demoMode = !nativeApi;
  let live = {
    cpu: 0, perCore: [], cpuClockMHz: null, cpuTemperatureC: null, cpuTemperatureSource: null, cpuTemperatureStale: false, cpuTemperatureBridgeRunning: false, cpuTemperatureBridgeElevationAttempted: false,
    memory: 0, storage: { percent: 0, total: 0, used: 0, free: 0 }, health: 0,
    totalMemory: 0, usedMemory: 0, uptime: 0, gpu: null,
    diskReadBps: 0, diskWriteBps: 0, diskBusyPercent: 0, networkRxBps: 0, networkTxBps: 0
  };
  let staticInfo = null;
  let securityInfo = null;
  let securityLoaded = false;
  let securityLoading = false;
  let sampleTimer = null;
  let intervalMs = 1000;
  let refreshInFlight = false;
  let powerProfiles = null;
  let startupItems = [];
  let storageInventory = null;
  let storageAnalysis = null;
  let cleanupPreview = null;
  let storageLoaded = false;
  let storageLoading = false;
  let storageAnalysisRunning = false;
  let processSnapshot = null;
  let installedAppsSnapshot = null;
  let appCenterLoaded = false;
  let appCenterLoading = false;
  let appCenterRefreshTimer = null;
  let networkOverview = null;
  let networkLoaded = false;
  let networkLoading = false;
  let vpnCenterState = null;
  let vpnCenterLoading = false;
  let ipGeoStatus = null;
  let ipGeoResult = null;
  let ipGeoBusy = false;
  let privacyDnsResult = null;
  let privacyMetadataResult = null;
  let privacyTrustResult = null;
  let privacyAppInventory = null;
  let privacyProtectionStatus = null;
  let privacyTrustBusy = false;
  const networkRxHistory = Array(60).fill(0);
  const networkTxHistory = Array(60).fill(0);
  let networkPeakRx = 0;
  let networkPeakTx = 0;

  let automationState = null;
  let automationLoaded = false;
  let automationLoading = false;
  let automationEditingRuleId = null;
  let reliabilityState = null;
  let reliabilityLoaded = false;
  let reliabilityLoading = false;
  let stableReleaseState = null;
  let stableReleaseLoaded = false;
  let stableReleaseLoading = false;
  let modelCenterState = null;
  let modelCenterLoaded = false;
  let modelCenterLoading = false;
  let modelChatBusy = false;
  let aiCommandBusy = false;
  let aiCommandLast = null;
  let aiCommandHistory = [];
  let dragonCouncilBusy = false;
  let dragonCouncilResults = [];
  let dragonRouteState = null;
  let dragonRouteBusy = false;
  let aiContextState = null;
  let aiContextBusy = false;
  let featureLabState = null;
  let featureLabLoaded = false;
  let featureLabLoading = false;
  let featureLabBusy = false;
  let updateReleaseState = null;
  let updateReleaseLoading = false;
  let githubCenterState = null;
  let githubCenterLoaded = false;
  let githubCenterLoading = false;
  let githubRepoDetails = null;
  let githubRepoLoading = false;
  let githubSourceFiles = [];
  let githubReleaseAssetFiles = [];
  let githubBusy = false;
  let changeJournalState = null;
  let changeJournalLoading = false;
  let appInfo = null;

  const cpuHistory = Array(60).fill(0);
  const gpuHistory = Array(60).fill(0);
  const ramHistory = Array(60).fill(0);
  const healthHistory = Array(60).fill(0);
  const cpuTempHistory = Array(60).fill(0);
  const gpuTempHistory = Array(60).fill(0);

  let previewAutomationRules = [];
  let previewAutomationHistory = [];
  let previewAutomationMaster = true;

  const fallbackApi = {
    async getAppInfo(){ return {name:'Purple Dragon PowerTools',version:'2.1.0',edition:'Stable Release',creator:'Purple Dragon Foundation Ltd',company:'Purple Dragon Foundation Ltd',tagline:'Software Development · Innovation · Solutions',arch:'x64',platform:'browser',electronVersion:null,nodeVersion:null}; },
    async getLiveMetrics() {
      const t = Date.now() / 1000;
      const cpu = Math.round(36 + Math.sin(t * .8) * 13 + Math.sin(t * .19) * 8);
      const gpuLoad = Math.round(42 + Math.sin(t * .63) * 20);
      const memory = Math.round(58 + Math.sin(t * .21) * 4);
      const perCore = Array.from({ length: 16 }, (_, i) => Math.max(1, Math.min(100, Math.round(cpu + Math.sin(t * (0.25 + i * .03) + i) * 16))));
      const storage = { percent: 67, total: 1024 ** 4, used: 0.67 * 1024 ** 4, free: 0.33 * 1024 ** 4 };
      return {
        cpu, perCore, cpuClockMHz: 4200, cpuTemperatureC: 58 + Math.round(Math.sin(t * .15) * 4), cpuTemperatureSource: 'Preview / CPU Package', cpuTemperatureStale: false,
        memory, storage, health: Math.round(94 - cpu * .06), totalMemory: 32 * 1024 ** 3,
        usedMemory: 18.6 * 1024 ** 3, uptime: 45642,
        gpu: { provider:'Preview telemetry', name:'Preview GPU', load:gpuLoad, temperatureC:64, memoryUsedMB:4250, memoryTotalMB:12288, coreClockMHz:1875, memoryClockMHz:7500, fanPercent:41, powerDrawW:126, powerLimitW:170 },
        diskReadBps: 34 * 1024 ** 2, diskWriteBps: 8 * 1024 ** 2, diskBusyPercent: 23,
        networkRxBps: 7.4 * 1024 ** 2, networkTxBps: 1.2 * 1024 ** 2,
        timestamp: Date.now()
      };
    },
    async enableCpuSensor() { return {ok:false,error:'Desktop-only CPU sensor'}; },
    async getStaticInfo() {
      return {
        hostname:'Browser Preview', platform:'preview', release:'Demo', arch:'x64', cpuModel:'Preview Processor',
        cpuCores:16, cpuPhysicalCores:8, cpuMaxClockMHz:4400, totalMemory:32*1024**3,
        gpu:{Name:'Preview GPU',DriverVersion:'Preview'}, gpus:[{Name:'Preview GPU'}], osCaption:'Browser Preview',
        osVersion:'Preview', osBuildNumber:'00000.0', osDisplayVersion:'Preview', osEdition:'Preview',
        system:{Manufacturer:'Purple Dragon',Model:'Preview PC',SystemType:'x64-based PC',HypervisorPresent:false},
        motherboard:{Manufacturer:'Purple Dragon',Product:'Preview Board'}, bios:{Manufacturer:'Purple Dragon',SMBIOSBIOSVersion:'Preview BIOS'},
        memoryModules:[{ConfiguredClockSpeed:3200,Capacity:16*1024**3},{ConfiguredClockSpeed:3200,Capacity:16*1024**3}],
        bootMode:'UEFI', secureBoot:true, tpm:{TpmPresent:true,TpmReady:true,TpmEnabled:true,ManufacturerIdTxt:'PREVIEW'}, tpmInfo:{SpecVersion:'2.0'},
        defender:null, firewall:null
      };
    },
    async getSecurityInfo() { return {
      source:'Browser preview', queryDurationMs:42,
      defender:{AntivirusEnabled:true,AntispywareEnabled:true,RealTimeProtectionEnabled:true,BehaviorMonitorEnabled:true,IoavProtectionEnabled:true,NISEnabled:true,AntivirusSignatureAge:0,AntivirusSignatureLastUpdated:new Date().toISOString(),QuickScanAge:1,FullScanAge:5,IsTamperProtected:true,AMRunningMode:'Normal',DefenderSignaturesOutOfDate:false,RebootRequired:false},
      firewall:[{Name:'Domain',Enabled:true},{Name:'Private',Enabled:true},{Name:'Public',Enabled:true}],
      antivirusProducts:[{displayName:'Microsoft Defender Antivirus',productState:397568,timestamp:new Date().toISOString()}],
      uac:{enabled:true,consentPromptBehaviorAdmin:5,promptOnSecureDesktop:true},
      smartScreen:{explorer:'Warn',appHostEnabled:true},
      bitLocker:{mountPoint:'C:',volumeStatus:'FullyEncrypted',protectionStatus:'On',encryptionPercentage:100,encryptionMethod:'XtsAes128',lockStatus:'Unlocked'},
      update:{latestHotfix:{HotFixID:'KB0000000',Description:'Security Update',InstalledOn:new Date(Date.now()-3*86400000).toISOString()},rebootPending:false},
      recentEvents:[{id:1001,timeCreated:new Date(Date.now()-3600000).toISOString(),level:'Information'},{id:5007,timeCreated:new Date(Date.now()-86400000).toISOString(),level:'Information'}]
    }; },
    async copySecuritySummary(){ return {ok:false,error:'Desktop-only action'}; },

    async getFeatureLab(){return {generatedAt:new Date().toISOString(),elevated:false,windows:{productName:'Windows 11 Preview',editionId:'Professional',displayVersion:'24H2',build:'26100',ubr:1000},platform:{virtualizationFirmwareEnabled:true,slat:true,hypervisorPresent:false},summary:{featureCount:11,supported:10,unsupported:0,enabled:6,needsReview:1,rebootPending:false},features:[
      {id:'sandbox',title:'Windows Sandbox',icon:'SB',category:'virtualization',categoryLabel:'Virtualization & Dev',description:'Disposable isolated Windows desktop for safely testing untrusted apps and files.',state:'disabled',stateLabel:'Disabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Preview machine meets the Windows edition requirement.',risk:'Medium',reversible:true,restartRequired:true,requiresAdmin:true,source:'Windows Optional Features',requirements:['Supported Windows edition','CPU virtualization enabled'],primaryAction:{type:'enable',label:'Enable'},openAvailable:true},
      {id:'wsl',title:'Windows Subsystem for Linux',icon:'WS',category:'virtualization',categoryLabel:'Virtualization & Dev',description:'Run Linux distributions and command-line tools directly on Windows.',state:'enabled',stateLabel:'Enabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Preview feature enabled.',risk:'Low',reversible:true,restartRequired:true,requiresAdmin:true,source:'Windows Optional Features',requirements:['WSL 2 may use Virtual Machine Platform'],primaryAction:{type:'disable',label:'Disable'},openAvailable:true},
      {id:'virtual-machine-platform',title:'Virtual Machine Platform',icon:'VM',category:'virtualization',categoryLabel:'Virtualization & Dev',description:'Virtualization foundation used by WSL 2 and other lightweight VM features.',state:'enabled',stateLabel:'Enabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Firmware virtualization enabled.',risk:'Medium',reversible:true,restartRequired:true,requiresAdmin:true,source:'Windows Optional Features',requirements:['CPU virtualization'],primaryAction:{type:'disable',label:'Disable'},openAvailable:true},
      {id:'hyper-v',title:'Hyper-V',icon:'HV',category:'virtualization',categoryLabel:'Virtualization & Dev',description:'Microsoft hypervisor platform with virtual machines and virtual switches.',state:'disabled',stateLabel:'Disabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Preview Pro edition supports Hyper-V.',risk:'Medium',reversible:true,restartRequired:true,requiresAdmin:true,source:'Windows Optional Features',requirements:['Pro / Enterprise / Education'],primaryAction:{type:'enable',label:'Enable'},openAvailable:true},
      {id:'openssh-client',title:'OpenSSH Client',icon:'SC',category:'developer',categoryLabel:'Developer & Remote',description:'Built-in SSH client for secure terminal and file-transfer connections.',state:'enabled',stateLabel:'Enabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Windows capability installed.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:true,source:'Windows Capability',requirements:['Optional Windows capability'],primaryAction:{type:'disable',label:'Remove'},openAvailable:true},
      {id:'developer-mode',title:'Developer Mode',icon:'DV',category:'developer',categoryLabel:'Developer & Remote',description:'Unlocks Windows development features and additional developer tooling.',state:'disabled',stateLabel:'Disabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Managed by Windows Settings.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:false,source:'Windows setting',requirements:['Enable only when needed'],primaryAction:null,openAvailable:true},
      {id:'hags',title:'Hardware-Accelerated GPU Scheduling',icon:'GS',category:'performance',categoryLabel:'Performance',description:'Lets the GPU handle more of its own scheduling on supported drivers.',state:'system-default',stateLabel:'System default',compatibility:'unknown',compatibilityLabel:'Needs review',compatibilityDetail:'Windows Settings determines driver support.',risk:'Low',reversible:true,restartRequired:true,requiresAdmin:false,source:'GraphicsDrivers policy state',requirements:['Compatible GPU + driver'],primaryAction:null,openAvailable:true},
      {id:'ultimate-performance',title:'Ultimate Performance Plan',icon:'UP',category:'performance',categoryLabel:'Performance',description:'Power scheme that reduces power-management latency.',state:'disabled',stateLabel:'Disabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Preview can create the plan.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:true,source:'powercfg',requirements:['Higher power use is possible'],primaryAction:{type:'activate',label:'Create & Activate'},openAvailable:true},
      {id:'memory-integrity',title:'Core Isolation / Memory Integrity',icon:'MI',category:'security',categoryLabel:'Security',description:'Virtualization-based security for kernel memory.',state:'enabled',stateLabel:'Enabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Preview virtualization enabled.',risk:'Medium',reversible:true,restartRequired:true,requiresAdmin:false,source:'Device Guard state',requirements:['Compatible drivers'],primaryAction:null,openAvailable:true},
      {id:'long-paths',title:'Win32 Long Paths',icon:'LP',category:'windows',categoryLabel:'Windows Core',description:'Allows compatible Win32 apps to exceed the legacy MAX_PATH limit.',state:'enabled',stateLabel:'Enabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Fixed Windows FileSystem policy.',risk:'Low',reversible:true,restartRequired:true,requiresAdmin:true,source:'Windows FileSystem policy',requirements:['Apps must be long-path aware'],primaryAction:{type:'disable',label:'Disable'},openAvailable:false},
      {id:'clipboard-history',title:'Clipboard History',icon:'CH',category:'windows',categoryLabel:'Windows Core',description:'Keeps multiple clipboard items available through Win + V.',state:'enabled',stateLabel:'Enabled',compatibility:'supported',compatibilityLabel:'Supported',compatibilityDetail:'Managed by Windows Settings.',risk:'Low',reversible:true,restartRequired:false,requiresAdmin:false,source:'Current-user Windows setting',requirements:['Consider privacy on shared PCs'],primaryAction:null,openAvailable:true}
    ]};},
    async getFeatureLabAdmin(){const x=await this.getFeatureLab();x.elevated=true;return x;},
    async applyFeatureLabAction(){return {ok:false,error:'Desktop-only guarded Windows change'};},
    async openFeatureLabItem(){return {ok:false,error:'Desktop-only Windows setting'};},

    async getModelCenter(force=false, customEndpoint='') {
      const providers=[
        {id:'openai',name:'OpenAI / ChatGPT',scope:'cloud',configured:false,online:false,modelsCount:0},
        {id:'codex',name:'Codex',scope:'cloud',configured:false,online:false,modelsCount:0},
        {id:'claude',name:'Claude',scope:'cloud',configured:false,online:false,modelsCount:0},
        {id:'gemini',name:'Gemini',scope:'cloud',configured:false,online:false,modelsCount:0},
        {id:'ollama',name:'Ollama',scope:'local',endpoint:'http://127.0.0.1:11434',configured:true,online:true,modelsCount:2,latencyMs:8},
        {id:'lmstudio',name:'LM Studio',scope:'local',endpoint:'http://127.0.0.1:1234/v1',configured:true,online:false,modelsCount:0,error:'Preview provider offline'}
      ];
      const models=[
        {key:'ollama::qwen2.5:7b',provider:'ollama',providerName:'Ollama',scope:'local',id:'qwen2.5:7b',name:'qwen2.5:7b',size:4.7*1024**3,modifiedAt:new Date(Date.now()-86400000).toISOString(),endpoint:'http://127.0.0.1:11434'},
        {key:'ollama::llama3.2:3b',provider:'ollama',providerName:'Ollama',scope:'local',id:'llama3.2:3b',name:'llama3.2:3b',size:2.1*1024**3,modifiedAt:new Date(Date.now()-2*86400000).toISOString(),endpoint:'http://127.0.0.1:11434'}
      ];
      return {generatedAt:new Date().toISOString(),localOnly:true,credentials:{encryptionAvailable:true,storage:'Preview secure storage',openai:false,anthropic:false,gemini:false},providers,models,summary:{providerCount:providers.length,onlineProviders:1,configuredCloudProviders:0,modelCount:models.length,localModels:2,cloudModels:0},customEndpoint:customEndpoint||''};
    },
    async getModelCredentials(){return {encryptionAvailable:true,storage:'Preview secure storage',openai:false,anthropic:false,gemini:false};},
    async saveModelCredential(){return {ok:false,error:'Desktop-only secure credential storage'};},
    async removeModelCredential(){return {ok:false,error:'Desktop-only secure credential storage'};},
    async modelChat(payload){const cloud=['openai','codex','claude','gemini'].includes(payload?.provider);const requested=payload?.systemAware?.enabled===true&&payload?.systemAware?.mode!=='off';const attached=requested&&(!cloud||payload?.systemAware?.allowCloud===true);return {ok:true,text:`Browser preview response from ${payload?.model||'local model'}${attached?' with System-Aware context':''}: ${String(payload?.prompt||'').slice(0,180)}`,provider:payload?.provider||'preview',model:payload?.model||'preview',scope:cloud?'cloud':'local',latencyMs:120,systemContext:{attached,requested,mode:payload?.systemAware?.mode||'smart',sections:attached?['system','performance','hardware']:[],generatedAt:attached?new Date().toISOString():null,reason:attached?'Preview redacted context attached.':cloud&&requested?'Cloud privacy guard blocked context.':'System-Aware AI disabled.'}};},
    async routeModel(payload){const center=await this.getModelCenter(false,payload?.customEndpoint||'');const prompt=String(payload?.prompt||'').toLowerCase();const profile=String(payload?.profile||'automatic');let models=center.models.slice();if(profile==='local-only'||payload?.allowCloud===false)models=models.filter(m=>m.scope!=='cloud');if(!models.length)return {ok:false,error:'No models available in preview.'};const coding=/code|script|javascript|python|powershell|debug/.test(prompt);const picked=(coding?models.find(m=>/qwen|coder|code/i.test(m.id||m.name)):null)||models[0];return {ok:true,profile,profileLabel:{automatic:'Automatic','best-quality':'Best Quality',fastest:'Fastest',cheapest:'Cheapest','local-only':'Local Only','privacy-first':'Privacy First'}[profile]||'Automatic',task:{id:coding?'coding':'general',label:coding?'Coding / Development':'General Assistant',confidence:coding?'medium':'normal'},selected:{...picked},confidence:coding?88:74,reason:[coding?'Coding terms detected.':'General task detected.','Local preview model available.','Runs through a local provider.'],alternatives:models.filter(m=>m.key!==picked.key).slice(0,3).map(m=>({model:{...m},score:50,reasons:['Available local alternative']})),considered:models.length,routedAt:new Date().toISOString()};},
    async getAISystemContext(payload={}){const mode=payload?.mode==='full'?'full':'smart';const generatedAt=new Date().toISOString();const sections=['system','performance','hardware'];if(mode==='full')sections.push('security','storage','processes','network','reliability','featureLab');return {ok:true,generatedAt,mode,sections,sectionLabels:sections.map(x=>x.toUpperCase()),sources:['preview live metrics','preview hardware identity'],unavailable:[],privacy:{level:'redacted-safe',omitted:['hostname','username','IP/MAC','paths','API keys']},text:`PURPLE DRAGON SYSTEM CONTEXT — BROWSER PREVIEW\nGenerated: ${generatedAt}\nMode: ${mode}\n\n[SYSTEM]\nOS: Windows 11 Preview build 26100 (x64)\nSecure Boot enabled; TPM ready\n\n[LIVE PERFORMANCE]\nCPU load ${live.cpu||36}%; Memory ${live.memory||58}%; CPU temperature ${live.cpuTemperatureC||58} C\nGPU ${live.gpu?.name||'Preview GPU'}; load ${live.gpu?.load||42}%; temperature ${live.gpu?.temperatureC||64} C\n\n[HARDWARE]\nCPU: Preview Processor; RAM 32 GB; GPU Preview GPU\n\nPrivacy: hostname, username, IP/MAC addresses, paths and API keys omitted.`};},
    async getUpdateReleaseState(){return {ok:true,repository:'bubblegump30/PurpleDragonPowerTools',currentVersion:'2.2.0',channel:'stable',checkPolicy:'daily',updateAvailable:false,latestVersion:'2.1.0',latestReleaseUrl:'https://github.com/bubblegump30/PurpleDragonPowerTools/releases/tag/v2.1.0',latestPublishedAt:new Date(Date.now()-86400000).toISOString(),lastCheckAt:new Date().toISOString(),build:{packaged:false,type:'Browser preview build',platform:'win32',arch:'x64'},trust:{manifestAvailable:false,checksumAvailable:true,signatureAvailable:false},settings:{channel:'stable',checkPolicy:'daily',autoDownload:false,autoInstall:false,verifySha256:true,requireReleaseSignature:true,keepRollbackPackage:true,showNotifications:true},releases:[{tag:'v2.1.0',version:'2.1.0',name:'Purple Dragon PowerTools v2.1.0',publishedAt:new Date(Date.now()-86400000).toISOString(),url:'https://github.com/bubblegump30/PurpleDragonPowerTools/releases/tag/v2.1.0',prerelease:false,trust:{manifestAvailable:false,checksumAvailable:true,signatureAvailable:false}}]};},
    async checkForAppUpdates(){return this.getUpdateReleaseState();},
    async saveUpdateReleaseSettings(payload={}){const st=await this.getUpdateReleaseState();st.settings={...st.settings,...payload};st.channel=st.settings.channel;st.checkPolicy=st.settings.checkPolicy;return {ok:true,settings:st.settings,state:st};},
    async openUpdateRelease(){return {ok:false,error:'Desktop-only external link'};},
    async getGitHubStatus(){return {configured:false,encryptionAvailable:true,storage:'Preview secure storage',provider:'GitHub'};},
    async saveGitHubToken(){return {ok:false,error:'Desktop-only secure GitHub connection'};},
    async removeGitHubToken(){return {ok:false,error:'Desktop-only secure GitHub connection'};},
    async getGitHubCenter(){return {configured:false,credential:{configured:false,encryptionAvailable:true,storage:'Preview secure storage'},profile:null,repositories:[],generatedAt:new Date().toISOString()};},
    async getGitHubRepoDetails(){return {ok:false,error:'Desktop-only GitHub API'};},
    async selectGitHubSource(){return {ok:false,error:'Desktop-only file picker',files:[]};},
    async clearGitHubSource(){return {ok:true,files:[]};},
    async commitGitHubSource(){return {ok:false,error:'Desktop-only GitHub write'};},
    async selectGitHubReleaseAssets(){return {ok:false,error:'Desktop-only file picker',files:[]};},
    async clearGitHubReleaseAssets(){return {ok:true,files:[]};},
    async generateGitHubReleaseNotes(){return {ok:false,error:'Desktop-only GitHub API'};},
    async publishGitHubRelease(){return {ok:false,error:'Desktop-only GitHub write'};},
    async openGitHubLink(){return {ok:false,error:'Desktop-only action'};},
    async openGitHubTokenSettings(){return {ok:false,error:'Desktop-only action'};},
    async getChangeJournal(){return {generatedAt:new Date().toISOString(),count:3,reversibleCount:2,undoneCount:0,entries:[{id:'preview-1',at:new Date().toISOString(),category:'Automation',title:'Automation rule created',summary:'CPU Guard',source:'Automation Engine',reversible:true,undone:false,restartRequired:false,risk:'Low'},{id:'preview-2',at:new Date(Date.now()-120000).toISOString(),category:'Performance',title:'Power profile changed',summary:'Balanced → Performance',source:'Performance Center',reversible:true,undone:false,restartRequired:false,risk:'Low'},{id:'preview-3',at:new Date(Date.now()-300000).toISOString(),category:'GitHub',title:'GitHub release published',summary:'example/repo · v2.1.0 · 2 assets',source:'GitHub Release Center',reversible:false,undone:false,restartRequired:false,risk:'Medium'}]};},
    async undoChangeJournalEntry(){return {ok:false,error:'Desktop-only undo in browser preview'};},
    async clearChangeJournal(){return {ok:false,error:'Desktop-only action'};},
    async getReliabilityStatus(){return {version:'2.1.0',sessionId:'browser-preview',boot:{uiReadyMs:42,sessionUptimeMs:Date.now(),fastBoot:true},renderer:{state:'Preview',crashCount:0,unresponsiveCount:0,lastError:null},diagnostics:{exists:false,sizeBytes:0,path:'Browser preview'},cache:{staticPresent:true,inMemory:true,ageMs:0},providers:{nvidiaCached:true,windowsPerfCached:true,sensorBridgeRunning:false,automationInitialized:true},checks:[{id:'renderer',label:'Renderer process',ok:true,detail:'Browser preview renderer is active.'},{id:'userdata',label:'Local data directory',ok:true,detail:'Preview localStorage is available.'},{id:'sensor',label:'CPU sensor runtime',ok:false,optional:true,detail:'Desktop-only sensor bridge.'}]};},
    async getStableReleaseStatus(){return {version:'2.1.0',channel:'Stable',ready:true,passed:8,total:9,warnings:0,informational:1,previousSession:{available:true,cleanShutdown:true,version:'2.0.3'},checks:[{id:'version',label:'Stable version',ok:true,detail:'Runtime version 2.1.0'},{id:'renderer',label:'Renderer bridge',ok:true,detail:'Preview renderer connected.'},{id:'runtime',label:'Core runtime files',ok:true,detail:'Preview runtime is complete.'},{id:'single',label:'Single-instance guard',ok:true,detail:'Desktop-only guard represented in preview.'},{id:'sensor',label:'CPU sensor runtime',ok:false,optional:true,detail:'Desktop-only optional sensor bridge.'}]};}, async copyStableReleaseSummary(){return {ok:false,error:'Desktop-only action'};},
    async rendererReady(){return this.getReliabilityStatus();}, async reportRendererError(){return {ok:true};}, async copyReliabilitySummary(){return {ok:false,error:'Desktop-only action'};}, async openReliabilityLogs(){return {ok:false,error:'Desktop-only action'};}, async clearReliabilityDiagnostics(){return {ok:false,error:'Desktop-only action'};}, async resetHardwareCache(){return {ok:false,error:'Desktop-only action'};},
    async getAutomationState(){return {masterEnabled:previewAutomationMaster,running:previewAutomationMaster&&previewAutomationRules.some(r=>r.enabled),tickMs:3000,ruleCount:previewAutomationRules.length,enabledCount:previewAutomationRules.filter(r=>r.enabled).length,lastTriggeredAt:previewAutomationHistory[0]?.at||null,nextScheduledAt:null,rules:previewAutomationRules,history:previewAutomationHistory};},
    async saveAutomationRule(rule){const now=new Date().toISOString();const copy=JSON.parse(JSON.stringify(rule||{}));if(copy.id){const i=previewAutomationRules.findIndex(r=>r.id===copy.id);if(i>=0)previewAutomationRules[i]={...previewAutomationRules[i],...copy,updatedAt:now};}else{copy.id=`preview-${Date.now()}`;copy.enabled=true;copy.createdAt=now;copy.updatedAt=now;copy.runCount=0;copy.lastTriggeredAt=null;previewAutomationRules.unshift(copy);}return {ok:true,state:await this.getAutomationState(),rule:copy};},
    async setAutomationRuleEnabled(id,enabled){const r=previewAutomationRules.find(x=>x.id===id);if(r)r.enabled=!!enabled;return {ok:!!r,state:await this.getAutomationState()};},
    async deleteAutomationRule(id){previewAutomationRules=previewAutomationRules.filter(r=>r.id!==id);return {ok:true,state:await this.getAutomationState()};},
    async runAutomationRuleNow(id){const r=previewAutomationRules.find(x=>x.id===id);if(!r)return {ok:false,error:'Rule not found'};const item={id:`preview-run-${Date.now()}`,at:new Date().toISOString(),ruleId:r.id,ruleName:r.name,trigger:'Preview manual run',action:'Preview action',triggerDetail:'Manual Run Now',origin:'Manual run',ok:true,detail:'Browser preview does not execute Windows actions.'};previewAutomationHistory.unshift(item);r.runCount=(r.runCount||0)+1;r.lastTriggeredAt=item.at;return {ok:true,item,state:await this.getAutomationState()};},
    async setAutomationMasterEnabled(enabled){previewAutomationMaster=!!enabled;return {ok:true,state:await this.getAutomationState()};},
    async clearAutomationHistory(){previewAutomationHistory=[];return {ok:true,state:await this.getAutomationState()};},
    async getPerformanceProfiles() {
      return { activeGuid:'381b4222-f694-41f0-9685-ff5bb260df2e', activeName:'Balanced', profiles:[
        {id:'eco',name:'Eco',guid:'a1841308-3541-4fab-bc81-f71556f20b4a',available:true},
        {id:'balanced',name:'Balanced',guid:'381b4222-f694-41f0-9685-ff5bb260df2e',available:true},
        {id:'performance',name:'Performance',guid:'8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c',available:true}
      ]};
    },
    async setPerformanceProfile(id) {
      const p = await this.getPerformanceProfiles();
      const selected = p.profiles.find(x => x.id === id);
      if (!selected) return {ok:false,error:'Profile unavailable'};
      p.activeGuid = selected.guid; p.activeName = selected.name;
      return {ok:true,profile:p};
    },
    async listStartupItems() { return []; },
    async getProcesses() { return {generatedAt:new Date().toISOString(),summary:{count:6,totalMemoryBytes:3.6*1024**3,totalIoReadBps:12*1024**2,totalIoWriteBps:2*1024**2,protectedCount:2,queryMs:45},processes:[
      {pid:4100,name:'chrome.exe',cpuPercent:7.4,memoryBytes:1.2*1024**3,ioReadBps:6*1024**2,ioWriteBps:1.2*1024**2,path:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',threads:48,handles:1100,protected:false,canTerminate:true,canRestart:true,canReveal:true},
      {pid:5220,name:'Discord.exe',cpuPercent:2.1,memoryBytes:620*1024**2,ioReadBps:1.1*1024**2,ioWriteBps:240*1024,path:'C:\\Users\\Preview\\AppData\\Local\\Discord\\Discord.exe',threads:28,handles:540,protected:false,canTerminate:true,canRestart:true,canReveal:true},
      {pid:1337,name:'explorer.exe',cpuPercent:0.8,memoryBytes:260*1024**2,ioReadBps:420*1024,ioWriteBps:120*1024,path:'C:\\Windows\\explorer.exe',threads:60,handles:2300,protected:false,canTerminate:true,canRestart:true,canReveal:true},
      {pid:900,name:'dwm.exe',cpuPercent:0.6,memoryBytes:190*1024**2,ioReadBps:0,ioWriteBps:0,path:'C:\\Windows\\System32\\dwm.exe',threads:18,handles:690,protected:true,canTerminate:false,canRestart:false,canReveal:true}
    ]}; },
    async endProcess(){return {ok:false,error:'Desktop-only process control'};}, async restartProcess(){return {ok:false,error:'Desktop-only process control'};}, async revealProcess(){return {ok:false};}, async copyProcessPath(){return {ok:false};},
    async getInstalledApps(){return {generatedAt:new Date().toISOString(),summary:{count:4,estimatedBytes:8.2*1024**3},apps:[{id:0,name:'Google Chrome',publisher:'Google LLC',version:'Preview',installDate:'2026-08-01',estimatedSizeBytes:650*1024**2,scope:'Machine x64'},{id:1,name:'Discord',publisher:'Discord Inc.',version:'Preview',installDate:'2026-08-10',estimatedSizeBytes:580*1024**2,scope:'Current user'},{id:2,name:'Steam',publisher:'Valve Corporation',version:'Preview',installDate:'2026-07-22',estimatedSizeBytes:1.1*1024**3,scope:'Machine x86'}]};},
    async revealInstalledApp(){return {ok:false};}, async openInstalledAppsSettings(){return {ok:false};},
    async getNetworkOverview(){return {generatedAt:new Date().toISOString(),source:'Browser preview',summary:{adapterCount:2,activeCount:1,activeAdapter:{name:'Ethernet',description:'Preview 2.5GbE Adapter',status:'Up',linkSpeed:'2.5 Gbps',macAddress:'00-00-00-00-00-00',ipv4:['192.168.1.42'],ipv6:['fe80::preview'],gateways:['192.168.1.1'],dnsServers:['1.1.1.1','8.8.8.8'],profileName:'Preview Network',networkCategory:'Private',connectivity:'Internet',dhcpEnabled:'Enabled'}},adapters:[{name:'Ethernet',description:'Preview 2.5GbE Adapter',status:'Up',linkSpeed:'2.5 Gbps',macAddress:'00-00-00-00-00-00',ipv4:['192.168.1.42'],ipv6:['fe80::preview'],gateways:['192.168.1.1'],dnsServers:['1.1.1.1','8.8.8.8'],profileName:'Preview Network',networkCategory:'Private',connectivity:'Internet',dhcpEnabled:'Enabled'},{name:'Wi-Fi',description:'Preview Wi-Fi Adapter',status:'Disconnected',linkSpeed:'0 bps',macAddress:'11-11-11-11-11-11',ipv4:[],ipv6:[],gateways:[],dnsServers:[],profileName:null,networkCategory:null}]};},
    async networkPing(target){return {ok:true,target,averageMs:18,packetLossPercent:0,replies:4,raw:'Preview ping: 4 replies, average 18 ms'};},
    async networkDnsLookup(target){return {ok:true,target,addresses:['93.184.216.34'],raw:'Preview DNS lookup'};},
    async networkConnectivityTest(){return {ok:true,dnsOk:true,dnsAddress:'13.107.246.38',tcp443:true,gateway:'192.168.1.1',gatewayPingMs:1,testedAt:new Date().toISOString()};},
    async networkFlushDns(){return {ok:false,error:'Desktop-only action'};}, async networkRenewDhcp(){return {ok:false,error:'Desktop-only action'};}, async networkCopyIpConfig(){return {ok:false,error:'Desktop-only action'};},
    async getVpnCenter(){return {generatedAt:new Date().toISOString(),platform:'browser',summary:{providerCount:2,installedCount:2,runningCount:1,connectedCount:1},providers:[{id:'nordvpn',name:'NordVPN',installed:true,running:true,connected:true,state:'Connected',adapterName:'NordLynx',cliAvailable:true,launchAvailable:true,requiresElevation:false,detection:'Preview Windows inventory'},{id:'expressvpn',name:'ExpressVPN',installed:true,running:false,connected:false,state:'Ready',adapterName:null,cliAvailable:true,launchAvailable:true,requiresElevation:true,detection:'Preview Windows inventory'}]};},
    async vpnProviderAction(){return {ok:false,error:'Desktop-only VPN control'};},
    async getIpGeolocationStatus(){return {configured:false,encryptionAvailable:true,storage:'Preview secure storage',provider:'Geo IPify'};},
    async saveIpGeolocationKey(){return {ok:false,error:'Desktop-only secure credential storage'};}, async removeIpGeolocationKey(){return {ok:false,error:'Desktop-only secure credential storage'};},
    async lookupIpGeolocation(ip=''){return {ok:true,provider:'Geo IPify Preview',lookedUpAt:new Date().toISOString(),requestedIp:ip||null,ip:ip||'203.0.113.42',country:'CA',region:'Preview Region',city:'Preview City',latitude:47.5,longitude:-52.7,postalCode:'A1A 1A1',timezone:'-02:30',isp:'Preview ISP',asn:64500,asName:'Preview Network',route:'203.0.113.0/24',asType:'ISP'};},
    async openGeoIpify(){return {ok:false,error:'Desktop-only link'};},
    async privacyDnsInspect(domain){return {ok:true,domain:domain||'example.com',checkedAt:new Date().toISOString(),records:{a:['93.184.216.34'],aaaa:['2606:2800:220:1:248:1893:25c8:1946'],mx:[{exchange:'mail.example.com',priority:10}],ns:['ns1.example.com','ns2.example.com'],txt:['v=spf1 -all']}};},
    async privacyInspectFile(){return {ok:true,name:'preview-photo.jpg',extension:'jpg',sizeBytes:2480000,modifiedAt:new Date().toISOString(),scannedBytes:2480000,signals:{exif:true,gps:true,author:false,comments:true,xmp:true,copyright:false},risk:'High',score:88,partial:false};},
    async privacyOpenProfile(){return {ok:false,error:'Desktop-only link'};},
    async privacyOpenResource(){return {ok:false,error:'Desktop-only link'};},
    async privacyGetAppTrustInventory(){return {ok:true,generatedAt:new Date().toISOString(),summary:{count:4,withPublisher:3,missingPublisher:1,inspectable:3,publisherCoverage:75},apps:[{id:0,name:'Google Chrome',version:'Preview',publisher:'Google LLC',scope:'Machine x64',inspectable:true},{id:1,name:'Discord',version:'Preview',publisher:'Discord Inc.',scope:'Current user',inspectable:true},{id:2,name:'Steam',version:'Preview',publisher:'Valve Corporation',scope:'Machine x86',inspectable:true},{id:3,name:'Unsigned Utility',version:'0.1',publisher:'',scope:'Current user',inspectable:false}]};},
    async privacySelectAppTrustFile(){return {ok:true,source:'Selected local file',name:'preview-tool.exe',extension:'exe',sizeBytes:1843200,modifiedAt:new Date().toISOString(),sha256:'4f0dcb87f4a845b44385f7d0a8ac7a8c5bd13fa4e8c3b9e434cf9dfd59b3a8ad',signature:{status:'Valid',message:'Signature verified.',signer:'Purple Dragon Foundation Ltd',issuer:'Preview Code Signing CA',certificateNotAfter:new Date(Date.now()+365*86400000).toISOString()},fileInfo:{productName:'Preview Tool',fileVersion:'2.1.0',companyName:'Purple Dragon Foundation Ltd',originalFilename:'preview-tool.exe'},origin:{zoneId:null,zoneLabel:'No Mark of the Web detected',locationClass:'Program Files'},assessment:{score:88,verdict:'Higher confidence',tone:'trusted',reasons:['Windows reports a valid Authenticode signature.','This score is a local trust heuristic, not a malware verdict.']}};},
    async privacyInspectInstalledApp(){return this.privacySelectAppTrustFile();},
    async privacyGetAppProtectionStatus(){return {ok:true,checkedAt:new Date().toISOString(),smartScreen:{explorer:'Warn',appHostEnabled:true,policyEnabled:null,policyLevel:null},smartAppControl:{state:2,label:'Evaluation'}};},
    async privacyOpenHashReputation(){return {ok:false,error:'Desktop-only external lookup'};},
    async getStorageInventory() {
      const gib=1024**3;
      const volumes=[
        {driveLetter:'C',label:'System',fileSystem:'NTFS',driveType:'Fixed',driveTypeCode:3,size:232*gib,free:76*gib,used:156*gib,percent:67,model:'Preview NVMe SSD',mediaType:'SSD',mediaClass:'SSD',busType:'NVMe',interfaceType:'NVMe',connectionType:'NVMe',isUsb:false,isRemovable:false,health:'Healthy',operationalStatus:'OK',temperatureC:41},
        {driveLetter:'E',label:'Archive',fileSystem:'NTFS',driveType:'Fixed',driveTypeCode:3,size:4.54*1024*gib,free:4.39*1024*gib,used:.15*1024*gib,percent:3,model:'Preview SATA HDD',mediaType:'HDD',mediaClass:'HDD',busType:'SATA',interfaceType:'IDE',connectionType:'SATA',isUsb:false,isRemovable:false,health:'Healthy',operationalStatus:'OK',temperatureC:34},
        {driveLetter:'F',label:'External SSD',fileSystem:'NTFS',driveType:'Fixed',driveTypeCode:3,size:953*gib,free:311*gib,used:642*gib,percent:67,model:'Preview USB SSD',mediaType:'SSD',mediaClass:'SSD',busType:'USB',interfaceType:'USB',connectionType:'USB',isUsb:true,isRemovable:false,health:'Healthy',operationalStatus:'OK',temperatureC:null},
        {driveLetter:'G',label:'USB Drive',fileSystem:'exFAT',driveType:'Removable',driveTypeCode:2,size:298*gib,free:263*gib,used:35*gib,percent:12,model:'Preview USB Storage',mediaType:null,mediaClass:'Unknown',busType:'USB',interfaceType:'USB',connectionType:'USB',isUsb:true,isRemovable:true,health:'Healthy',operationalStatus:'OK',temperatureC:null}
      ];
      const totalBytes=volumes.reduce((a,v)=>a+v.size,0),freeBytes=volumes.reduce((a,v)=>a+v.free,0),usedBytes=volumes.reduce((a,v)=>a+v.used,0);
      return {generatedAt:new Date().toISOString(),volumes,physicalDisks:[],summary:{driveCount:volumes.length,totalBytes,freeBytes,usedBytes,systemDrive:volumes[0],lowSpaceDrives:0,usbDrives:2,removableDrives:1,ssdDrives:2,hddDrives:1}};
    },
    async analyzeUserFolders() { return {generatedAt:new Date().toISOString(),durationMs:820,categories:[{id:'downloads',label:'Downloads',path:'C:\\Users\\Preview\\Downloads',bytes:8.4*1024**3,files:482,folders:28,unreadable:0,incomplete:false},{id:'documents',label:'Documents',path:'C:\\Users\\Preview\\Documents',bytes:3.1*1024**3,files:1204,folders:93,unreadable:0,incomplete:false},{id:'pictures',label:'Pictures',path:'C:\\Users\\Preview\\Pictures',bytes:11.7*1024**3,files:642,folders:44,unreadable:0,incomplete:false}],largeFiles:[{name:'video-project.mp4',path:'C:\\Users\\Preview\\Downloads\\video-project.mp4',size:2.3*1024**3,category:'Downloads'},{name:'archive.zip',path:'C:\\Users\\Preview\\Documents\\archive.zip',size:780*1024**2,category:'Documents'}],totalBytes:23.2*1024**3,totalFiles:2328,incomplete:false,cancelled:false}; },
    async cancelStorageAnalysis() { return {ok:true}; },
    async previewStorageCleanup() { return {generatedAt:new Date().toISOString(),totalBytes:1.6*1024**3,totalFiles:312,durationMs:340,incomplete:false,categories:[{id:'user-temp',label:'User temporary files',description:'Preview-only browser data.',bytes:1.6*1024**3,files:312,incomplete:false},{id:'diagnostics',label:'PowerTools diagnostics log',description:'Local diagnostics only.',bytes:0,files:0,incomplete:false}]}; },
    async runStorageCleanup() { return {ok:false,error:'Desktop-only cleanup'}; },
    async openStorageFolder() { return {ok:false}; },
    async openStorageDrive() { return {ok:false}; },
    async revealLargeFile() { return {ok:false}; },
    async listActivity() { return JSON.parse(localStorage.getItem('pt.activity') || '[]'); },
    async addActivity(title, detail) { const a = await this.listActivity(); a.unshift({id:Date.now(),title,detail,at:new Date().toISOString()}); localStorage.setItem('pt.activity',JSON.stringify(a.slice(0,40))); return a; },
    async exportReport() { downloadBlob(JSON.stringify({generatedAt:new Date().toISOString(),system:staticInfo,metrics:live},null,2),'Purple-Dragon-System-Report.json','application/json'); return {ok:true,path:'browser download'}; },
    async openSystem() { return {ok:false}; },
    minimize() {}, maximize() {}, close() {}
  };
  const api = nativeApi || fallbackApi;

  function clamp(v, min=0, max=100){ return Math.max(min, Math.min(max, Number(v) || 0)); }
  function finite(v){ return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)); }
  function formatBytes(bytes, decimals=1) {
    if (!bytes) return '0 B';
    const k = 1024, units = ['B','KB','MB','GB','TB','PB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${(bytes / Math.pow(k, i)).toFixed(i < 3 ? 0 : decimals)} ${units[i]}`;
  }
  function formatRate(bytes){ return `${formatBytes(Math.max(0, Number(bytes) || 0))}/s`; }
  function formatNetworkRate(bytes){
    const kbps = Math.max(0, Number(bytes) || 0) * 8 / 1000;
    const decimals = kbps < 10 ? 2 : kbps < 1000 ? 1 : 0;
    return `${kbps.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:decimals})} kbps`;
  }
  function formatTemp(v){ return finite(v) ? `${Math.round(Number(v))}°C` : 'Unavailable'; }
  function temperatureState(v){ if(!finite(v)) return 'Unavailable'; const t=Number(v); if(t>=90) return 'Critical'; if(t>=80) return 'Hot'; if(t>=70) return 'Warm'; return 'Normal'; }
  function formatClock(v){ return finite(v) ? (Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(2)} GHz` : `${Math.round(Number(v))} MHz`) : 'Unavailable'; }
  function formatPower(v){ return finite(v) ? `${Number(v).toFixed(0)} W` : 'Unavailable'; }
  function formatUptime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const d = Math.floor(sec/86400), h = Math.floor((sec%86400)/3600), m = Math.floor((sec%3600)/60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  }
  function yesNoUnknown(v) { return v === true ? 'Enabled' : v === false ? 'Disabled' : 'Unavailable'; }
  function presentUnknown(v) { return v === true ? 'Present' : v === false ? 'Not present' : 'Unavailable'; }
  function formatDate(value) {
    if (!value) return 'Unavailable';
    const raw = String(value);
    const ps = raw.match(/^\/?Date\((\d+)(?:[+-]\d+)?\)\/?$/i);
    const d = ps ? new Date(Number(ps[1])) : new Date(value);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
  }
  function relativeTime(iso) {
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }
  function healthLabel(v) {
    if (v >= 90) return 'Optimal';
    if (v >= 75) return 'Good';
    if (v >= 60) return 'Moderate';
    return 'High load';
  }
  function setText(id, value){ const el = $(id); if (el) el.textContent = value; }
  function setWidth(id, value){ const el = $(id); if (el) el.style.width = `${clamp(value)}%`; }
  function setRing(id, value){ const el = $(id); if (el) el.style.setProperty('--value', clamp(value)); }
  function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function pushHistory(arr, value){ arr.push(finite(value) ? Number(value) : 0); if(arr.length>60) arr.shift(); }

  function drawLineChart(canvas, series) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, rect.width), h = Math.max(10, rect.height);
    if (canvas.width !== Math.floor(w*dpr) || canvas.height !== Math.floor(h*dpr)) { canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const pad = {l:10,r:10,t:8,b:8};
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(157,104,211,.12)';
    for(let i=1;i<5;i++){ const y=pad.t+(h-pad.t-pad.b)*i/5; ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke(); }
    series.forEach((s, idx) => {
      const values = s.values || [];
      if(values.length<2) return;
      const grad = ctx.createLinearGradient(0,0,w,0);
      if(idx===0){ grad.addColorStop(0,'rgba(125,61,255,.95)'); grad.addColorStop(1,'rgba(232,74,255,.95)'); }
      else if(idx===1){ grad.addColorStop(0,'rgba(46,155,255,.95)'); grad.addColorStop(1,'rgba(58,231,255,.95)'); }
      else { grad.addColorStop(0,'rgba(76,229,171,.86)'); grad.addColorStop(1,'rgba(162,89,255,.88)'); }
      ctx.strokeStyle=grad; ctx.lineWidth=s.width||1.6; ctx.shadowBlur=8; ctx.shadowColor=idx===1?'rgba(52,202,255,.35)':'rgba(183,64,255,.35)';
      ctx.beginPath();
      values.forEach((v,i)=>{ const x=pad.l+(w-pad.l-pad.r)*(i/(values.length-1)); const y=h-pad.b-(h-pad.t-pad.b)*(clamp(v)/100); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); });
      ctx.stroke(); ctx.shadowBlur=0;
    });
  }

  function normalizedNetworkSeries(values, scale) { return values.map(v => scale > 0 ? clamp((Number(v)||0) / scale * 100) : 0); }
  function drawNetworkChart() {
    const scale = Math.max(1024, ...networkRxHistory, ...networkTxHistory);
    drawLineChart($('#networkTrafficChart'), [{values:normalizedNetworkSeries(networkRxHistory,scale),width:1.8},{values:normalizedNetworkSeries(networkTxHistory,scale),width:1.5}]);
    setText('#networkChartScale', `Scale: ${formatNetworkRate(scale)}`);
  }

  function drawCharts() {
    const activeView = document.querySelector('.view.active')?.id || 'view-dashboard';
    if (activeView === 'view-dashboard') {
      drawLineChart($('#performanceChart'), [{values:cpuHistory.slice(-30),width:1.4},{values:ramHistory.slice(-30),width:1.0}]);
      drawLineChart($('#resourceChart'), [{values:cpuHistory},{values:ramHistory}]);
      return;
    }
    if (activeView === 'view-performance') {
      drawLineChart($('#perfDetailChart'), [{values:cpuHistory},{values:gpuHistory},{values:ramHistory}]);
      drawLineChart($('#thermalChart'), [{values:cpuTempHistory},{values:gpuTempHistory}]);
      return;
    }
    if (activeView === 'view-network') drawNetworkChart();
  }

  function renderHardwareIdentity() {
    if (!staticInfo) return;
    setText('#hardwareCpu', staticInfo.cpuModel || 'Unknown processor');
    setText('#hardwareCpuMeta', `${staticInfo.cpuPhysicalCores || '—'} physical · ${staticInfo.cpuCores || '—'} logical · max ${formatClock(staticInfo.cpuMaxClockMHz)}`);
    setText('#hardwareGpu', staticInfo.gpu?.Name || staticInfo.gpu?.name || 'GPU information unavailable');
    setText('#hardwareGpuMeta', staticInfo.gpu?.DriverVersion ? `Driver ${staticInfo.gpu.DriverVersion}` : 'Driver information unavailable');
    const board = staticInfo.motherboard;
    setText('#hardwareBoard', board ? [board.Manufacturer, board.Product].filter(Boolean).join(' ') : 'Unavailable');
    setText('#hardwareBoardMeta', board?.Version ? `Version ${board.Version}` : 'Baseboard information');
    const bios = staticInfo.bios;
    setText('#hardwareBios', bios?.SMBIOSBIOSVersion || 'Unavailable');
    setText('#hardwareBiosMeta', bios?.Manufacturer || 'BIOS information');
    const modules = staticInfo.memoryModules || [];
    const speeds = [...new Set(modules.map(m=>Number(m.ConfiguredClockSpeed || m.Speed)).filter(Boolean))];
    setText('#hardwareRam', `${formatBytes(staticInfo.totalMemory || 0,0)} installed`);
    setText('#hardwareRamMeta', `${modules.length || '—'} module${modules.length===1?'':'s'}${speeds.length ? ` · ${speeds.join('/')} MHz` : ''}`);
    setText('#hardwareOs', staticInfo.osCaption || 'Windows');
    setText('#hardwareOsMeta', `${staticInfo.hostname || ''} · ${(staticInfo.arch || '').toUpperCase()}`);
  }


  function renderSystemPowerTools() {
    if (!staticInfo) return;
    const sys = staticInfo.system || {};
    const board = staticInfo.motherboard || {};
    const bios = staticInfo.bios || {};
    const tpm = staticInfo.tpm || {};
    const rawTpmInfo = staticInfo.tpmInfo || null;
    const tpmInfo = rawTpmInfo || {};
    const modules = staticInfo.memoryModules || [];
    const speeds = [...new Set(modules.map(m => Number(m.ConfiguredClockSpeed || m.Speed)).filter(Boolean))];
    const computerModel = [sys.Manufacturer, sys.Model].filter(Boolean).join(' ') || 'Model unavailable';
    const boardName = [board.Manufacturer, board.Product].filter(Boolean).join(' ') || 'Unavailable';
    const gpuName = staticInfo.gpu?.Name || staticInfo.gpu?.name || 'Unavailable';
    const windowsLabel = staticInfo.osDisplayVersion || staticInfo.osVersion || 'Windows';
    const buildLabel = staticInfo.osBuildNumber ? `Build ${staticInfo.osBuildNumber}` : 'Build unavailable';
    const tpmPresent = typeof tpm.TpmPresent === 'boolean' ? tpm.TpmPresent : (rawTpmInfo ? true : null);
    const tpmReady = typeof tpm.TpmReady === 'boolean' ? tpm.TpmReady : null;
    const tpmSpec = tpmInfo.SpecVersion || 'Unavailable';

    setText('#sysDeviceName', staticInfo.hostname || 'Unknown PC');
    setText('#sysDeviceModel', computerModel);
    setText('#sysWindowsVersion', windowsLabel);
    setText('#sysWindowsBuild', `${staticInfo.osCaption || 'Windows'} · ${buildLabel}`);
    setText('#sysBootMode', staticInfo.bootMode || 'Unavailable');
    setText('#sysSecureBootSummary', `Secure Boot: ${yesNoUnknown(staticInfo.secureBoot)}`);
    setText('#sysTpmStatus', presentUnknown(tpmPresent));
    setText('#sysTpmSummary', tpmReady === true ? `Ready · Spec ${tpmSpec}` : `Ready: ${tpmReady === false ? 'No' : 'Unavailable'} · Spec ${tpmSpec}`);

    setText('#detailComputer', staticInfo.hostname || 'Unknown PC');
    setText('#detailComputerMeta', computerModel);
    setText('#detailCpu', staticInfo.cpuModel || 'Unknown processor');
    setText('#detailCpuMeta', `${staticInfo.cpuPhysicalCores || '—'} physical · ${staticInfo.cpuCores || '—'} logical · max ${formatClock(staticInfo.cpuMaxClockMHz)}`);
    setText('#detailGpu', gpuName);
    setText('#detailGpuMeta', staticInfo.gpu?.DriverVersion ? `Driver ${staticInfo.gpu.DriverVersion}` : 'Driver unavailable');
    setText('#detailBoard', boardName);
    setText('#detailBoardMeta', board.Version ? `Version ${board.Version}` : 'Baseboard');
    setText('#detailBios', bios.SMBIOSBIOSVersion || 'Unavailable');
    setText('#detailBiosMeta', [bios.Manufacturer, bios.ReleaseDate ? `Released ${formatDate(bios.ReleaseDate)}` : ''].filter(Boolean).join(' · ') || 'BIOS information');
    setText('#detailMemory', `${formatBytes(staticInfo.totalMemory || 0, 0)} installed`);
    setText('#detailMemoryMeta', `${modules.length || '—'} module${modules.length === 1 ? '' : 's'}${speeds.length ? ` · ${speeds.join('/')} MHz` : ''}`);
    setText('#detailOs', staticInfo.osCaption || 'Windows');
    setText('#detailOsMeta', `${windowsLabel} · ${buildLabel}`);
    setText('#detailArch', (staticInfo.arch || 'Unknown').toUpperCase());
    setText('#detailSystemType', sys.SystemType || staticInfo.osVersion || 'System type unavailable');
    setText('#detailLastBoot', formatDate(staticInfo.lastBootUpTime));
    setText('#detailUptime', `Current uptime ${formatUptime(live.uptime)}`);
    setText('#detailInstallDate', formatDate(staticInfo.installDate));
    setText('#detailEdition', staticInfo.osEdition ? `Edition ${staticInfo.osEdition}` : 'Edition unavailable');

    setText('#firmwareBootMode', staticInfo.bootMode || 'Unavailable');
    setText('#firmwareSecureBoot', yesNoUnknown(staticInfo.secureBoot));
    setText('#firmwareTpmPresent', presentUnknown(tpmPresent));
    setText('#firmwareTpmReady', tpmReady === true ? 'Ready' : tpmReady === false ? 'Not ready' : 'Unavailable');
    setText('#firmwareTpmSpec', tpmSpec);
    setText('#firmwareHypervisor', sys.HypervisorPresent === true ? 'Detected' : sys.HypervisorPresent === false ? 'Not detected' : 'Unavailable');
  }

  function renderStartupItems() {
    const root = $('#startupList');
    if (!root) return;
    const items = Array.isArray(startupItems) ? startupItems : [];
    setText('#startupSubtitle', items.length ? `${items.length} startup entr${items.length === 1 ? 'y' : 'ies'} detected. State changes are managed in Windows Startup Apps.` : 'No startup entries detected or Windows did not expose them.');
    if (!items.length) {
      root.innerHTML = '<div class="empty">No startup entries detected.</div>';
      return;
    }
    root.innerHTML = items.map(item => {
      const state = String(item.State || 'Unknown');
      const cls = state.toLowerCase() === 'enabled' ? 'enabled' : state.toLowerCase() === 'disabled' ? 'disabled' : 'unknown';
      return `<div class="startup-row"><div><strong>${escapeHtml(item.Name || 'Unnamed')}</strong><small>${escapeHtml(item.User || 'Current system')}</small></div><span>${escapeHtml(item.Publisher || 'Unknown')}</span><span><i class="startup-state ${cls}">${escapeHtml(state)}</i></span><span title="${escapeHtml(item.Location || '')}">${escapeHtml(item.Location || 'Unknown')}</span><code title="${escapeHtml(item.Command || '')}">${escapeHtml(item.Command || 'Unavailable')}</code></div>`;
    }).join('');
  }

  async function refreshStartup(force=false) {
    if (!api.listStartupItems) return;
    const root = $('#startupList');
    if (force && root) root.innerHTML = '<div class="empty">Refreshing Windows startup inventory…</div>';
    try { startupItems = await api.listStartupItems(force); } catch { startupItems = []; }
    renderStartupItems();
  }

  async function refreshStatic(force=false) {
    try { staticInfo = await api.getStaticInfo(force); } catch { staticInfo = null; }
    if (!staticInfo) return;
    setText('#cpuName', staticInfo.cpuModel || 'Unknown processor');
    setText('#coresStat', staticInfo.cpuCores ?? '--');
    setText('#ramStat', formatBytes(staticInfo.totalMemory || 0, 0));
    setText('#platformStat', staticInfo.arch ? staticInfo.arch.toUpperCase() : '--');
    const rows = $$('#systemProfile .system-row');
    if (rows[0]) rows[0].querySelector('small').textContent = staticInfo.cpuModel || 'Unknown processor';
    if (rows[1]) rows[1].querySelector('small').textContent = staticInfo.gpu?.Name || staticInfo.gpu?.name || 'GPU information unavailable';
    if (rows[2]) rows[2].querySelector('small').textContent = `${staticInfo.osCaption || 'Windows'} · ${staticInfo.arch || ''}`;
    if (rows[3]) rows[3].querySelector('small').textContent = `${formatBytes(staticInfo.totalMemory || 0,0)} installed`;
    renderHardwareIdentity();
    renderSystemPowerTools();

  }

  function securityState(el, text, state='neutral') {
    const node = typeof el === 'string' ? $(el) : el;
    if (!node) return;
    node.textContent = text;
    node.classList.remove('state-good','state-warn','state-bad','state-neutral');
    node.classList.add(`state-${state}`);
  }

  function boolSecurity(value, positive='Enabled', negative='Disabled') {
    if (value === true) return {text:positive,state:'good',known:true,pass:true};
    if (value === false) return {text:negative,state:'bad',known:true,pass:false};
    return {text:'Unavailable',state:'neutral',known:false,pass:false};
  }

  function renderSecurityScore() {
    const sec = securityInfo || {};
    const def = sec.defender || {};
    const fw = Array.isArray(sec.firewall) ? sec.firewall : (sec.firewall ? [sec.firewall] : []);
    const tpm = staticInfo?.tpm || {};
    const checks = [];
    const add = (known, pass, weight) => { if (known) checks.push({pass:Boolean(pass),weight}); };
    add(typeof def.RealTimeProtectionEnabled === 'boolean', def.RealTimeProtectionEnabled === true, 22);
    add(typeof def.DefenderSignaturesOutOfDate === 'boolean', def.DefenderSignaturesOutOfDate === false, 10);
    add(fw.length > 0, fw.length > 0 && fw.every(x => x.Enabled === true), 15);
    add(typeof staticInfo?.secureBoot === 'boolean', staticInfo?.secureBoot === true, 10);
    add(typeof tpm.TpmPresent === 'boolean' || typeof tpm.TpmReady === 'boolean', tpm.TpmReady === true, 10);
    add(typeof sec.uac?.enabled === 'boolean', sec.uac.enabled === true, 8);
    const smartKnown = sec.smartScreen?.explorer != null || typeof sec.smartScreen?.appHostEnabled === 'boolean';
    const smartPass = String(sec.smartScreen?.explorer || '').toLowerCase() !== 'off' && sec.smartScreen?.appHostEnabled !== false;
    add(smartKnown, smartPass, 5);
    const bl = sec.bitLocker;
    const blKnown = Boolean(bl && bl.supported !== false && (bl.protectionStatus || bl.volumeStatus));
    const blPass = /on|1|fullyencrypted|encryptioninprogress/i.test(`${bl?.protectionStatus || ''} ${bl?.volumeStatus || ''}`);
    add(blKnown, blPass, 15);
    add(typeof sec.update?.rebootPending === 'boolean', sec.update.rebootPending === false, 5);
    const knownWeight = checks.reduce((a,c)=>a+c.weight,0);
    const earned = checks.reduce((a,c)=>a+(c.pass?c.weight:0),0);
    if (!knownWeight) { securityState('#securityScore','--','neutral'); setText('#securityScoreDetail','Security data unavailable'); return; }
    const score = Math.round(earned / knownWeight * 100);
    securityState('#securityScore',`${score}%`,score>=90?'good':score>=75?'warn':'bad');
    setText('#securityScoreDetail',`${checks.filter(c=>c.pass).length}/${checks.length} available checks passing`);
  }

  function renderSecurityCenter() {
    const sec = securityInfo || {};
    const def = sec.defender || null;
    const fw = Array.isArray(sec.firewall) ? sec.firewall : (sec.firewall ? [sec.firewall] : []);

    const defOn = def && def.RealTimeProtectionEnabled === true && def.AntivirusEnabled !== false;
    securityState('#defenderStatus', def ? (defOn ? 'Protected' : 'Attention') : (demoMode ? 'Preview mode' : 'Unavailable'), def ? (defOn?'good':'bad') : 'neutral');
    const sigText = def ? (def.DefenderSignaturesOutOfDate === true ? 'Signatures out of date' : def.AntivirusSignatureAge != null ? `Signatures ${Number(def.AntivirusSignatureAge)||0}d old` : 'Signature age unavailable') : 'Windows Defender status unavailable';
    setText('#defenderDetail', def ? `Real-time ${def.RealTimeProtectionEnabled?'On':'Off'} · ${sigText}` : sigText);

    const fwOn = fw.length > 0 && fw.every(x=>x.Enabled === true);
    securityState('#firewallStatus', fw.length ? (fwOn?'Enabled':'Check profiles') : 'Unavailable', fw.length ? (fwOn?'good':'bad') : 'neutral');
    setText('#firewallDetail', fw.length ? `${fw.filter(x=>x.Enabled===true).length}/${fw.length} profiles enabled` : 'Firewall profile data unavailable');

    const sb = staticInfo?.secureBoot;
    const tpm = staticInfo?.tpm || {};
    const platformKnown = typeof sb === 'boolean' || typeof tpm.TpmPresent === 'boolean' || typeof tpm.TpmReady === 'boolean';
    const platformGood = sb === true && tpm.TpmReady === true;
    securityState('#platformSecurityStatus', platformKnown ? (platformGood?'Protected':'Review') : 'Unavailable', platformKnown ? (platformGood?'good':'warn') : 'neutral');
    setText('#platformSecurityDetail', `Secure Boot ${sb===true?'On':sb===false?'Off':'?'} · TPM ${tpm.TpmReady===true?'Ready':tpm.TpmPresent===true?'Present':'?'}`);

    const bl = sec.bitLocker || null;
    const blUnsupported = bl?.supported === false;
    const blProtected = Boolean(bl && !blUnsupported && /on|1|protection on/i.test(String(bl.protectionStatus || '')));
    securityState('#bitlockerSummary', blUnsupported ? 'Not supported' : bl ? (blProtected?'Protected':'Not protected') : 'Unavailable', blUnsupported ? 'neutral' : bl ? (blProtected?'good':'warn') : 'neutral');
    setText('#bitlockerSummaryDetail', blUnsupported ? 'BitLocker/device-encryption provider is not available on this Windows installation' : bl ? `${bl.mountPoint || 'System drive'} · ${bl.encryptionPercentage != null ? `${Math.round(Number(bl.encryptionPercentage))}% encrypted` : bl.volumeStatus || 'Status available'}` : 'BitLocker/device encryption data unavailable');

    const upd = sec.update || {};
    const rebootKnown = typeof upd.rebootPending === 'boolean';
    securityState('#updateSecurityStatus', rebootKnown ? (upd.rebootPending?'Restart needed':'Current state OK') : 'Unavailable', rebootKnown ? (upd.rebootPending?'warn':'good') : 'neutral');
    const hf = upd.latestHotfix;
    setText('#updateSecurityDetail', hf?.HotFixID ? `${hf.HotFixID} · ${formatDate(hf.InstalledOn)}` : (rebootKnown ? 'No pending restart detected' : 'Update status unavailable'));

    const protection = [
      ['Real-time protection', def?.RealTimeProtectionEnabled, 'On', 'Off'],
      ['Antivirus signatures', def?.DefenderSignaturesOutOfDate === false ? true : def?.DefenderSignaturesOutOfDate === true ? false : null, def?.AntivirusSignatureAge != null ? `Current · ${Number(def.AntivirusSignatureAge)||0}d old` : 'Current', 'Out of date'],
      ['Behavior monitor', def?.BehaviorMonitorEnabled, 'On', 'Off'],
      ['Network inspection', def?.NISEnabled, 'On', 'Off'],
      ['Tamper protection', def?.IsTamperProtected, 'On', 'Off'],
      ['Last quick scan', def?.QuickScanAge != null ? true : null, def?.QuickScanAge != null ? `${Number(def.QuickScanAge)} day${Number(def.QuickScanAge)===1?'':'s'} ago` : 'Unavailable', 'Unavailable']
    ];
    const pc = $('#securityProtectionChecks');
    if (pc) pc.innerHTML = protection.map(([label,val,on,off])=>{
      const r=val===true?{text:on,state:'good'}:val===false?{text:off,state:'bad'}:{text:'Unavailable',state:'neutral'};
      return `<div><span>${escapeHtml(label)}</span><strong class="state-${r.state}">${escapeHtml(r.text)}</strong></div>`;
    }).join('');

    securityState('#securitySecureBoot', yesNoUnknown(sb), sb===true?'good':sb===false?'bad':'neutral');
    const tpmText = tpm.TpmReady===true ? 'Ready' : tpm.TpmPresent===true ? 'Present / not ready' : tpm.TpmPresent===false ? 'Not present' : 'Unavailable';
    securityState('#securityTpm', tpmText, tpm.TpmReady===true?'good':tpm.TpmPresent===true?'warn':tpm.TpmPresent===false?'bad':'neutral');
    const uac = boolSecurity(sec.uac?.enabled, 'Enabled', 'Disabled'); securityState('#securityUac',uac.text,uac.state);
    const smartKnown = sec.smartScreen?.explorer != null || typeof sec.smartScreen?.appHostEnabled === 'boolean';
    const smartOff = String(sec.smartScreen?.explorer || '').toLowerCase()==='off' || sec.smartScreen?.appHostEnabled===false;
    securityState('#securitySmartScreen', smartKnown ? (smartOff?'Review settings':String(sec.smartScreen?.explorer || 'Enabled')) : 'Unavailable', smartKnown ? (smartOff?'warn':'good') : 'neutral');

    const fwRoot=$('#securityFirewallProfiles');
    if(fwRoot) fwRoot.innerHTML = fw.length ? fw.map(x=>`<div><span>${escapeHtml(x.Name || 'Profile')}</span><strong class="state-${x.Enabled===true?'good':'bad'}">${x.Enabled===true?'Enabled':'Disabled'}</strong></div>`).join('') : '<div class="empty">Firewall profile data unavailable.</div>';

    securityState('#securityBitlocker', blUnsupported ? 'Not supported' : bl ? `${bl.mountPoint || 'System drive'} · ${bl.protectionStatus || 'Unknown'}` : 'Unavailable', blUnsupported ? 'neutral' : bl ? (blProtected?'good':'warn') : 'neutral');
    securityState('#securityEncryption', blUnsupported ? 'Not supported' : bl ? `${bl.volumeStatus || 'Unknown'}${bl.encryptionPercentage != null ? ` · ${Math.round(Number(bl.encryptionPercentage))}%` : ''}` : 'Unavailable', blUnsupported ? 'neutral' : bl ? (blProtected?'good':'warn') : 'neutral');
    securityState('#securityRestartPending', typeof upd.rebootPending==='boolean' ? (upd.rebootPending?'Yes':'No') : 'Unavailable', typeof upd.rebootPending==='boolean' ? (upd.rebootPending?'warn':'good') : 'neutral');
    securityState('#securityLatestHotfix', hf?.HotFixID ? `${hf.HotFixID}` : 'Unavailable', hf?.HotFixID?'good':'neutral');

    const providers = Array.isArray(sec.antivirusProducts) ? sec.antivirusProducts : [];
    const providerRoot=$('#securityProviders');
    if(providerRoot) providerRoot.innerHTML = providers.length ? providers.map(x=>`<div class="security-provider"><span class="provider-dot"></span><div><strong>${escapeHtml(x.displayName || 'Detected antivirus')}</strong><small>${x.registeredWithSecurityCenter===false ? 'Detected via Microsoft Defender status' : 'Registered with Windows Security'}${x.timestamp ? ` · ${escapeHtml(formatDate(x.timestamp))}` : ''}</small></div></div>`).join('') : '<div class="empty">No antivirus provider inventory was returned by Windows.</div>';

    const eventLabels={1000:'Defender scan started',1001:'Defender scan completed',1116:'Threat detected',1117:'Threat action taken',5007:'Defender configuration changed'};
    const eventRoot=$('#securityEventList');
    const events=Array.isArray(sec.recentEvents)?sec.recentEvents:[];
    if(eventRoot) eventRoot.innerHTML=events.length?events.map(ev=>{
      const id=Number(ev.id); const severity=id===1116?'bad':id===1117?'good':'neutral';
      return `<div class="security-event"><span class="event-icon state-${severity}">⬡</span><div><strong>${escapeHtml(eventLabels[id]||`Defender event ${id||''}`)}</strong><small>${escapeHtml(formatDate(ev.timeCreated))}${ev.level?` · ${escapeHtml(ev.level)}`:''}</small></div><b>#${Number.isFinite(id)?id:'--'}</b></div>`;
    }).join(''):'<div class="empty">No selected Defender events were found in the last 7 days.</div>';

    renderSecurityScore();
  }

  async function refreshSecurity(force=false) {
    if (!api.getSecurityInfo || securityLoading) return;
    securityLoading = true;
    const refreshBtn=$('#refreshSecurityCenter');
    if(refreshBtn){refreshBtn.disabled=true;refreshBtn.textContent='Checking…';}
    try {
      const [sec, info] = await Promise.all([
        api.getSecurityInfo(force).catch(()=>null),
        api.getStaticInfo ? api.getStaticInfo(force).catch(()=>staticInfo) : Promise.resolve(staticInfo)
      ]);
      securityInfo = sec;
      if(info) staticInfo=info;
      securityLoaded = true;
      renderSecurityCenter();
    } catch {
      securityInfo = null;
      renderSecurityCenter();
    } finally {
      securityLoading=false;
      if(refreshBtn){refreshBtn.disabled=false;refreshBtn.textContent='Refresh';}
    }
  }

  function renderCoreGrid(values) {
    const root = $('#coreGrid');
    if (!root) return;
    if (!Array.isArray(values) || !values.length) { root.innerHTML='<div class="empty">Per-core telemetry is unavailable.</div>'; return; }
    setText('#coreCountChip', `${values.length} logical cores`);
    root.innerHTML = values.map((v,i)=>`<div class="core-item"><div><span>Core ${i+1}</span><strong>${clamp(v)}%</strong></div><div class="core-bar"><i style="width:${clamp(v)}%"></i></div></div>`).join('');
  }

  function renderPerformanceSensors() {
    const gpu = live.gpu;
    const gpuLoad = gpu && finite(gpu.load) ? clamp(gpu.load) : null;
    const cpuTemp = live.cpuTemperatureC;
    const gpuTemp = gpu?.temperatureC;

    setText('#perfGpu', gpuLoad === null ? 'N/A' : `${gpuLoad}%`);
    setWidth('#perfGpuBar', gpuLoad ?? 0);
    setText('#perfCpuTemp', `Temp ${formatTemp(cpuTemp)}`);
    setText('#perfCpuClock', `Clock ${formatClock(live.cpuClockMHz)}`);
    setText('#perfGpuTemp', `Temp ${formatTemp(gpuTemp)}`);
    if (gpu && finite(gpu.memoryUsedMB) && finite(gpu.memoryTotalMB)) setText('#perfGpuVram', `VRAM ${(gpu.memoryUsedMB/1024).toFixed(1)} / ${(gpu.memoryTotalMB/1024).toFixed(1)} GB`);
    else setText('#perfGpuVram', 'VRAM unavailable');
    setText('#perfRamUsed', `${formatBytes(live.usedMemory)} used`);
    setText('#perfRamTotal', `${formatBytes(live.totalMemory,0)} total`);
    setText('#perfDiskReadMini', `Read ${formatRate(live.diskReadBps)}`);
    setText('#perfDiskWriteMini', `Write ${formatRate(live.diskWriteBps)}`);

    setText('#sensorCpuTemp', formatTemp(cpuTemp));
    const cpuTempState = temperatureState(cpuTemp);
    const cpuSource = live.cpuTemperatureSource || 'CPU temperature sensor';
    const cpuTempUnavailableNote = live.cpuTemperatureBridgeNeedsElevation
      ? 'Dedicated CPU sensor helper needs Administrator approval — use Enable CPU Sensor'
      : (live.cpuTemperatureBridgeError || 'CPU package temperature unavailable; 0°C is never used as a placeholder');
    setText('#sensorCpuTempNote', finite(cpuTemp)
      ? `${cpuSource} · ${cpuTempState}${live.cpuTemperatureStale ? ' · last valid sample' : ''}`
      : cpuTempUnavailableNote);
    const sensorButton = $('#enableCpuSensor');
    if (sensorButton) {
      sensorButton.hidden = finite(cpuTemp) || Boolean(live.cpuTemperatureBridgeRunning);
      sensorButton.textContent = live.cpuTemperatureBridgeElevationAttempted ? 'Retry CPU Sensor' : 'Enable CPU Sensor';
    }
    const sensorChip = $('#sensorIntegrationChip');
    if (sensorChip) {
      sensorChip.textContent = finite(cpuTemp) ? 'Connected' : (live.cpuTemperatureBridgeRunning ? 'Starting…' : 'On demand');
      sensorChip.classList.toggle('active', finite(cpuTemp));
    }
    setText('#sensorCpuClock', formatClock(live.cpuClockMHz));
    setText('#sensorGpuTemp', formatTemp(gpuTemp));
    setText('#sensorGpuProvider', gpu?.provider || 'NVIDIA telemetry unavailable');
    setText('#sensorGpuClock', formatClock(gpu?.coreClockMHz));
    setText('#sensorGpuFan', finite(gpu?.fanPercent) ? `Fan ${Math.round(gpu.fanPercent)}%` : 'Fan sensor unavailable');
    setText('#sensorGpuPower', formatPower(gpu?.powerDrawW));
    setText('#sensorGpuPowerLimit', finite(gpu?.powerLimitW) ? `Limit ${Math.round(gpu.powerLimitW)} W` : 'Power limit unavailable');
    setText('#sensorDiskBusy', `${Math.round(clamp(live.diskBusyPercent))}%`);
    setText('#diskReadRate', formatRate(live.diskReadBps));
    setText('#diskWriteRate', formatRate(live.diskWriteBps));
    setText('#networkDownRate', formatNetworkRate(live.networkRxBps));
    setText('#networkUpRate', formatNetworkRate(live.networkTxBps));
    setText('#thermalCpuNow', `CPU ${formatTemp(cpuTemp)}`);
    setText('#thermalGpuNow', `GPU ${formatTemp(gpuTemp)}`);
    renderCoreGrid(live.perCore);
  }

  async function refreshLive() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try { live = await api.getLiveMetrics(); } catch { refreshInFlight = false; return; }
    refreshInFlight = false;

    const cpu = clamp(live.cpu), mem = clamp(live.memory), stor = clamp(live.storage?.percent), health = clamp(live.health);
    const gpuLoad = live.gpu && finite(live.gpu.load) ? clamp(live.gpu.load) : 0;
    pushHistory(cpuHistory, cpu); pushHistory(gpuHistory, gpuLoad); pushHistory(ramHistory, mem); pushHistory(healthHistory, health);
    pushHistory(cpuTempHistory, live.cpuTemperatureC); pushHistory(gpuTempHistory, live.gpu?.temperatureC);
    pushHistory(networkRxHistory, live.networkRxBps); pushHistory(networkTxHistory, live.networkTxBps);

    setText('#cpuCard', `${cpu}%`);
    setText('#ramCard', formatBytes(live.usedMemory || 0));
    setText('#ramDetail', `${formatBytes(live.totalMemory || 0,0)} installed`);
    setText('#healthCard', `${health}%`);
    setText('#healthLabel', healthLabel(health));
    setText('#uptimeCard', formatUptime(live.uptime));
    setText('#detailUptime', `Current uptime ${formatUptime(live.uptime)}`);
    setText('#miniHealth', `${health}%`);
    setText('#miniHealthLabel', healthLabel(health));
    setText('#statusText', health >= 75 ? 'All core systems operational' : 'System is under elevated load');
    setRing('#miniRing', health); setRing('#cpuRing', cpu);
    setText('#cpuRingValue', `${cpu}%`); setText('#cpuPct', `${cpu}%`); setText('#memoryPct', `${mem}%`); setText('#storagePct', `${stor}%`); setText('#healthPct', `${health}%`);
    setWidth('#cpuBar', cpu); setWidth('#memoryBar', mem); setWidth('#storageBar', stor); setWidth('#healthBar', health);
    setText('#storageStat', formatBytes(live.storage?.total || 0,0));
    setText('#perfCpu', `${cpu}%`); setText('#perfRam', `${mem}%`); setText('#perfStorage', `${stor}%`);
    setWidth('#perfCpuBar', cpu); setWidth('#perfRamBar', mem); setWidth('#perfStorageBar', stor);
    setText('#securityHealth', `${health}%`);
    const activeView = document.querySelector('.view.active')?.id || 'view-dashboard';
    if (activeView === 'view-performance') renderPerformanceSensors();
    if (activeView === 'view-network') renderNetworkLive();
    drawCharts();
  }

  async function refreshPowerProfiles() {
    if (!api.getPerformanceProfiles) return;
    try { powerProfiles = await api.getPerformanceProfiles(); } catch { powerProfiles = null; }
    if (!powerProfiles) { setText('#activePowerPlan','Unavailable'); return; }
    setText('#activePowerPlan', powerProfiles.activeName || 'Custom');
    $$('.profile-btn').forEach(btn => {
      const p = powerProfiles.profiles?.find(x => x.id === btn.dataset.profile);
      btn.disabled = p ? !p.available : true;
      btn.classList.toggle('active', Boolean(p && p.guid === powerProfiles.activeGuid));
      btn.title = p && !p.available ? `${p.name} power plan is not installed on this PC.` : '';
    });
  }

  async function setPowerProfile(id) {
    if (!api.setPerformanceProfile) return;
    const button = $(`.profile-btn[data-profile="${id}"]`);
    if (button) button.disabled = true;
    let result;
    try { result = await api.setPerformanceProfile(id); } catch { result = {ok:false,error:'Unable to change the Windows power plan.'}; }
    if (result?.ok) {
      powerProfiles = result.profile;
      toast('Performance profile changed', powerProfiles?.activeName || id);
      await refreshPowerProfiles(); await refreshActivity();
    } else {
      toast('Profile unavailable', result?.error || 'Windows rejected this power-plan change.');
      await refreshPowerProfiles();
    }
  }

  async function refreshActivity() {
    const list = $('#activityList'); if(!list) return;
    let items = [];
    try { items = await api.listActivity(); } catch {}
    if(!items?.length){ list.innerHTML='<div class="empty">No recent activity yet.</div>'; return; }
    list.innerHTML = items.slice(0,5).map(item => `<div class="activity-item"><div class="activity-icon">◇</div><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div><time>${relativeTime(item.at)}</time></div>`).join('');
  }

  async function logActivity(title, detail) { try { await api.addActivity(title, detail); await refreshActivity(); } catch {} }


  function storageMediaLabel(v) {
    const mediaClass = String(v?.mediaClass || '').trim().toUpperCase();
    const media = String(v?.mediaType || '').trim();
    const bus = String(v?.busType || '').trim();
    const connection = String(v?.connectionType || '').trim();
    const usb = Boolean(v?.isUsb) || /^usb/i.test(connection) || /^usb/i.test(bus);
    if (usb) return mediaClass === 'SSD' || mediaClass === 'HDD' ? `USB ${mediaClass}` : (v?.isRemovable ? 'USB removable' : 'USB storage');
    if (mediaClass === 'SSD' || mediaClass === 'HDD') return mediaClass;
    if (media && media.toLowerCase() !== 'unspecified' && media.toLowerCase() !== 'unknown') return media;
    if (connection && connection.toLowerCase() !== 'internal') return connection;
    if (bus) return bus;
    return v?.isRemovable ? 'Removable storage' : 'Local storage';
  }

  function renderStorageInventory() {
    const volumes = Array.isArray(storageInventory?.volumes) ? storageInventory.volumes : [];
    const summary = storageInventory?.summary || {};
    setText('#storageDriveCount', volumes.length ? String(volumes.length) : '--');
    setText('#storageTotalCapacity', volumes.length ? formatBytes(summary.totalBytes || 0, 1) : '--');
    setText('#storageTotalUsed', volumes.length ? `${formatBytes(summary.usedBytes || 0)} used across mounted drives` : 'No drive inventory available');
    setText('#storageTotalFree', volumes.length ? formatBytes(summary.freeBytes || 0, 1) : '--');
    const typeBits = [];
    if (summary.ssdDrives) typeBits.push(`${summary.ssdDrives} SSD`);
    if (summary.hddDrives) typeBits.push(`${summary.hddDrives} HDD`);
    if (summary.usbDrives) typeBits.push(`${summary.usbDrives} USB`);
    setText('#storageFreeHealth', summary.lowSpaceDrives ? `${summary.lowSpaceDrives} drive${summary.lowSpaceDrives===1?'':'s'} below 10% free` : (volumes.length ? (typeBits.join(' · ') || 'No low-space warning') : 'No mounted storage detected'));
    setText('#driveCenterSubtitle', volumes.length ? `${volumes.length} mounted volume${volumes.length===1?'':'s'}${typeBits.length?` · ${typeBits.join(' · ')}`:''} · refreshed ${new Date(storageInventory.generatedAt).toLocaleTimeString()}` : 'Windows did not expose mounted drive inventory.');
    const root = $('#driveList');
    if (!root) return;
    if (!volumes.length) { root.innerHTML='<div class="empty">No local storage volumes were detected.</div>'; return; }
    root.innerHTML = volumes.map(v => {
      const pct = clamp(v.percent);
      const low = v.size > 0 && (v.free / v.size) < .10;
      const healthRaw = String(v.health || '').toLowerCase();
      const healthy = healthRaw.includes('healthy') || String(v.operationalStatus || '').toLowerCase().includes('ok');
      const healthLabel = low ? 'Low space' : healthy ? 'Healthy' : (v.health || 'Status unavailable');
      const healthClass = low ? 'warn' : healthy ? '' : 'unknown';
      const transport = (v.isUsb || /^usb/i.test(String(v.connectionType||''))) ? null : (v.connectionType || v.busType);
      const detail = [storageMediaLabel(v), transport, v.fileSystem].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(' · ');
      return `<div class="drive-card"><div class="drive-card-head"><div class="drive-identity"><div class="drive-badge">${escapeHtml(v.driveLetter || '?')}:</div><div><strong>${escapeHtml(v.label || `${v.driveLetter || '?'}: Local Disk`)}</strong><small title="${escapeHtml(v.model || '')}">${escapeHtml(v.model || detail || 'Windows local volume')}</small></div></div><span class="drive-health ${healthClass}">${escapeHtml(healthLabel)}</span></div><div class="drive-meter"><i class="${low?'warn':''}" style="width:${pct}%"></i></div><div class="drive-stats"><span>${pct.toFixed(0)}% used · ${formatBytes(v.used)}</span><span>${formatBytes(v.free)} free</span></div><div class="drive-meta"><span>${escapeHtml(detail || 'Volume')}</span><span>${finite(v.temperatureC)?`${Math.round(v.temperatureC)}°C`:'Temp unavailable'}</span></div><button class="drive-open" data-open-drive="${escapeHtml(v.driveLetter)}">Open ${escapeHtml(v.driveLetter)}:\\</button></div>`;
    }).join('');
  }

  function renderStorageAnalysis() {
    const categories = Array.isArray(storageAnalysis?.categories) ? storageAnalysis.categories : [];
    const root = $('#folderUsageGrid');
    if (root) {
      root.innerHTML = categories.length ? categories.map(c => `<div class="folder-usage-card"><span>${escapeHtml(c.label || c.id)}</span><strong>${formatBytes(c.bytes || 0)}</strong><small>${Number(c.files||0).toLocaleString()} files · ${Number(c.folders||0).toLocaleString()} folders${c.incomplete?' · partial':''}</small></div>`).join('') : '<div class="empty">Run Analyze Folders to calculate usage.</div>';
    }
    if (storageAnalysis) {
      const status = storageAnalysis.cancelled ? 'Analysis cancelled.' : storageAnalysis.incomplete ? `Partial scan · ${formatBytes(storageAnalysis.totalBytes || 0)} across ${Number(storageAnalysis.totalFiles||0).toLocaleString()} files · ${Math.round((storageAnalysis.durationMs||0)/1000)}s` : `Complete · ${formatBytes(storageAnalysis.totalBytes || 0)} across ${Number(storageAnalysis.totalFiles||0).toLocaleString()} files · ${Math.max(1,Math.round((storageAnalysis.durationMs||0)/1000))}s`;
      setText('#storageAnalysisStatus', status);
    }
    const large = Array.isArray(storageAnalysis?.largeFiles) ? storageAnalysis.largeFiles : [];
    setText('#largeFileCount', storageAnalysis ? `${large.length} found` : 'Not scanned');
    const list = $('#largeFileList');
    if (list) list.innerHTML = large.length ? large.slice(0,40).map((f,i)=>`<div class="large-file-row"><div><strong title="${escapeHtml(f.path||'')}">${escapeHtml(f.name||'Unnamed file')}</strong><small>${escapeHtml(f.category||'User folder')} · ${escapeHtml(f.path||'')}</small></div><div class="large-file-actions"><b>${formatBytes(f.size||0)}</b><button data-reveal-large="${i}">Show in folder</button></div></div>`).join('') : (storageAnalysis ? '<div class="empty">No files ≥ 250 MB were found in the scanned folders.</div>' : '<div class="empty">Large-file results appear after analysis.</div>');
  }

  function selectedCleanupIds() { return $$('.cleanup-select:checked').map(x=>x.value); }
  function updateCleanupSelection() {
    const ids = new Set(selectedCleanupIds());
    const cats = cleanupPreview?.categories || [];
    const bytes = cats.filter(c=>ids.has(c.id)).reduce((sum,c)=>sum+(Number(c.bytes)||0),0);
    setText('#cleanupSelectedSize', `${formatBytes(bytes)} selected`);
    const btn = $('#runCleanup'); if (btn) btn.disabled = bytes <= 0 || ids.size === 0;
  }
  function renderCleanupPreview() {
    const root = $('#cleanupCategoryList');
    const cats = Array.isArray(cleanupPreview?.categories) ? cleanupPreview.categories : [];
    if (!root) return;
    if (!cats.length) { root.innerHTML='<div class="empty">Create a preview to see reclaimable space.</div>'; setText('#storageCleanupReclaim','--'); setText('#storageCleanupSummary','Run preview before deleting anything'); updateCleanupSelection(); return; }
    setText('#storageCleanupReclaim', formatBytes(cleanupPreview.totalBytes || 0));
    setText('#storageCleanupSummary', `${Number(cleanupPreview.totalFiles||0).toLocaleString()} previewed file${Number(cleanupPreview.totalFiles||0)===1?'':'s'}${cleanupPreview.incomplete?' · partial scan':''}`);
    setText('#cleanupPreviewTime', `Previewed ${new Date(cleanupPreview.generatedAt).toLocaleTimeString()}${cleanupPreview.incomplete?' · scan limit reached':''}`);
    root.innerHTML = cats.map((c,i)=>`<label class="cleanup-category"><input class="cleanup-select" type="checkbox" value="${escapeHtml(c.id)}" ${i===0 && c.bytes>0?'checked':''} ${c.bytes<=0?'disabled':''}/><span><strong>${escapeHtml(c.label)}</strong><small>${escapeHtml(c.description||'')}${c.incomplete?' · Partial inventory':''}</small></span><b>${formatBytes(c.bytes||0)}</b></label>`).join('');
    $$('.cleanup-select', root).forEach(cb=>cb.addEventListener('change',updateCleanupSelection));
    updateCleanupSelection();
  }

  async function loadDataHub(force=false) {
    if (storageLoading) return;
    if (storageLoaded && !force) { renderStorageInventory(); return; }
    storageLoading = true;
    $('#driveList')?.classList.add('storage-loading');
    setText('#driveCenterSubtitle', 'Reading local volumes… Data Hub runs independently from startup.');
    try {
      storageInventory = await api.getStorageInventory(force);
      storageLoaded = true;
      renderStorageInventory();
    } catch {
      setText('#driveCenterSubtitle','Drive inventory failed. Use Refresh Drives to retry.');
      if ($('#driveList')) $('#driveList').innerHTML='<div class="empty">Unable to read local storage inventory.</div>';
    } finally {
      storageLoading = false;
      $('#driveList')?.classList.remove('storage-loading');
    }
  }

  async function runFolderAnalysis() {
    if (storageAnalysisRunning) return;
    storageAnalysisRunning = true;
    const analyze = $('#analyzeStorage'), cancel = $('#cancelStorageAnalysis');
    if (analyze) { analyze.disabled=true; analyze.textContent='Analyzing…'; }
    if (cancel) cancel.hidden=false;
    setText('#storageAnalysisStatus','Scanning user folders locally… large folders may take up to about one minute.');
    try {
      storageAnalysis = await api.analyzeUserFolders();
      renderStorageAnalysis();
      if (!storageAnalysis?.cancelled) { toast('Storage analysis complete', `${formatBytes(storageAnalysis?.totalBytes||0)} indexed`); logActivity('User storage analyzed', `${Number(storageAnalysis?.totalFiles||0).toLocaleString()} files`); }
    } catch { setText('#storageAnalysisStatus','Analysis failed. No files were changed.'); toast('Storage analysis failed'); }
    finally {
      storageAnalysisRunning=false;
      if (analyze) { analyze.disabled=false; analyze.textContent='Analyze Folders'; }
      if (cancel) cancel.hidden=true;
    }
  }

  async function previewCleanupNow() {
    const btn=$('#previewCleanup'); if(btn){btn.disabled=true;btn.textContent='Scanning…';}
    try { cleanupPreview=await api.previewStorageCleanup(true); renderCleanupPreview(); toast('Cleanup preview ready', `${formatBytes(cleanupPreview?.totalBytes||0)} reclaimable in preview`); }
    catch { toast('Cleanup preview failed','No files were changed.'); }
    finally { if(btn){btn.disabled=false;btn.textContent='Preview Cleanup';} }
  }

  async function cleanSelectedStorage() {
    const ids=selectedCleanupIds(); if(!ids.length) return;
    const btn=$('#runCleanup'); if(btn)btn.disabled=true;
    let result;
    try { result=await api.runStorageCleanup(ids); } catch { result={ok:false,error:'Cleanup failed'}; }
    if(result?.ok){ toast('Cleanup complete', `${formatBytes(result.deletedBytes||0)} reclaimed · ${result.deletedFiles||0} files`); cleanupPreview=null; renderCleanupPreview(); await refreshActivity(); }
    else if(!result?.canceled) toast('Cleanup not completed',result?.error||'No files were changed.');
    updateCleanupSelection();
  }

  function startSampling() {
    clearInterval(sampleTimer);
    // Yield one paint before asking the main process for telemetry.
    setTimeout(refreshLive, 80);
    sampleTimer = setInterval(refreshLive, intervalMs);
  }


  function processIoLabel(p) {
    const read = Number(p?.ioReadBps) || 0, write = Number(p?.ioWriteBps) || 0;
    if (p?.sampleReady === false) return 'Sampling…';
    if (read < 1024 && write < 1024) return 'Idle';
    return `${formatRate(read)} R · ${formatRate(write)} W`;
  }

  function filteredProcesses() {
    const q = ($('#processSearch')?.value || '').trim().toLowerCase();
    const list = Array.isArray(processSnapshot?.processes) ? processSnapshot.processes : [];
    if (!q) return list;
    return list.filter(p => String(p.name||'').toLowerCase().includes(q) || String(p.pid||'').includes(q) || String(p.path||'').toLowerCase().includes(q));
  }

  function renderProcesses() {
    const root = $('#processList'); if (!root) return;
    const list = filteredProcesses();
    const summary = processSnapshot?.summary || {};
    setText('#processCount', processSnapshot ? String(summary.count ?? list.length) : '--');
    setText('#processMemory', processSnapshot ? formatBytes(summary.totalMemoryBytes || 0) : '--');
    setText('#processSummary', processSnapshot ? `${Number(summary.protectedCount||0)} protected · query ${Number(summary.queryMs||0)} ms` : 'Open Process & Apps to scan');
    setText('#processManagerSubtitle', processSnapshot ? `${Number(summary.count||0)} running processes · refreshed ${new Date(processSnapshot.generatedAt).toLocaleTimeString()} · auto-refresh while visible` : 'Process telemetry loads only while this page is open.');
    if (!list.length) { root.innerHTML='<div class="empty">No processes match the current filter.</div>'; return; }
    root.innerHTML = list.slice(0,220).map(p=>{
      const cpu = Number(p.cpuPercent||0); const cpuLabel = p.sampleReady === false ? '…' : `${cpu.toFixed(cpu>=10?0:1)}%`; const io = processIoLabel(p); const protectedLabel = p.protected ? '<i class="process-protected">PROTECTED</i>' : '';
      const revealDisabled = p.canReveal ? '' : 'disabled'; const restartDisabled = p.canRestart ? '' : 'disabled'; const endDisabled = p.canTerminate ? '' : 'disabled';
      return `<div class="process-row" data-pid="${Number(p.pid)||0}"><div class="process-name"><strong title="${escapeHtml(p.path||'')}">${escapeHtml(p.name||'Unknown')}</strong><small>${escapeHtml(p.path||'Path unavailable')}</small>${protectedLabel}</div><b class="process-cpu">${cpuLabel}</b><span>${formatBytes(p.memoryBytes||0)}</span><span class="process-io">${escapeHtml(io)}</span><code>${Number(p.pid)||0}</code><div class="process-actions"><button data-process-action="reveal" ${revealDisabled}>Folder</button><button data-process-action="copy" ${p.path?'':'disabled'}>Copy path</button><button data-process-action="restart" ${restartDisabled}>Restart</button><button class="danger-link" data-process-action="end" ${endDisabled}>End</button></div></div>`;
    }).join('');
  }

  async function refreshProcesses(force=false) {
    if (!api.getProcesses) return;
    if (force) setText('#processManagerSubtitle','Refreshing running process telemetry…');
    try { processSnapshot = await api.getProcesses(force); } catch { processSnapshot = {processes:[],summary:{count:0},generatedAt:new Date().toISOString()}; }
    renderProcesses();
  }

  function filteredInstalledApps() {
    const q = ($('#appSearch')?.value || '').trim().toLowerCase();
    const list = Array.isArray(installedAppsSnapshot?.apps) ? installedAppsSnapshot.apps : [];
    if (!q) return list;
    return list.filter(a => [a.name,a.publisher,a.version,a.scope].some(v=>String(v||'').toLowerCase().includes(q)));
  }

  function renderInstalledApps() {
    const root=$('#installedAppList'); if(!root)return;
    const list=filteredInstalledApps(), summary=installedAppsSnapshot?.summary||{};
    setText('#installedAppCount', installedAppsSnapshot ? String(summary.count ?? list.length) : '--');
    setText('#installedAppSummary', installedAppsSnapshot ? `${formatBytes(summary.estimatedBytes||0)} estimated where Windows reports size` : 'Inventory loads on demand');
    setText('#installedAppsSubtitle', installedAppsSnapshot ? `${Number(summary.count||0)} installed applications detected · local registry inventory` : 'Installed applications are read from Windows uninstall registry keys, not Win32_Product.');
    if(!list.length){root.innerHTML='<div class="empty">No installed applications match the current filter.</div>';return;}
    root.innerHTML=list.slice(0,500).map(a=>`<div class="installed-app-row" data-app-index="${Number(a.id)}"><div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.scope||'Windows')} ${a.installDate?`· Installed ${escapeHtml(a.installDate)}`:''}</small></div><span>${escapeHtml(a.publisher||'Unknown')}</span><span>${escapeHtml(a.version||'—')}</span><b>${a.estimatedSizeBytes?formatBytes(a.estimatedSizeBytes):'—'}</b><div class="installed-app-actions"><button data-app-action="reveal">Location</button><button data-app-action="uninstall">Uninstall…</button></div></div>`).join('');
  }

  async function refreshInstalledApps(force=false){
    if(!api.getInstalledApps)return;
    if(force)setText('#installedAppsSubtitle','Refreshing Windows installed-app inventory…');
    try{installedAppsSnapshot=await api.getInstalledApps(force);}catch{installedAppsSnapshot={apps:[],summary:{count:0},generatedAt:new Date().toISOString()};}
    renderInstalledApps();
  }

  function renderAppsStartupItems(){
    const root=$('#appsStartupList'); if(!root)return;
    const items=Array.isArray(startupItems)?startupItems:[];
    setText('#appsStartupCount', String(items.length));
    const enabled=items.filter(i=>String(i.State||'').toLowerCase()==='enabled').length;
    setText('#appsStartupSummary', items.length ? `${enabled} enabled · manage state in Windows` : 'No startup entries detected');
    if(!items.length){root.innerHTML='<div class="empty">No startup entries detected.</div>';return;}
    root.innerHTML=items.map(item=>{const state=item.State||'Unknown',cls=state.toLowerCase()==='enabled'?'enabled':state.toLowerCase()==='disabled'?'disabled':'unknown';return `<div class="startup-row"><div><strong>${escapeHtml(item.Name||'Unnamed')}</strong><small>${escapeHtml(item.User||'Current system')}</small></div><span>${escapeHtml(item.Publisher||'Unknown')}</span><span><i class="startup-state ${cls}">${escapeHtml(state)}</i></span><span title="${escapeHtml(item.Location||'')}">${escapeHtml(item.Location||'Unknown')}</span><code title="${escapeHtml(item.Command||'')}">${escapeHtml(item.Command||'Unavailable')}</code></div>`;}).join('');
  }

  async function loadAppCenter(force=false){
    if(appCenterLoading)return;
    appCenterLoading=true;
    if(force||!appCenterLoaded){setText('#processManagerSubtitle','Loading process telemetry…');setText('#installedAppsSubtitle','Loading installed applications…');}
    try{
      await Promise.all([refreshProcesses(force),refreshInstalledApps(force),refreshStartup(force)]);
      renderAppsStartupItems(); appCenterLoaded=true;
    } finally { appCenterLoading=false; }
  }

  function stopAppCenterAutoRefresh(){ if(appCenterRefreshTimer){clearInterval(appCenterRefreshTimer);appCenterRefreshTimer=null;} }
  function startAppCenterAutoRefresh(){
    stopAppCenterAutoRefresh();
    appCenterRefreshTimer=setInterval(()=>{ if($('#view-apps')?.classList.contains('active') && !appCenterLoading) refreshProcesses(false); },2500);
  }


  function renderNetworkOverview() {
    const adapters = Array.isArray(networkOverview?.adapters) ? networkOverview.adapters : [];
    const summary = networkOverview?.summary || {};
    const active = summary.activeAdapter || adapters.find(a=>String(a.status).toLowerCase()==='up') || null;
    setText('#networkActiveAdapter', active?.name || '--');
    setText('#networkActiveLink', active ? `${active.linkSpeed || 'Link speed unavailable'} · ${active.description || 'Windows adapter'}` : 'No active adapter detected');
    setText('#networkLocalIp', active?.ipv4?.[0] || '--');
    setText('#networkProfileName', active ? `${active.profileName || 'Local network'}${active.networkCategory?` · ${active.networkCategory}`:''}` : 'Local address only');
    setText('#networkOverviewSubtitle', networkOverview ? `${Number(summary.activeCount||0)} active of ${Number(summary.adapterCount||adapters.length)} adapters · refreshed ${new Date(networkOverview.generatedAt).toLocaleTimeString()}` : 'Adapter inventory is lazy-loaded.');
    setText('#netDetailAdapter', active?.description || active?.name || '--');
    setText('#netDetailLink', active?.linkSpeed || '--');
    setText('#netDetailIpv4', active?.ipv4?.join(', ') || '--');
    setText('#netDetailGateway', active?.gateways?.join(', ') || '--');
    setText('#netDetailDns', active?.dnsServers?.join(', ') || '--');
    setText('#netDetailProfile', active ? [active.profileName,active.networkCategory,active.connectivity].filter(Boolean).join(' · ') || '--' : '--');
    const root=$('#networkAdapterList'); if(!root)return;
    if(!adapters.length){root.innerHTML='<div class="empty">Windows did not expose any network adapters.</div>';return;}
    root.innerHTML=adapters.map(a=>{
      const status=String(a.status||'Unknown'),up=status.toLowerCase()==='up';
      const addresses=[...(a.ipv4||[]),...(a.ipv6||[])].slice(0,4);
      const route=[...(a.gateways||[]).map(x=>`GW ${x}`),...(a.dnsServers||[]).slice(0,2).map(x=>`DNS ${x}`)];
      return `<div class="adapter-row"><div><strong>${escapeHtml(a.name||'Adapter')}</strong><small title="${escapeHtml(a.description||'')}">${escapeHtml(a.description||'Windows network adapter')}</small><code>${escapeHtml(a.macAddress||'MAC unavailable')}</code></div><span><i class="adapter-state ${up?'up':'down'}">${escapeHtml(status)}</i></span><b>${escapeHtml(a.linkSpeed||'--')}</b><span title="${escapeHtml(addresses.join(' · '))}">${escapeHtml(addresses.join(' · ')||'No address')}</span><span title="${escapeHtml(route.join(' · '))}">${escapeHtml(route.join(' · ')||'No gateway / DNS')}</span></div>`;
    }).join('');
  }

  function renderVpnCenter(){
    const state=vpnCenterState,summary=state?.summary||{},providers=Array.isArray(state?.providers)?state.providers:[];
    setText('#vpnSupportedCount',String(summary.providerCount??2));
    setText('#vpnInstalledCount',state?String(summary.installedCount||0):'--');
    setText('#vpnRunningCount',state?String(summary.runningCount||0):'--');
    setText('#vpnConnectedCount',state?String(summary.connectedCount||0):'--');
    setText('#vpnCenterSubtitle',state?`${Number(summary.connectedCount||0)} connected · ${Number(summary.runningCount||0)} running · refreshed ${new Date(state.generatedAt).toLocaleTimeString()}`:'NordVPN and ExpressVPN detection is lazy-loaded with Network PowerTools.');
    const root=$('#vpnProviderGrid');if(!root)return;
    if(!providers.length){root.innerHTML='<div class="empty">Supported VPN clients could not be detected on this platform.</div>';return;}
    root.innerHTML=providers.map(provider=>{
      const cls=provider.connected?'connected':provider.running?'running':provider.installed?'ready':'missing';
      const mark=provider.id==='nordvpn'?'N':'E';
      const statusDetail=provider.connected?`Tunnel: ${provider.adapterName||'Active VPN adapter'}`:provider.running?'Client is open; no active provider tunnel detected.':provider.installed?'Client is installed and ready.':'Client is not installed on this PC.';
      const mainAction=provider.installed?`<button class="secondary-btn" data-vpn-provider="${escapeHtml(provider.id)}" data-vpn-action="launch" ${provider.launchAvailable?'':'disabled'}>Open App</button>`:`<button class="primary-btn" data-vpn-provider="${escapeHtml(provider.id)}" data-vpn-action="install">Get ${escapeHtml(provider.name)}</button>`;
      const controls=provider.installed?`<button class="primary-btn" data-vpn-provider="${escapeHtml(provider.id)}" data-vpn-action="connect" ${provider.cliAvailable?'':'disabled'}>Quick Connect</button><button class="secondary-btn danger-soft" data-vpn-provider="${escapeHtml(provider.id)}" data-vpn-action="disconnect" ${provider.cliAvailable?'':'disabled'}>Disconnect</button>`:'';
      const cliNote=provider.cliAvailable?(provider.requiresElevation?'CLI ready · UAC required for control':'CLI ready'):'Open the provider app to connect or disconnect';
      return `<article class="vpn-provider-card ${cls}"><div class="vpn-provider-head"><div class="vpn-provider-mark">${mark}</div><div><strong>${escapeHtml(provider.name)}</strong><small>${escapeHtml(statusDetail)}</small></div><span class="vpn-state-chip">${escapeHtml(provider.state||'Unknown')}</span></div><div class="vpn-provider-meta"><span>${provider.installed?'INSTALLED':'NOT INSTALLED'}</span><span>${escapeHtml(cliNote)}</span><span>Credentials stay in ${escapeHtml(provider.name)}</span></div><div class="vpn-provider-actions">${mainAction}${controls}</div></article>`;
    }).join('');
  }

  async function loadVpnCenter(force=false){
    if(vpnCenterLoading)return;
    vpnCenterLoading=true;setText('#vpnCenterSubtitle','Detecting NordVPN and ExpressVPN locally…');
    try{vpnCenterState=await api.getVpnCenter?.(force);renderVpnCenter();}
    catch(error){vpnCenterState=null;renderVpnCenter();setText('#vpnCenterSubtitle','VPN client inventory could not be loaded.');}
    finally{vpnCenterLoading=false;}
  }

  async function runVpnProviderAction(providerId,action,button){
    if(button)button.disabled=true;
    let result;try{result=await api.vpnProviderAction?.(providerId,action);}catch(error){result={ok:false,error:String(error?.message||error||'VPN action failed')}}
    if(button)button.disabled=false;
    if(result?.canceled)return;
    const provider=vpnCenterState?.providers?.find(x=>x.id===providerId);const name=provider?.name||'VPN client';
    if(!result?.ok){toast(demoMode?'Desktop-only VPN control':`${name} action unavailable`,result?.error||'The provider client rejected the request.');return;}
    toast(action==='launch'?`${name} opened`:action==='install'?`${name} setup opened`:`${name} ${action} requested`,result?.detail||'');
    if(['connect','disconnect','launch'].includes(action)){await new Promise(resolve=>setTimeout(resolve,1200));await loadVpnCenter(true);}
    await refreshActivity();
  }

  async function loadNetworkCenter(force=false){
    if(networkLoading)return;
    if(networkLoaded&&!force){renderNetworkOverview();return;}
    networkLoading=true; setText('#networkOverviewSubtitle','Loading Windows adapter inventory…');
    if(!ipGeoStatus)loadIpGeoStatus();
    if(!vpnCenterState||force)loadVpnCenter(force);
    try{networkOverview=await api.getNetworkOverview(force);networkLoaded=true;renderNetworkOverview();}
    catch{networkOverview=null;renderNetworkOverview();setText('#networkOverviewSubtitle','Network inventory could not be loaded.');}
    finally{networkLoading=false;}
  }

  function renderNetworkLive(){
    const rx=Math.max(0,Number(live.networkRxBps)||0),tx=Math.max(0,Number(live.networkTxBps)||0);
    networkPeakRx=Math.max(networkPeakRx,rx); networkPeakTx=Math.max(networkPeakTx,tx);
    setText('#networkCurrentDown',formatNetworkRate(rx)); setText('#networkCurrentUp',formatNetworkRate(tx));
    setText('#networkPeakDown',`Session peak ${formatNetworkRate(networkPeakRx)}`); setText('#networkPeakUp',`Session peak ${formatNetworkRate(networkPeakTx)}`);
    setText('#networkTrafficNow',`${formatNetworkRate(rx)} down · ${formatNetworkRate(tx)} up`);
  }

  function showDiagnosticResult(title, lines, raw=''){
    const root=$('#networkDiagnosticResult');if(!root)return;
    root.innerHTML=`<div class="diagnostic-result-card"><strong>${escapeHtml(title)}</strong>${(lines||[]).map(x=>`<span>${escapeHtml(x)}</span>`).join('')}${raw?`<pre>${escapeHtml(String(raw).slice(0,5000))}</pre>`:''}</div>`;
  }

  async function runNetworkPing(){
    const target=($('#networkTarget')?.value||'').trim(); if(!target){toast('Enter a target','Use a hostname or IP address.');return;}
    const btn=$('#runPing');if(btn)btn.disabled=true;showDiagnosticResult('Ping running…',[target]);
    let r;try{r=await api.networkPing(target);}catch{r={ok:false,error:'Ping failed'};}if(btn)btn.disabled=false;
    if(!r?.ok){showDiagnosticResult('Ping failed',[r?.error||'No replies received'],r?.raw||'');return;}
    showDiagnosticResult(`Ping · ${r.target}`,[`Average: ${finite(r.averageMs)?`${r.averageMs} ms`:'unavailable'}`,`Packet loss: ${finite(r.packetLossPercent)?`${r.packetLossPercent}%`:'unavailable'}`,`Replies: ${Number(r.replies||0)}`],r.raw||''); await refreshActivity();
  }

  async function runNetworkDns(){
    const target=($('#networkTarget')?.value||'').trim();if(!target){toast('Enter a target','Use a hostname or IP address.');return;}
    const btn=$('#runDnsLookup');if(btn)btn.disabled=true;showDiagnosticResult('DNS lookup running…',[target]);
    let r;try{r=await api.networkDnsLookup(target);}catch{r={ok:false,error:'DNS lookup failed'};}if(btn)btn.disabled=false;
    if(!r?.ok){showDiagnosticResult('DNS lookup failed',[r?.error||'No DNS answer received'],r?.raw||'');return;}
    showDiagnosticResult(`DNS · ${r.target}`,[r.addresses?.length?`Addresses: ${r.addresses.join(', ')}`:'Lookup completed'],r.raw||''); await refreshActivity();
  }

  async function runConnectivity(){
    const btn=$('#runConnectivityTest');if(btn){btn.disabled=true;btn.textContent='Testing…';}
    setText('#connectivityDns','Testing…');setText('#connectivityHttps','Testing…');setText('#connectivityGateway','Testing…');
    let r;try{r=await api.networkConnectivityTest();}catch{r={ok:false,error:'Connectivity test failed'};}if(btn){btn.disabled=false;btn.textContent='Test Internet';}
    if(r?.error){setText('#connectivityDns','Unavailable');setText('#connectivityHttps','Unavailable');setText('#connectivityGateway','Unavailable');showDiagnosticResult('Connectivity test failed',[r.error]);return;}
    setText('#connectivityDns',r.dnsOk?'Passed':'Failed');setText('#connectivityHttps',r.tcp443?'Passed':'Failed');setText('#connectivityGateway',r.gateway?`${r.gateway}${finite(r.gatewayPingMs)?` · ${r.gatewayPingMs} ms`:''}`:'Unavailable');
    showDiagnosticResult(r.ok?'Internet connectivity passed':'Connectivity needs attention',[`DNS: ${r.dnsOk?'Passed':'Failed'}${r.dnsAddress?` · ${r.dnsAddress}`:''}`,`HTTPS 443: ${r.tcp443?'Passed':'Failed'}`,`Gateway: ${r.gateway||'Unavailable'}${finite(r.gatewayPingMs)?` · ${r.gatewayPingMs} ms`:''}`]); await refreshActivity();
  }


  function countryLabel(code){
    const c=String(code||'').toUpperCase(); if(!c)return '--';
    try{const dn=new Intl.DisplayNames([navigator.language||'en'],{type:'region'});return `${dn.of(c)||c} (${c})`;}catch{return c;}
  }
  function renderIpGeoStatus(){
    const chip=$('#ipGeoProviderStatus'); if(chip){chip.textContent=ipGeoStatus?.configured?'Configured':'Not configured';chip.classList.toggle('active',Boolean(ipGeoStatus?.configured));}
    const cfg=$('#ipGeoConfigure');if(cfg)cfg.textContent=ipGeoStatus?.configured?'API Settings':'Configure API';
    const privacy=$('#ipGeoPrivacyNote');if(privacy)privacy.textContent=ipGeoStatus?.configured
      ? 'Geo IPify is contacted only when you press Locate IP. The stored API key stays encrypted in the desktop main process. Lookup results and your public IP are excluded from exported PowerTools reports and System-Aware AI context.'
      : 'Geo IPify is contacted only when you press Locate IP. Configure your own API key first. IP geolocation is approximate and should not be treated as a physical address.';
  }
  function renderIpGeoResult(){
    const r=ipGeoResult;if(!r){setText('#ipGeoIp','--');setText('#ipGeoLocation','Not looked up');setText('#ipGeoCountry','--');setText('#ipGeoTimezone','--');setText('#ipGeoIsp','--');setText('#ipGeoAsn','--');setText('#ipGeoRoute','--');setText('#ipGeoCoordinates','--');return;}
    setText('#ipGeoIp',r.ip||'--');
    setText('#ipGeoLocation',[r.city,r.region,r.postalCode].filter(Boolean).join(', ')||'Location unavailable');
    setText('#ipGeoCountry',countryLabel(r.country));setText('#ipGeoTimezone',r.timezone||'--');
    setText('#ipGeoIsp',r.isp||r.asName||'--');setText('#ipGeoAsn',r.asn?`AS${r.asn}${r.asName?` · ${r.asName}`:''}`:'--');setText('#ipGeoRoute',r.route||'--');
    const coords=finite(r.latitude)&&finite(r.longitude)?`${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`:'--';setText('#ipGeoCoordinates',coords);
    $('#ipGeoIp')?.classList.add('geo-primary');
  }
  async function loadIpGeoStatus(){
    try{ipGeoStatus=await api.getIpGeolocationStatus?.();}catch{ipGeoStatus={configured:false,encryptionAvailable:false};}renderIpGeoStatus();
  }
  function openIpGeoConfiguration(){
    const configured=Boolean(ipGeoStatus?.configured);const secure=ipGeoStatus?.encryptionAvailable!==false;
    openModal('Geo IPify Configuration',`<div class="ipgeo-key-dialog"><p>Add your own Geo IPify API key to enable on-demand public IP geolocation inside Network PowerTools.</p><div class="ipgeo-key-note">The key is encrypted by the Electron main process using Windows-backed secure storage. It is never returned to the renderer, exported in reports, or included in AI context. Geo IPify receives the IP being looked up only when you explicitly press Locate IP. The Country + City endpoint uses provider credits for each lookup.</div><label><span>GEO IPIFY API KEY</span><input id="ipGeoKeyInput" type="password" autocomplete="new-password" placeholder="Paste Geo IPify API key" ${secure?'':'disabled'} /></label><div class="ipgeo-key-actions"><button class="secondary-btn" id="ipGeoOpenWebsite" type="button">Open Geo IPify</button>${configured?'<button class="secondary-btn" id="ipGeoRemoveKey" type="button">Remove Key</button>':''}<button class="secondary-btn" id="ipGeoKeyCancel" type="button">Cancel</button><button class="primary-btn" id="ipGeoKeySave" type="button" ${secure?'':'disabled'}>Save Key</button></div><div class="ipgeo-key-status" id="ipGeoKeyStatus">${secure?(configured?'A Geo IPify key is already stored securely.':'No Geo IPify key is stored yet.'):'Secure storage is unavailable; PowerTools will not store the key as plaintext.'}</div></div>`,'IP GEOLOCATION');
    $('#ipGeoKeyCancel')?.addEventListener('click',closeModal);
    $('#ipGeoOpenWebsite')?.addEventListener('click',async()=>{const out=await api.openGeoIpify?.();if(!out?.ok&&demoMode)toast('Desktop-only link');});
    $('#ipGeoKeySave')?.addEventListener('click',async()=>{const key=($('#ipGeoKeyInput')?.value||'').trim();if(!key){setText('#ipGeoKeyStatus','Enter your Geo IPify API key first.');return;}const btn=$('#ipGeoKeySave');if(btn)btn.disabled=true;setText('#ipGeoKeyStatus','Encrypting key…');const out=await api.saveIpGeolocationKey?.(key);if(!out?.ok){setText('#ipGeoKeyStatus',out?.error||'Unable to save API key.');if(btn)btn.disabled=false;return;}ipGeoStatus=out.status||null;closeModal();renderIpGeoStatus();toast('Geo IPify configured','IP geolocation is ready for manual lookups.');});
    $('#ipGeoRemoveKey')?.addEventListener('click',async()=>{const out=await api.removeIpGeolocationKey?.();if(out?.ok){ipGeoStatus=out.status||{configured:false};ipGeoResult=null;closeModal();renderIpGeoStatus();renderIpGeoResult();toast('Geo IPify key removed');}else setText('#ipGeoKeyStatus',out?.error||'Unable to remove key.');});
    setTimeout(()=>$('#ipGeoKeyInput')?.focus(),30);
  }
  async function runIpGeolocation(){
    if(ipGeoBusy)return;const input=($('#ipGeoAddress')?.value||'').trim();const btn=$('#ipGeoLookup');ipGeoBusy=true;if(btn){btn.disabled=true;btn.textContent='Locating…';}
    if(!ipGeoStatus)await loadIpGeoStatus();
    if(!ipGeoStatus?.configured){ipGeoBusy=false;if(btn){btn.disabled=false;btn.textContent='Locate IP';}openIpGeoConfiguration();return;}
    try{const out=await api.lookupIpGeolocation?.(input);if(!out?.ok){if(out?.needsConfiguration){ipGeoStatus=out.status||{configured:false};renderIpGeoStatus();openIpGeoConfiguration();}else toast('IP geolocation failed',out?.error||'Geo IPify did not return a location.');return;}ipGeoResult=out;renderIpGeoResult();toast('IP located',`${out.city||out.region||out.country||'Location returned'} · ${out.ip||'public IP'}`);}catch(error){toast('IP geolocation failed',String(error?.message||error));}finally{ipGeoBusy=false;if(btn){btn.disabled=false;btn.textContent='Locate IP';}}
  }


  function privacyRiskLabel(score){const n=Math.max(0,Math.min(100,Number(score)||0));return n>=60?'High':n>=20?'Moderate':n>0?'Low':'Low';}
  function renderPrivacySummary(){
    const score=Math.max(0,Math.min(100,Number(privacyMetadataResult?.score)||0));const label=privacyRiskLabel(score);
    setText('#privacyRiskScore',`${score} / 100`);setText('#privacyRiskDetail',privacyMetadataResult?`${label} metadata exposure heuristic for the selected file`:'No risky metadata findings this session');
    setText('#privacyMetadataStatus',privacyMetadataResult?(privacyMetadataResult.risk||label):'Not scanned');setText('#privacyMetadataDetail',privacyMetadataResult?`${privacyMetadataResult.name||'Selected file'} · ${Object.values(privacyMetadataResult.signals||{}).filter(Boolean).length} signal(s)`:'Select a file to inspect locally');
    setText('#privacyTrustStatus',privacyTrustResult?(privacyTrustResult.assessment?.verdict||'Reviewed'):'Not scanned');setText('#privacyTrustDetail',privacyTrustResult?`${privacyTrustResult.signature?.status||'Unknown signature'} · ${privacyTrustResult.assessment?.score??0}/100 confidence`:'Select a local app or installed application');
    setText('#privacyAppInventoryStatus',privacyAppInventory?`${privacyAppInventory.summary?.publisherCoverage??0}% publishers`:'Not loaded');setText('#privacyAppInventoryDetail',privacyAppInventory?`${privacyAppInventory.summary?.withPublisher||0}/${privacyAppInventory.summary?.count||0} apps declare a publisher`:'Publisher inventory is manual and on-demand');
    setText('#privacyDnsStatus',privacyDnsResult?'Checked':'Idle');setText('#privacyDnsDetail',privacyDnsResult?`${privacyDnsResult.domain||'Domain'} · on-demand DNS only`:'Manual DNS inspection only');
    const chip=$('#privacyDnsChip');if(chip){chip.textContent=privacyDnsResult?'Checked':'Idle';chip.classList.toggle('active',Boolean(privacyDnsResult));}
    const trustChip=$('#privacyTrustChip');if(trustChip){trustChip.textContent=privacyTrustResult?(privacyTrustResult.assessment?.verdict||'Reviewed'):'Idle';trustChip.classList.toggle('active',privacyTrustResult?.assessment?.tone==='trusted');}
  }
  function renderPrivacyTrust(){
    const root=$('#privacyTrustResult');if(!root)return;const r=privacyTrustResult;
    if(!r){root.innerHTML='<div class="empty">No app inspected yet. A valid signature raises confidence; an unsigned file is a review signal, not proof of malware.</div>';renderPrivacySummary();return;}
    const a=r.assessment||{};const sig=r.signature||{};const info=r.fileInfo||{};const origin=r.origin||{};const tone=a.tone==='trusted'?'trusted':a.tone==='warning'?'warning':'review';
    const signer=sig.signer||info.companyName||'Not available'; const hash=String(r.sha256||'');
    root.innerHTML=`<div class="app-trust-head"><div><strong>${escapeHtml(r.name||'Selected app')}</strong><small>${escapeHtml((r.extension||'file').toUpperCase())} · ${formatBytes(r.sizeBytes||0)} · ${escapeHtml(r.source||'Local scan')}</small></div><span class="app-trust-score ${tone}">${escapeHtml(a.verdict||'Review')} · ${Number(a.score)||0}/100</span></div><div class="app-trust-signal-grid"><div><span>AUTHENTICODE</span><strong>${escapeHtml(sig.status||'Unknown')}</strong><small>${escapeHtml(sig.message||'Windows signature status')}</small></div><div><span>SIGNER</span><strong>${escapeHtml(signer)}</strong><small>${escapeHtml(sig.issuer?`Issuer: ${sig.issuer}`:'Certificate issuer unavailable')}</small></div><div><span>SHA-256</span><strong class="app-trust-hash">${escapeHtml(hash||'Unavailable')}</strong><small>Calculated locally from the selected file</small></div><div><span>WINDOWS ORIGIN</span><strong>${escapeHtml(origin.zoneLabel||'Unknown')}</strong><small>${escapeHtml(origin.locationClass||'Local file')}</small></div><div><span>PRODUCT</span><strong>${escapeHtml(info.productName||r.name||'Unknown')}</strong><small>${escapeHtml(info.fileVersion||'Version unavailable')}</small></div><div><span>COMPANY METADATA</span><strong>${escapeHtml(info.companyName||'Unavailable')}</strong><small>File version metadata; not a signature guarantee</small></div></div><div class="app-trust-reasons">${(a.reasons||[]).map(x=>`<div>• ${escapeHtml(x)}</div>`).join('')}</div>${hash?`<div class="app-trust-reputation"><button class="secondary-btn" type="button" data-trust-reputation="${escapeHtml(hash)}">Open SHA-256 on VirusTotal</button><small>This opens an external website and sends the hash only. PowerTools does not upload the selected file.</small></div>`:''}`;
    renderPrivacySummary();
  }
  async function scanPrivacyAppTrustFile(){
    if(privacyTrustBusy)return;privacyTrustBusy=true;const btn=$('#privacyTrustSelectFile');if(btn){btn.disabled=true;btn.textContent='Inspecting…';}
    try{const out=await api.privacySelectAppTrustFile?.();if(out?.canceled)return;if(!out?.ok){toast('App Trust scan failed',out?.error||'Unable to inspect that file.');return;}privacyTrustResult=out;renderPrivacyTrust();toast('App Trust scan complete',`${out.assessment?.verdict||'Reviewed'} · ${out.signature?.status||'Unknown signature'}`);await refreshActivity();}
    catch(error){toast('App Trust scan failed',String(error?.message||error));}finally{privacyTrustBusy=false;if(btn){btn.disabled=false;btn.textContent='Select App / Package';}}
  }
  function renderPrivacyAppInventory(){
    const root=$('#privacyAppList');if(!root)return;const state=privacyAppInventory;
    if(!state){root.innerHTML='<div class="empty">Load the installed-app inventory when you want to review publisher coverage.</div>';setText('#privacyAppCoverage','Inventory not loaded');renderPrivacySummary();return;}
    const q=($('#privacyAppSearch')?.value||'').trim().toLowerCase();const apps=(state.apps||[]).filter(a=>!q||`${a.name} ${a.publisher} ${a.version}`.toLowerCase().includes(q));
    setText('#privacyAppCoverage',`${state.summary?.publisherCoverage??0}% publisher coverage · ${state.summary?.inspectable||0} app entry files inspectable`);
    root.innerHTML=apps.length?apps.slice(0,250).map(a=>`<div class="app-trust-app-row"><div class="app-trust-app-icon">${a.publisher?'✓':'?'}</div><div class="app-trust-app-copy"><strong>${escapeHtml(a.name||'Unnamed application')}</strong><small>${escapeHtml(a.publisher||'Publisher unavailable')} · ${escapeHtml(a.version||'Version unavailable')} · ${escapeHtml(a.scope||'Unknown scope')}</small></div><span class="app-trust-publisher ${a.publisher?'declared':'missing'}">${a.publisher?'PUBLISHER':'REVIEW'}</span>${a.inspectable?`<button class="small-btn" type="button" data-trust-installed="${Number(a.id)}">Inspect</button>`:'<span class="app-trust-noentry">No entry file</span>'}</div>`).join(''):'<div class="empty">No installed applications match that search.</div>';
    renderPrivacySummary();
  }
  async function loadPrivacyAppInventory(force=false){
    const btn=$('#privacyAppInventoryRefresh');if(btn){btn.disabled=true;btn.textContent='Loading…';}
    try{const out=await api.privacyGetAppTrustInventory?.(force);if(!out?.ok){toast('App inventory unavailable',out?.error||'Windows did not return an installed-app inventory.');return;}privacyAppInventory=out;renderPrivacyAppInventory();toast('App inventory loaded',`${out.summary?.count||0} applications · ${out.summary?.publisherCoverage??0}% publisher coverage`);}
    catch(error){toast('App inventory unavailable',String(error?.message||error));}finally{if(btn){btn.disabled=false;btn.textContent='Refresh Apps';}}
  }
  async function inspectPrivacyInstalledApp(index){
    if(privacyTrustBusy)return;privacyTrustBusy=true;try{const out=await api.privacyInspectInstalledApp?.(Number(index));if(!out?.ok){toast('Installed app scan unavailable',out?.error||'No app entry file was available.');return;}privacyTrustResult=out;renderPrivacyTrust();$('#privacyTrustResult')?.scrollIntoView?.({behavior:'smooth',block:'center'});toast('Installed app inspected',`${out.assessment?.verdict||'Reviewed'} · ${out.signature?.status||'Unknown signature'}`);await refreshActivity();}catch(error){toast('Installed app scan failed',String(error?.message||error));}finally{privacyTrustBusy=false;}
  }
  function renderPrivacyProtection(){
    const root=$('#privacyProtectionResult');if(!root)return;const r=privacyProtectionStatus;if(!r){root.innerHTML='<div class="empty">Not checked. This does not change Windows settings.</div>';return;}
    const smart=r.smartScreen||{}, sac=r.smartAppControl||{};const sm=smart.explorer||'Unavailable';
    root.innerHTML=`<div class="app-protection-grid"><div><span>SMARTSCREEN</span><strong>${escapeHtml(sm)}</strong><small>Explorer reputation check</small></div><div><span>WEB CONTENT</span><strong>${smart.appHostEnabled===true?'On':smart.appHostEnabled===false?'Off':'Unavailable'}</strong><small>Windows AppHost evaluation</small></div><div><span>SMART APP CONTROL</span><strong>${escapeHtml(sac.label||'Unavailable')}</strong><small>Reported Windows policy state</small></div></div><div class="app-protection-note">Read-only status. PowerTools does not enable, disable, or bypass Windows reputation controls from this panel.</div>`;
  }
  async function loadPrivacyProtection(){
    const btn=$('#privacyProtectionRefresh');if(btn){btn.disabled=true;btn.textContent='Checking…';}
    try{const out=await api.privacyGetAppProtectionStatus?.();if(!out?.ok){toast('Windows trust status unavailable',out?.error||'Unable to read the Windows reputation state.');return;}privacyProtectionStatus=out;renderPrivacyProtection();toast('Windows app protection checked');await refreshActivity();}catch(error){toast('Windows trust status unavailable',String(error?.message||error));}finally{if(btn){btn.disabled=false;btn.textContent='Check Windows Trust';}}
  }
  function buildPrivacyProfiles(){
    const username=($('#privacyUsername')?.value||'').trim();const root=$('#privacyProfileResults');if(!root)return;
    if(!/^[A-Za-z0-9._-]{1,64}$/.test(username)){root.innerHTML='<div class="empty">Use 1–64 letters, numbers, dots, underscores, or hyphens.</div>';return;}
    const items=[['github','GitHub'],['reddit','Reddit'],['youtube','YouTube'],['tiktok','TikTok'],['instagram','Instagram']];
    root.innerHTML=items.map(([id,label])=>`<button class="privacy-profile-link" type="button" data-privacy-profile="${id}" data-privacy-username="${escapeHtml(username)}"><strong>${label}</strong><small>${escapeHtml(username)}</small></button>`).join('');
  }
  function privacyDnsText(value){if(Array.isArray(value))return value.length?value.join('\n'):'None found';return value?String(value):'None found';}
  function renderPrivacyDns(){
    const root=$('#privacyDnsResults');if(!root)return;const r=privacyDnsResult;if(!r){root.innerHTML='<div class="empty">No domain inspected yet.</div>';renderPrivacySummary();return;}
    const rec=r.records||{};const mx=(rec.mx||[]).map(x=>`${x.priority??0} ${x.exchange||''}`.trim());
    const cards=[['A',rec.a],['AAAA',rec.aaaa],['MX',mx],['NS',rec.ns],['TXT',rec.txt]];
    root.innerHTML=`<div class="privacy-dns-grid">${cards.map(([label,value])=>`<div class="privacy-dns-record"><span>${label}</span><strong>${Array.isArray(value)?value.length:0} record(s)</strong><small>${escapeHtml(privacyDnsText(value))}</small></div>`).join('')}</div>`;
    renderPrivacySummary();
  }
  async function inspectPrivacyDns(){
    const domain=($('#privacyDomain')?.value||'').trim();if(!domain){toast('Enter a domain','Example: example.com');return;}const btn=$('#privacyInspectDomain');if(btn){btn.disabled=true;btn.textContent='Inspecting…';}
    try{const out=await api.privacyDnsInspect?.(domain);if(!out?.ok){toast('DNS inspection failed',out?.error||'No DNS result returned.');return;}privacyDnsResult=out;renderPrivacyDns();toast('DNS inspection complete',out.domain||domain);await refreshActivity();}
    catch(error){toast('DNS inspection failed',String(error?.message||error));}finally{if(btn){btn.disabled=false;btn.textContent='Inspect DNS';}}
  }
  function renderPrivacyMetadata(){
    const root=$('#privacyMetadataResult');if(!root)return;const r=privacyMetadataResult;if(!r){root.innerHTML='<div class="empty">No file selected. File paths are never returned to the renderer or included in PowerTools reports.</div>';renderPrivacySummary();return;}
    const signals=r.signals||{};const list=[['GPS coordinates','gps'],['EXIF container','exif'],['Author / creator','author'],['Comments / description','comments'],['XMP packet','xmp'],['Copyright','copyright']];const level=privacyRiskLabel(r.score).toLowerCase();
    root.innerHTML=`<div class="privacy-meta-head"><div><strong>${escapeHtml(r.name||'Selected file')}</strong><small>${escapeHtml((r.extension||'file').toUpperCase())} · ${formatBytes(r.sizeBytes||0)}${r.partial?' · prefix scan':''}</small></div><span class="privacy-risk-badge ${level==='moderate'?'moderate':level==='high'?'high':''}">${escapeHtml(r.risk||privacyRiskLabel(r.score))}</span></div><div class="privacy-signal-grid">${list.map(([label,key])=>`<div class="privacy-signal ${signals[key]?'found':''}">${signals[key]?'Found':'Not found'} · ${label}</div>`).join('')}</div>`;
    renderPrivacySummary();
  }
  async function inspectPrivacyFile(){
    const btn=$('#privacyInspectFile');if(btn){btn.disabled=true;btn.textContent='Inspecting…';}
    try{const out=await api.privacyInspectFile?.();if(out?.canceled)return;if(!out?.ok){toast('Metadata inspection failed',out?.error||'Unable to inspect that file.');return;}privacyMetadataResult=out;renderPrivacyMetadata();toast('Metadata inspection complete',`${out.risk||'Result'} · ${out.name||'selected file'}`);await refreshActivity();}
    catch(error){toast('Metadata inspection failed',String(error?.message||error));}finally{if(btn){btn.disabled=false;btn.textContent='Select File';}}
  }
  async function openPrivacyHibp(){
    const email=($('#privacyEmail')?.value||'').trim();const state=$('#privacyEmailState');const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if(!valid){if(state)state.innerHTML='<strong>Invalid email</strong><small>Enter a normal email address first. It will not be sent by PowerTools.</small>';return;}
    if(state)state.innerHTML='<strong>Validated locally</strong><small>Opening Have I Been Pwned without inserting your email into the URL. Enter it manually on the site.</small>';
    const out=await api.privacyOpenResource?.('hibp');if(!out?.ok&&demoMode)toast('Desktop-only link');
  }
  function clearPrivacySession(){
    privacyDnsResult=null;privacyMetadataResult=null;privacyTrustResult=null;privacyAppInventory=null;privacyProtectionStatus=null;['#privacyUsername','#privacyEmail','#privacyDomain','#privacyAppSearch'].forEach(id=>{const el=$(id);if(el)el.value='';});
    const profiles=$('#privacyProfileResults');if(profiles)profiles.innerHTML='<div class="empty">Enter a username to build public profile shortcuts for GitHub, Reddit, YouTube, TikTok, and Instagram.</div>';
    const email=$('#privacyEmailState');if(email)email.innerHTML='<strong>Not checked</strong><small>Your email stays in this renderer session and is not inserted into an external URL.</small>';
    renderPrivacyDns();renderPrivacyMetadata();renderPrivacyTrust();renderPrivacyAppInventory();renderPrivacyProtection();renderPrivacySummary();toast('Privacy session cleared','Identifiers and findings were cleared from the UI.');
  }


  function automationTriggerSummary(rule){
    const t=rule?.trigger||{};
    if(t.type==='cpuAbove')return `CPU > ${t.threshold}% for ${t.durationSec}s`;
    if(t.type==='gpuAbove')return `GPU > ${t.threshold}% for ${t.durationSec}s`;
    if(t.type==='ramAbove')return `RAM > ${t.threshold}% for ${t.durationSec}s`;
    if(t.type==='diskFreeBelow')return `System drive free < ${t.threshold}% for ${t.durationSec}s`;
    if(t.type==='processStarted')return `${t.processName}.exe starts`;
    if(t.type==='processStopped')return `${t.processName}.exe closes`;
    if(t.type==='networkDisconnected')return `Network disconnected for ${t.durationSec}s`;
    if(t.type==='batteryBelow')return `Battery < ${t.threshold}% for ${t.durationSec}s`;
    if(t.type==='dailyTime')return `Daily at ${t.time}`;
    if(t.type==='systemStartup')return 'PowerTools startup (next launch)';
    return 'Unknown trigger';
  }
  function automationActionSummary(rule){
    const a=rule?.action||{};
    if(a.type==='notification')return `Notification${a.message?` · ${a.message}`:''}`;
    if(a.type==='activity')return `Activity log${a.message?` · ${a.message}`:''}`;
    if(a.type==='profile')return `Performance profile · ${a.profile}`;
    if(a.type==='navigate')return `Open PowerTools · ${a.view}`;
    if(a.type==='windowsTool')return `Open Windows · ${a.target}`;
    return 'Unknown action';
  }
  function formatAutomationSchedule(iso){
    if(!iso)return 'None'; const d=new Date(iso); if(Number.isNaN(d.getTime()))return 'None';
    return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+(d.toDateString()!==new Date().toDateString()?` · ${d.toLocaleDateString([],{month:'short',day:'numeric'})}`:'');
  }
  function renderAutomationTriggerConfig(trigger=null){
    const type=$('#automationTriggerType')?.value||trigger?.type||'cpuAbove'; const box=$('#automationTriggerConfig'); if(!box)return;
    const t=trigger||{};
    if(['cpuAbove','gpuAbove','ramAbove'].includes(type)) box.innerHTML=`<label class="automation-field"><span>THRESHOLD</span><div class="automation-inline-input"><input id="automationThreshold" type="number" min="1" max="100" value="${Number(t.threshold)||85}"/><em>%</em></div></label><label class="automation-field"><span>FOR</span><div class="automation-inline-input"><input id="automationDuration" type="number" min="0" max="900" value="${Number.isFinite(Number(t.durationSec))?Number(t.durationSec):15}"/><em>seconds</em></div></label>`;
    else if(type==='diskFreeBelow') box.innerHTML=`<label class="automation-field"><span>FREE SPACE BELOW</span><div class="automation-inline-input"><input id="automationThreshold" type="number" min="1" max="99" value="${Number(t.threshold)||10}"/><em>% free</em></div></label><label class="automation-field"><span>FOR</span><div class="automation-inline-input"><input id="automationDuration" type="number" min="0" max="900" value="${Number.isFinite(Number(t.durationSec))?Number(t.durationSec):30}"/><em>seconds</em></div></label>`;
    else if(['processStarted','processStopped'].includes(type)) box.innerHTML=`<label class="automation-field span-2"><span>PROCESS / APP NAME</span><input id="automationProcessName" maxlength="120" value="${escapeHtml(t.processName||'')}" placeholder="Example: Discord or chrome.exe"/><small>Process name only; paths and command lines are not executed.</small></label>`;
    else if(type==='networkDisconnected') box.innerHTML=`<label class="automation-field span-2"><span>DISCONNECTED FOR</span><div class="automation-inline-input"><input id="automationDuration" type="number" min="0" max="300" value="${Number.isFinite(Number(t.durationSec))?Number(t.durationSec):10}"/><em>seconds</em></div><small>Uses local adapter state; no Internet probing.</small></label>`;
    else if(type==='batteryBelow') box.innerHTML=`<label class="automation-field"><span>BATTERY BELOW</span><div class="automation-inline-input"><input id="automationThreshold" type="number" min="1" max="100" value="${Number(t.threshold)||20}"/><em>%</em></div></label><label class="automation-field"><span>FOR</span><div class="automation-inline-input"><input id="automationDuration" type="number" min="0" max="900" value="${Number.isFinite(Number(t.durationSec))?Number(t.durationSec):30}"/><em>seconds</em></div></label>`;
    else if(type==='dailyTime') box.innerHTML=`<label class="automation-field span-2"><span>LOCAL TIME</span><input id="automationDailyTime" type="time" value="${escapeHtml(t.time||'09:00')}"/><small>Runs once per day at this PC's local time.</small></label>`;
    else box.innerHTML=`<div class="automation-config-message"><strong>Next PowerTools launch</strong><small>This trigger fires once after the next application start. A startup rule created during the current session waits until the next launch.</small></div>`;
  }
  function renderAutomationActionConfig(action=null){
    const type=$('#automationActionType')?.value||action?.type||'notification'; const box=$('#automationActionConfig'); if(!box)return; const a=action||{};
    if(type==='notification') box.innerHTML=`<label class="automation-field span-2"><span>MESSAGE</span><input id="automationActionMessage" maxlength="220" value="${escapeHtml(a.message||'')}" placeholder="Optional — defaults to the rule/trigger summary"/></label>`;
    else if(type==='activity') box.innerHTML=`<label class="automation-field span-2"><span>LOG MESSAGE</span><input id="automationActionMessage" maxlength="220" value="${escapeHtml(a.message||'')}" placeholder="Optional local Activity log message"/></label>`;
    else if(type==='profile') box.innerHTML=`<label class="automation-field span-2"><span>PERFORMANCE PROFILE</span><select id="automationActionProfile"><option value="eco" ${a.profile==='eco'?'selected':''}>Eco</option><option value="balanced" ${!a.profile||a.profile==='balanced'?'selected':''}>Balanced</option><option value="performance" ${a.profile==='performance'?'selected':''}>Performance</option></select><small>Runs through Windows powercfg using the same allowlisted profiles as Performance+.</small></label>`;
    else if(type==='navigate') box.innerHTML=`<label class="automation-field span-2"><span>POWERTOOLS PAGE</span><select id="automationActionView">${[['dashboard','Dashboard'],['models','AI Command Center'],['performance','Performance'],['system','System'],['featurelab','Feature Lab'],['data','Data Hub'],['apps','Process & Apps'],['network','Network'],['privacy','Privacy & App Trust'],['security','Security'],['automation','Automation'],['journal','Change Journal'],['settings','Settings']].map(([v,l])=>`<option value="${v}" ${a.view===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
    else box.innerHTML=`<label class="automation-field span-2"><span>WINDOWS TOOL</span><select id="automationActionTarget">${[['taskmanager','Task Manager'],['resmon','Resource Monitor'],['storage','Storage Settings'],['network','Network Settings'],['defender','Windows Security'],['eventviewer','Event Viewer'],['updates','Windows Update']].map(([v,l])=>`<option value="${v}" ${a.target===v?'selected':''}>${l}</option>`).join('')}</select><small>Fixed allowlist only; arbitrary executables/scripts are not accepted.</small></label>`;
  }
  function resetAutomationBuilder(rule=null){
    automationEditingRuleId=rule?.id||null;
    if($('#automationName'))$('#automationName').value=rule?.name||'';
    if($('#automationTriggerType'))$('#automationTriggerType').value=rule?.trigger?.type||'cpuAbove';
    if($('#automationActionType'))$('#automationActionType').value=rule?.action?.type||'notification';
    if($('#automationCooldown'))$('#automationCooldown').value=String(Math.max(1,Math.round(Number(rule?.cooldownSec||300)/60)));
    setText('#automationBuilderMode',rule?'EDIT RULE':'NEW RULE');
    const save=$('#saveAutomationRule');if(save)save.textContent=rule?'Update Rule':'Save Rule';
    renderAutomationTriggerConfig(rule?.trigger||null);renderAutomationActionConfig(rule?.action||null);
  }
  function collectAutomationRule(){
    const type=$('#automationTriggerType')?.value||'cpuAbove'; const actionType=$('#automationActionType')?.value||'notification';
    const trigger={type}; const action={type:actionType};
    if(['cpuAbove','gpuAbove','ramAbove','diskFreeBelow','batteryBelow'].includes(type)){trigger.threshold=Number($('#automationThreshold')?.value);trigger.durationSec=Number($('#automationDuration')?.value||0);}
    else if(['processStarted','processStopped'].includes(type))trigger.processName=($('#automationProcessName')?.value||'').trim();
    else if(type==='networkDisconnected')trigger.durationSec=Number($('#automationDuration')?.value||0);
    else if(type==='dailyTime')trigger.time=$('#automationDailyTime')?.value||'';
    if(['notification','activity'].includes(actionType))action.message=($('#automationActionMessage')?.value||'').trim();
    else if(actionType==='profile')action.profile=$('#automationActionProfile')?.value||'balanced';
    else if(actionType==='navigate')action.view=$('#automationActionView')?.value||'dashboard';
    else if(actionType==='windowsTool')action.target=$('#automationActionTarget')?.value||'taskmanager';
    return {id:automationEditingRuleId||undefined,name:($('#automationName')?.value||'').trim(),trigger,action,cooldownSec:Math.max(60,Number($('#automationCooldown')?.value||5)*60)};
  }
  function renderAutomationCenter(){
    if(!automationState)return;
    const master=automationState.masterEnabled!==false;
    setText('#automationEngineStatus',master?(automationState.running?'ACTIVE':'READY'):'PAUSED');
    setText('#automationEngineDetail',master?(automationState.enabledCount?'Monitoring only the signals required by enabled rules.':'No enabled rules — background evaluator is stopped.'):'Master switch paused all automatic evaluation.');
    const masterBtn=$('#automationMasterToggle');if(masterBtn){
      const idle=master && !(automationState.enabledCount||0);
      masterBtn.textContent=!master?'Enable Engine':idle?'Disable Engine':'Pause Engine';
      masterBtn.classList.toggle('paused',!master);
      masterBtn.classList.toggle('idle',idle);
      masterBtn.setAttribute('aria-pressed',master?'true':'false');
      masterBtn.title=!master?'Enable automatic rule evaluation':idle?'Disable the Automation Engine master switch':'Pause automatic rule evaluation';
    }
    setText('#automationEnabledCount',String(automationState.enabledCount||0));setText('#automationRuleCount',`${automationState.ruleCount||0} rules total`);setText('#automationLastRun',automationState.lastTriggeredAt?relativeTime(automationState.lastTriggeredAt):'Never');setText('#automationNextSchedule',formatAutomationSchedule(automationState.nextScheduledAt));setText('#automationTick',`${Math.round((automationState.tickMs||3000)/1000)} sec`);setText('#automationRulesMeta',`${automationState.ruleCount||0} rules`);
    const rules=$('#automationRuleList');const arr=Array.isArray(automationState.rules)?automationState.rules:[];
    if(rules)rules.innerHTML=arr.length?arr.map(rule=>`<div class="automation-rule ${rule.enabled?'enabled':'disabled'}" data-rule-id="${escapeHtml(rule.id)}"><div class="automation-rule-state"><button class="automation-toggle ${rule.enabled?'on':''}" data-automation-action="toggle" aria-label="${rule.enabled?'Disable':'Enable'} rule"><i></i></button><span>${rule.enabled?'ENABLED':'PAUSED'}</span></div><div class="automation-rule-copy"><strong>${escapeHtml(rule.name)}</strong><small><b>WHEN</b> ${escapeHtml(automationTriggerSummary(rule))}</small><small><b>THEN</b> ${escapeHtml(automationActionSummary(rule))}</small></div><div class="automation-rule-stats"><span>${Number(rule.runCount||0)} runs</span><small>${rule.lastTriggeredAt?`Last ${relativeTime(rule.lastTriggeredAt)}`:'Never triggered'}</small><small>Cooldown ${Math.round(Number(rule.cooldownSec||300)/60)}m</small></div><div class="automation-rule-actions"><button data-automation-action="run">Run Now</button><button data-automation-action="edit">Edit</button><button class="danger" data-automation-action="delete">Delete</button></div></div>`).join(''):'<div class="empty">No automation rules yet. Use Rule Builder or a Quick Preset.</div>';
    const history=$('#automationHistoryList');const hist=Array.isArray(automationState.history)?automationState.history:[];
    if(history)history.innerHTML=hist.length?hist.slice(0,50).map(item=>`<div class="automation-history-item ${item.ok===false?'failed':''}"><div class="automation-history-icon">${item.ok===false?'!':'⎇'}</div><div><strong>${escapeHtml(item.ruleName||'Automation')}</strong><small>${escapeHtml(item.triggerDetail||item.trigger||'Rule executed')}</small><small>${escapeHtml(item.action||'')}</small></div><div class="automation-history-time"><b>${item.ok===false?'FAILED':escapeHtml(item.origin||'ENGINE')}</b><span>${relativeTime(item.at)}</span></div></div>`).join(''):'<div class="empty">No automation runs yet.</div>';
  }
  async function loadAutomationCenter(force=false){
    if(automationLoading)return; if(automationLoaded&&!force){renderAutomationCenter();return;} automationLoading=true;
    try{automationState=await api.getAutomationState();automationLoaded=true;renderAutomationCenter();}catch{toast('Automation Engine unavailable','Unable to read local rule state.');}finally{automationLoading=false;}
  }
  async function saveAutomationFromBuilder(){
    const draft=collectAutomationRule();if(!draft.name){toast('Rule name required','Give this automation a short name.');$('#automationName')?.focus();return;}
    const btn=$('#saveAutomationRule');if(btn){btn.disabled=true;btn.textContent=automationEditingRuleId?'Updating…':'Saving…';}
    let r;try{r=await api.saveAutomationRule(draft);}catch{r={ok:false,error:'Unable to save automation rule.'};}
    if(btn)btn.disabled=false;
    if(!r?.ok){toast('Rule not saved',r?.error||'Check the trigger/action configuration.');resetAutomationBuilder(automationEditingRuleId?automationState?.rules?.find(x=>x.id===automationEditingRuleId):null);return;}
    automationState=r.state;automationLoaded=true;renderAutomationCenter();toast(automationEditingRuleId?'Automation rule updated':'Automation rule saved',r.rule?.name||draft.name);resetAutomationBuilder();await refreshActivity();
  }
  function applyAutomationPreset(name){
    const presets={cpu:{name:'CPU Guard',trigger:{type:'cpuAbove',threshold:85,durationSec:30},action:{type:'notification',message:'CPU usage has stayed above 85%.'},cooldownSec:300},ram:{name:'Memory Guard',trigger:{type:'ramAbove',threshold:85,durationSec:30},action:{type:'notification',message:'RAM usage has stayed above 85%.'},cooldownSec:300},disk:{name:'Low Disk Space',trigger:{type:'diskFreeBelow',threshold:10,durationSec:30},action:{type:'notification',message:'System drive free space is below 10%.'},cooldownSec:1800},network:{name:'Network Watch',trigger:{type:'networkDisconnected',durationSec:15},action:{type:'notification',message:'Network adapter connectivity was lost.'},cooldownSec:300},daily:{name:'Daily Dashboard',trigger:{type:'dailyTime',time:'09:00'},action:{type:'navigate',view:'dashboard'},cooldownSec:60}};
    const p=presets[name];if(!p)return;automationEditingRuleId=null;if($('#automationName'))$('#automationName').value=p.name;if($('#automationTriggerType'))$('#automationTriggerType').value=p.trigger.type;if($('#automationActionType'))$('#automationActionType').value=p.action.type;if($('#automationCooldown'))$('#automationCooldown').value=String(Math.max(1,Math.round(p.cooldownSec/60)));setText('#automationBuilderMode','PRESET');renderAutomationTriggerConfig(p.trigger);renderAutomationActionConfig(p.action);$('#automationName')?.scrollIntoView({behavior:'smooth',block:'center'});toast('Preset loaded',p.name+' — review and Save Rule.');
  }

  function formatMs(ms) {
    const n=Number(ms); if(!Number.isFinite(n)) return '--';
    if(n<1000) return `${Math.max(0,Math.round(n))} ms`;
    return `${(n/1000).toFixed(n<10000?2:1)} s`;
  }

  function renderReliability() {
    const st=reliabilityState;
    if(!st) return;
    setText('#reliabilityBootTime', st.boot?.uiReadyMs==null?'Pending':formatMs(st.boot.uiReadyMs));
    setText('#reliabilityRenderer', st.renderer?.state || 'Unknown');
    const crashCount=Number(st.renderer?.crashCount||0), unresponsive=Number(st.renderer?.unresponsiveCount||0);
    setText('#reliabilityRendererDetail', crashCount||unresponsive ? `${crashCount} crash recovery · ${unresponsive} unresponsive` : 'No renderer recovery events this session');
    setText('#reliabilityDiagnostics', formatBytes(st.diagnostics?.sizeBytes||0));
    setText('#reliabilityDiagnosticsDetail', st.diagnostics?.exists ? 'Local diagnostic log present' : 'No diagnostic entries this session');
    setText('#reliabilityCache', st.cache?.staticPresent ? 'Ready' : 'Cold');
    setText('#reliabilityCacheDetail', st.cache?.staticPresent ? (Number.isFinite(Number(st.cache?.ageMs))?`Identity cache age ${Math.max(0,Math.round(st.cache.ageMs/1000))} sec`:'Static identity cache present') : 'Builds lazily after system identity loads');
    const checks=Array.isArray(st.checks)?st.checks:[];
    const root=$('#reliabilityChecks');
    if(root) root.innerHTML=checks.length?checks.map(c=>`<div class="reliability-check ${c.ok?'':c.optional?'info':'warn'}"><i></i><div><strong>${escapeHtml(c.label||c.id||'Check')}</strong><small>${escapeHtml(c.detail||'')}</small></div></div>`).join(''):'<div class="empty">No reliability checks returned.</div>';
    const hardWarnings=checks.filter(c=>!c.ok&&!c.optional).length;
    const chip=$('#reliabilityStateChip');
    if(chip){chip.textContent=hardWarnings?'Review':'Healthy';chip.classList.toggle('active',!hardWarnings);}
  }

  async function loadReliability(force=false){
    if(reliabilityLoading) return;
    if(reliabilityLoaded&&!force){renderReliability();return;}
    reliabilityLoading=true;
    try { reliabilityState=await api.getReliabilityStatus?.(); reliabilityLoaded=Boolean(reliabilityState); renderReliability(); }
    catch(error){ toast('Reliability status unavailable',String(error?.message||error||'Unknown error')); }
    finally { reliabilityLoading=false; }
  }


  function renderStableRelease() {
    const st=stableReleaseState;
    if(!st)return;
    setText('#stableChannel', st.channel || 'Stable');
    setText('#stableVersion', st.version || '2.1.0');
    setText('#stablePreflight', st.ready ? 'READY' : 'REVIEW');
    setText('#stablePreflightDetail', `${st.passed||0}/${st.total||0} checks passed${st.informational?` · ${st.informational} info`:''}`);
    const prev=st.previousSession;
    setText('#stablePreviousSession', !prev?.available ? 'FIRST RUN' : prev.cleanShutdown ? 'CLEAN' : 'NOTE');
    setText('#stablePreviousSessionDetail', !prev?.available ? 'No previous v2.1.0 session marker yet' : prev.cleanShutdown ? `Previous ${prev.version||''} session closed cleanly` : 'Prior session has no clean-shutdown marker · informational only');
    const root=$('#stableChecks');
    const checks=Array.isArray(st.checks)?st.checks:[];
    if(root)root.innerHTML=checks.length?checks.map(c=>`<div class="reliability-check ${c.ok?'':c.optional?'info':'warn'}"><i></i><div><strong>${escapeHtml(c.label||c.id||'Check')}</strong><small>${escapeHtml(c.detail||'')}</small></div></div>`).join(''):'<div class="empty">No release-readiness checks returned.</div>';
    const chip=$('#stableStateChip');
    if(chip){chip.textContent=st.ready?'Stable Ready':'Review';chip.classList.toggle('active',Boolean(st.ready));}
  }

  async function loadStableRelease(force=false){
    if(stableReleaseLoading)return;
    if(stableReleaseLoaded&&!force){renderStableRelease();return;}
    stableReleaseLoading=true;
    try{stableReleaseState=await api.getStableReleaseStatus?.();stableReleaseLoaded=Boolean(stableReleaseState);renderStableRelease();}
    catch(error){toast('Release preflight unavailable',String(error?.message||error||'Unknown error'));}
    finally{stableReleaseLoading=false;}
  }

  function modelCustomEndpoint() { return (localStorage.getItem('pt.model.customEndpoint') || '').trim(); }
  function modelKey(model) { return model?.key || `${model?.provider || ''}::${model?.id || model?.name || ''}`; }
  function savedActiveModelKey() { return localStorage.getItem('pt.model.active') || ''; }
  function currentModelList() { return Array.isArray(modelCenterState?.models) ? modelCenterState.models : []; }
  function activeModel() {
    const models=currentModelList(); const saved=savedActiveModelKey();
    return models.find(m=>modelKey(m)===saved) || models[0] || null;
  }
  function providerStatus(providerId) { return (modelCenterState?.providers || []).find(p=>p.id===providerId) || null; }
  function setProviderCard(providerId,statusId,detailId) {
    const p=providerStatus(providerId); const status=$(statusId);
    if(!p){setText(detailId,'Not checked');if(status){status.textContent='Idle';status.className='chip';}return;}
    let detail='';let label='';let cls='chip';
    if(p.scope==='cloud'&&!p.configured){detail=providerId==='codex'?'Uses the OpenAI API key':'API key not configured';label='Setup';}
    else if(p.online){detail=`${p.modelsCount||0} model${p.modelsCount===1?'':'s'} · ${p.latencyMs??'—'} ms`;label='Connected';cls+=' active';}
    else if(p.scope==='cloud'&&p.configured){detail=p.error||'Configured but provider did not respond';label='Error';cls+=' error';}
    else{detail=p.error||'Local service not responding';label='Offline';}
    setText(detailId,detail); if(status){status.textContent=label;status.className=cls;}
  }
  function dragonCouncilCloudAllowed(){return localStorage.getItem('pt.model.council.cloud')==='true';}
  function dragonCouncilSavedKeys(){try{const v=JSON.parse(localStorage.getItem('pt.model.council.members')||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,4):[];}catch{return [];}}
  function setDragonCouncilSavedKeys(keys){localStorage.setItem('pt.model.council.members',JSON.stringify([...new Set(keys)].slice(0,4)));}
  function dragonCouncilEligibleModels(){const allowCloud=dragonCouncilCloudAllowed();return currentModelList().filter(m=>m&&(allowCloud||m.scope!=='cloud'));}
  function dragonCouncilSelectedModels(){const saved=new Set(dragonCouncilSavedKeys());return dragonCouncilEligibleModels().filter(m=>saved.has(modelKey(m))).slice(0,4);}
  function councilWords(text){const stop=new Set(['this','that','with','from','have','your','you','the','and','for','are','was','were','will','would','could','should','into','about','there','their','they','them','then','than','when','what','which','while','where','also','can','not','but','its','our','out','all','has','had']);return new Set(String(text||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>=4&&!stop.has(w)).slice(0,600));}
  function councilAgreement(results){const good=results.filter(r=>r?.ok&&r.text);if(good.length<2)return {percent:null,label:'--'};let total=0,pairs=0;for(let i=0;i<good.length;i++)for(let j=i+1;j<good.length;j++){const a=councilWords(good[i].text),b=councilWords(good[j].text);if(!a.size&&!b.size)continue;let common=0;for(const w of a)if(b.has(w))common++;const union=new Set([...a,...b]).size||1;total+=common/union;pairs++;}if(!pairs)return {percent:0,label:'Low'};const percent=Math.round((total/pairs)*100);return {percent,label:percent>=38?'High':percent>=20?'Medium':'Low'};}
  function renderDragonCouncil(){
    const models=dragonCouncilEligibleModels(),selected=new Set(dragonCouncilSavedKeys()),members=$('#dragonCouncilMembers');const cloud=dragonCouncilCloudAllowed();const cloudToggle=$('#dragonCouncilCloud');if(cloudToggle)cloudToggle.checked=cloud;
    if(members)members.innerHTML=models.length?models.map(m=>{const key=modelKey(m),checked=selected.has(key);return `<label class="dragon-council-member ${checked?'selected':''}"><input type="checkbox" data-council-key="${escapeHtml(key)}" ${checked?'checked':''}/><span class="dragon-council-member-mark">${m.scope==='cloud'?'☁':'◆'}</span><span><strong>${escapeHtml(m.name||m.id||'Model')}</strong><small>${escapeHtml(`${m.providerName||m.provider||'AI'} · ${m.scope==='cloud'?'Cloud':'Local'}${Number.isFinite(Number(m.latencyMs))?` · ${Math.round(Number(m.latencyMs))} ms probe`:''}`)}</small></span></label>`}).join(''):'<div class="empty">No eligible models are currently available. Refresh providers or allow configured cloud members.</div>';
    const chosen=dragonCouncilSelectedModels(),agreement=councilAgreement(dragonCouncilResults),completed=dragonCouncilResults.filter(r=>r?.ok),fastest=completed.slice().sort((a,b)=>(a.latencyMs||Infinity)-(b.latencyMs||Infinity))[0];
    const summary=$('#dragonCouncilSummary');if(summary)summary.innerHTML=`<div><span>MEMBERS</span><strong>${chosen.length} / 4</strong><small>${chosen.length>=2?'Ready to compare':'Select at least two models'}</small></div><div><span>AGREEMENT</span><strong>${agreement.percent==null?'--':`${agreement.label} · ${agreement.percent}%`}</strong><small>Local lexical heuristic</small></div><div><span>FASTEST</span><strong>${fastest?escapeHtml(fastest.modelName||fastest.model||'Model'):'--'}</strong><small>${fastest?`${Math.round(fastest.latencyMs||0)} ms`:'No Council run yet'}</small></div><div><span>CONTEXT</span><strong>${aiContextEnabled()?'System-Aware':'Off'}</strong><small>${aiContextEnabled()?(aiContextCloudAllowed()?'Cloud opt-in enabled':'Cloud context blocked'):'Normal prompts only'}</small></div>`;
    const state=$('#dragonCouncilState');if(state){state.textContent=dragonCouncilBusy?'Consulting…':dragonCouncilResults.length?`${completed.length}/${dragonCouncilResults.length} replied`:'Ready';state.className=`chip active ${dragonCouncilBusy?'routing':''}`;}const run=$('#dragonCouncilRun');if(run){run.disabled=dragonCouncilBusy||chosen.length<2;run.textContent=dragonCouncilBusy?'Consulting…':'Run Council';}
    const results=$('#dragonCouncilResults');if(results)results.innerHTML=dragonCouncilResults.length?dragonCouncilResults.map((r,i)=>`<article class="dragon-council-response ${r.ok?'':'error'}"><div class="dragon-council-response-head"><div><span>${r.scope==='cloud'?'CLOUD':'LOCAL'} · ${escapeHtml(r.providerName||r.provider||'AI')}</span><strong>${escapeHtml(r.modelName||r.model||'Model')}</strong><small>${r.ok?`${Math.round(r.latencyMs||0)} ms · ${String(r.text||'').length.toLocaleString()} chars${r.systemContext?.attached?' · System context':''}`:escapeHtml(r.error||'Request failed')}</small></div>${r.ok?`<button class="small-btn" data-council-use="${i}">Use Response</button>`:''}</div><pre>${escapeHtml(r.ok?(r.text||'(Empty response)'):(r.error||'Request failed'))}</pre></article>`).join(''):'<div class="empty">Council responses will appear here after a run.</div>';
  }
  function selectRecommendedCouncil(){const models=dragonCouncilEligibleModels();if(models.length<2){toast('Not enough Council members','At least two eligible models must be discovered.');return;}const selected=[],seenProviders=new Set(),active=activeModel();if(active&&models.some(m=>modelKey(m)===modelKey(active))){selected.push(active);seenProviders.add(active.provider);}for(const m of models){if(selected.length>=3)break;if(seenProviders.has(m.provider))continue;selected.push(m);seenProviders.add(m.provider);}for(const m of models){if(selected.length>=Math.min(3,models.length))break;if(!selected.some(x=>modelKey(x)===modelKey(m)))selected.push(m);}setDragonCouncilSavedKeys(selected.map(modelKey));dragonCouncilResults=[];renderDragonCouncil();renderAiCommandCenter();}
  async function runDragonCouncil(promptOverride='', options={}) {
    const override=typeof promptOverride==='string'?promptOverride:'';
    const prompt=String(override||$('#dragonCouncilPrompt')?.value||'').trim();
    if(!prompt){toast('Enter a Council prompt','Type a question or copy the AI Playground prompt first.');return [];}
    const models=dragonCouncilSelectedModels();
    if(models.length<2){toast('Select at least two Council members','Dragon Council compares 2–4 models per run.');return [];}
    if(dragonCouncilBusy)return [];
    dragonCouncilBusy=true;dragonCouncilResults=[];
    if(override&&$('#dragonCouncilPrompt'))$('#dragonCouncilPrompt').value=prompt;
    renderDragonCouncil();renderAiCommandCenter();
    try{
      const aware=systemAwareRequest();
      const councilSystem=String(options?.system||'You are one member of Purple Dragon Dragon Council. Answer the user independently and directly. Do not claim to know what other Council models answered.');
      const tasks=models.map(async m=>{
        const started=Date.now();
        try{
          const out=await api.modelChat?.({provider:m.provider,model:m.id||m.name,endpoint:m.endpoint,customEndpoint:m.provider==='custom'?modelCustomEndpoint():'',system:councilSystem,prompt,systemAware:aware});
          return {...(out||{}),provider:m.provider,providerName:m.providerName||m.provider,model:m.id||m.name,modelName:m.name||m.id,scope:m.scope||out?.scope,latencyMs:Number(out?.latencyMs)||Date.now()-started};
        }catch(error){return {ok:false,error:String(error?.message||error),provider:m.provider,providerName:m.providerName||m.provider,model:m.id||m.name,modelName:m.name||m.id,scope:m.scope,latencyMs:Date.now()-started};}
      });
      dragonCouncilResults=await Promise.all(tasks);
      for(const r of dragonCouncilResults)noteContextResult(r);
      const ok=dragonCouncilResults.filter(r=>r.ok).length;
      await logActivity('Dragon Council completed',`${ok}/${dragonCouncilResults.length} models replied · ${dragonCouncilCloudAllowed()?'cloud members allowed':'local-only members'}`);
      if(!options?.silent)toast('Dragon Council completed',`${ok}/${dragonCouncilResults.length} models replied.`);
      return dragonCouncilResults;
    }finally{dragonCouncilBusy=false;renderDragonCouncil();renderAiCommandCenter();}
  }
  function dragonRouterProfile(){return localStorage.getItem('pt.model.router.profile')||$('#dragonRouterProfile')?.value||'automatic';}
  function dragonRouterCloudAllowed(){const stored=localStorage.getItem('pt.model.router.cloud');if(stored==='false')return false;if(stored==='true')return true;const el=$('#dragonRouterCloud');return el?el.checked:true;}
  function dragonRouterAssistantEnabled(){return localStorage.getItem('pt.model.router.assistant')==='true';}
  function renderDragonRoute(){
    const route=dragonRouteState;const panel=$('.dragon-router-panel');if(panel)panel.classList.toggle('routing',dragonRouteBusy);const chip=$('#dragonRouterState');if(chip){chip.textContent=dragonRouteBusy?'Routing…':route?.ok?(route.selected?.scope==='cloud'?'Cloud route':'Local route'):'Ready';chip.className=`chip active ${route?.selected?.scope==='cloud'?'cloud-route':route?.selected?'local-route':''}`;}
    const profile=dragonRouterProfile();const labels={automatic:'Automatic','best-quality':'Best Quality',fastest:'Fastest',cheapest:'Cheapest','local-only':'Local Only','privacy-first':'Privacy First'};setText('#dragonRouteProfileDetail',`${labels[profile]||'Automatic'} profile`);
    if(!route?.ok){if(route?.error)setText('#dragonRouteReason',route.error);return;}
    setText('#dragonRouteTask',route.task?.label||'General Assistant');setText('#dragonRouteModel',route.selected?.name||route.selected?.id||'Unknown model');setText('#dragonRouteProvider',`${route.selected?.providerName||route.selected?.provider||'AI'} · ${route.selected?.scope==='cloud'?'Cloud API':'Local'}`);setText('#dragonRouteConfidence',`${Math.round(route.confidence||0)}%`);setText('#dragonRouteReason',(route.reason||[]).join(' '));
    const alt=$('#dragonRouteAlternatives');if(alt){const rows=Array.isArray(route.alternatives)?route.alternatives:[];alt.innerHTML=rows.length?rows.map((x,i)=>`<div class="dragon-route-alt"><div><strong>${i+2}. ${escapeHtml(x.model?.name||x.model?.id||'Alternative')}</strong><small>${escapeHtml(`${x.model?.providerName||x.model?.provider||'AI'} · ${x.model?.scope==='cloud'?'Cloud API':'Local'}${x.reasons?.length?` · ${x.reasons[0]}`:''}`)}</small></div><span class="chip">Backup</span></div>`).join(''):'<div class="empty">No alternative route was available.</div>';}
  }
  async function routeCurrentPrompt(sendAfter=false,promptOverride=''){
    const prompt=String(promptOverride||$('#modelPrompt')?.value||'').trim();if(!prompt){toast('Enter a prompt first','Dragon Router needs the task text before it can choose a model.');return null;}if(dragonRouteBusy)return null;dragonRouteBusy=true;renderDragonRoute();
    try{const route=await api.routeModel?.({prompt,profile:dragonRouterProfile(),allowCloud:dragonRouterCloudAllowed(),customEndpoint:modelCustomEndpoint()});dragonRouteState=route||{ok:false,error:'Router did not return a decision.'};if(route?.ok){if(!currentModelList().some(m=>modelKey(m)===modelKey(route.selected)))await loadModelCenter(true);localStorage.setItem('pt.model.active',modelKey(route.selected));renderModelCenter();renderDragonRoute();toast('Dragon Router selected a model',`${route.task?.label||'Task'} → ${route.selected?.providerName||route.selected?.provider} / ${route.selected?.name||route.selected?.id}`);if(sendAfter)await sendModelPrompt();return route;}toast('Dragon Router could not route',route?.error||'No eligible model was found.');return route;}catch(error){dragonRouteState={ok:false,error:String(error?.message||error)};toast('Dragon Router unavailable',dragonRouteState.error);return null;}finally{dragonRouteBusy=false;renderDragonRoute();}
  }
  function aiContextMode(){const stored=localStorage.getItem('pt.ai.context.mode')||'smart';return ['smart','full','off'].includes(stored)?stored:'smart';}
  function aiContextEnabled(){return localStorage.getItem('pt.ai.context.enabled')!=='false'&&aiContextMode()!=='off';}
  function aiContextCloudAllowed(){return localStorage.getItem('pt.ai.context.cloud')==='true';}
  function systemAwareRequest(){return {enabled:aiContextEnabled(),mode:aiContextMode(),allowCloud:aiContextCloudAllowed()};}
  function renderAiContext(){
    const enabled=aiContextEnabled(), mode=aiContextMode(), cloud=aiContextCloudAllowed();const chip=$('#aiContextState');if(chip){chip.textContent=!enabled?'Off':cloud?'Cloud opt-in':'Local-only';chip.className=`chip active ${!enabled?'off':cloud?'cloud-enabled':''}`;}
    const modeEl=$('#aiContextMode');if(modeEl)modeEl.value=mode;const enabledEl=$('#aiContextEnabled');if(enabledEl)enabledEl.checked=enabled;const cloudEl=$('#aiContextCloud');if(cloudEl)cloudEl.checked=cloud;
    setText('#aiContextSections',aiContextState?.sections?.length?String(aiContextState.sections.length):'--');setText('#aiContextGenerated',aiContextState?.generatedAt?relativeTime(aiContextState.generatedAt):'Not built');setText('#aiContextPrivacy',enabled?'Redacted':'Off');setText('#aiContextPrivacyDetail',!enabled?'No context attached':cloud?'Cloud sharing explicitly allowed':'Cloud sharing blocked');
    const preview=$('#aiContextPreviewText');if(preview){if(aiContextBusy)preview.textContent='Building a redacted system snapshot…';else if(aiContextState?.text)preview.textContent=aiContextState.text.slice(0,1500)+(aiContextState.text.length>1500?'\n…':'');else if(aiContextState?.generatedAt)preview.textContent='System context was attached to the last AI request. Use Preview Context to rebuild and inspect the redacted snapshot.';else preview.textContent='System context has not been generated yet. Enter a question and use Preview Context, or send a prompt with System-Aware AI enabled.';}
  }
  async function loadAiContext(force=false,promptOverride=''){if(aiContextBusy)return aiContextState;if(!aiContextEnabled()){aiContextState=null;renderAiContext();return null;}aiContextBusy=true;renderAiContext();try{const prompt=String(promptOverride||$('#modelPrompt')?.value||'').trim();const out=await api.getAISystemContext?.({mode:aiContextMode(),prompt,force});aiContextState=out?.ok?out:{ok:false,error:out?.error||'Context unavailable',sections:[],text:''};if(!out?.ok)toast('System context unavailable',out?.error||'Unable to build context.');return aiContextState;}catch(error){aiContextState={ok:false,error:String(error?.message||error),sections:[],text:''};toast('System context unavailable',aiContextState.error);return aiContextState;}finally{aiContextBusy=false;renderAiContext();}}
  async function showAiContextPreview(promptOverride=''){const override=typeof promptOverride==='string'?promptOverride:'';if(!aiContextEnabled()){toast('System-Aware AI is off','Choose Smart Context or Full Loaded Context first.');return;}if(!aiContextState?.text||override)await loadAiContext(true,override);if(!aiContextState?.text)return;openModal('System Context Preview',`<div class="ai-context-modal"><p>This is the redacted snapshot PowerTools may attach to an AI request. Optional heavy modules appear only if you already opened them elsewhere.</p><pre class="ai-context-modal-pre">${escapeHtml(aiContextState.text)}</pre><div class="model-key-dialog-actions"><button class="primary-btn" id="aiContextPreviewClose">OK</button></div></div>`,'SYSTEM-AWARE AI');$('#aiContextPreviewClose')?.addEventListener('click',closeModal);}
  function noteContextResult(result){const meta=result?.systemContext;if(!meta)return;if(meta.attached){aiContextState={...(aiContextState||{}),ok:true,generatedAt:meta.generatedAt||new Date().toISOString(),mode:meta.mode||aiContextMode(),sections:meta.sections||[],sectionLabels:meta.sectionLabels||[],text:aiContextState?.text||''};}renderAiContext();}

  function aiCommandMode(){const v=localStorage.getItem('pt.ai.command.mode')||'direct';return ['direct','router','council'].includes(v)?v:'direct';}
  function aiCommandPreset(){const v=localStorage.getItem('pt.ai.command.preset')||'general';return ['general','diagnostics','windows','coding','security','analysis'].includes(v)?v:'general';}
  function aiCommandPresetMeta(id=aiCommandPreset()){
    const map={
      general:{label:'General Assistant',system:'Answer directly, separate known facts from assumptions, and give practical next steps.',starter:'Help me understand the best next step for this task.'},
      diagnostics:{label:'PC Diagnostics',system:'Diagnose the PC using attached System-Aware evidence when available. Treat telemetry as time-bound observations, call out missing evidence, rank likely causes, and recommend reversible checks before changes.',starter:'Analyze my current PC health and identify the most likely performance or stability issues.'},
      windows:{label:'Windows Troubleshooting',system:'Give Windows troubleshooting guidance using supported Windows tools and reversible steps. Prefer observation and validation before mutations. Never claim a setting changed unless the user performed it.',starter:'Help me troubleshoot this Windows problem using safe, reversible steps.'},
      coding:{label:'Coding / Development',system:'Act as a software engineering assistant. Prefer precise code, explain architectural tradeoffs, preserve existing behavior, and identify validation steps.',starter:'Review this development task and propose the cleanest implementation plan.'},
      security:{label:'Security Review',system:'Perform defensive security analysis. Prioritize observable evidence, trust boundaries, least privilege, and remediation. Do not treat a heuristic as a malware verdict.',starter:'Review my current security posture and prioritize the most important defensive checks.'},
      analysis:{label:'Deep Analysis',system:'Analyze the task deeply. Compare alternatives, state uncertainty, identify failure modes, and finish with a clear recommendation.',starter:'Analyze this problem deeply, compare the strongest options, and recommend a path forward.'}
    };return map[id]||map.general;
  }
  function aiCommandTargetInfo(){
    const mode=aiCommandMode();
    if(mode==='router')return {name:'Dragon Router',detail:`${dragonRouterProfile().replace(/-/g,' ')} profile`,cloud:dragonRouterCloudAllowed()?'Possible':'Blocked'};
    if(mode==='council'){const members=dragonCouncilSelectedModels();return {name:`${members.length} Council member${members.length===1?'':'s'}`,detail:members.length>=2?members.map(m=>m.name||m.id).slice(0,2).join(' + '):'Select 2–4 members below',cloud:dragonCouncilCloudAllowed()?'Possible':'Blocked'};}
    const m=activeModel();return {name:m?.name||m?.id||'None',detail:m?`${m.providerName||m.provider} · ${m.scope==='cloud'?'Cloud':'Local'}`:'Select a model below',cloud:m?.scope==='cloud'?'Active':'Local'};
  }
  function aiCommandRecord(entry){aiCommandHistory.unshift({...entry,at:new Date().toISOString()});aiCommandHistory=aiCommandHistory.slice(0,8);}
  function renderAiCommandCenter(){
    const mode=aiCommandMode(),preset=aiCommandPreset(),target=aiCommandTargetInfo(),prompt=String($('#aiCommandPrompt')?.value||'').trim();
    const modeSel=$('#aiCommandMode');if(modeSel)modeSel.value=mode;const presetSel=$('#aiCommandPreset');if(presetSel)presetSel.value=preset;
    const labels={direct:'Direct Model',router:'Dragon Router',council:'Dragon Council'};setText('#aiCommandModeSummary',labels[mode]||'Direct Model');setText('#aiCommandModeDetail',mode==='direct'?'Pinned model':mode==='router'?`${dragonRouterProfile().replace(/-/g,' ')} routing`:'Parallel comparison');
    setText('#aiCommandTarget',target.name);setText('#aiCommandTargetDetail',target.detail);
    const aware=aiContextEnabled();setText('#aiCommandContext',aware?(aiContextMode()==='full'?'Full':'Smart'):'Off');setText('#aiCommandContextDetail',aware?(aiContextCloudAllowed()?'Cloud context opt-in enabled':'Cloud context blocked'):'No system context');
    const cloudText=target.cloud==='Active'?'Active':target.cloud==='Possible'?'Allowed':target.cloud==='Blocked'?'Blocked':'Local';setText('#aiCommandCloud',cloudText);setText('#aiCommandCloudDetail',mode==='direct'?(target.cloud==='Active'?'Prompt goes to selected cloud provider':'Prompt stays local when the selected model is local'):mode==='router'?(dragonRouterCloudAllowed()?'Router may select configured cloud':'Router restricted to local models'):(dragonCouncilCloudAllowed()?'Council may include configured cloud':'Council restricted to local models'));
    const chip=$('#aiCommandState');if(chip){chip.textContent=aiCommandBusy?'Running…':aiCommandLast?.ok?'Complete':aiCommandLast&&!aiCommandLast.ok?'Review':'Ready';chip.className=`chip active ${aiCommandBusy?'routing':''}`;}
    const run=$('#aiCommandRun');if(run){const unavailable=mode==='direct'&&!activeModel()||mode==='council'&&dragonCouncilSelectedModels().length<2;run.disabled=aiCommandBusy||dragonCouncilBusy||!prompt||unavailable;run.textContent=aiCommandBusy?'Running Mission…':'Run Mission';}
    setText('#aiCommandLastRun',aiCommandLast?.at?`${relativeTime(aiCommandLast.at)} · ${aiCommandLast.latencyMs?Math.round(aiCommandLast.latencyMs)+' ms':'completed'}`:'No mission run this session');
    const out=$('#aiCommandOutput');if(out&&aiCommandLast)out.textContent=aiCommandLast.output||aiCommandLast.error||'Mission completed.';
    const history=$('#aiCommandHistory');if(history)history.innerHTML=aiCommandHistory.length?aiCommandHistory.map(h=>`<div class="ai-command-history-row"><span class="ai-command-history-mark">${h.ok?'✓':'!'}</span><div><strong>${escapeHtml(h.profile||'AI Mission')}</strong><small>${escapeHtml(`${h.mode||'Direct'} · ${h.target||'AI'} · ${Math.round(h.latencyMs||0)} ms`)}</small></div><span class="chip ${h.ok?'active':''}">${h.ok?'DONE':'REVIEW'}</span></div>`).join(''):'<div class="empty">No missions run this session.</div>';
  }
  async function runAiCommand(){
    const prompt=String($('#aiCommandPrompt')?.value||'').trim();if(!prompt){toast('Enter a mission first');return;}if(aiCommandBusy)return;
    const mode=aiCommandMode(),preset=aiCommandPreset(),meta=aiCommandPresetMeta(preset);aiCommandBusy=true;aiCommandLast={ok:false,at:new Date().toISOString(),output:'Running mission…'};renderAiCommandCenter();const started=Date.now();
    try{
      if(mode==='council'){
        const councilSystem=`You are one member of Purple Dragon AI Command Center's Dragon Council. ${meta.system} Answer independently; do not claim to know what other Council members answered. Never claim that you executed a PowerTools or Windows action. Recommendations that change the system must remain review-first and user-initiated.`;const results=await runDragonCouncil(prompt,{silent:true,system:councilSystem});const good=results.filter(r=>r?.ok);if(!results.length)throw new Error('Dragon Council needs at least two eligible selected members.');const agreement=councilAgreement(results);const text=good.length?good.map(r=>`[${r.providerName||r.provider} · ${r.modelName||r.model}]\n${r.text||'(Empty response)'}`).join('\n\n────────────────────────\n\n'):results.map(r=>`[${r.modelName||r.model}] ${r.error||'Request failed'}`).join('\n');aiCommandLast={ok:good.length>0,at:new Date().toISOString(),latencyMs:Date.now()-started,output:`DRAGON COUNCIL · ${good.length}/${results.length} replied · Agreement ${agreement.percent==null?'--':agreement.label+' '+agreement.percent+'%'}\n\n${text}`};aiCommandRecord({ok:aiCommandLast.ok,profile:meta.label,mode:'Dragon Council',target:`${results.length} models`,latencyMs:aiCommandLast.latencyMs});await logActivity('AI Command Center mission completed',`${meta.label} · Dragon Council · ${good.length}/${results.length} replies · ${Math.round(aiCommandLast.latencyMs)} ms`);
      }else{
        let model=activeModel(),route=null;if(mode==='router'){route=await api.routeModel?.({prompt,profile:dragonRouterProfile(),allowCloud:dragonRouterCloudAllowed(),customEndpoint:modelCustomEndpoint()});dragonRouteState=route||null;renderDragonRoute();if(!route?.ok)throw new Error(route?.error||'Dragon Router could not select a model.');model=route.selected;localStorage.setItem('pt.model.active',modelKey(model));}
        if(!model)throw new Error('No active model is available. Select or configure a model first.');
        const system=`You are Purple Dragon AI Command Center, a private assistant inside Purple Dragon PowerTools. ${meta.system} Never claim that you executed a PowerTools or Windows action. Recommendations that change the system must remain review-first and user-initiated.`;
        const result=await api.modelChat?.({provider:model.provider,model:model.id||model.name,endpoint:model.endpoint,customEndpoint:model.provider==='custom'?modelCustomEndpoint():'',system,prompt,systemAware:systemAwareRequest()});noteContextResult(result);if(!result?.ok)throw new Error(result?.error||'AI request failed.');const routeLine=route?`ROUTED: ${route.task?.label||'Task'} → ${model.providerName||model.provider} / ${model.name||model.id}\n\n`:'';aiCommandLast={ok:true,at:new Date().toISOString(),latencyMs:Number(result.latencyMs)||Date.now()-started,output:`${routeLine}${result.text||'(Empty response)'}`};aiCommandRecord({ok:true,profile:meta.label,mode:mode==='router'?'Dragon Router':'Direct Model',target:model.name||model.id||'Model',latencyMs:aiCommandLast.latencyMs});await logActivity('AI Command Center mission completed',`${meta.label} · ${mode==='router'?'Dragon Router':'Direct Model'} · ${model.providerName||model.provider} · ${Math.round(aiCommandLast.latencyMs)} ms`);
      }
      toast('AI mission completed',`${meta.label} · ${mode==='council'?'Dragon Council':mode==='router'?'Dragon Router':'Direct Model'}`);
    }catch(error){aiCommandLast={ok:false,at:new Date().toISOString(),latencyMs:Date.now()-started,error:String(error?.message||error),output:`Mission could not complete: ${String(error?.message||error)}`};aiCommandRecord({ok:false,profile:meta.label,mode:mode==='council'?'Dragon Council':mode==='router'?'Dragon Router':'Direct Model',target:aiCommandTargetInfo().name,latencyMs:aiCommandLast.latencyMs});toast('AI mission needs review',aiCommandLast.error);}finally{aiCommandBusy=false;renderModelCenter();renderAiCommandCenter();}
  }

  function renderModelReadiness() {
    const ram=Number(live.totalMemory || staticInfo?.totalMemory || 0); const vramMb=Number(live.gpu?.memoryTotalMB || 0); const vram=vramMb*1024**2;
    setText('#modelReadinessRam',ram?formatBytes(ram):'Unavailable'); setText('#modelReadinessVram',vram?formatBytes(vram):'Unavailable'); setText('#modelReadinessGpu',live.gpu?.name||staticInfo?.gpu?.Name||'Unavailable');
    let grade='Basic'; let detail='Local inference depends heavily on model size and quantization.'; const ramGb=ram/1024**3, vramGb=vram/1024**3;
    if(ramGb>=32 || vramGb>=12){grade='Strong';detail='Good local-AI headroom for many quantized models; exact fit still depends on the model.';}
    else if(ramGb>=16 || vramGb>=8){grade='Good';detail='Suitable for many smaller/quantized local models; exact fit depends on context size and quantization.';}
    else if(ramGb>=8 || vramGb>=4){grade='Entry';detail='Best suited to compact quantized models.';}
    setText('#modelReadiness',grade);setText('#modelReadinessDetail',detail);
  }
  function renderModelCenter() {
    const state=modelCenterState;if(!state)return;
    const providers=state.providers||[];const online=providers.filter(p=>p.online).length;const cloudConfigured=providers.filter(p=>p.scope==='cloud'&&p.configured).length;
    setText('#modelProviderCount',String(online));setText('#modelProviderDetail',`${online} of ${providers.length} provider${providers.length===1?'':'s'} online`);
    setText('#modelCount',String((state.models||[]).length));setText('#modelCountDetail',`${state.summary?.localModels||0} local · ${state.summary?.cloudModels||0} cloud`);
    setProviderCard('openai','#modelOpenAIStatus','#modelOpenAIDetail');setProviderCard('codex','#modelCodexStatus','#modelCodexDetail');setProviderCard('claude','#modelClaudeStatus','#modelClaudeDetail');setProviderCard('gemini','#modelGeminiStatus','#modelGeminiDetail');setProviderCard('ollama','#modelOllamaStatus','#modelOllamaDetail');setProviderCard('lmstudio','#modelLmStudioStatus','#modelLmStudioDetail');
    const custom=providerStatus('custom');setText('#modelCustomStatus',custom?(custom.online?`Connected · ${custom.modelsCount||0} model${custom.modelsCount===1?'':'s'} · ${custom.latencyMs??'—'} ms`:custom.error||'Endpoint unavailable'):(modelCustomEndpoint()?'Custom endpoint not checked.':'No custom endpoint configured.'));
    const secure=state.credentials?.encryptionAvailable;setText('#modelCredentialSecurity',secure?'Encrypted key vault':'Secure storage unavailable');
    const privacy=cloudConfigured?'MIXED':'LOCAL';setText('#modelPrivacyMode',privacy);setText('#modelPrivacyDetail',cloudConfigured?`${cloudConfigured} cloud provider credential${cloudConfigured===1?'':'s'} configured`:'No cloud provider configured');
    const active=activeModel();if(active&&savedActiveModelKey()!==modelKey(active))localStorage.setItem('pt.model.active',modelKey(active));
    setText('#modelActiveSummary',active?.name||active?.id||'None');setText('#modelActiveProvider',active?`${active.providerName||active.provider} · ${active.scope==='cloud'?'cloud API':'local'}`:'Select a discovered model');
    setText('#modelSelectedName',active?.name||active?.id||'None');setText('#modelSelectedMeta',active?`${active.providerName||active.provider} · ${active.scope==='cloud'?'Cloud API':active.endpoint||'local'}`:'Choose a model from the library.');
    const warning=$('#modelCloudWarning');if(warning){const cloud=active?.scope==='cloud';warning.textContent=cloud?(aiContextEnabled()&&aiContextCloudAllowed()?'CLOUD MODEL + SYSTEM CONTEXT · Your prompt and redacted PC context are sent to the selected provider. API charges may apply.':'CLOUD MODEL · Your prompt is sent to the selected provider. System context remains blocked unless you explicitly opt in.'):(aiContextEnabled()?'LOCAL MODEL + SYSTEM CONTEXT · Redacted PC context is attached when relevant.':'LOCAL MODEL · System context is off.');warning.classList.toggle('cloud',Boolean(cloud));}
    setText('#modelAssistantToggleNote',active?.scope==='cloud'?'Assistant questions use this cloud provider. System context is attached only when the separate cloud-context opt-in is enabled.':'Local models can receive the redacted System-Aware AI snapshot when context is enabled.');
    const chatState=$('#modelChatState');if(chatState){chatState.textContent=active?(active.scope==='cloud'?'Cloud ready':'Local ready'):'No model';chatState.classList.toggle('active',Boolean(active));}
    const send=$('#modelSend');if(send){send.disabled=!active||modelChatBusy;send.textContent=modelChatBusy?'Sending…':active?.scope==='cloud'?'Send to Provider':'Send Locally';}
    const q=($('#modelSearch')?.value||'').trim().toLowerCase();const filter=$('#modelProviderFilter')?.value||'all';
    const models=currentModelList().filter(m=>(filter==='all'||m.provider===filter)&&(!q||`${m.name||''} ${m.id||''} ${m.providerName||''}`.toLowerCase().includes(q)));
    const root=$('#modelList');if(root)root.innerHTML=models.length?models.map(m=>{const isActive=active&&modelKey(m)===modelKey(active);const meta=[m.providerName||m.provider,m.scope==='cloud'?'Cloud API':'Local',m.size?formatBytes(m.size):null,m.modifiedAt?`updated ${relativeTime(m.modifiedAt)}`:null].filter(Boolean).join(' · ');return `<button class="model-row ${isActive?'active':''}" data-model-key="${escapeHtml(modelKey(m))}"><div class="model-row-icon">${escapeHtml((m.providerName||m.provider||'AI').slice(0,2).toUpperCase())}</div><div class="model-row-copy"><strong>${escapeHtml(m.name||m.id||'Unnamed model')}</strong><small>${escapeHtml(meta)}</small></div><span class="chip ${isActive?'active':''}">${isActive?'Selected':'Use'}</span></button>`;}).join(''):'<div class="empty">No models matched. Configure a cloud provider or start a supported local provider, then refresh.</div>';
    setText('#modelLibrarySubtitle',`${models.length} shown · ${(state.models||[]).length} discovered`);renderModelReadiness();const routeAssistant=dragonRouterAssistantEnabled();const toggle=$('#modelAssistantToggle');if(toggle){toggle.checked=localStorage.getItem('pt.model.assistant')==='true';toggle.disabled=routeAssistant;}const routerAssistant=$('#dragonRouterAssistant');if(routerAssistant)routerAssistant.checked=routeAssistant;const cloudToggle=$('#dragonRouterCloud');if(cloudToggle)cloudToggle.checked=localStorage.getItem('pt.model.router.cloud')!=='false';const profileSelect=$('#dragonRouterProfile');if(profileSelect)profileSelect.value=localStorage.getItem('pt.model.router.profile')||'automatic';renderDragonRoute();renderAiContext();renderDragonCouncil();renderAiCommandCenter();if(routeAssistant)setText('#modelAssistantToggleNote','Dragon Router is controlling PowerTools Assistant model selection. Disable Router Assistant to pin a single model.');
  }
  async function loadModelCenter(force=false) {
    if(modelCenterLoading)return;if(modelCenterLoaded&&!force){renderModelCenter();return;}modelCenterLoading=true;setText('#modelProviderDetail','Checking configured providers…');
    try{modelCenterState=await api.getModelCenter?.(force,modelCustomEndpoint());modelCenterLoaded=Boolean(modelCenterState);renderModelCenter();}catch(error){toast('AI Command Center unavailable',String(error?.message||error||'Unknown error'));}finally{modelCenterLoading=false;}
  }
  function providerSetupMeta(provider) {
    const p=provider==='openai'?{name:'OpenAI / Codex',placeholder:'sk-…',note:'The OpenAI key is shared by OpenAI/ChatGPT and Codex models. A ChatGPT subscription is separate from OpenAI API billing.'}:provider==='anthropic'?{name:'Claude',placeholder:'sk-ant-…',note:'Uses Anthropic Claude API access for this key.'}:{name:'Gemini',placeholder:'Google AI Studio API key',note:'Uses Google Gemini API access for this key.'};return p;
  }
  function showProviderSetup(provider) {
    const meta=providerSetupMeta(provider);const status=modelCenterState?.credentials||{};const configured=provider==='openai'?status.openai:provider==='anthropic'?status.anthropic:status.gemini;
    openModal(`${meta.name} Provider`,`<div class="model-key-dialog"><p>Configure your own ${escapeHtml(meta.name)} API access for Purple Dragon PowerTools.</p><div class="model-key-note">${escapeHtml(meta.note)} API keys are encrypted by the desktop main process and are never returned to this page.</div><label><span>API KEY</span><input id="modelProviderKeyInput" type="password" autocomplete="new-password" placeholder="${escapeHtml(meta.placeholder)}" /></label><div class="model-key-dialog-actions">${configured?'<button class="secondary-btn" id="modelRemoveProviderKey">Remove Key</button>':''}<button class="secondary-btn" id="modelProviderCancel">Cancel</button><button class="primary-btn" id="modelProviderSave">Save & Test</button></div><div class="model-endpoint-status" id="modelProviderSetupStatus">${configured?'A key is already stored securely. Enter a replacement only if you want to change it.':'No key is stored for this provider.'}</div></div>`,'AI PROVIDER');
    $('#modelProviderCancel')?.addEventListener('click',closeModal);$('#modelProviderSave')?.addEventListener('click',async()=>{const key=($('#modelProviderKeyInput')?.value||'').trim();if(!key){setText('#modelProviderSetupStatus','Enter an API key first.');return;}const btn=$('#modelProviderSave');if(btn)btn.disabled=true;setText('#modelProviderSetupStatus','Encrypting key and testing provider…');const out=await api.saveModelCredential?.(provider,key);if(!out?.ok){setText('#modelProviderSetupStatus',out?.error||'Unable to save API key.');if(btn)btn.disabled=false;return;}closeModal();modelCenterLoaded=false;await loadModelCenter(true);toast(`${meta.name} configured`,providerStatus(provider==='anthropic'?'claude':provider)?.online?'Provider connected':'Key saved; provider needs review');});
    $('#modelRemoveProviderKey')?.addEventListener('click',async()=>{const out=await api.removeModelCredential?.(provider);if(out?.ok){closeModal();modelCenterLoaded=false;await loadModelCenter(true);toast(`${meta.name} credential removed`);}else setText('#modelProviderSetupStatus',out?.error||'Unable to remove key.');});setTimeout(()=>$('#modelProviderKeyInput')?.focus(),30);
  }
  async function sendModelPrompt() {
    const model=activeModel();const prompt=($('#modelPrompt')?.value||'').trim();if(!model||!prompt||modelChatBusy)return;modelChatBusy=true;renderModelCenter();setText('#modelResponse',model.scope==='cloud'?'Sending to configured provider…':'Thinking locally…');
    try{const result=await api.modelChat?.({provider:model.provider,model:model.id||model.name,endpoint:model.endpoint,customEndpoint:model.provider==='custom'?modelCustomEndpoint():'',system:($('#modelSystemPrompt')?.value||'').trim(),prompt,systemAware:systemAwareRequest()});noteContextResult(result);if(result?.ok){setText('#modelResponse',result.text||'(Empty response)');setText('#modelChatState',`${Math.round(result.latencyMs||0)} ms${result?.systemContext?.attached?' · Context':''}`);await logActivity(result.scope==='cloud'?'Cloud model response':'Local model response',`${model.providerName||model.provider} · ${model.name||model.id} · ${Math.round(result.latencyMs||0)} ms${result?.systemContext?.attached?' · System-Aware':''}`);if(result?.systemContext?.requested&&!result?.systemContext?.attached&&model.scope==='cloud')toast('Cloud context blocked',result.systemContext.reason||'Enable cloud system context if you want PC facts attached.');}else setText('#modelResponse',`Error: ${result?.error||'AI request failed'}`);}catch(error){setText('#modelResponse',`Error: ${String(error?.message||error)}`);}finally{modelChatBusy=false;renderModelCenter();}
  }
  async function resolveAssistantModel(prompt=''){if(!modelCenterState){try{modelCenterState=await api.getModelCenter?.(false,modelCustomEndpoint());modelCenterLoaded=Boolean(modelCenterState);}catch{return null;}}if(dragonRouterAssistantEnabled()&&String(prompt||'').trim()){try{const route=await api.routeModel?.({prompt:String(prompt),profile:dragonRouterProfile(),allowCloud:dragonRouterCloudAllowed(),customEndpoint:modelCustomEndpoint()});dragonRouteState=route||null;renderDragonRoute();if(route?.ok)return route.selected;}catch{}}return activeModel();}



  function updateCheckPolicyLabel(value){
    return ({manual:'Manual only',startup:'Every startup','6h':'Every 6 hours','12h':'Every 12 hours',daily:'Daily',weekly:'Weekly'})[value]||'Daily';
  }
  function renderUpdateReleaseCenter(){
    const st=updateReleaseState||{};const settings=st.settings||{};const current=st.currentVersion||appInfo?.version||'2.2.0';const latest=st.latestVersion||null;const trust=st.trust||{};
    setText('#updateCurrentVersion',`v${current}`);setText('#updateBuildType',st.build?.type||'Build origin unavailable');
    setText('#updateLatestVersion',latest?`v${latest}`:'Not checked');
    setText('#updateLatestMeta',st.error?`Check failed · ${st.error}`:st.updateAvailable?'New release available':latest?'Installed version is current or newer':'Run an update check to query official releases');
    setText('#updateChannelSummary',(st.channel||settings.channel)==='preview'?'Preview':'Stable');
    setText('#updateCheckMeta',`${updateCheckPolicyLabel(st.checkPolicy||settings.checkPolicy)} update checks${st.lastCheckAt?` · last ${relativeTime(st.lastCheckAt)}`:''}`);
    const trustParts=[trust.manifestAvailable?'Manifest':null,trust.checksumAvailable?'SHA-256':null,trust.signatureAvailable?'Signature':null].filter(Boolean);
    setText('#updateTrustSummary',trustParts.length?trustParts.join(' + '):latest?'Verification material incomplete':'Pending');
    setText('#updateTrustMeta',latest?`${trust.manifestAvailable?'Manifest found':'No manifest'} · ${trust.checksumAvailable?'Checksum found':'No checksum'} · ${trust.signatureAvailable?'Signature found':'No signature'}`:'Manifest, checksum and signature presence');
    setText('#updateStatusText',st.error?`Official update source unavailable · ${st.error}`:`Official repository: ${st.repository||'bubblegump30/PurpleDragonPowerTools'}${st.updateAvailable?' · update available':''}`);
    const open=$('#updateOpenRelease');if(open)open.disabled=!st.latestReleaseUrl;
    const channel=$('#updateChannel');if(channel)channel.value=settings.channel||st.channel||'stable';
    const policy=$('#updateCheckPolicy');if(policy)policy.value=settings.checkPolicy||st.checkPolicy||'daily';
    const verify=$('#updateVerifySha');if(verify)verify.checked=settings.verifySha256!==false;
    const sig=$('#updateRequireSignature');if(sig)sig.checked=settings.requireReleaseSignature!==false;
    const rollback=$('#updateKeepRollback');if(rollback)rollback.checked=settings.keepRollbackPackage!==false;
    const notifications=$('#updateShowNotifications');if(notifications)notifications.checked=settings.showNotifications!==false;
    const releases=Array.isArray(st.releases)?st.releases:[];setText('#updateHistoryMeta',releases.length?`${releases.length} release${releases.length===1?'':'s'} loaded`:st.lastCheckAt?`Last checked ${relativeTime(st.lastCheckAt)}`:'No update check yet');
    const list=$('#updateReleaseHistory');if(list)list.innerHTML=releases.length?releases.map(r=>`<button class="update-release-row" data-update-release-link="${escapeHtml(r.url||'')}"><span><strong>${escapeHtml(r.name||r.tag||'Release')}</strong><small>${escapeHtml(r.tag||'')}${r.prerelease?' · Preview':''} · ${escapeHtml(relativeTime(r.publishedAt))}</small></span><b>${r.trust?.checksumAvailable?'SHA-256':'No checksum'}${r.trust?.signatureAvailable?' · Signed':''}</b></button>`).join(''):'<div class="empty">Run Check for Updates to load release history.</div>';
    const check=$('#updateCheck');if(check){check.disabled=updateReleaseLoading;check.textContent=updateReleaseLoading?'Checking…':'Check for Updates';}
  }
  async function loadUpdateReleaseCenter(force=false){
    if(updateReleaseLoading)return;updateReleaseLoading=true;renderUpdateReleaseCenter();
    try{updateReleaseState=force?await api.checkForAppUpdates?.(true):await api.getUpdateReleaseState?.();if(updateReleaseState?.error&&force)toast('Update check needs review',updateReleaseState.error);else if(force&&updateReleaseState?.updateAvailable)toast('Update available',`v${updateReleaseState.latestVersion} is available.`);else if(force)toast('Update check complete',updateReleaseState?.latestVersion?`Latest: v${updateReleaseState.latestVersion}`:'No eligible release found.');}
    catch(error){toast('Update & Release Center unavailable',String(error?.message||error));}
    finally{updateReleaseLoading=false;renderUpdateReleaseCenter();}
  }
  async function saveUpdateReleaseSettings(){
    const payload={channel:$('#updateChannel')?.value||'stable',checkPolicy:$('#updateCheckPolicy')?.value||'daily',verifySha256:Boolean($('#updateVerifySha')?.checked),requireReleaseSignature:Boolean($('#updateRequireSignature')?.checked),keepRollbackPackage:Boolean($('#updateKeepRollback')?.checked),showNotifications:Boolean($('#updateShowNotifications')?.checked)};
    try{const out=await api.saveUpdateReleaseSettings?.(payload);if(!out?.ok){toast('Update settings not saved',out?.error||'Unknown error');return;}updateReleaseState=out.state||updateReleaseState;if(updateReleaseState)updateReleaseState.settings=out.settings||payload;renderUpdateReleaseCenter();}
    catch(error){toast('Update settings not saved',String(error?.message||error));}
  }

  function githubSelectedRepoName(){
    const saved=localStorage.getItem('pt.github.repo')||'';const repos=Array.isArray(githubCenterState?.repositories)?githubCenterState.repositories:[];
    return repos.some(r=>r.fullName===saved)?saved:'';
  }
  function githubRepoAccess(repo){if(repo?.permissions?.admin)return 'Admin';if(repo?.permissions?.maintain)return 'Maintain';if(repo?.permissions?.push)return 'Write';return repo?.permissions?.pull?'Read':'Unknown';}
  function githubSelectedRepoObject(){const name=githubSelectedRepoName();return (githubCenterState?.repositories||[]).find(r=>r.fullName===name)||null;}
  function githubBranchName(){const value=$('#githubBranch')?.value||githubRepoDetails?.repository?.defaultBranch||githubSelectedRepoObject()?.defaultBranch||'';return String(value||'');}
  function renderGitHubFileList(selector,items,emptyText){const root=$(selector);if(!root)return;root.innerHTML=items?.length?items.map(f=>`<div class="github-file-row"><div><strong>${escapeHtml(f.relativePath||f.name||'file')}</strong><small>${escapeHtml(f.name||'')}</small></div><b>${formatBytes(Number(f.sizeBytes)||0)}</b></div>`).join(''):`<div class="empty">${escapeHtml(emptyText)}</div>`;}
  function renderGitHubCenter(){
    const st=githubCenterState||{};const configured=Boolean(st.configured||st.credential?.configured);const profile=st.profile||{};const repos=Array.isArray(st.repositories)?st.repositories:[];const selected=githubSelectedRepoObject();
    setText('#githubAccount',configured?(profile.login||'Connected'):'Not connected');setText('#githubAccountMeta',configured?(profile.name?`${profile.name} · authenticated`:'Authenticated GitHub account'):'Fine-grained PAT recommended');
    setText('#githubRepoCount',String(repos.length));setText('#githubRepoCountMeta',configured?`${repos.filter(r=>r.private).length} private · ${repos.filter(r=>!r.private).length} public`:'Connect GitHub to load repositories');
    setText('#githubSelectedRepo',selected?.name||'None');setText('#githubSelectedRepoMeta',selected?`${selected.private?'Private':'Public'} · ${selected.defaultBranch||'default branch'}`:'Choose a repository below');
    setText('#githubVaultState',st.credential?.encryptionAvailable===false?'Unavailable':configured?'Encrypted':'Ready');
    setText('#githubRepoSubtitle',st.error?`Connection needs review · ${st.error}`:configured?`${repos.length} accessible repositories · ${relativeTime(st.generatedAt)}`:'GitHub is not connected.');
    const configure=$('#githubConfigure');if(configure)configure.textContent=configured?'GitHub Settings':'Configure GitHub';
    const q=($('#githubRepoSearch')?.value||'').trim().toLowerCase();const shown=repos.filter(r=>!q||`${r.fullName} ${r.description||''}`.toLowerCase().includes(q));const list=$('#githubRepoList');if(list)list.innerHTML=shown.length?shown.map(r=>`<button class="github-repo-row ${selected?.fullName===r.fullName?'active':''}" data-github-repo="${escapeHtml(r.fullName)}"><span class="github-repo-icon">${r.private?'🔒':'GH'}</span><span class="github-repo-copy"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.owner)} · ${escapeHtml(r.defaultBranch||'main')}${r.archived?' · Archived':''}</small></span><span class="chip ${r.private?'private':'public'}">${r.private?'PRIVATE':'PUBLIC'}</span></button>`).join(''):`<div class="empty">${configured?'No repositories match the search.':'Configure GitHub to load repositories.'}</div>`;
    renderGitHubRepoDetails();renderGitHubFileList('#githubSourceFiles',githubSourceFiles,'No source files selected.');renderGitHubFileList('#githubReleaseAssets',githubReleaseAssetFiles,'No release assets selected.');
    setText('#githubSourceSummary',`${githubSourceFiles.length} file${githubSourceFiles.length===1?'':'s'} selected`);setText('#githubAssetSummary',`${githubReleaseAssetFiles.length} asset${githubReleaseAssetFiles.length===1?'':'s'} selected`);
    const canWrite=Boolean(selected&&!selected.archived&&(selected?.permissions?.push||selected?.permissions?.admin||selected?.permissions?.maintain));if($('#githubCommitUpload'))$('#githubCommitUpload').disabled=!canWrite||!githubSourceFiles.length||githubBusy;if($('#githubPublishRelease'))$('#githubPublishRelease').disabled=!canWrite||githubBusy;if($('#githubGenerateNotes'))$('#githubGenerateNotes').disabled=!canWrite||githubBusy;if($('#githubOpenRepo'))$('#githubOpenRepo').disabled=!selected;
  }
  function renderGitHubRepoDetails(){
    const selected=githubSelectedRepoObject();const detail=githubRepoDetails?.ok?githubRepoDetails:null;setText('#githubWorkspaceTitle',selected?selected.name.toUpperCase():'REPOSITORY WORKSPACE');setText('#githubWorkspaceMeta',selected?selected.fullName:'Select a repository to begin.');
    setText('#githubAccess',selected?githubRepoAccess(selected):'--');setText('#githubAccessMeta',selected?`${selected.private?'Private':'Public'} repository${selected.archived?' · archived':''}`:'No repository selected');
    const branch=$('#githubBranch');if(branch){const branches=detail?.branches||[];const preferred=githubRepoDetails?._selectedBranch||selected?.defaultBranch||'';branch.innerHTML=branches.length?branches.map(b=>`<option value="${escapeHtml(b.name)}" ${b.name===preferred?'selected':''}>${escapeHtml(b.name)}${b.protected?' · protected':''}</option>`).join(''):(selected?`<option value="${escapeHtml(selected.defaultBranch||'main')}">${escapeHtml(selected.defaultBranch||'main')}</option>`:'<option>--</option>');branch.disabled=!selected;}
    const commits=$('#githubRecentCommits');if(commits)commits.innerHTML=detail?.commits?.length?detail.commits.map(c=>`<button class="github-mini-row" data-github-link="${escapeHtml(c.url||'')}"><span><strong>${escapeHtml(c.message||'Commit')}</strong><small>${escapeHtml(c.author||'GitHub')} · ${relativeTime(c.date)}</small></span><b>${escapeHtml(c.shortSha||'')}</b></button>`).join(''):`<div class="empty">${githubRepoLoading?'Loading commits…':detail?.emptyRepository?'Empty repository — first upload will initialize the default branch automatically.':'No commit history loaded.'}</div>`;
    const releases=$('#githubRecentReleases');if(releases)releases.innerHTML=detail?.releases?.length?detail.releases.map(r=>`<button class="github-mini-row" data-github-link="${escapeHtml(r.url||'')}"><span><strong>${escapeHtml(r.name||r.tag||'Release')}</strong><small>${escapeHtml(r.tag||'')}${r.draft?' · Draft':''}${r.prerelease?' · Pre-release':''}</small></span><b>${r.assets||0} assets</b></button>`).join(''):`<div class="empty">${githubRepoLoading?'Loading releases…':'No GitHub releases found.'}</div>`;
  }
  async function loadGitHubCenter(force=false){
    if(githubCenterLoading)return;if(githubCenterLoaded&&!force){renderGitHubCenter();return;}githubCenterLoading=true;setText('#githubRepoSubtitle','Connecting to GitHub…');
    try{githubCenterState=await api.getGitHubCenter?.(force);githubCenterLoaded=Boolean(githubCenterState);if(githubCenterState?.error)toast('GitHub connection needs review',githubCenterState.error);const repos=githubCenterState?.repositories||[];let selected=githubSelectedRepoName();if(!selected&&repos.length){selected=repos[0].fullName;localStorage.setItem('pt.github.repo',selected);}renderGitHubCenter();if(selected)await loadGitHubRepoDetails(selected,false);}catch(error){toast('GitHub Release Center unavailable',String(error?.message||error));}finally{githubCenterLoading=false;renderGitHubCenter();}
  }
  async function loadGitHubRepoDetails(repo,force=true){
    if(!repo||githubRepoLoading)return;if(!force&&githubRepoDetails?.repository?.fullName===repo){renderGitHubRepoDetails();return;}githubRepoLoading=true;githubRepoDetails=null;renderGitHubRepoDetails();
    try{const out=await api.getGitHubRepoDetails?.(repo);if(!out?.ok){toast('Repository details unavailable',out?.error||'GitHub request failed.');return;}githubRepoDetails=out;githubRepoDetails._selectedBranch=out.repository?.defaultBranch||githubSelectedRepoObject()?.defaultBranch||'';renderGitHubRepoDetails();if($('#githubReleaseTitle')&&!$('#githubReleaseTitle').value.trim())$('#githubReleaseTitle').value=`${out.repository?.name||'Release'} v${appInfo?.version||'2.2.0'}`;}catch(error){toast('Repository details unavailable',String(error?.message||error));}finally{githubRepoLoading=false;renderGitHubRepoDetails();renderGitHubCenter();}
  }
  function showGitHubSetup(){
    const configured=Boolean(githubCenterState?.configured||githubCenterState?.credential?.configured);const login=githubCenterState?.profile?.login||'';
    openModal('GitHub Release Center',`<div class="model-key-dialog"><p>${configured?`Connected as <strong>${escapeHtml(login||'GitHub user')}</strong>. You can replace the token or disconnect.`:'Connect your GitHub account with a fine-grained personal access token.'}</p><div class="model-key-note">Recommended permission: repository <strong>Contents: Read and write</strong>, limited to only the repositories you want Purple Dragon PowerTools to manage. The token is encrypted in Electron safeStorage and never returned to this page after saving.</div><label><span>FINE-GRAINED PERSONAL ACCESS TOKEN</span><input id="githubTokenInput" type="password" autocomplete="new-password" placeholder="github_pat_…" /></label><div class="model-key-dialog-actions"><button class="secondary-btn" id="githubOpenTokenSettings">Create Token</button>${configured?'<button class="secondary-btn" id="githubDisconnect">Disconnect</button>':''}<button class="secondary-btn" id="githubSetupCancel">Cancel</button><button class="primary-btn" id="githubSetupSave">Save & Test</button></div><div class="model-endpoint-status" id="githubSetupStatus">${configured?'A GitHub token is stored securely.':'No GitHub token is stored.'}</div></div>`,'GITHUB');
    $('#githubSetupCancel')?.addEventListener('click',closeModal);$('#githubOpenTokenSettings')?.addEventListener('click',async()=>{const out=await api.openGitHubTokenSettings?.();if(!out?.ok)toast('Unable to open GitHub token settings',out?.error||'');});$('#githubSetupSave')?.addEventListener('click',async()=>{const token=($('#githubTokenInput')?.value||'').trim();if(!token){setText('#githubSetupStatus','Enter a GitHub personal access token first.');return;}const btn=$('#githubSetupSave');if(btn)btn.disabled=true;setText('#githubSetupStatus','Testing GitHub access and encrypting token…');const out=await api.saveGitHubToken?.(token);if(!out?.ok){setText('#githubSetupStatus',out?.error||'Unable to connect GitHub.');if(btn)btn.disabled=false;return;}closeModal();githubCenterLoaded=false;githubRepoDetails=null;await loadGitHubCenter(true);toast('GitHub connected',out.profile?.login||'GitHub account');});$('#githubDisconnect')?.addEventListener('click',async()=>{const out=await api.removeGitHubToken?.();if(!out?.ok){setText('#githubSetupStatus',out?.error||'Unable to disconnect GitHub.');return;}closeModal();githubCenterState=null;githubCenterLoaded=false;githubRepoDetails=null;githubSourceFiles=[];githubReleaseAssetFiles=[];localStorage.removeItem('pt.github.repo');await loadGitHubCenter(true);toast('GitHub disconnected');});setTimeout(()=>$('#githubTokenInput')?.focus(),30);
  }
  async function chooseGitHubSource(kind){const out=await api.selectGitHubSource?.(kind);if(out?.canceled)return;if(!out?.ok){toast('Source selection failed',out?.error||'');return;}githubSourceFiles=out.files||[];renderGitHubCenter();}
  async function chooseGitHubAssets(){const out=await api.selectGitHubReleaseAssets?.();if(out?.canceled)return;if(!out?.ok){toast('Release asset selection failed',out?.error||'');return;}githubReleaseAssetFiles=out.files||[];renderGitHubCenter();}
  async function commitGitHubSource(){const repo=githubSelectedRepoName();const branch=githubBranchName();if(!repo||!branch||githubBusy)return;githubBusy=true;renderGitHubCenter();try{const out=await api.commitGitHubSource?.({repo,branch,prefix:($('#githubDestination')?.value||'').trim(),message:($('#githubCommitMessage')?.value||'').trim()});if(out?.canceled)return;if(!out?.ok){toast('GitHub commit failed',out?.error||'');return;}toast(out.initializedEmptyRepository?'GitHub repository initialized':'GitHub source update published',`${out.files||0} files · ${String(out.commitSha||'').slice(0,7)}`);githubRepoDetails=null;await loadGitHubRepoDetails(repo,true);await refreshActivity();if(out.commitUrl)openModal('GitHub Commit Published',`<p>${escapeHtml(out.message||'Source update')}</p><div class="model-key-dialog-actions"><button class="secondary-btn" id="githubCommitDone">Close</button><button class="primary-btn" id="githubCommitOpen">Open Commit</button></div>`,'GITHUB');$('#githubCommitDone')?.addEventListener('click',closeModal);$('#githubCommitOpen')?.addEventListener('click',()=>api.openGitHubLink?.(out.commitUrl));}finally{githubBusy=false;renderGitHubCenter();}}
  async function generateGitHubNotes(){const repo=githubSelectedRepoName(),branch=githubBranchName(),tag=($('#githubReleaseTag')?.value||'').trim();if(!repo||!branch||!tag||githubBusy)return;githubBusy=true;renderGitHubCenter();try{const out=await api.generateGitHubReleaseNotes?.({repo,branch,tag});if(!out?.ok){toast('Release notes unavailable',out?.error||'');return;}if($('#githubReleaseNotes'))$('#githubReleaseNotes').value=out.body||'';if($('#githubReleaseTitle')&&!$('#githubReleaseTitle').value.trim())$('#githubReleaseTitle').value=out.name||tag;toast('GitHub release notes generated');}finally{githubBusy=false;renderGitHubCenter();}}
  async function publishGitHubRelease(){const repo=githubSelectedRepoName(),branch=githubBranchName();if(!repo||!branch||githubBusy)return;githubBusy=true;renderGitHubCenter();try{const out=await api.publishGitHubRelease?.({repo,branch,tag:($('#githubReleaseTag')?.value||'').trim(),name:($('#githubReleaseTitle')?.value||'').trim(),body:($('#githubReleaseNotes')?.value||''),draft:Boolean($('#githubReleaseDraft')?.checked),prerelease:Boolean($('#githubReleasePrerelease')?.checked),updateExisting:Boolean($('#githubUpdateExisting')?.checked),replaceAssets:Boolean($('#githubReplaceAssets')?.checked)});if(out?.canceled)return;if(!out?.ok){toast('GitHub release failed',out?.error||'');return;}toast('GitHub release published',`${out.tag} · ${out.uploaded?.length||0} assets`);githubRepoDetails=null;await loadGitHubRepoDetails(repo,true);await refreshActivity();openModal('GitHub Release Published',`<p><strong>${escapeHtml(out.tag||'Release')}</strong> was published to ${escapeHtml(out.repo||repo)}.</p><div class="model-key-dialog-actions"><button class="secondary-btn" id="githubReleaseDone">Close</button><button class="primary-btn" id="githubReleaseOpen">Open Release</button></div>`,'GITHUB');$('#githubReleaseDone')?.addEventListener('click',closeModal);$('#githubReleaseOpen')?.addEventListener('click',()=>api.openGitHubLink?.(out.releaseUrl));}finally{githubBusy=false;renderGitHubCenter();}}

  function featureLabStateClass(feature){
    if(feature?.compatibility==='unsupported')return 'unsupported';
    if(feature?.state==='enabled')return 'enabled';
    if(feature?.compatibility==='unknown'||feature?.state==='unknown'||feature?.state==='system-default')return 'review';
    return '';
  }
  function featureLabChipClass(feature){
    if(feature?.compatibility==='unsupported'||feature?.compatibility==='unknown'||feature?.state==='unknown'||feature?.state==='system-default')return 'warn';
    if(feature?.state==='enabled')return 'on';return 'off';
  }
  function featureLabFilteredFeatures(){
    const arr=Array.isArray(featureLabState?.features)?featureLabState.features:[];const q=($('#featureLabSearch')?.value||'').trim().toLowerCase();const category=$('#featureLabCategory')?.value||'all';const state=$('#featureLabStateFilter')?.value||'all';
    return arr.filter(f=>{if(category!=='all'&&f.category!==category)return false;if(q&&!`${f.title||''} ${f.description||''} ${f.categoryLabel||''} ${f.compatibilityDetail||''}`.toLowerCase().includes(q))return false;if(state==='all')return true;if(state==='enabled'||state==='disabled')return f.state===state;if(state==='supported')return f.compatibility==='supported';if(state==='unsupported')return f.compatibility==='unsupported';if(state==='unknown')return f.compatibility==='unknown'||f.state==='unknown'||f.state==='system-default';return true;});
  }
  function renderFeatureLab(){
    const st=featureLabState;if(!st)return;const win=st.windows||{};const summary=st.summary||{};const build=[win.displayVersion,win.build?`Build ${win.build}${win.ubr!=null?`.${win.ubr}`:''}`:null].filter(Boolean).join(' · ');
    setText('#featureLabWindows',win.productName||'Windows');setText('#featureLabWindowsMeta',[win.editionId,build].filter(Boolean).join(' · ')||'Edition/build unavailable');setText('#featureLabSupported',`${summary.supported||0}/${summary.featureCount||0}`);setText('#featureLabSupportedMeta',summary.unsupported?`${summary.unsupported} unavailable on this edition/device`:'Compatible feature set');setText('#featureLabEnabled',String(summary.enabled||0));setText('#featureLabEnabledMeta',`${summary.needsReview||0} item${summary.needsReview===1?'':'s'} need review`);setText('#featureLabScanMode',st.elevated?'Administrator':'Standard');setText('#featureLabScanMeta',st.elevated?'Optional-feature inventory read with UAC approval':'Some optional-feature states may require Admin Scan');
    const reboot=$('#featureLabRebootChip');if(reboot){reboot.textContent=summary.rebootPending?'Restart pending':'No restart detected';reboot.classList.toggle('active',!summary.rebootPending);}
    const list=featureLabFilteredFeatures();setText('#featureLabResultMeta',`${list.length} shown · ${summary.featureCount||0} discovered · scan ${relativeTime(st.generatedAt)}`);
    const root=$('#featureLabGrid');if(!root)return;root.innerHTML=list.length?list.map(f=>{const req=(f.requirements||[]).slice(0,2).join(' · ')||'No special requirement';const primary=f.primaryAction&&f.compatibility!=='unsupported'?`<button class="primary-btn feature-primary" data-feature-lab-action="apply" data-feature-action-type="${escapeHtml(f.primaryAction.type)}">${escapeHtml(f.primaryAction.label)}</button>`:'';const open=f.openAvailable?'<button class="small-btn" data-feature-lab-action="open">Open Settings</button>':'';return `<article class="panel feature-card ${featureLabStateClass(f)}" data-feature-id="${escapeHtml(f.id)}"><div class="feature-card-head"><div class="feature-card-icon">${escapeHtml(f.icon||'WF')}</div><div class="feature-card-title"><strong>${escapeHtml(f.title)}</strong><small>${escapeHtml(f.categoryLabel||f.category||'Windows')}</small></div><span class="feature-card-state ${featureLabChipClass(f)}">${escapeHtml(f.compatibility==='unsupported'?'Not supported':f.stateLabel||f.state||'Unknown')}</span></div><p class="feature-card-desc">${escapeHtml(f.description||'')}</p><div class="feature-card-facts"><div><span>RISK</span><strong>${escapeHtml(f.risk||'Low')}</strong></div><div><span>RESTART</span><strong>${f.restartRequired?'Likely':'No'}</strong></div><div><span>ADMIN</span><strong>${f.requiresAdmin?'Required':'No'}</strong></div></div><div class="feature-card-compat"><b>${escapeHtml(f.compatibilityLabel||'Needs review')}.</b> ${escapeHtml(f.compatibilityDetail||'')}</div><div class="feature-card-actions"><button class="small-btn" data-feature-lab-action="details">Details</button>${open}${primary}</div></article>`;}).join(''):'<div class="panel empty feature-lab-empty">No Feature Lab items match the current filters.</div>';
  }
  async function loadFeatureLab(force=false,admin=false){
    if(featureLabLoading)return;if(featureLabLoaded&&!force&&!admin){renderFeatureLab();return;}featureLabLoading=true;setText('#featureLabResultMeta',admin?'Waiting for Windows UAC approval…':'Inspecting Windows capabilities…');
    try{const out=admin?await api.getFeatureLabAdmin?.():await api.getFeatureLab?.(force);if(out?.canceled){toast('Administrator scan canceled');return;}if(out?.error&&!out?.features?.length){toast('Feature Lab scan unavailable',out.error);return;}featureLabState=out;featureLabLoaded=Boolean(out);renderFeatureLab();if(out?.error)toast('Feature Lab partial scan',out.error);}
    catch(error){toast('Feature Lab unavailable',String(error?.message||error||'Unknown error'));}finally{featureLabLoading=false;}
  }
  function showFeatureDetails(feature){
    if(!feature)return;const req=(feature.requirements||[]).map(x=>`• ${escapeHtml(x)}`).join('<br>')||'No special requirements reported.';const primary=feature.primaryAction&&feature.compatibility!=='unsupported'?`<button class="primary-btn" id="featureDetailApply" data-feature-action-type="${escapeHtml(feature.primaryAction.type)}">${escapeHtml(feature.primaryAction.label)}</button>`:'';const open=feature.openAvailable?'<button class="secondary-btn" id="featureDetailOpen">Open Windows Settings</button>':'';
    openModal(feature.title,`<div class="feature-detail"><div class="feature-detail-summary"><strong>${escapeHtml(feature.stateLabel||feature.state||'Unknown')} · ${escapeHtml(feature.compatibilityLabel||'Needs review')}</strong><small>${escapeHtml(feature.description||'')}</small></div><div class="feature-detail-grid"><div><span>SOURCE</span><strong>${escapeHtml(feature.source||'Windows')}</strong></div><div><span>RISK</span><strong>${escapeHtml(feature.risk||'Low')}</strong></div><div><span>REVERSIBLE</span><strong>${feature.reversible?'Yes':'Review first'}</strong></div><div><span>RESTART</span><strong>${feature.restartRequired?'May be required':'Normally no'}</strong></div></div><div class="feature-detail-requirements"><strong>Compatibility</strong><br>${escapeHtml(feature.compatibilityDetail||'')}<br><br><strong>Requirements</strong><br>${req}</div><div class="feature-detail-actions"><button class="secondary-btn" id="featureDetailClose">Close</button>${open}${primary}</div></div>`,'FEATURE LAB');
    $('#featureDetailClose')?.addEventListener('click',closeModal);$('#featureDetailOpen')?.addEventListener('click',async()=>{const r=await api.openFeatureLabItem?.(feature.id);if(!r?.ok)toast(demoMode?'Desktop-only action':'Unable to open Windows settings',r?.error||'');});$('#featureDetailApply')?.addEventListener('click',async e=>{closeModal();await runFeatureLabAction(feature,e.currentTarget.dataset.featureActionType);});
  }
  async function runFeatureLabAction(feature,action){
    if(!feature||featureLabBusy)return;featureLabBusy=true;const card=$(`[data-feature-id="${CSS.escape(feature.id)}"]`);card?.classList.add('feature-busy');try{const out=await api.applyFeatureLabAction?.(feature.id,action);if(out?.canceled){toast('Feature change canceled',feature.title);return;}if(!out?.ok){toast('Feature change failed',out?.error||'Windows rejected the change.');return;}toast(`${out.label||feature.title} updated`,out.restartRequired?'Windows restart may be required.':'Change completed.');featureLabLoaded=false;await loadFeatureLab(true,false);await refreshActivity();}catch(error){toast('Feature change failed',String(error?.message||error));}finally{featureLabBusy=false;card?.classList.remove('feature-busy');}
  }

  function journalFilteredEntries(){
    const arr=Array.isArray(changeJournalState?.entries)?changeJournalState.entries:[];
    const q=($('#journalSearch')?.value||'').trim().toLowerCase();const category=$('#journalCategory')?.value||'all';const state=$('#journalStateFilter')?.value||'all';
    return arr.filter(e=>{if(category!=='all'&&e.category!==category)return false;if(q&&!`${e.title} ${e.summary} ${e.category} ${e.source}`.toLowerCase().includes(q))return false;if(state==='undoable'&&(!e.reversible||e.undone))return false;if(state==='undone'&&!e.undone)return false;if(state==='audit'&&e.reversible)return false;return true;});
  }
  function renderChangeJournal(){
    const st=changeJournalState||{entries:[],count:0,reversibleCount:0,undoneCount:0};setText('#journalCount',String(st.count||0));setText('#journalUndoCount',String(st.reversibleCount||0));setText('#journalUndoneCount',String(st.undoneCount||0));
    const list=journalFilteredEntries();setText('#journalMeta',`${list.length} shown · ${st.count||0} recorded`);const root=$('#journalList');if(!root)return;
    root.innerHTML=list.length?list.map(e=>{const state=e.undone?'UNDONE':e.reversible?'UNDO READY':'AUDIT ONLY';const cls=e.undone?'journal-undone':e.reversible?'journal-reversible':'journal-audit';const undo=e.reversible&&!e.undone?`<button class="primary-btn journal-undo-btn" data-journal-undo="${escapeHtml(e.id)}">Undo</button>`:'';return `<article class="panel journal-entry ${cls}"><div class="journal-entry-icon">${e.undone?'✓':e.reversible?'↶':'•'}</div><div class="journal-entry-main"><div class="journal-entry-head"><div><strong>${escapeHtml(e.title||'Change')}</strong><small>${escapeHtml(e.category||'PowerTools')} · ${escapeHtml(e.source||'PowerTools')} · ${escapeHtml(relativeTime(e.at))}</small></div><span class="journal-state-chip">${state}</span></div><p>${escapeHtml(e.summary||'No additional detail')}</p><div class="journal-entry-meta"><span>Risk: <b>${escapeHtml(e.risk||'Low')}</b></span>${e.restartRequired?'<span>Restart may be required</span>':''}${e.undoneAt?`<span>Undone ${escapeHtml(relativeTime(e.undoneAt))}</span>`:''}</div></div><div class="journal-entry-actions">${undo}</div></article>`;}).join(''):'<div class="panel empty journal-empty">No Change Journal entries match the current filters.</div>';
  }
  async function loadChangeJournal(){if(changeJournalLoading)return;changeJournalLoading=true;try{changeJournalState=await api.getChangeJournal?.();renderChangeJournal();}catch(error){toast('Change Journal unavailable',String(error?.message||error));}finally{changeJournalLoading=false;}}
  async function undoJournalEntry(id){if(changeJournalLoading)return;changeJournalLoading=true;try{const out=await api.undoChangeJournalEntry?.(id);if(out?.canceled)return;if(!out?.ok){toast('Undo unavailable',out?.error||'The change could not be undone.');return;}changeJournalState=out.state||await api.getChangeJournal?.();renderChangeJournal();toast('Change undone',out.detail||'Previous state restored.');await refreshActivity();}catch(error){toast('Undo failed',String(error?.message||error));}finally{changeJournalLoading=false;}}

  function navigate(view) {
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`)?.classList.add('active');
    if (view === 'performance') refreshPowerProfiles();
    if (view === 'models') loadModelCenter(false);
    if (view === 'system') { refreshStatic(false); refreshStartup(false); }
    if (view === 'featurelab') loadFeatureLab(false,false);
    if (view === 'security') refreshSecurity(false);
    if (view === 'settings') { loadReliability(false); loadStableRelease(false); }
    if (view === 'journal') loadChangeJournal();
    if (view === 'automation') { loadAutomationCenter(false); resetAutomationBuilder(automationEditingRuleId ? automationState?.rules?.find(r=>r.id===automationEditingRuleId) : null); }
    if (view === 'data') loadDataHub(false);
    if (view === 'network') loadNetworkCenter(false);
    if (view === 'integrations') { loadUpdateReleaseCenter(false); loadGitHubCenter(false); }
    if (view === 'apps') { loadAppCenter(false); startAppCenterAutoRefresh(); } else stopAppCenterAutoRefresh();
    setTimeout(drawCharts, 60);
  }

  function openModal(title, body, eyebrow='COMMAND') {
    setText('#modalTitle', title); setText('#modalEyebrow', eyebrow); $('#modalBody').innerHTML = body; $('#modalBackdrop').hidden = false;
  }
  function closeModal(){ $('#modalBackdrop').hidden = true; }
  function setProfileMenu(open) {
    const button = $('#profileMenuButton'); const menu = $('#profileMenu');
    if(!button || !menu) return;
    const shouldOpen = Boolean(open);
    menu.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if(shouldOpen) setTimeout(()=>menu.querySelector('[role="menuitem"]')?.focus(),0);
  }
  function toggleProfileMenu(){ const button=$('#profileMenuButton'); setProfileMenu(button?.getAttribute('aria-expanded')!=='true'); }
  function architectureLabel(arch){ return arch==='x64'?'64-bit':arch==='ia32'?'32-bit':arch==='arm64'?'ARM64':String(arch||'Unknown'); }
  async function showAbout() {
    setProfileMenu(false);
    try { appInfo = await api.getAppInfo?.() || appInfo; } catch {}
    const info = appInfo || {name:'Purple Dragon PowerTools',version:'2.2.0',edition:'Stable Release',creator:'Purple Dragon Foundation Ltd',company:'Purple Dragon Foundation Ltd',tagline:'Software Development · Innovation · Solutions',arch:'x64'};
    const version = escapeHtml(info.version || '2.2.0');
    const edition = escapeHtml(info.edition || 'AI Command Center');
    const creator = escapeHtml(info.creator || 'Purple Dragon Foundation Ltd');
    const arch = escapeHtml(architectureLabel(info.arch));
    const electron = escapeHtml(info.electronVersion || (demoMode ? 'Browser preview' : 'Unavailable'));
    const platform = escapeHtml(info.platform==='win32'?'Windows':info.platform || 'Windows');
    openModal(info.name || 'Purple Dragon PowerTools', `<div class="about-dialog"><div class="about-dialog-hero"><img class="about-dialog-logo" src="assets/purple-dragon-foundation-logo.png" alt="Purple Dragon Foundation Ltd" /><div><strong class="about-dialog-product">Purple Dragon PowerTools</strong><span class="about-dialog-version">v${version} (${arch})</span><span class="about-dialog-edition">${edition}</span></div></div><div class="about-dialog-divider"></div><p class="about-dialog-copy"><strong>Created by ${creator}</strong><br>Local-first Windows command center for hardware, system, Windows Feature Lab, storage, process, network, Privacy & App Trust Intelligence, security, automation, reliability, and optional local/cloud AI tools.</p><div class="about-dialog-meta"><div><span>PLATFORM</span><strong>${platform}</strong></div><div><span>RUNTIME</span><strong>Electron ${electron}</strong></div><div><span>RELEASE CHANNEL</span><strong>Release Candidate</strong></div><div><span>PRIVACY</span><strong>Local-first</strong></div></div><div class="about-dialog-divider"></div><p class="about-dialog-copy">Purple Dragon PowerTools is a public-release candidate Windows utility by Purple Dragon Foundation Ltd. System actions remain guarded. Local AI endpoints stay loopback-only; cloud AI is contacted only for providers you explicitly configure and use.</p><div class="about-dialog-actions"><button class="secondary-btn" id="aboutSettings" type="button">Settings</button><button class="primary-btn" id="aboutClose" type="button">OK</button></div></div>`, 'ABOUT');
    $('#aboutClose')?.addEventListener('click',closeModal);
    $('#aboutSettings')?.addEventListener('click',()=>{closeModal();navigate('settings');});
  }
  function toast(title, detail='') {
    const el = document.createElement('div'); el.className='toast'; el.innerHTML=`<strong>${escapeHtml(title)}</strong>${detail?`<small>${escapeHtml(detail)}</small>`:''}`; $('#toastStack').appendChild(el); setTimeout(()=>el.remove(),3200);
  }

  async function openWindows(target) {
    const result = await api.openSystem(target);
    if(result?.ok){ toast('Windows tool opened', target); await refreshActivity(); }
    else if(demoMode) toast('Desktop-only action', 'Open the app through Electron on Windows to use this command.');
    else toast('Unable to open tool', target);
  }

  function downloadBlob(content, name, type){
    const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function doExport() {
    const r = await api.exportReport();
    if(r?.ok){ toast('Report exported', r.path || 'System snapshot saved'); await refreshActivity(); }
  }

  function showAssistant() {
    const contextLabel=!aiContextEnabled()?'SYSTEM CONTEXT: OFF':aiContextCloudAllowed()?'SYSTEM CONTEXT: LOCAL + CLOUD OPT-IN':'SYSTEM CONTEXT: LOCAL-ONLY';
    openModal('PowerTools AI Assistant', `<div class="assistant-chat"><div class="assistant-context-pill">${contextLabel}</div><p>v2.1.0 AI Command Center can use a pinned model or Dragon Router with redacted System-Aware context. Cloud AI receives system context only when you explicitly enable the separate cloud-context option in AI Command Center.</p><input id="assistantInput" placeholder="Try: Why does my PC feel slow right now?" /><button class="primary-btn" id="assistantAsk">Ask</button><div class="response" id="assistantResponse">Ready.</div></div>`, 'AI ASSISTANT');
    setTimeout(()=>$('#assistantInput')?.focus(),50);
    $('#assistantAsk')?.addEventListener('click', answerAssistant);
    $('#assistantInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter') answerAssistant(); });
  }
  async function answerAssistant() {
    const raw = ($('#assistantInput')?.value || '').trim();
    if(!raw)return;
    if(localStorage.getItem('pt.model.assistant')==='true'||dragonRouterAssistantEnabled()){
      const model=await resolveAssistantModel(raw);
      if(model){
        setText('#assistantResponse',dragonRouterAssistantEnabled()?'Dragon Router selected a model. Thinking…':`Thinking with ${model.scope==='cloud'?'the selected cloud':'the selected local'} model…`);
        try{const system='You are Purple Dragon PowerTools System-Aware AI. When a system context snapshot is attached, use it as time-bound observed evidence. Distinguish observed facts from estimates and unavailable data; never invent telemetry, hardware, security state, processes, or Windows settings. Give practical Windows guidance and keep risky actions review-first.';const result=await api.modelChat?.({provider:model.provider,model:model.id||model.name,endpoint:model.endpoint,customEndpoint:model.provider==='custom'?modelCustomEndpoint():'',system,prompt:raw,systemAware:systemAwareRequest()});noteContextResult(result);if(result?.ok){setText('#assistantResponse',result.text||'(Empty AI response)');if(result?.systemContext?.requested&&!result?.systemContext?.attached&&model.scope==='cloud')toast('Cloud context blocked',result.systemContext.reason||'Cloud context is off.');return;}}catch{}
      }
    }
    const q = raw.toLowerCase();
    let answer = 'I can report CPU, GPU, temperatures, memory, storage, processes, installed apps, uptime, Windows build, BIOS, motherboard, Secure Boot, TPM, and local system information in this build.';
    if(q.includes('temperature') || q.includes('temp') || q.includes('hot')) answer = `CPU temperature: ${formatTemp(live.cpuTemperatureC)}. GPU temperature: ${formatTemp(live.gpu?.temperatureC)}. CPU temperature prefers the local LibreHardwareMonitor hardware-sensor bridge and falls back to Windows ACPI when needed.`;
    else if(q.includes('gpu') || q.includes('graphics')) answer = `Detected GPU: ${live.gpu?.name || staticInfo?.gpu?.Name || 'GPU information unavailable'}. Current GPU load: ${finite(live.gpu?.load)?`${Math.round(live.gpu.load)}%`:'unavailable'}, temperature: ${formatTemp(live.gpu?.temperatureC)}, VRAM: ${finite(live.gpu?.memoryUsedMB)?`${(live.gpu.memoryUsedMB/1024).toFixed(1)} GB used`:'unavailable'}.`;
    else if(q.includes('cpu') || q.includes('processor')) answer = `CPU load is ${live.cpu}% on ${staticInfo?.cpuModel || 'the detected processor'}. Average reported clock is ${formatClock(live.cpuClockMHz)}.`;
    else if(q.includes('memory') || q.includes('ram')) answer = `Memory usage is ${live.memory}% — ${formatBytes(live.usedMemory)} of ${formatBytes(live.totalMemory)} currently in use.`;
    else if(q.includes('storage') || q.includes('disk')) answer = storageInventory?.summary ? `Data Hub sees ${storageInventory.summary.driveCount} mounted drive${storageInventory.summary.driveCount===1?'':'s'} with ${formatBytes(storageInventory.summary.freeBytes)} free of ${formatBytes(storageInventory.summary.totalBytes)}. The system drive is ${live.storage?.percent}% used. Current throughput is ${formatRate(live.diskReadBps)} read and ${formatRate(live.diskWriteBps)} write.` : `The system drive is ${live.storage?.percent}% used. Current disk throughput is ${formatRate(live.diskReadBps)} read and ${formatRate(live.diskWriteBps)} write. Open Data Hub for all-drive inventory.`;
    else if(q.includes('network')) answer = networkOverview?.summary?.activeAdapter ? `Active network adapter: ${networkOverview.summary.activeAdapter.name || 'Windows adapter'} at ${networkOverview.summary.activeAdapter.linkSpeed || 'unknown link speed'}, IPv4 ${networkOverview.summary.activeAdapter.ipv4?.[0] || 'unavailable'}. Current traffic is ${formatNetworkRate(live.networkRxBps)} down and ${formatNetworkRate(live.networkTxBps)} up.` : `Current aggregate network traffic is ${formatNetworkRate(live.networkRxBps)} down and ${formatNetworkRate(live.networkTxBps)} up. Open Network PowerTools for adapter, IP, gateway, DNS, ping, connectivity diagnostics, and optional manual IP geolocation.`;
    else if(q.includes('reliability') || q.includes('diagnostic') || q.includes('crash') || q.includes('boot time')) answer = reliabilityState ? `Reliability Center reports renderer ${reliabilityState.renderer?.state || 'unknown'}, UI ready in ${formatMs(reliabilityState.boot?.uiReadyMs)}, ${reliabilityState.renderer?.crashCount || 0} renderer crash recoveries, and ${formatBytes(reliabilityState.diagnostics?.sizeBytes || 0)} of local diagnostics.` : 'Open Settings to load the local Reliability Center. It does not run Windows scans.';
    else if(q.includes('privacy') || q.includes('metadata') || q.includes('digital footprint') || q.includes('exposure')) answer = 'Open Privacy & App Trust Intelligence for self-auditing public identifiers, domain DNS exposure, file metadata, installed-app publisher coverage, and local SHA-256 / Authenticode trust signals. Privacy and App Trust findings stay out of System-Aware AI context and exported reports.';
    else if(q.includes('feature lab') || q.includes('sandbox') || q.includes('wsl') || q.includes('hyper-v') || q.includes('hyperv')) answer = featureLabState ? `Windows Feature Lab has discovered ${featureLabState.summary?.featureCount||0} capabilities on this PC, with ${featureLabState.summary?.supported||0} reported as supported and ${featureLabState.summary?.enabled||0} enabled. Open Feature Lab for compatibility details and guarded changes.` : 'Open Windows Feature Lab to inspect buried Windows capabilities. The scan is lazy and can optionally request administrator approval for deeper optional-feature state.';
    else if(q.includes('vpn') || q.includes('nord') || q.includes('expressvpn')) answer = vpnCenterState ? `VPN Center sees ${vpnCenterState.summary?.installedCount||0} supported client${vpnCenterState.summary?.installedCount===1?'':'s'} installed, ${vpnCenterState.summary?.runningCount||0} running, and ${vpnCenterState.summary?.connectedCount||0} active tunnel${vpnCenterState.summary?.connectedCount===1?'':'s'}. Open Network PowerTools to launch, connect, disconnect, or refresh NordVPN and ExpressVPN.` : 'Open Network PowerTools to detect NordVPN and ExpressVPN. VPN detection is local and lazy; credentials remain inside the official provider apps.';
    else if(q.includes('stable') || q.includes('release') || q.includes('preflight')) answer = stableReleaseState ? `Stable preflight is ${stableReleaseState.ready?'READY':'REVIEW'} with ${stableReleaseState.passed||0}/${stableReleaseState.total||0} checks passed. Open Settings for the complete local release-readiness list.` : 'Open Settings to run the v2.1.0 Stable preflight. It uses local runtime/configuration checks and does not trigger hardware or VPN scans.';
    else if(q.includes('automation') || q.includes('rule') || q.includes('schedule')) answer = automationState ? `Automation Engine is ${automationState.masterEnabled===false?'paused':automationState.running?'active':'ready'} with ${automationState.enabledCount||0} enabled rule${automationState.enabledCount===1?'':'s'} (${automationState.ruleCount||0} total).${automationState.nextScheduledAt?` Next daily schedule: ${formatAutomationSchedule(automationState.nextScheduledAt)}.`:''}` : 'Open Automation to load the local Automation Engine, rules, schedules, and run history.';
    else if(q.includes('process')) answer = processSnapshot?.summary ? `Process Manager+ currently sees ${processSnapshot.summary.count} processes using about ${formatBytes(processSnapshot.summary.totalMemoryBytes||0)} of working-set memory. Open Process & Apps for per-process CPU, memory and I/O.` : 'Open Process & Apps to load the on-demand process inventory.';
    else if(q.includes('installed app') || q.includes('program')) answer = installedAppsSnapshot?.summary ? `App Manager+ currently sees ${installedAppsSnapshot.summary.count} installed applications in Windows uninstall registry inventory.` : 'Open Process & Apps to load installed applications.';
    else if(q.includes('health')) answer = `The current PowerTools health score is ${live.health}% (${healthLabel(live.health)}). It is a local heuristic based on CPU, memory, storage, and available thermal pressure.`;
    else if(q.includes('uptime')) answer = `This session has been up for ${formatUptime(live.uptime)}.`;
    else if(q.includes('motherboard') || q.includes('board')) answer = `Motherboard: ${[staticInfo?.motherboard?.Manufacturer,staticInfo?.motherboard?.Product].filter(Boolean).join(' ') || 'unavailable'}.`;
    else if(q.includes('bios')) answer = `BIOS: ${staticInfo?.bios?.SMBIOSBIOSVersion || 'unavailable'}${staticInfo?.bios?.Manufacturer ? ` by ${staticInfo.bios.Manufacturer}` : ''}.`;
    else if(q.includes('secure boot') || q.includes('secureboot')) answer = `Boot mode: ${staticInfo?.bootMode || 'unavailable'}. Secure Boot: ${staticInfo?.secureBoot === true ? 'enabled' : staticInfo?.secureBoot === false ? 'disabled' : 'unavailable'}.`;
    else if(q.includes('tpm')) answer = `TPM present: ${staticInfo?.tpm?.TpmPresent === true ? 'yes' : staticInfo?.tpm?.TpmPresent === false ? 'no' : 'unavailable'}. TPM ready: ${staticInfo?.tpm?.TpmReady === true ? 'yes' : staticInfo?.tpm?.TpmReady === false ? 'no' : 'unavailable'}. Specification: ${staticInfo?.tpmInfo?.SpecVersion || 'unavailable'}.`;
    else if(q.includes('windows') || q.includes('operating') || q.includes('build')) answer = `${staticInfo?.osCaption || 'Windows'} · ${staticInfo?.osDisplayVersion || staticInfo?.osVersion || ''} · Build ${staticInfo?.osBuildNumber || 'unavailable'} · ${(staticInfo?.arch || '').toUpperCase()} · host ${staticInfo?.hostname || ''}.`;
    setText('#assistantResponse', answer);
  }

  function createDraft(kind) {
    openModal(`New ${kind}`, `<p>Create a local draft. It will not perform privileged actions.</p><input id="draftName" placeholder="${kind} name" /><button class="primary-btn" id="saveDraft">Save Draft</button>`, kind.toUpperCase());
    $('#saveDraft')?.addEventListener('click', ()=>{
      const name = ($('#draftName')?.value || '').trim(); if(!name) return;
      const key = kind === 'Experiment' ? 'pt.experiments' : 'pt.automations';
      const items = JSON.parse(localStorage.getItem(key)||'[]'); items.unshift({name,at:new Date().toISOString()}); localStorage.setItem(key,JSON.stringify(items.slice(0,20))); closeModal(); renderDrafts(); toast(`${kind} draft saved`,name); logActivity(`${kind} draft created`,name);
    });
  }
  function renderDrafts() {
    const render = (key, target) => { const el=$(target); if(!el)return; const arr=JSON.parse(localStorage.getItem(key)||'[]'); el.innerHTML=arr.length?arr.map(x=>`<div class="draft-item"><strong>${escapeHtml(x.name)}</strong><small>${relativeTime(x.at)}</small></div>`).join(''):'<div class="empty">No local drafts yet.</div>'; };
    render('pt.experiments','#experimentList');
  }

  function applySettings(load=false) {
    if(load){
      const saved=JSON.parse(localStorage.getItem('pt.settings')||'{}');
      if(saved.glow) $('#glowRange').value=saved.glow;
      if(typeof saved.motion==='boolean') $('#motionToggle').checked=saved.motion;
      else if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) $('#motionToggle').checked=false;
      if(typeof saved.compact==='boolean') $('#compactToggle').checked=saved.compact;
      if(saved.interval) $('#intervalSelect').value=String(saved.interval);
    }
    const glow=Number($('#glowRange').value||100); const motion=$('#motionToggle').checked; const compact=$('#compactToggle').checked; intervalMs=Number($('#intervalSelect').value||1000);
    document.documentElement.style.setProperty('--glow', String(glow/100));
    document.body.classList.toggle('motion-off', !motion); document.body.classList.toggle('compact', compact);
  }

  function bindEvents() {
    $$('#nav .nav-item').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));
    $$('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.nav)));
    $$('[data-open-system]').forEach(btn=>btn.addEventListener('click',()=>openWindows(btn.dataset.openSystem)));
    $('#settingsShortcut')?.addEventListener('click',()=>navigate('settings'));
    $('#profileMenuButton')?.addEventListener('click',e=>{e.stopPropagation();toggleProfileMenu();});
    $('#profileMenu')?.addEventListener('click',e=>{const item=e.target.closest('[data-profile-action]');if(!item)return;const action=item.dataset.profileAction;setProfileMenu(false);if(action==='settings')navigate('settings');else if(action==='about')showAbout();});
    document.addEventListener('click',e=>{if(!e.target.closest('#profileAccount'))setProfileMenu(false);});
    $('#pulseBtn')?.addEventListener('click', async()=>{ await Promise.all([refreshLive(),refreshStatic(true),refreshSecurity(true),refreshActivity(),refreshPowerProfiles()]); toast('System refreshed'); });
    $('#notifyBtn')?.addEventListener('click',()=>openModal('Notifications','<p>Performance+, System PowerTools, Security Center, VPN Center, Automation Engine, Reliability Center, and Stable Release readiness is online. v2.1.0 keeps VPN detection, GitHub, Feature Lab, startup scans, and cloud AI providers lazy; diagnostics stay local.</p>','NOTIFICATIONS'));
    $('#assistantStart')?.addEventListener('click',showAssistant);
    $('#modalClose')?.addEventListener('click',closeModal); $('#modalBackdrop')?.addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
    $('#refreshSystem')?.addEventListener('click',async()=>{await refreshStatic(true);toast('System profile refreshed')});
    $('#refreshHardware')?.addEventListener('click',async()=>{await refreshStatic(true);toast('Hardware identity refreshed')});
    $('#refreshPerformance')?.addEventListener('click',async()=>{await Promise.all([refreshLive(),refreshStatic(true),refreshPowerProfiles()]);toast('Performance sensors refreshed')});
    $('#enableCpuSensor')?.addEventListener('click', async()=>{ const r=await api.enableCpuSensor(); if(r?.ok){ toast('CPU sensor requested','Accept the Windows UAC prompt. PowerTools itself stays non-elevated.'); setTimeout(refreshLive,1800); } else { toast('CPU sensor could not start', r?.error || 'The sensor helper was not started.'); } });
    $('#refreshSystemTools')?.addEventListener('click',async()=>{await Promise.all([refreshStatic(true),refreshStartup(true),refreshLive()]);toast('System PowerTools refreshed')});
    $('#refreshStartup')?.addEventListener('click',async()=>{await refreshStartup(true);toast('Startup inventory refreshed')});
    $('#systemExport')?.addEventListener('click',doExport);
    $$('.profile-btn').forEach(btn=>btn.addEventListener('click',()=>setPowerProfile(btn.dataset.profile)));
    $('#clearActivity')?.addEventListener('click',()=>{ if(demoMode){localStorage.removeItem('pt.activity');refreshActivity();} else toast('Activity log is session-managed','Restarting the app clears the current session history.'); });
    $('#dataExport')?.addEventListener('click',doExport);
    $('#refreshDrives')?.addEventListener('click',async()=>{await loadDataHub(true);toast('Drive inventory refreshed')});
    $('#analyzeStorage')?.addEventListener('click',runFolderAnalysis);
    $('#cancelStorageAnalysis')?.addEventListener('click',async()=>{await api.cancelStorageAnalysis();setText('#storageAnalysisStatus','Cancelling analysis…');});
    $('#previewCleanup')?.addEventListener('click',previewCleanupNow);
    $('#runCleanup')?.addEventListener('click',cleanSelectedStorage);
    $$('[data-open-folder]').forEach(btn=>btn.addEventListener('click',async()=>{const r=await api.openStorageFolder(btn.dataset.openFolder);if(!r?.ok)toast(demoMode?'Desktop-only action':'Unable to open folder',btn.dataset.openFolder);}));
    $('#driveList')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-open-drive]');if(!btn)return;const r=await api.openStorageDrive(btn.dataset.openDrive);if(!r?.ok)toast('Unable to open drive',btn.dataset.openDrive);});
    $('#largeFileList')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-reveal-large]');if(!btn)return;const r=await api.revealLargeFile(Number(btn.dataset.revealLarge));if(!r?.ok)toast(demoMode?'Desktop-only action':'File location is no longer available');});
    $('#refreshAppCenter')?.addEventListener('click',async()=>{await loadAppCenter(true);toast('Process & App Center refreshed');});
    $('#refreshProcesses')?.addEventListener('click',async()=>{await refreshProcesses(true);toast('Process list refreshed');});
    $('#refreshInstalledApps')?.addEventListener('click',async()=>{await refreshInstalledApps(true);toast('Installed apps refreshed');});
    $('#refreshAppsStartup')?.addEventListener('click',async()=>{await refreshStartup(true);renderAppsStartupItems();toast('Startup inventory refreshed');});
    $('#processSearch')?.addEventListener('input',renderProcesses);
    $('#appSearch')?.addEventListener('input',renderInstalledApps);
    $('#openInstalledApps')?.addEventListener('click',async()=>{const r=await api.openInstalledAppsSettings();if(!r?.ok)openWindows('apps');});
    $('#processList')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-process-action]');if(!btn)return;const row=btn.closest('[data-pid]');const pid=Number(row?.dataset.pid);const action=btn.dataset.processAction;let r=null;if(action==='reveal')r=await api.revealProcess(pid);else if(action==='copy')r=await api.copyProcessPath(pid);else if(action==='restart')r=await api.restartProcess(pid);else if(action==='end')r=await api.endProcess(pid);if(r?.ok){toast(action==='copy'?'Path copied':action==='reveal'?'File location opened':action==='restart'?'Process restarted':'Process ended');if(['restart','end'].includes(action))setTimeout(()=>refreshProcesses(true),800);await refreshActivity();}else if(!r?.canceled)toast('Process action unavailable',r?.error||'Windows rejected the action.');});
    $('#installedAppList')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-app-action]');if(!btn)return;const row=btn.closest('[data-app-index]');const index=Number(row?.dataset.appIndex);let r;if(btn.dataset.appAction==='reveal')r=await api.revealInstalledApp(index);else r=await api.openInstalledAppsSettings();if(r?.ok)toast(btn.dataset.appAction==='reveal'?'Application location opened':'Windows Installed Apps opened');else toast('App action unavailable',r?.error||'Windows did not expose a usable location.');});
    $('#refreshNetwork')?.addEventListener('click',async()=>{await loadNetworkCenter(true);toast('Network inventory refreshed');});
    $('#refreshVpnCenter')?.addEventListener('click',async()=>{await loadVpnCenter(true);toast('VPN status refreshed');});
    $('#vpnProviderGrid')?.addEventListener('click',e=>{const btn=e.target.closest('[data-vpn-provider][data-vpn-action]');if(btn)runVpnProviderAction(btn.dataset.vpnProvider,btn.dataset.vpnAction,btn);});
    $('#runPing')?.addEventListener('click',runNetworkPing);
    $('#runDnsLookup')?.addEventListener('click',runNetworkDns);
    $('#runConnectivityTest')?.addEventListener('click',runConnectivity);
    $('#networkTarget')?.addEventListener('keydown',e=>{if(e.key==='Enter')runNetworkPing();});
    $('#ipGeoLookup')?.addEventListener('click',runIpGeolocation);
    $('#ipGeoConfigure')?.addEventListener('click',()=>{if(!ipGeoStatus)loadIpGeoStatus().then(openIpGeoConfiguration);else openIpGeoConfiguration();});
    $('#ipGeoAddress')?.addEventListener('keydown',e=>{if(e.key==='Enter')runIpGeolocation();});
    $('#privacyBuildProfiles')?.addEventListener('click',buildPrivacyProfiles);
    $('#privacyUsername')?.addEventListener('keydown',e=>{if(e.key==='Enter')buildPrivacyProfiles();});
    $('#privacyProfileResults')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-privacy-profile]');if(!btn)return;const out=await api.privacyOpenProfile?.(btn.dataset.privacyProfile,btn.dataset.privacyUsername||'');if(!out?.ok)toast(demoMode?'Desktop-only link':'Unable to open profile',out?.error||'');});
    $('#privacyInspectDomain')?.addEventListener('click',inspectPrivacyDns);
    $('#privacyDomain')?.addEventListener('keydown',e=>{if(e.key==='Enter')inspectPrivacyDns();});
    $('#privacyInspectFile')?.addEventListener('click',inspectPrivacyFile);
    $('#privacyOpenHibp')?.addEventListener('click',openPrivacyHibp);
    $('#privacyClearSession')?.addEventListener('click',clearPrivacySession);
    $('#privacyOpenNetwork')?.addEventListener('click',()=>{navigate('network');setTimeout(()=>$('#ipGeoAddress')?.focus(),80);});
    $('#privacyTrustSelectFile')?.addEventListener('click',scanPrivacyAppTrustFile);
    $('#privacyProtectionRefresh')?.addEventListener('click',loadPrivacyProtection);
    $('#privacyAppInventoryRefresh')?.addEventListener('click',()=>loadPrivacyAppInventory(Boolean(privacyAppInventory)));
    $('#privacyAppSearch')?.addEventListener('input',renderPrivacyAppInventory);
    $('#privacyAppList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-trust-installed]');if(btn)inspectPrivacyInstalledApp(btn.dataset.trustInstalled);});
    $('#privacyTrustResult')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-trust-reputation]');if(!btn)return;const out=await api.privacyOpenHashReputation?.(btn.dataset.trustReputation||'');if(!out?.ok)toast(demoMode?'Desktop-only reputation lookup':'Unable to open reputation lookup',out?.error||'');});
    $('#copyIpConfig')?.addEventListener('click',async()=>{const r=await api.networkCopyIpConfig();if(r?.ok)toast('IP configuration copied','ipconfig /all is on the clipboard.');else toast(demoMode?'Desktop-only action':'Unable to copy IP configuration',r?.error||'');});
    $('#flushDns')?.addEventListener('click',async()=>{const r=await api.networkFlushDns();if(r?.ok){toast('DNS cache flushed');await refreshActivity();}else toast(demoMode?'Desktop-only action':'DNS flush failed',r?.error||'');});
    $('#renewDhcp')?.addEventListener('click',async()=>{const r=await api.networkRenewDhcp();if(r?.ok){toast('DHCP renewed');networkLoaded=false;setTimeout(()=>loadNetworkCenter(true),900);await refreshActivity();}else if(!r?.canceled)toast(demoMode?'Desktop-only action':'DHCP renewal failed',r?.error||'');});
    $('#refreshSecurityCenter')?.addEventListener('click',async()=>{await refreshSecurity(true);toast('Security Center refreshed');});
    $('#refreshJournal')?.addEventListener('click',loadChangeJournal);
    $('#journalSearch')?.addEventListener('input',renderChangeJournal);
    ['#journalCategory','#journalStateFilter'].forEach(id=>$(id)?.addEventListener('change',renderChangeJournal));
    $('#journalList')?.addEventListener('click',e=>{const btn=e.target.closest('[data-journal-undo]');if(btn)undoJournalEntry(btn.dataset.journalUndo);});
    $('#clearJournal')?.addEventListener('click',async()=>{const out=await api.clearChangeJournal?.();if(out?.canceled)return;if(!out?.ok){toast('Unable to clear journal',out?.error||'');return;}changeJournalState=out.state;renderChangeJournal();toast('Change Journal cleared');});
    $('#refreshFeatureLab')?.addEventListener('click',async()=>{featureLabLoaded=false;await loadFeatureLab(true,false);toast('Windows Feature Lab refreshed');});
    $('#featureLabAdminScan')?.addEventListener('click',async()=>{await loadFeatureLab(true,true);if(featureLabState?.elevated)toast('Administrator Feature Lab scan complete',`${featureLabState.summary?.featureCount||0} capabilities inspected`);});
    ['#featureLabSearch','#featureLabCategory','#featureLabStateFilter'].forEach(id=>$(id)?.addEventListener(id==='#featureLabSearch'?'input':'change',renderFeatureLab));
    $('#featureLabGrid')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-feature-lab-action]');if(!btn)return;const card=btn.closest('[data-feature-id]');const feature=featureLabState?.features?.find(f=>f.id===card?.dataset.featureId);if(!feature)return;const action=btn.dataset.featureLabAction;if(action==='details')showFeatureDetails(feature);else if(action==='open'){const out=await api.openFeatureLabItem?.(feature.id);if(!out?.ok)toast(demoMode?'Desktop-only action':'Unable to open Windows settings',out?.error||'');}else if(action==='apply')await runFeatureLabAction(feature,btn.dataset.featureActionType);});
    $('#copySecuritySummary')?.addEventListener('click',async()=>{const r=await api.copySecuritySummary?.();if(r?.ok){toast('Security summary copied','Local Windows security posture is on the clipboard.');await refreshActivity();}else toast(demoMode?'Desktop-only action':'Unable to copy security summary',r?.error||'');});
    $('#newExperiment')?.addEventListener('click',()=>createDraft('Experiment'));
    $('#newAutomation')?.addEventListener('click',()=>{automationEditingRuleId=null;resetAutomationBuilder();$('#automationName')?.focus();});
    $('#refreshAutomation')?.addEventListener('click',async()=>{automationLoaded=false;await loadAutomationCenter(true);toast('Automation Engine refreshed');});
    $('#automationMasterToggle')?.addEventListener('click',async()=>{const next=automationState?.masterEnabled===false;const r=await api.setAutomationMasterEnabled(next);if(r?.ok){automationState=r.state;renderAutomationCenter();toast(next?'Automation Engine enabled':'Automation Engine paused');await refreshActivity();}});
    $('#automationTriggerType')?.addEventListener('change',()=>renderAutomationTriggerConfig());
    $('#automationActionType')?.addEventListener('change',()=>renderAutomationActionConfig());
    $('#saveAutomationRule')?.addEventListener('click',saveAutomationFromBuilder);
    $('#resetAutomationBuilder')?.addEventListener('click',()=>resetAutomationBuilder());
    $$('[data-automation-preset]').forEach(btn=>btn.addEventListener('click',()=>applyAutomationPreset(btn.dataset.automationPreset)));
    $('#automationRuleList')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-automation-action]');if(!btn)return;const row=btn.closest('[data-rule-id]');const id=row?.dataset.ruleId;const rule=automationState?.rules?.find(r=>r.id===id);if(!rule)return;const action=btn.dataset.automationAction;if(action==='toggle'){const r=await api.setAutomationRuleEnabled(id,!rule.enabled);if(r?.ok){automationState=r.state;renderAutomationCenter();await refreshActivity();}}else if(action==='edit'){automationEditingRuleId=id;resetAutomationBuilder(rule);$('#automationName')?.scrollIntoView({behavior:'smooth',block:'center'});}else if(action==='run'){btn.disabled=true;const r=await api.runAutomationRuleNow(id);btn.disabled=false;if(r?.state){automationState=r.state;renderAutomationCenter();}toast(r?.ok?'Automation action executed':'Automation action failed',r?.item?.detail||r?.error||rule.name);await refreshActivity();}else if(action==='delete'){const r=await api.deleteAutomationRule(id);if(r?.ok){automationState=r.state;renderAutomationCenter();if(automationEditingRuleId===id)resetAutomationBuilder();toast('Automation rule deleted',rule.name);await refreshActivity();}}});
    $('#clearAutomationHistory')?.addEventListener('click',async()=>{const r=await api.clearAutomationHistory();if(r?.ok){automationState=r.state;renderAutomationCenter();toast('Automation history cleared');}});
    $('#saveSettings')?.addEventListener('click',()=>{ applySettings(); localStorage.setItem('pt.settings',JSON.stringify({glow:$('#glowRange').value,motion:$('#motionToggle').checked,compact:$('#compactToggle').checked,interval:Number($('#intervalSelect').value)})); startSampling(); toast('Settings saved'); logActivity('Settings updated',`Telemetry interval ${intervalMs} ms`); });
    $('#refreshReliability')?.addEventListener('click',async()=>{reliabilityLoaded=false;await loadReliability(true);toast('Reliability status refreshed');});
    $('#copyReliability')?.addEventListener('click',async()=>{const out=await api.copyReliabilitySummary?.();if(out?.ok){reliabilityState=out.status||reliabilityState;renderReliability();toast('Reliability summary copied');}else toast(demoMode?'Desktop-only action':'Unable to copy reliability summary',out?.error||'');});
    $('#openReliabilityLogs')?.addEventListener('click',async()=>{const out=await api.openReliabilityLogs?.();if(out?.ok)toast('PowerTools data folder opened');else toast(demoMode?'Desktop-only action':'Unable to open log folder',out?.error||'');});
    $('#clearReliabilityLog')?.addEventListener('click',async()=>{const out=await api.clearReliabilityDiagnostics?.();if(out?.ok){reliabilityState=out.status;renderReliability();toast('Diagnostics cleared');}else if(!out?.canceled)toast(demoMode?'Desktop-only action':'Unable to clear diagnostics',out?.error||'');});
    $('#resetHardwareCache')?.addEventListener('click',async()=>{const out=await api.resetHardwareCache?.();if(out?.ok){reliabilityState=out.status;staticInfo=null;renderReliability();toast('Hardware cache reset','Identity will rebuild lazily.');}else if(!out?.canceled)toast(demoMode?'Desktop-only action':'Unable to reset hardware cache',out?.error||'');});
    $('#runStablePreflight')?.addEventListener('click',async()=>{stableReleaseLoaded=false;await loadStableRelease(true);toast(stableReleaseState?.ready?'Stable preflight passed':'Stable preflight needs review',stableReleaseState?`${stableReleaseState.passed||0}/${stableReleaseState.total||0} checks passed`:'');});
    $('#copyStableSummary')?.addEventListener('click',async()=>{const out=await api.copyStableReleaseSummary?.();if(out?.ok){stableReleaseState=out.status||stableReleaseState;renderStableRelease();toast('Release readiness summary copied');await refreshActivity();}else toast(demoMode?'Desktop-only action':'Unable to copy release summary',out?.error||'');});
    $('#resetUiSettings')?.addEventListener('click',()=>{localStorage.removeItem('pt.settings');if($('#glowRange'))$('#glowRange').value='100';if($('#motionToggle'))$('#motionToggle').checked=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if($('#compactToggle'))$('#compactToggle').checked=false;if($('#intervalSelect'))$('#intervalSelect').value='1000';applySettings();startSampling();toast('UI defaults restored');});

    ['#glowRange','#motionToggle','#compactToggle'].forEach(id=>$(id)?.addEventListener('input',()=>applySettings()));

    $('#aiCommandMode')?.addEventListener('change',e=>{localStorage.setItem('pt.ai.command.mode',e.currentTarget.value);renderAiCommandCenter();});
    $('#aiCommandPreset')?.addEventListener('change',e=>{localStorage.setItem('pt.ai.command.preset',e.currentTarget.value);renderAiCommandCenter();});
    $('#aiCommandPrompt')?.addEventListener('input',renderAiCommandCenter);
    $('#aiCommandPrompt')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runAiCommand();}});
    $$('#view-models [data-ai-command-preset]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.aiCommandPreset;localStorage.setItem('pt.ai.command.preset',id);const field=$('#aiCommandPrompt');if(field)field.value=aiCommandPresetMeta(id).starter;renderAiCommandCenter();field?.focus();}));
    $('#aiCommandPreviewContext')?.addEventListener('click',()=>showAiContextPreview(String($('#aiCommandPrompt')?.value||'').trim()));
    $('#aiCommandClear')?.addEventListener('click',()=>{if($('#aiCommandPrompt'))$('#aiCommandPrompt').value='';aiCommandLast=null;setText('#aiCommandOutput','Choose a mission profile and execution mode, enter a prompt, then run the mission.');renderAiCommandCenter();});
    $('#aiCommandRun')?.addEventListener('click',runAiCommand);
    $('#refreshModels')?.addEventListener('click',async()=>{dragonRouteState=null;modelCenterLoaded=false;await loadModelCenter(true);toast('AI providers refreshed',`${modelCenterState?.summary?.modelCount||0} model${modelCenterState?.summary?.modelCount===1?'':'s'} discovered`);});
    $('#modelTestEndpoint')?.addEventListener('click',async()=>{const value=($('#modelCustomEndpoint')?.value||'').trim();if(value)localStorage.setItem('pt.model.customEndpoint',value);else localStorage.removeItem('pt.model.customEndpoint');dragonRouteState=null;modelCenterLoaded=false;await loadModelCenter(true);});
    $('#modelClearEndpoint')?.addEventListener('click',async()=>{localStorage.removeItem('pt.model.customEndpoint');if($('#modelCustomEndpoint'))$('#modelCustomEndpoint').value='';dragonRouteState=null;modelCenterLoaded=false;await loadModelCenter(true);});
    $('#view-models')?.addEventListener('click',e=>{const btn=e.target.closest('[data-model-config]');if(btn)showProviderSetup(btn.dataset.modelConfig);});
    $('#modelSearch')?.addEventListener('input',renderModelCenter); $('#modelProviderFilter')?.addEventListener('change',renderModelCenter);
    $('#dragonCouncilCloud')?.addEventListener('change',e=>{localStorage.setItem('pt.model.council.cloud',e.currentTarget.checked?'true':'false');const eligible=new Set(dragonCouncilEligibleModels().map(modelKey));setDragonCouncilSavedKeys(dragonCouncilSavedKeys().filter(k=>eligible.has(k)));dragonCouncilResults=[];renderDragonCouncil();renderAiCommandCenter();});
    $('#dragonCouncilMembers')?.addEventListener('change',e=>{const box=e.target.closest('[data-council-key]');if(!box)return;let keys=dragonCouncilSavedKeys();if(box.checked){if(keys.length>=4){box.checked=false;toast('Council is full','Dragon Council supports up to four models per comparison.');return;}keys.push(box.dataset.councilKey);}else keys=keys.filter(k=>k!==box.dataset.councilKey);setDragonCouncilSavedKeys(keys);dragonCouncilResults=[];renderDragonCouncil();renderAiCommandCenter();});
    $('#dragonCouncilUsePrompt')?.addEventListener('click',()=>{const text=String($('#modelPrompt')?.value||'').trim();if(!text){toast('Playground prompt is empty');return;}if($('#dragonCouncilPrompt'))$('#dragonCouncilPrompt').value=text;toast('Prompt copied to Dragon Council');});
    $('#dragonCouncilRecommend')?.addEventListener('click',selectRecommendedCouncil);
    $('#dragonCouncilClear')?.addEventListener('click',()=>{setDragonCouncilSavedKeys([]);dragonCouncilResults=[];if($('#dragonCouncilPrompt'))$('#dragonCouncilPrompt').value='';renderDragonCouncil();renderAiCommandCenter();});
    $('#dragonCouncilRun')?.addEventListener('click',runDragonCouncil);
    $('#dragonCouncilPrompt')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runDragonCouncil();}});
    $('#dragonCouncilResults')?.addEventListener('click',e=>{const btn=e.target.closest('[data-council-use]');if(!btn)return;const r=dragonCouncilResults[Number(btn.dataset.councilUse)];if(!r?.ok)return;const m=currentModelList().find(x=>x.provider===r.provider&&(x.id===r.model||x.name===r.model||x.name===r.modelName));if(m)localStorage.setItem('pt.model.active',modelKey(m));setText('#modelResponse',r.text||'(Empty response)');renderModelCenter();toast('Council response moved to Playground',r.modelName||r.model||'Model');});
    $('#dragonRouterProfile')?.addEventListener('change',e=>{localStorage.setItem('pt.model.router.profile',e.currentTarget.value||'automatic');dragonRouteState=null;renderDragonRoute();renderAiCommandCenter();});
    $('#dragonRouterCloud')?.addEventListener('change',e=>{localStorage.setItem('pt.model.router.cloud',e.currentTarget.checked?'true':'false');dragonRouteState=null;renderDragonRoute();renderAiCommandCenter();});
    $('#dragonRouterAssistant')?.addEventListener('change',e=>{localStorage.setItem('pt.model.router.assistant',e.currentTarget.checked?'true':'false');renderModelCenter();toast(e.currentTarget.checked?'Dragon Router enabled for Assistant':'Dragon Router disabled for Assistant',e.currentTarget.checked?`${dragonRouterProfile().replace(/-/g,' ')} routing will be used per question.`:'Assistant will use the pinned model when enabled.');});
    $('#dragonRoutePrompt')?.addEventListener('click',()=>routeCurrentPrompt(false));
    $('#dragonRouteSend')?.addEventListener('click',()=>routeCurrentPrompt(true));
    $('#modelList')?.addEventListener('click',e=>{const row=e.target.closest('[data-model-key]');if(!row)return;dragonRouteState=null;localStorage.setItem('pt.model.active',row.dataset.modelKey||'');renderModelCenter();toast('AI model selected',activeModel()?.name||activeModel()?.id||'Model');});
    $('#modelSend')?.addEventListener('click',sendModelPrompt); $('#modelPrompt')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();sendModelPrompt();}});
    $('#modelClearChat')?.addEventListener('click',()=>{if($('#modelPrompt'))$('#modelPrompt').value='';setText('#modelResponse','Ready.');});
    $('#modelAssistantToggle')?.addEventListener('change',e=>{localStorage.setItem('pt.model.assistant',e.currentTarget.checked?'true':'false');toast(e.currentTarget.checked?'Selected AI enabled for Assistant':'Built-in Assistant restored',e.currentTarget.checked?(activeModel()?.name||'Select a model'):'No model calls will be made by Assistant.');});
    $('#aiContextMode')?.addEventListener('change',e=>{localStorage.setItem('pt.ai.context.mode',e.currentTarget.value||'smart');if(e.currentTarget.value==='off')localStorage.setItem('pt.ai.context.enabled','false');else if(localStorage.getItem('pt.ai.context.enabled')==='false')localStorage.setItem('pt.ai.context.enabled','true');aiContextState=null;renderAiContext();renderModelCenter();});
    $('#aiContextEnabled')?.addEventListener('change',e=>{localStorage.setItem('pt.ai.context.enabled',e.currentTarget.checked?'true':'false');if(e.currentTarget.checked&&aiContextMode()==='off')localStorage.setItem('pt.ai.context.mode','smart');aiContextState=null;renderAiContext();renderModelCenter();toast(e.currentTarget.checked?'System-Aware AI enabled':'System-Aware AI disabled',e.currentTarget.checked?'Local AI can receive redacted PC context when relevant.':'AI requests will not include automatic PC context.');});
    $('#aiContextCloud')?.addEventListener('change',e=>{if(!e.currentTarget.checked){localStorage.setItem('pt.ai.context.cloud','false');renderAiContext();renderModelCenter();toast('Cloud system context disabled');return;}e.currentTarget.checked=false;openModal('Allow cloud system context?',`<div class="model-key-dialog"><p>OpenAI/Codex, Claude, or Gemini may receive the redacted Purple Dragon system snapshot when you send a prompt through them.</p><div class="model-key-note">Still omitted: hostname, Windows username, IP/MAC addresses, file paths, API keys, and automation rule names/commands. This does not send anything until you actually make a cloud AI request.</div><div class="model-key-dialog-actions"><button class="secondary-btn" id="aiCloudContextCancel">Cancel</button><button class="primary-btn" id="aiCloudContextConfirm">Allow Cloud Context</button></div></div>`,'PRIVACY');$('#aiCloudContextCancel')?.addEventListener('click',()=>{closeModal();renderAiContext();});$('#aiCloudContextConfirm')?.addEventListener('click',()=>{localStorage.setItem('pt.ai.context.cloud','true');closeModal();renderAiContext();renderModelCenter();toast('Cloud system context enabled','Redacted context will be attached only when you send a cloud AI prompt.');});});
    $('#aiContextRefresh')?.addEventListener('click',async()=>{await loadAiContext(true);if(aiContextState?.ok)toast('System context refreshed',`${aiContextState.sections?.length||0} context sections ready`);});
    $('#aiContextPreview')?.addEventListener('click',showAiContextPreview);
    $('#modelOpenAssistant')?.addEventListener('click',showAssistant);
    $$('.quick-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const a=btn.dataset.action;
      if(a==='export') doExport(); else if(a==='experiment') createDraft('Experiment'); else if(a==='automation'){navigate('automation');setTimeout(()=>{automationEditingRuleId=null;resetAutomationBuilder();$('#automationName')?.focus();},80);} else openWindows(a);
    }));
    $('#updateCheck')?.addEventListener('click',()=>loadUpdateReleaseCenter(true));
    $('#updateOpenRelease')?.addEventListener('click',async()=>{if(!updateReleaseState?.latestReleaseUrl)return;const out=await api.openUpdateRelease?.(updateReleaseState.latestReleaseUrl);if(out?.ok===false)toast('Unable to open release',out.error||'');});
    $('#updateChannel')?.addEventListener('change',async()=>{await saveUpdateReleaseSettings();await loadUpdateReleaseCenter(true);});
    $('#updateCheckPolicy')?.addEventListener('change',saveUpdateReleaseSettings);
    $('#updateVerifySha')?.addEventListener('change',saveUpdateReleaseSettings);
    $('#updateRequireSignature')?.addEventListener('change',saveUpdateReleaseSettings);
    $('#updateKeepRollback')?.addEventListener('change',saveUpdateReleaseSettings);
    $('#updateShowNotifications')?.addEventListener('change',saveUpdateReleaseSettings);
    $('#updateReleaseHistory')?.addEventListener('click',e=>{const row=e.target.closest('[data-update-release-link]');if(row?.dataset.updateReleaseLink)api.openUpdateRelease?.(row.dataset.updateReleaseLink);});
    $('#githubRefresh')?.addEventListener('click',()=>{githubCenterLoaded=false;githubRepoDetails=null;loadGitHubCenter(true);});
    $('#githubConfigure')?.addEventListener('click',showGitHubSetup);
    $('#githubRepoSearch')?.addEventListener('input',renderGitHubCenter);
    $('#githubRepoList')?.addEventListener('click',e=>{const row=e.target.closest('[data-github-repo]');if(!row)return;const repo=row.dataset.githubRepo||'';localStorage.setItem('pt.github.repo',repo);githubRepoDetails=null;renderGitHubCenter();loadGitHubRepoDetails(repo,true);});
    $('#githubBranch')?.addEventListener('change',e=>{if(githubRepoDetails)githubRepoDetails._selectedBranch=e.currentTarget.value||'';});
    $('#githubOpenRepo')?.addEventListener('click',()=>{const repo=githubSelectedRepoObject();if(repo?.htmlUrl)api.openGitHubLink?.(repo.htmlUrl);});
    $('#githubRecentCommits')?.addEventListener('click',e=>{const row=e.target.closest('[data-github-link]');if(row?.dataset.githubLink)api.openGitHubLink?.(row.dataset.githubLink);});
    $('#githubRecentReleases')?.addEventListener('click',e=>{const row=e.target.closest('[data-github-link]');if(row?.dataset.githubLink)api.openGitHubLink?.(row.dataset.githubLink);});
    $('#githubSelectFiles')?.addEventListener('click',()=>chooseGitHubSource('files'));$('#githubSelectFolder')?.addEventListener('click',()=>chooseGitHubSource('folder'));$('#githubClearSource')?.addEventListener('click',async()=>{await api.clearGitHubSource?.();githubSourceFiles=[];renderGitHubCenter();});$('#githubCommitUpload')?.addEventListener('click',commitGitHubSource);
    $('#githubSelectAssets')?.addEventListener('click',chooseGitHubAssets);$('#githubClearAssets')?.addEventListener('click',async()=>{await api.clearGitHubReleaseAssets?.();githubReleaseAssetFiles=[];renderGitHubCenter();});$('#githubGenerateNotes')?.addEventListener('click',generateGitHubNotes);$('#githubPublishRelease')?.addEventListener('click',publishGitHubRelease);
    $('#globalSearch')?.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const q=e.currentTarget.value.trim().toLowerCase(); const map=[['release center','integrations'],['github release','integrations'],['stable','settings'],['release','settings'],['preflight','settings'],['reliability','settings'],['diagnostics','settings'],['crash','settings'],['boot time','settings'],['device manager','system'],['event viewer','system'],['registry','system'],['services','system'],['startup','system'],['secure boot','system'],['tpm','system'],['bios','system'],['system','system'],['gpu','performance'],['hardware','performance'],['sensor','performance'],['temperature','performance'],['defender','security'],['firewall','security'],['bitlocker','security'],['smartscreen','security'],['uac','security'],['antivirus','security'],['security','security'],['performance','performance'],['setting','settings'],['automation','automation'],['schedule','automation'],['trigger','automation'],['rule','automation'],['experiment','experiments'],['network','network'],['ping','network'],['dns','network'],['adapter','network'],['ip address','network'],['ip geolocation','network'],['geolocation','network'],['geo ipify','network'],['public ip','network'],['app trust','privacy'],['authenticode','privacy'],['signature','privacy'],['publisher','privacy'],['privacy','privacy'],['exposure','privacy'],['metadata','privacy'],['digital footprint','privacy'],['username','privacy'],['breach','privacy'],['dns intelligence','privacy'],['gateway','network'],['process','apps'],['task','apps'],['installed app','apps'],['program','apps'],['app manager','apps'],['cleanup','data'],['drive','data'],['disk space','data'],['large file','data'],['downloads','data'],['storage','data'],['data','data'],['ai command center','models'],['command deck','models'],['dragon council','models'],['openai','models'],['chatgpt','models'],['codex','models'],['claude','models'],['gemini','models'],['ollama','models'],['lm studio','models'],['dragon router','models'],['router','models'],['route','models'],['system-aware','models'],['system context','models'],['ai context','models'],['local ai','models'],['model','models'],['github','integrations'],['repository','integrations'],['commit','integrations'],['release center','integrations'],['integration','integrations'],['dashboard','dashboard']]; const hit=map.find(([k])=>q.includes(k)); if(hit){navigate(hit[1]);e.currentTarget.blur();} else if(q){toast('No direct match','Try stable, preflight, reliability, diagnostics, Defender, firewall, BitLocker, network, ping, DNS, processes, apps, system, BIOS, TPM, startup, performance, hardware, GPU, security, settings, automation, schedules, rules, or data, privacy, exposure, metadata, OpenAI, ChatGPT, Codex, Claude, Gemini, local AI, Ollama, LM Studio, or models.');} } });
    window.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch')?.focus();} if(e.key==='Escape'){setProfileMenu(false);closeModal();} });
    window.addEventListener('resize',()=>drawCharts());
    $('#minBtn')?.addEventListener('click',()=>api.minimize()); $('#maxBtn')?.addEventListener('click',()=>api.maximize()); $('#closeBtn')?.addEventListener('click',()=>api.close());
  }

  async function init() {
    const hour = new Date().getHours();
    setText('#greeting', `${hour<12?'GOOD MORNING':hour<18?'GOOD AFTERNOON':'GOOD EVENING'}, ADMIN`);
    setText('#assistantMessage','Ask about performance, automation, security, network, hardware, storage, or use a selected AI provider/model.');
    bindEvents(); applySettings(true); renderDrafts(); resetAutomationBuilder(); renderAiContext(); renderPrivacySummary(); if($('#modelCustomEndpoint'))$('#modelCustomEndpoint').value=modelCustomEndpoint();
    api.getAppInfo?.().then(info=>{appInfo=info||null;const version=info?.version||'2.2.0';const menuVersion=$('#profileMenu .profile-menu-version');if(menuVersion)menuVersion.textContent=`v${version} · ${info?.edition||'Stable Release'}`;}).catch(()=>{});
    window.addEventListener('error',event=>{nativeApi?.reportRendererError?.({message:event?.error?.stack||event?.message||'Renderer window error'});});
    window.addEventListener('unhandledrejection',event=>{nativeApi?.reportRendererError?.({message:event?.reason?.stack||event?.reason?.message||String(event?.reason||'Renderer unhandled rejection')});});
    if(nativeApi?.rendererReady) nativeApi.rendererReady().then(status=>{reliabilityState=status;reliabilityLoaded=Boolean(status);if($('#view-settings')?.classList.contains('active'))renderReliability();}).catch(()=>{});
    if(nativeApi?.onAutomationEvent) nativeApi.onAutomationEvent(item=>{automationLoaded=false;if($('#view-automation')?.classList.contains('active'))loadAutomationCenter(true);toast(item?.ok===false?'Automation action failed':'Automation rule fired',item?.ruleName||'Automation Engine');refreshActivity();});
    if(nativeApi?.onAutomationNavigate) nativeApi.onAutomationNavigate(view=>{if(view)navigate(view);});

    // v1.7.0 Change Journal + Undo: paint and begin live sampling immediately; reliability and release readiness remain local/lazy. Static CIM/firmware and
    // security queries populate asynchronously instead of blocking dashboard startup.
    startSampling();
    refreshActivity();

    // Fast boot: do not spawn PowerShell/CIM, powercfg or startup inventory during first paint.
    // Hardware identity is restored from the local cache when available, then verified later.
    setTimeout(() => {
      refreshStatic(false).then(() => logActivity(
        demoMode?'Browser preview opened':'Dashboard initialized',
        demoMode?'Desktop integrations are simulated in preview mode':'System PowerTools and Performance+ telemetry connected'
      ));
    }, 900);

    if(demoMode) toast('Browser preview mode','Run with Electron on Windows for real hardware telemetry and Windows actions.');
  }

  init();
})();
