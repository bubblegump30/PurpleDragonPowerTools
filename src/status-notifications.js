(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PowerToolsStatus=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const reads={
  getLiveMetrics:['Live telemetry','dashboard'],getStaticInfo:['System identity','system'],getSecurityInfo:['Security inventory','security'],listStartupItems:['Startup inventory','system'],getPerformanceProfiles:['Power profiles','performance'],
  getStorageInventory:['Drive inventory','data'],getProcesses:['Processes','apps'],getInstalledApps:['Installed apps','apps'],getNetworkOverview:['Network adapters','network'],getVpnCenter:['VPN clients','network'],
  getModelCenter:['AI providers','models'],getFeatureLab:['Windows features','featurelab'],getGitHubCenter:['GitHub connection','integrations'],getUpdateReleaseState:['Update center','integrations'],getReliabilityStatus:['Reliability','settings'],getStableReleaseStatus:['Release preflight','settings'],getChangeJournal:['Change journal','journal'],getAutomationState:['Automation','automation']
 };
 function preferences(input){return {quiet:input?.quiet===true,infoToasts:input?.infoToasts!==false};}
 function severity(title){return /failed|failure|error|unavailable|unable|could not|rejected/i.test(title)?'error':/warning|needs review|unsupported|required/i.test(title)?'warning':'info';}
 function resultStatus(result){
  if(result===null||result===undefined)return {state:'unavailable',detail:'No data was returned. Open this center to check support or configuration.'};
  if(result.requiresAdmin===true&&result.ok===false)return {state:'admin',detail:result.error||'Administrator approval is required. Open the center for its guarded action.'};
  if(result.supported===false)return {state:'unsupported',detail:'This provider is not supported on this PC.'};
  if(result.available===false||result.configured===false)return {state:'unavailable',detail:result.error||'This provider needs setup or is currently unavailable.'};
  if(result.ok===false||result.error)return {state:'error',detail:String(result.error||'The refresh failed. Retry or check this center’s configuration.')};
  return {state:'success',detail:'Read completed.'};
 }
 function tracker(onChange=()=>{}){
  const states=new Map(),retry=new Map();let serial=0;
  function wrap(base){const api={...base};for(const [method,[label,view]] of Object.entries(reads)){
   if(typeof base[method]!=='function')continue;
   api[method]=async (...args)=>{
    const token=++serial,old=states.get(method)||{};
    retry.set(method,()=>api[method](...(typeof args[0]==='boolean'?[true,...args.slice(1)]:args)));
    states.set(method,{...old,method,label,view,state:'loading',detail:'Reading…',token});onChange(states.get(method));
    try{const result=await base[method].apply(base,args);if(states.get(method)?.token===token){const status=resultStatus(result);states.set(method,{...states.get(method),...status,checkedAt:Date.now(),lastSuccessAt:status.state==='success'?Date.now():old.lastSuccessAt});onChange(states.get(method));}return result;}
    catch(error){if(states.get(method)?.token===token){states.set(method,{...states.get(method),state:'error',detail:String(error?.message||error),checkedAt:Date.now()});onChange(states.get(method));}throw error;}
   };
  }return api;}
  return {states,wrap,retry:method=>states.get(method)?.state==='loading'?Promise.resolve():retry.get(method)?.()};
 }
 return {reads,preferences,severity,resultStatus,tracker};
});
