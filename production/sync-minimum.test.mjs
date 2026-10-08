import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {AppService} from '../web/core/service.mjs';
import {SyncEngine} from '../web/core/sync.mjs';
import {GraphClient,OneDriveCloud,MARKER_NAME} from '../web/core/graph.mjs';
import {canonical,operationKey,objectKey,seal} from '../web/core/model.mjs';
const input=n=>({title:'合成練習',goal:'合成の判断 '+n,team:'U15',players:15,totalMinutes:180,items:[{name:'合成メニュー',section:'BODY',minutes:10,term:{ID:'GBT-test','正式/標準用語':'Synthetic Term',定義:'合成用語'},variationName:'基本',rule:'合成条件',canvasRaw:''}]});
async function fixture(t,count=4,{pageSize=10000,downloadUrl=true,etag=true}={}){
 const app=new AppService(new DatabaseSync(':memory:'),'guest-local');t.after(()=>app.repo.close());
 const files=new Map(),versions=new Map(),ids=new Map(),requests=[];let downloads=0,lists=0,afterList=()=>{},corruptWrite=false;
 let last;
 for(let n=0;n<count;n++)last=(await app.run('savePlan',{revisionId:last?.body.opId,input:input(n)})).operation;
 await new SyncEngine(app.repo,{scope:app.repo.scope,list:async()=>[...files.keys()],get:async key=>files.get(key)||null,put:async(key,wire)=>files.set(key,wire)}).sync();
 const meta=name=>({id:ids.get(name)||name,name,file:{},size:Buffer.byteLength(canonical(files.get(name))),...(etag?{eTag:String(versions.get(name)||1)}:{}),...(downloadUrl?{'@microsoft.graph.downloadUrl':'https://synthetic.invalid/'+encodeURIComponent(name)}:{})});
 const client=new GraphClient({getToken:async()=> 'synthetic-token',sleep:async()=>{},fetcher:async(url,options)=>{
  const u=new URL(url);requests.push({url,method:options.method||'GET'});
  if(u.hostname==='synthetic.invalid'){downloads++;const name=decodeURIComponent(u.pathname.slice(1));return files.has(name)?new Response(canonical(files.get(name))):new Response('',{status:404});}
  const p=decodeURIComponent(u.pathname);
  if(p.endsWith('/children')){
   const offset=Number(u.searchParams.get('offset')||0),entries=[...files.keys()].map(meta),value=entries.slice(offset,offset+pageSize);
   if(!offset)lists++;
   const next=offset+pageSize<entries.length?'https://graph.microsoft.com/v1.0/me/drive/items/fixture/children?offset='+(offset+pageSize):undefined;
   const response=Response.json({value,...(next?{'@odata.nextLink':next}:{})});
   if(!next)afterList(lists);
   return response;
  }
  let name=p.includes('fixture:/')?p.split('fixture:/')[1]:p.split('/items/')[1];
  if(options.method==='PUT'){
   name=name.replace(/:\/content$/,'');files.set(name,corruptWrite?{wrong:true}:JSON.parse(options.body));versions.set(name,(versions.get(name)||1)+1);return Response.json(meta(name));
  }
  if(!files.has(name))return new Response('',{status:404});
  // Individual metadata includes a download URL even when the listing omits it.
  return Response.json({...meta(name),'@microsoft.graph.downloadUrl':'https://synthetic.invalid/'+encodeURIComponent(name)});
 }});
 const cloud=new OneDriveCloud(client,app.repo.scope,app.repo);cloud.folderId='fixture';cloud.marker={id:MARKER_NAME};files.set(MARKER_NAME,cloud.markerValue());app.cloud=cloud;app.engine=new SyncEngine(app.repo,cloud);
 return {app,cloud,client,files,last,requests,versions,ids,get downloads(){return downloads},get lists(){return lists},set afterList(fn){afterList=fn},set corruptWrite(value){corruptWrite=value},reset(){requests.length=0;downloads=0;lists=0;client.requests=0;}};
}
test('M01 100履歴の変更なし同期は2回の一覧だけで済み、本文を再取得しない',async t=>{
 const f=await fixture(t,100);await f.app.run('sync');f.reset();const before=await f.app.run('backup');await f.app.run('sync');
 assert.equal(f.client.requests,2);assert.equal(f.downloads,0);assert.equal(f.lists,2);const {createdAt:beforeAt,...beforeData}=before.body;const {createdAt:afterAt,...afterData}=(await f.app.run('backup')).body;assert.deepEqual(afterData,beforeData);assert.equal(f.cloud.index,null);
});
test('M02 一覧のページングで全履歴を取得し、各ページを一度ずつ確認する',async t=>{
 const f=await fixture(t,10,{pageSize:7});await f.app.run('sync');f.reset();await f.app.run('sync');assert.equal(f.client.requests,Math.ceil(f.files.size/7)*2);assert.equal(f.downloads,0);
});
test('M03 一覧にURLがなくても同じ版の本文は再取得せず、初回だけ必要なメタデータを取得',async t=>{
 const f=await fixture(t,3,{downloadUrl:false});await f.app.run('sync');f.reset();await f.app.run('sync');assert.equal(f.client.requests,2);assert.equal(f.downloads,0);
});
test('M04 版情報がない一覧は古い本文を再利用しない',async t=>{
 const f=await fixture(t,2,{etag:false});await f.app.run('sync');f.reset();await f.app.run('sync');assert(f.downloads>0);
});
test('M05 次の同期で既送信ファイルの消失を検出し、未送信の保存を保持',async t=>{
 const f=await fixture(t);await f.app.run('sync');f.files.delete(operationKey(f.last));await f.app.run('savePlan',{input:input('pending')});await assert.rejects(f.app.run('sync'),{code:'CLOUD_MISSING'});assert.equal(f.app.repo.pending().length,1);assert.equal(f.cloud.index,null);assert.equal(f.app.engine.busy,false);
});
test('M06 同期中に消えた既送信ファイルも完了にせず、次回は新しい一覧で復帰',async t=>{
 const f=await fixture(t);await f.app.run('sync');f.reset();const key=operationKey(f.last),wire=f.files.get(key);f.afterList=phase=>{if(phase===1)f.files.delete(key)};await assert.rejects(f.app.run('sync'),{code:'CLOUD_MISSING'});assert.equal(f.cloud.index,null);f.afterList=()=>{};f.files.set(key,wire);f.reset();await f.app.run('sync');assert.equal(f.app.repo.pending().length,0);
});
test('M07 変更された版を読み直し、改変された履歴を成功扱いにしない',async t=>{
 const f=await fixture(t);await f.app.run('sync');const key=operationKey(f.last);f.files.set(key,{...f.files.get(key),hash:'a'.repeat(64)});f.versions.set(key,2);await assert.rejects(f.app.run('sync'),{code:'CORRUPT'});assert.equal(f.cloud.index,null);
});
test('M08 所有者識別の変更を検出し、書込を行わない',async t=>{
 const f=await fixture(t);await f.app.run('sync');f.files.set(MARKER_NAME,{...f.cloud.markerValue(),scope:'other'});f.versions.set(MARKER_NAME,2);await f.app.run('savePlan',{input:input('pending')});f.reset();await assert.rejects(f.app.run('sync'),{code:'SCOPE'});assert.equal(f.requests.filter(r=>r.method==='PUT').length,0);assert.equal(f.app.repo.pending().length,1);
});
test('M09 新規保存の読戻しはキャッシュを使わず、誤った書込を検出',async t=>{
 const f=await fixture(t);await f.app.run('savePlan',{input:input('pending')});f.corruptWrite=true;await assert.rejects(f.app.run('sync'),{code:'VERIFY'});assert.equal(f.app.repo.pending().length,1);assert.equal(f.cloud.index,null);
});
test('M10 一覧取得後に同名の異なる内容が現れた場合は上書きしない',async t=>{
 const f=await fixture(t);const result=await f.app.run('savePlan',{input:input('pending')});const object=f.app.repo.closure(result.operation.body.opId).objects.find(o=>!f.files.has(objectKey(o.hash)));const key=objectKey(object.hash);const collision=seal({...object.body,payload:{...object.body.payload,unexpected:true}});f.afterList=phase=>{if(phase===1)f.files.set(key,collision)};await assert.rejects(f.app.run('sync'),{code:'COLLISION'});assert.deepEqual(f.files.get(key),collision);assert.equal(f.requests.filter(r=>r.method==='PUT'&&decodeURIComponent(r.url).includes(key)).length,0);
});

test('M11 アプリ再起動後も同じ版は端末の検証済み内容を使い、識別情報だけを取得',async t=>{
 const f=await fixture(t,10);await f.app.run('sync');
 const fetcher=f.client.fetcher;const client=new GraphClient({getToken:async()=> 'synthetic-token',fetcher,sleep:async()=>{}});
 const cloud=new OneDriveCloud(client,f.app.repo.scope,f.app.repo);cloud.folderId='fixture';cloud.marker={id:MARKER_NAME};f.app.cloud=cloud;f.app.engine=new SyncEngine(f.app.repo,cloud);f.reset();
 await f.app.run('sync');assert.equal(client.requests,2);assert.equal(f.downloads,1);const cache=JSON.parse(f.app.repo.meta('syncFileVersions'));assert.equal(Object.keys(cache.entries).length,f.files.size-1);assert(!JSON.stringify(cache).includes('https:'));
});
test('M12 版キャッシュが壊れている場合は通常の読込で検証し直す',async t=>{
 const f=await fixture(t);await f.app.run('sync');f.app.repo.setMeta('syncFileVersions','broken');f.client.textCache.clear();f.client.textCacheBytes=0;f.reset();await f.app.run('sync');assert(f.downloads>1);assert.equal(f.app.repo.pending().length,0);
});

test('M13 同じeTagでも別IDに置き換わったファイルは内容を再取得する',async t=>{
 const f=await fixture(t);await f.app.run('sync');const key=operationKey(f.last);f.ids.set(key,'replacement-id');f.reset();await f.app.run('sync');assert.equal(f.downloads,1);assert.equal(f.client.requests,2);
});
test('M14 版が同じでも端末の内容が破損していれば成功にしない',async t=>{
 const f=await fixture(t);await f.app.run('sync');const op=f.app.repo.getOp(f.last.body.opId);op.body.payload.goal='corrupt';f.app.repo.db.prepare('UPDATE operations SET body=? WHERE id=?').run(JSON.stringify(op.body),op.body.opId);await assert.rejects(f.app.run('sync'),{code:'CORRUPT'});assert.equal(f.cloud.index,null);
});
