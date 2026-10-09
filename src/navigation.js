/* Shared navigation catalog and local preference model. No system mutations. */
(function (root, factory) {
  const navigation = factory();
  if (typeof module === 'object' && module.exports) module.exports = navigation;
  else root.PowerToolsNavigation = navigation;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const centers = [
    ['dashboard','Dashboard','home metrics overview'], ['models','AI Command Center','model ollama lm studio chatgpt codex claude gemini router council'],
    ['performance','Performance & Hardware','cpu gpu memory sensor temperature'], ['system','System PowerTools','bios firmware tpm startup'],
    ['featurelab','Windows Feature Lab','windows features'], ['data','Storage & Data Hub','disk drives cleanup large files'],
    ['apps','Process & Apps','process installed applications'], ['network','Network PowerTools','vpn ping dns adapters ip'],
    ['privacy','Privacy & App Trust','publisher signature exposure authenticode'], ['automation','Automation Engine','rules schedules triggers'],
    ['journal','Change Journal','undo history'], ['experiments','Experiments','experiment'], ['integrations','Updates & Releases','github repository commit release download verification'],
    ['security','Security Center','defender firewall bitlocker antivirus'], ['settings','Settings & Reliability','diagnostics recovery preferences preflight']
  ].map(([view,label,keywords])=>({id:`center:${view}`,label,keywords,kind:'center',target:view}));
  const tools = [
    ['taskmanager','Task Manager'], ['resmon','Resource Monitor'], ['devicemanager','Device Manager'], ['eventviewer','Event Viewer'],
    ['services','Services'], ['diskmanagement','Disk Management'], ['computermanagement','Computer Management'], ['controlpanel','Control Panel'],
    ['poweroptions','Power Options'], ['networkconnections','Network Connections'], ['updates','Windows Update'], ['defender','Windows Security'],
    ['firewall','Windows Firewall'], ['bitlocker','BitLocker Settings'], ['startup','Startup Apps'], ['storage','Windows Storage Settings'], ['apps','Windows Installed Apps']
  ].map(([target,label])=>({id:`tool:${target}`,label,keywords:`windows open ${target}`,kind:'tool',target}));
  const catalog = [...centers,...tools,{id:'help:shortcuts',label:'Keyboard Shortcut Guide',keywords:'help keyboard shortcuts hotkeys',kind:'help'}];
  const byId = new Map(catalog.map(item=>[item.id,item]));
  function normalize(value) {
    const clean = (items,max) => Array.isArray(items) ? [...new Set(items.filter(id=>typeof id==='string' && byId.has(id)))].slice(0,max) : [];
    return {pins:clean(value?.pins,12),recent:clean(value?.recent,8)};
  }
  function load(storage) {try{return normalize(JSON.parse(storage.getItem('pt.navigation.v1') || '{}'));}catch{return normalize({});}}
  function save(storage,state) {try{storage.setItem('pt.navigation.v1',JSON.stringify(normalize(state)));return true;}catch{return false;}}
  function recent(state,id) {if(!byId.has(id))return normalize(state);return normalize({...state,recent:[id,...state.recent.filter(x=>x!==id)]});}
  function togglePin(state,id) {
    state=normalize(state);if(!byId.has(id))return state;
    return normalize({...state,pins:state.pins.includes(id)?state.pins.filter(x=>x!==id):state.pins.length<12?[...state.pins,id]:state.pins});
  }
  function search(query,state) {
    const words=String(query||'').toLowerCase().trim().split(/\s+/).filter(Boolean);state=normalize(state);
    return catalog.filter(item=>words.every(word=>`${item.label} ${item.keywords}`.toLowerCase().includes(word)))
      .map(item=>({item,score:(!words.length?0:item.label.toLowerCase()===words.join(' ')?100:item.label.toLowerCase().startsWith(words.join(' '))?50:0)+(state.pins.includes(item.id)?10:0)+(state.recent.includes(item.id)?8-state.recent.indexOf(item.id):0)}))
      .sort((a,b)=>b.score-a.score||a.item.label.localeCompare(b.item.label)).map(x=>x.item);
  }
  return {catalog,byId,normalize,load,save,recent,togglePin,search};
});
