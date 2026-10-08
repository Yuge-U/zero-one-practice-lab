import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const web=join(resolve(process.argv[2]),'web');
function replace(text,before,after){assert.equal(text.split(before).length-1,1,'Minimum sync patch mismatch: '+before);return text.replace(before,after);}
let graph=await readFile(join(web,'core/graph.mjs'),'utf8');
graph=replace(graph,'async readText(item,{fresh=false}={})','async readText(item,{fresh=false,forceRead=false}={})');
graph=replace(graph,"const meta=fresh&&item['@microsoft.graph.downloadUrl']?item:await this.request(`/me/drive/items/${encodeURIComponent(item.id)}`);", "let meta=fresh&&(item.eTag||item['@microsoft.graph.downloadUrl'])?item:await this.request(`/me/drive/items/${encodeURIComponent(item.id)}`);");
graph=replace(graph,"if(typeof meta.eTag==='string'&&meta.eTag&&cached?.eTag===meta.eTag)return cached.raw;const target=", "if(!forceRead&&typeof meta.eTag==='string'&&meta.eTag&&cached?.eTag===meta.eTag)return cached.raw;if(!meta['@microsoft.graph.downloadUrl']){meta=await this.request(`/me/drive/items/${encodeURIComponent(item.id)}`);ensure(meta,'CLOUD_MISSING','ファイルが見つかりません。');ensure(!Number.isFinite(meta.size)||meta.size<=LIMIT,'LIMIT','受信ファイルが大きすぎます。');}const target=");
const start=graph.indexOf('  async check()'),end=graph.lastIndexOf('\n}');
assert(start>0&&end>start);
graph=graph.slice(0,start)+`  async beginSync() {
    ensure(!this.index,'BUSY','同期はすでに進行中です。');
    this.reads=new Map();this.versions={};
    // The account database stores only verified file IDs/eTags, never tokens or download URLs.
    try{const saved=JSON.parse(this.repo.meta('syncFileVersions')||'null');if(saved?.version===1&&saved.folderId===this.folderId&&saved.entries&&typeof saved.entries==='object'&&!Array.isArray(saved.entries)&&Object.keys(saved.entries).length<=10000)this.versions=saved.entries;}catch{}
    try{await this.refreshIndex();}catch(error){this.endSync();throw error;}
  }
  endSync(){this.index=null;this.reads=null;this.versions=null;}
  commitSync(){
    const entries={};
    for(const [key,item]of this.index||[]){const read=this.reads.get(key);if(read?.wire&&typeof item.id==='string'&&typeof item.eTag==='string'&&item.eTag)entries[key]=[item.id,item.eTag];}
    this.repo.setMeta('syncFileVersions',JSON.stringify({version:1,folderId:this.folderId,entries}));
  }
  localFile(key,item){
    const version=this.versions?.[key];
    if(!item.eTag||!Array.isArray(version)||version[0]!==item.id||version[1]!==item.eTag)return null;
    const wire=key.startsWith('B_')?this.repo.getObject(key.slice(2,-5)):this.repo.getOp(key.slice(2,38));
    if(!wire)return null;
    if(key.startsWith('B_')){validateObject(wire);ensure(objectKey(wire.hash)===key,'CORRUPT','固定版名が不一致です。');}
    else{validateOperation(wire,this.scope);ensure(operationKey(wire)===key,'CORRUPT','操作名が不一致です。');}
    return wire;
  }
  async refreshIndex(){
    ensure(this.folderId&&this.marker,'NOT_PROVISIONED','OneDriveの保存領域が未接続です。');
    const files=await this.client.children(this.folderId);
    const marker=files.find(item=>item.name===MARKER_NAME);
    ensure(marker?.file&&marker.id,'CLOUD_MISSING','同期領域の識別ファイルが消失しています。');
    ensure(await this.client.readText(marker,{fresh:true})===canonical(this.markerValue()),'SCOPE','同期領域の識別情報が変更されています。');
    const next=new Map();
    for(const item of files){if(!item.file||item.name===MARKER_NAME)continue;ensure(validCloudKey(item.name),'CORRUPT','同期領域に未対応ファイルがあります。');ensure(!next.has(item.name),'CORRUPT','同名の同期ファイルがあります。');next.set(item.name,item);}
    // Only an unchanged ID and nonempty eTag may reuse a read across the two fresh listings.
    for(const [key,entry]of this.reads||[]){const item=next.get(key);if(!item||!item.eTag||item.id!==entry.id||item.eTag!==entry.eTag)this.reads.delete(key);}
    this.index=next;
  }
  async check(){
    ensure(this.folderId&&this.marker,'NOT_PROVISIONED','OneDriveの保存領域が未接続です。');
    if(this.index)return; // The current sync listing already verified the owner marker.
    const marker=await this.client.request(\`/me/drive/items/\${encodeURIComponent(this.folderId)}:/\${MARKER_NAME}\`);
    ensure(marker,'CLOUD_MISSING','同期領域の識別ファイルが消失しています。');
    ensure(await this.client.readText(marker,{fresh:true})===canonical(this.markerValue()),'SCOPE','同期領域の識別情報が変更されています。');
  }
  async writeNew(name,value){const raw=canonical(value);ensure(byteLength(raw)<=LIMIT,'LIMIT','保存データが大きすぎます。');return this.client.request(\`/me/drive/items/\${encodeURIComponent(this.folderId)}:/\${encodeURIComponent(name)}:/content\`,{method:'PUT',headers:{'Content-Type':'application/json'},body:raw});}
  async list(){
    if(this.index)return [...this.index.keys()].sort();
    await this.check();const files=await this.client.children(this.folderId);const keys=files.filter(item=>item.file&&item.name!==MARKER_NAME).map(item=>item.name);keys.forEach(key=>ensure(validCloudKey(key),'CORRUPT','同期領域に未対応ファイルがあります。'));return keys.sort();
  }
  async get(key,{fresh=false,forceRead=false}={}){
    ensure(validCloudKey(key),'PATH','不正なファイル名です。');ensure(this.folderId,'NOT_PROVISIONED','同期領域が未接続です。');
    if(this.index&&!fresh){if(!this.index.has(key))return null;const cached=this.reads.get(key);if(cached)return cached.promise;}
    const read=async()=>{
      const item=this.index&&!fresh?this.index.get(key):await this.client.request(\`/me/drive/items/\${encodeURIComponent(this.folderId)}:/\${encodeURIComponent(key)}\`);
      if(!item){if(this.index){this.index.delete(key);this.reads.delete(key);}return null;}
      let wire=!forceRead&&this.index?this.localFile(key,item):null;
      if(!wire){const raw=await this.client.readText(item,{fresh:true,forceRead});try{wire=JSON.parse(raw);}catch{throw new LabError('CORRUPT','同期ファイルの内容が壊れています。');}}
      if(this.index){this.index.set(key,item);this.reads.set(key,{id:item.id,eTag:item.eTag,wire,promise:Promise.resolve(wire)});}
      return wire;
    };
    const promise=read();
    if(this.index&&!fresh){const item=this.index.get(key);this.reads.set(key,{...this.reads.get(key),id:item.id,eTag:item.eTag,promise});}
    try{return await promise;}catch(error){this.reads?.delete(key);throw error;}
  }
  async put(key,wire){
    ensure(validCloudKey(key),'PATH','検証データ以外は保存できません。');if(key.startsWith('B_')){validateObject(wire);ensure(objectKey(wire.hash)===key,'CORRUPT','固定版名が不一致です。');}else{validateOperation(wire,this.scope);ensure(operationKey(wire)===key,'CORRUPT','操作名が不一致です。');}
    await this.check();
    // A new name is checked directly before writing; a listing cannot authorize an overwrite.
    const old=await this.get(key,{fresh:Boolean(this.index&&!this.index.has(key))});
    if(old){ensure(canonical(old)===canonical(wire),'COLLISION','同名の異なる内容を上書きしません。');return;}
    await this.writeNew(key,wire);
    // The actual response body is reread even if a test/service returns an unchanged eTag.
    const saved=await this.get(key,{fresh:true,forceRead:true});
    ensure(saved&&canonical(saved)===canonical(wire),'VERIFY','OneDrive保存後の内容確認が未完了です。');
  }
`+graph.slice(end);
await writeFile(join(web,'core/graph.mjs'),graph);
let sync=await readFile(join(web,'core/sync.mjs'),'utf8');
sync=replace(sync,'      await this.verifyAcknowledged();','      await this.cloud.beginSync?.();\n      await this.verifyAcknowledged();');
sync=replace(sync,"      await this.pull(); this.repo.setMeta('lastCheckedAt',new Date().toISOString());", "      await this.cloud.refreshIndex?.();\n      await this.pull(); await this.verifyAcknowledged(); this.cloud.commitSync?.(); this.repo.setMeta('lastCheckedAt',new Date().toISOString());");
sync=replace(sync,'finally { this.busy = false; }','finally { this.cloud.endSync?.(); this.busy = false; }');
await writeFile(join(web,'core/sync.mjs'),sync);
let service=await readFile(join(web,'core/service.mjs'),'utf8');
service=replace(service,"await this.cloud.check();return this.engine.sync();", "if(!this.cloud.beginSync)await this.cloud.check();return this.engine.sync();");
await writeFile(join(web,'core/service.mjs'),service);
