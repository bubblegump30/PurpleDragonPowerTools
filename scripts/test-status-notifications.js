'use strict';
const assert=require('node:assert/strict');const status=require('../src/status-notifications');
(async()=>{
 assert.deepEqual(status.preferences({quiet:'true'}),{quiet:false,infoToasts:true});assert.equal(status.severity('Update failed'),'error');assert.equal(status.severity('Saved'),'info');
 assert.equal(status.resultStatus({requiresAdmin:true,ok:false}).state,'admin');assert.equal(status.resultStatus({supported:false}).state,'unsupported');assert.equal(status.resultStatus(null).state,'unavailable');assert.equal(status.resultStatus({configured:false}).state,'unavailable');
 const tracker=status.tracker();let fail=false;const api=tracker.wrap({async getProcesses(){if(fail)throw Error('Offline');return {processes:[]};}});
 await api.getProcesses();const success=tracker.states.get('getProcesses').lastSuccessAt;fail=true;await assert.rejects(api.getProcesses(),/Offline/);assert.equal(tracker.states.get('getProcesses').state,'error');assert.equal(tracker.states.get('getProcesses').lastSuccessAt,success);fail=false;await tracker.retry('getProcesses');assert.equal(tracker.states.get('getProcesses').state,'success');
 let first,second;let n=0;const overlapping=status.tracker();const concurrent=overlapping.wrap({getProcesses(){return new Promise(resolve=>{if(n++===0)first=resolve;else second=resolve;});}});const a=concurrent.getProcesses(),b=concurrent.getProcesses();second({processes:[]});await b;first({ok:false,error:'stale error'});await a;assert.equal(overlapping.states.get('getProcesses').state,'success');
 const changes=[];let unavailable=false;const polling=status.tracker(state=>changes.push(state.state));const samples=polling.wrap({async getLiveMetrics(){return unavailable?{ok:false,error:'Sensor offline'}:{cpu:10};}});
 await samples.getLiveMetrics();await samples.getLiveMetrics();await samples.getLiveMetrics();assert.deepEqual(changes,['loading','success']);
 unavailable=true;await samples.getLiveMetrics();assert.equal(changes.at(-1),'error');unavailable=false;await samples.getLiveMetrics();assert.equal(changes.at(-1),'success');
 const realNow=Date.now;try{Date.now=()=>realNow()+31000;await samples.getLiveMetrics();assert.equal(changes.length,5);}finally{Date.now=realNow;}
 assert(Object.keys(status.reads).every(method=>!/(apply|run|save|set|install|publish|Admin)/.test(method)));
 console.log('Status tests passed: classification, validated preferences, failed reads, last-success timestamps, retry, overlapping reads, read-only catalog.');
})().catch(error=>{console.error(error);process.exit(1)});
