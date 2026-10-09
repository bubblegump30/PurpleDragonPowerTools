/* Validated workspace preferences and display geometry, shared by main/renderer. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PowerToolsWorkspace=value;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const key='pt.workspace.v1';
 const views=['dashboard','models','performance','system','featurelab','data','apps','network','privacy','automation','journal','experiments','integrations','security','settings'];
 const fields={
  modelSearch:null,processSearch:null,appSearch:null,featureLabSearch:null,journalSearch:null,privacyAppSearch:null,githubRepoSearch:null,
  modelProviderFilter:['all','openai','codex','claude','gemini','ollama','lmstudio','custom'],
  featureLabCategory:['all','virtualization','developer','performance','security','windows'],featureLabStateFilter:['all','enabled','disabled','supported','unsupported','unknown'],
  journalCategory:['all','Windows Feature Lab','Performance','Automation','GitHub','Storage','Network','Process & Apps'],journalStateFilter:['all','undoable','undone','audit'],
  processSort:['default','name','cpu','memory'],appSort:['default','name','publisher']
 };
 function normalize(input){const filters={};for(const [id,options] of Object.entries(fields)){const value=input?.filters?.[id];if(typeof value==='string'&&(!options||options.includes(value)))filters[id]=options?value:value.slice(0,200);}return {view:views.includes(input?.view)?input.view:'dashboard',filters};}
 function load(storage){try{return normalize(JSON.parse(storage.getItem(key)||'{}'));}catch{return normalize({});}}
 function save(storage,state){try{storage.setItem(key,JSON.stringify(normalize(state)));return true;}catch{return false;}}
 function fitWindow(saved,displays,primaryId){
  const areas=displays.filter(d=>d?.workArea&&['x','y','width','height'].every(k=>Number.isFinite(d.workArea[k]))&&d.workArea.width>0&&d.workArea.height>0);
  if(!areas.length)return {width:1540,height:980,maximized:false,minWidth:1180,minHeight:760};
  const positioned=Number.isFinite(saved?.x)&&Number.isFinite(saved?.y);
  const width=Number.isFinite(saved?.width)?Math.max(1,Math.min(3840,saved.width)):1540;
  const height=Number.isFinite(saved?.height)?Math.max(1,Math.min(2160,saved.height)):980;
  const overlap=d=>{const a=d.workArea;return positioned?Math.max(0,Math.min(saved.x+width,a.x+a.width)-Math.max(saved.x,a.x))*Math.max(0,Math.min(saved.y+height,a.y+a.height)-Math.max(saved.y,a.y)):0;};
  const best=areas.reduce((a,b)=>overlap(b)>overlap(a)?b:a);
  const display=positioned&&overlap(best)>0?best:areas.find(d=>d.id===primaryId)||areas[0];const a=display.workArea;
  const minWidth=Math.min(1180,a.width),minHeight=Math.min(760,a.height);
  const w=Math.round(Math.min(a.width,Math.max(minWidth,width))),h=Math.round(Math.min(a.height,Math.max(minHeight,height)));
  const x=Math.round(Math.min(a.x+a.width-w,Math.max(a.x,positioned&&overlap(best)>0?saved.x:a.x+(a.width-w)/2)));
  const y=Math.round(Math.min(a.y+a.height-h,Math.max(a.y,positioned&&overlap(best)>0?saved.y:a.y+(a.height-h)/2)));
  return {x,y,width:w,height:h,minWidth,minHeight,maximized:saved?.maximized===true};
 }
 function sorted(items,mode,type){const copy=items.slice();if(mode==='default')return copy;const name=(a,b)=>String(a.name||a.displayName||'').localeCompare(String(b.name||b.displayName||''));if(type==='process'&&['cpu','memory'].includes(mode)){const field=mode==='cpu'?'cpuPercent':'memoryBytes';return copy.sort((a,b)=>(Number(b[field])||0)-(Number(a[field])||0)||name(a,b));}if(mode==='publisher')return copy.sort((a,b)=>String(a.publisher||'').localeCompare(String(b.publisher||''))||name(a,b));return copy.sort(name);}
 return {key,views,fields,normalize,load,save,fitWindow,sorted};
});
