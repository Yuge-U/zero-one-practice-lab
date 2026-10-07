import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {updateBrandShell} from '../brand-shell-update.mjs';
const source=readFileSync(new URL('./fixtures/before-brand-refresh-sw.js',import.meta.url),'utf8');
function worker({version='1.3.4',ready=true,network=true}={}){
 const events={},listeners=new Set();let skipped=0,claimed=0,cached=0,marker=false;
 const active={postMessage(){for(const receive of listeners)receive({source:active,data:{type:'offlineStatus',version,appShellReady:ready}});}};
 const self={registration:{scope:'https://example.test/zero-one-practice-lab/',active},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{skipped++;},addEventListener(name,fn){if(name==='message')listeners.add(fn);else events[name]=fn;},removeEventListener(name,fn){listeners.delete(fn);}};
 const context={self,URL,Promise,Error,Response,setTimeout:()=>1,clearTimeout(){},fetch:async()=>{if(!network)throw Error('offline');return 'fresh html';},caches:{open:async()=>({addAll:async()=>{},put:async()=>{marker=true;},match:async key=>{if(key.includes('.brand-takeover'))return marker?'1.3.4':undefined;cached++;return 'offline html';}})}};
 vm.runInNewContext(updateBrandShell(source),context);
 return{events,get skipped(){return skipped;},get claimed(){return claimed;},get cached(){return cached;}};
}
for(const [version,ready,expected]of [['1.3.4',true,1],['1.3.3',true,0],['1.3.4',false,0]])test(`safe shell activation ${version} ready=${ready}`,async()=>{const w=worker({version,ready});let pending;w.events.install({waitUntil(p){pending=p;}});await pending;assert.equal(w.skipped,expected);});
test('navigation uses fresh HTML, not old app-shell cache',async()=>{const w=worker();let response;w.events.fetch({request:{method:'GET',mode:'navigate'},respondWith(p){response=p;}});assert.equal(await response,'fresh html');assert.equal(w.cached,0);});
test('offline navigation retains the prepared app shell',async()=>{const w=worker({network:false});let response;w.events.fetch({request:{method:'GET',mode:'navigate'},respondWith(p){response=p;}});assert.equal(await response,'offline html');assert.equal(w.cached,1);});
test('same-version activation claims clients without reloading editors',async()=>{const w=worker();let pending;w.events.install({waitUntil(p){pending=p;}});await pending;w.events.activate({waitUntil(p){pending=p;}});await pending;assert.equal(w.claimed,1);});

test('initial activation keeps the existing startup behaviour',async()=>{const w=worker({version:'1.3.3'});let pending;w.events.install({waitUntil(p){pending=p;}});await pending;w.events.activate({waitUntil(p){pending=p;}});await pending;assert.equal(w.claimed,0);});
