import test from 'node:test'; // 新規添付の接続条件を検証します。
import assert from 'node:assert/strict'; // 実行結果を厳密に確認します。
import {mediaImportAccess,authorizeMediaImport,assertMediaImportPermit} from '../web/media-import-policy.mjs'; // 候補と同じ判定を使います。
import {MediaStore} from '../web/media-store.mjs'; // 実際の取込処理を対象にします。
import {inspectMedia,digestBlob,mediaFilename} from '../web/media-model.mjs'; // 添付の内容と識別値を確認します。
const snapshot=()=>({initialized:true,account:true,connected:true,online:true,scope:'ms-a',recordScope:'ms-a',storeScope:'ms-a',needsInteraction:false,closed:false,protected:false,syncError:''}); // 本人接続済みの人工状態です。
const image=()=>new File([Buffer.from('89504e470d0a1a0a0000000000000000','hex')],'sample.png',{type:'image/png'}); // 人物を含まない形式確認用データです。
class Directory{ // OPFSの読み書きをメモリで模擬します。
  constructor(hooks={},stats={writes:0,commits:0,aborts:0}){this.files=new Map();this.dirs=new Map();this.hooks=hooks;this.stats=stats;} // 保存回数と中断回数を記録します。
  async getDirectoryHandle(name,{create=false}={}){if(!this.dirs.has(name)&&create)this.dirs.set(name,new Directory(this.hooks,this.stats));if(!this.dirs.has(name))throw Object.assign(new Error('missing'),{name:'NotFoundError'});return this.dirs.get(name);} // アカウント別の領域を再現します。
  async getFileHandle(name,{create=false}={}){if(!this.files.has(name)&&!create)throw Object.assign(new Error('missing'),{name:'NotFoundError'});const self=this;return {getFile:async()=>self.files.get(name)||new Blob([]),createWritable:async()=>{let pending;await self.hooks.writer?.();return {write:async value=>{self.stats.writes++;pending=value;await self.hooks.write?.();},close:async()=>{self.stats.commits++;self.files.set(name,pending);await self.hooks.close?.();},abort:async()=>{self.stats.aborts++;}};}};} // 確定前は本体を保存済みにしません。
} // 模擬保存領域を閉じます。
const filesystem=hooks=>{const root=new Directory(hooks);return {storage:{getDirectory:async()=>root},root};}; // ブラウザは起動せず保存手順だけを試験します。
const permitFor=(value,verify=async()=>({scope:value.scope,folderId:'folder-a'}),signal)=>authorizeMediaImport(()=>value,verify,{signal}); // 接続確認を経由した許可を作ります。
for(const [name,changes,code]of [ // 許可しない状態を列挙します。
  ['初期化前',{initialized:false},'NOT_READY'], // 準備途中の追加は拒否します。
  ['データ保護中',{protected:true},'PROTECTED'], // 保存停止条件を優先します。
  ['サインアウト済み',{closed:true},'CLOSED'], // 閉じたセッションを拒否します。
  ['再認証が必要',{needsInteraction:true},'REAUTH'], // 認証期限切れを拒否します。
  ['ゲスト',{account:false,scope:'guest-local',recordScope:'guest-local',storeScope:'guest-local'},'SIGN_IN'], // 端末専用の取込を拒否します。
  ['本人名があってもゲスト領域',{scope:'guest-local',recordScope:'guest-local',storeScope:'guest-local'},'SIGN_IN'], // 表示だけの本人状態を信用しません。
  ['認証済みだがOneDrive未接続',{connected:false},'NOT_CONNECTED'], // サインインと同期領域の接続を区別します。
  ['通信なし',{online:false},'OFFLINE'], // 新しい添付のオフライン取込を禁止します。
  ['通信状態が不明',{online:undefined},'OFFLINE'], // 不明を許可に倒しません。
  ['同期確認失敗',{syncError:'failed'},'SYNC_ERROR'], // 失敗した状態のまま追加しません。
  ['計画が別アカウント',{recordScope:'ms-b'},'ACCOUNT_CHANGED'], // 計画領域の一致を要求します。
  ['添付が別アカウント',{storeScope:'ms-b'},'ACCOUNT_CHANGED'] // 添付領域の一致を要求します。
])test('P '+name+'では読取確認にも進まない',async()=>{const value={...snapshot(),...changes};let checks=0;assert.equal(mediaImportAccess(value).code,code);await assert.rejects(permitFor(value,async()=>{checks++;return {scope:'ms-a',folderId:'folder-a'};}),{code:'MEDIA_IMPORT_'+code});assert.equal(checks,0);}); // 拒否時には外部アクセスも発生しません。
test('P 同期可能なら待機中も送受信中も添付を許可',()=>{assert.equal(mediaImportAccess(snapshot()).allowed,true);assert.equal(mediaImportAccess({...snapshot(),sending:true,pending:2}).allowed,true);}); // 同期中の数秒間だけに制限する設計ではありません。
test('P フォルダー確認が失敗したら許可を返さない',async()=>{await assert.rejects(permitFor(snapshot(),async()=>{throw new Error('503');}),/503/);}); // 画面が接続済みでも実確認に失敗したら止めます。
test('P 空のフォルダー情報と別人の応答を拒否',async()=>{for(const response of [null,{scope:'ms-a',folderId:''},{scope:'ms-b',folderId:'folder-a'}])await assert.rejects(permitFor(snapshot(),async()=>response),{code:'MEDIA_IMPORT_UNVERIFIED'});}); // 未確認の保存先を許可しません。
test('P 許可証を省略・偽装して保存層を呼べない',async()=>{const store=new MediaStore('ms-a',filesystem().storage);for(const permit of [undefined,{scope:'ms-a',assert(){}}])await assert.rejects(store.import(image(),permit),{code:'MEDIA_IMPORT_UNVERIFIED'});}); // UIを経由しない呼出しにも制限を適用します。
test('P 許可証を別人の保存先へ流用できない',async()=>{const permit=await permitFor(snapshot());const store=new MediaStore('ms-b',filesystem().storage);await assert.rejects(store.import(image(),permit),{code:'MEDIA_IMPORT_UNVERIFIED'});}); // 本人境界を保存直前にも維持します。
test('P 認証確認待ちに通信が切れたら許可しない',async()=>{const value=snapshot();await assert.rejects(permitFor(value,async()=>{value.online=false;return {scope:'ms-a',folderId:'folder-a'};}),{code:'MEDIA_IMPORT_OFFLINE'});}); // 非同期確認の後にも接続条件を検査します。
test('P 確認後に本人が切り替わったら拒否',async()=>{const value=snapshot();const permit=await permitFor(value);value.scope=value.recordScope=value.storeScope='ms-b';assert.throws(()=>assertMediaImportPermit(permit,'ms-a'),{code:'MEDIA_IMPORT_ACCOUNT_CHANGED'});}); // 全領域が別人へ切り替わっても以前の許可を再利用しません。
test('P 接続確認後だけ取込でき、同一ファイルは重複しない',async()=>{const value=snapshot(),fs=filesystem(),store=new MediaStore('ms-a',fs.storage);let checks=0;const permit=await permitFor(value,async()=>{checks++;return {scope:value.scope,folderId:'folder-a'};});const ref=await store.import(image(),permit);await store.import(image(),permit);assert.equal(checks,1);assert.equal(fs.root.stats.commits,1);assert.equal(await digestBlob(await store.get(ref)),ref.hash);}); // 接続を確認した取込と従来の重複抑止が両立します。
test('P 本体読取中に切断したら書込みへ進まない',async()=>{const value=snapshot(),fs=filesystem(),store=new MediaStore('ms-a',fs.storage),file=image();const original=file.arrayBuffer.bind(file);file.arrayBuffer=async()=>{value.online=false;return original();};const permit=await permitFor(value);await assert.rejects(store.import(file,permit),{code:'MEDIA_IMPORT_OFFLINE'});assert.equal(fs.root.stats.writes,0);}); // 選択済みのファイルでも切断後は取り込みません。
test('P 書込準備中の切断では本体を書かない',async()=>{const value=snapshot(),fs=filesystem({writer:async()=>{value.online=false;}}),store=new MediaStore('ms-a',fs.storage);await assert.rejects(store.import(image(),await permitFor(value)),{code:'MEDIA_IMPORT_OFFLINE'});assert.equal(fs.root.stats.writes,0);assert.equal(fs.root.stats.commits,0);assert.equal(fs.root.stats.aborts,1);}); // 非同期writer取得中の切断も止めます。
test('P 書込中の切断では確定せず中断する',async()=>{const value=snapshot(),fs=filesystem({write:async()=>{value.online=false;}}),store=new MediaStore('ms-a',fs.storage);await assert.rejects(store.import(image(),await permitFor(value)),{code:'MEDIA_IMPORT_OFFLINE'});assert.equal(fs.root.stats.commits,0);assert.equal(fs.root.stats.aborts,1);}); // 準備完了時だけの判定にしません。
test('P 切断後に復帰しても中断した許可を復活させない',async()=>{const value=snapshot(),controller=new AbortController(),permit=await permitFor(value,undefined,controller.signal);controller.abort(new Error('切断'));value.online=true;await assert.rejects(new MediaStore('ms-a',filesystem().storage).import(image(),permit),/切断/);}); // 自動で選択中のファイルを再取り込みしません。
test('P オフラインでも保存済み実体の読出しは保持',async()=>{const value=snapshot(),store=new MediaStore('ms-a',filesystem().storage);const permit=await permitFor(value),ref=await store.import(image(),permit);value.online=false;assert.equal(await digestBlob(await store.get(ref)),ref.hash);await assert.rejects(store.import(image(),permit),{code:'MEDIA_IMPORT_OFFLINE'});}); // 既存の閲覧と新規取込の制限を分けて確認します。
test('P 過去のゲスト添付を消さずに読める',async()=>{const store=new MediaStore('guest-local',filesystem().storage),blob=image(),ref=await inspectMedia(blob);await store.put(blob,ref);assert.equal(await digestBlob(await store.get(ref)),ref.hash);await assert.rejects(store.import(blob),{code:'MEDIA_IMPORT_UNVERIFIED'});}); // 旧版から持ち越した添付のキャッシュは読み出せます。
test('P 許可証に認証情報や送信先を保存しない',async()=>{const permit=await permitFor(snapshot(),async()=>({scope:'ms-a',folderId:'folder-a',token:'not-to-keep'}));assert.deepEqual(Object.keys(permit).sort(),['assert','scope']);assert(!JSON.stringify(permit).includes('not-to-keep'));}); // 資格情報を添付データへ混入させません。
