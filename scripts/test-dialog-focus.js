'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/renderer.js', 'utf8');
const document = { activeElement: null };
function control({disabled=false, hidden=false, tabIndex=0}={}) {
  return {disabled, tabIndex, isConnected:true, getClientRects:()=>hidden?[]:[{}], focus(){document.activeElement=this;}};
}
const trigger=control(), close=control(), last=control(), disabled=control({disabled:true}), hidden=control({hidden:true});
const dialog=control({tabIndex:-1});dialog.scrollTop=90;
let controls=[close,disabled,hidden,last];
const backdrop={hidden:true, querySelector:()=>dialog, querySelectorAll:()=>controls};
const body={innerHTML:''}, search=control();
const nodes={'#modalBackdrop':backdrop,'#modalBackdrop .modal':dialog,'#modalBody':body,'#globalSearch':search};
let keydown;
const context=vm.createContext({document, $:s=>nodes[s], setText:()=>{}, setProfileMenu:()=>{}, window:{addEventListener:(_name,handler)=>{keydown=handler;}}});
vm.runInContext(source.slice(source.indexOf('  let modalReturnFocus'),source.indexOf('  function setProfileMenu')),context);
const start=source.indexOf("    window.addEventListener('keydown', e => {");
const end=source.indexOf('\n    });',start)+8;
vm.runInContext(source.slice(start,end),context);
function key(key,shiftKey=false,ctrlKey=false) {let prevented=false;keydown({key,shiftKey,ctrlKey,preventDefault(){prevented=true;}});return prevented;}
document.activeElement=trigger;
context.openModal('Title','Body');
assert.equal(document.activeElement,close);assert.equal(dialog.scrollTop,0);
assert(key('Tab',true));assert.equal(document.activeElement,last);
assert(key('Tab'));assert.equal(document.activeElement,close);
assert(key('k',false,true));assert.equal(document.activeElement,close);
context.openModal('Replacement','Body');key('Escape');assert.equal(document.activeElement,trigger);assert(backdrop.hidden);
context.openModal('No controls','Body');controls=[];assert(key('Tab'));assert.equal(document.activeElement,dialog);
trigger.isConnected=false;context.closeModal();assert(backdrop.hidden);
console.log('Dialog focus tests passed: wrap, disabled/hidden filtering, modal replacement, shortcut containment, focus restoration, missing trigger.');
