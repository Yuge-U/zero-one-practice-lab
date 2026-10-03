import {readFile,writeFile,copyFile} from 'node:fs/promises'; // 検証用コピーの通信経路だけを更新します。
import {join,resolve} from 'node:path'; // ビルド先を固定します。
import assert from 'node:assert/strict'; // 想定外の置換を拒否します。
const root=resolve(process.argv[2]),web=join(root,'web'); // 比較対象の公開ソースには書き込みません。
const replace=(text,before,after,count=1)=>{assert.equal(text.split(before).length-1,count,'Connection patch mismatch: '+before);return text.replaceAll(before,after);}; // 変更箇所数を固定します。
await copyFile('production/connection.mjs',join(web,'core/connection.mjs')); // 安全な診断と分類をWindowとWorkerで共用します。
let graph=await readFile(join(web,'core/graph.mjs'),'utf8'); // 同期フォルダーとデータ形式を維持します。
graph="import {authCode,connectionError,recordConnection} from './connection.mjs'; // 通信分類と匿名の診断を共有します。\n"+graph.slice(0,graph.indexOf('export class GraphClient'))+await readFile('production/graph-client.fragment.mjs','utf8')+graph.slice(graph.indexOf('export class OneDriveCloud')); // 通信クライアントだけを置き換え保存確認の実装を保持します。
await writeFile(join(web,'core/graph.mjs'),graph); // DBとOneDriveの保存先は変更しません。
let bridge=await readFile(join(web,'worker-bridge.mjs'),'utf8'); // 認証の結果をWorkerへ渡す箇所を読みます。
bridge="import {authCode,connectionError} from './core/connection.mjs'; // 元エラーの本文をWorkerへ漏らしません。\n"+bridge; // 許可した分類だけを渡します。
bridge=replace(bridge,'await this.getToken()','await this.getToken(message.options||{})'); // 強制更新要求を認証担当へ渡します。
bridge=replace(bridge,"}catch{if(!this.closed&&!this.failed)this.worker.postMessage({type:'tokenResult',id:message.id,error:'Microsoftへの再接続が必要です。'});}","}catch(error){const safe=connectionError(authCode(error));if(!this.closed&&!this.failed)this.worker.postMessage({type:'tokenResult',id:message.id,error:safe.message,code:safe.code});} // 通信・権限・本人操作の区別を保持します。"); // すべてを再接続エラーへ変換しません。
await writeFile(join(web,'worker-bridge.mjs'),bridge); // 従来のWorker失敗時の保護を保持します。
let worker=await readFile(join(web,'worker.js'),'utf8'); // DBの開閉処理は触りません。
worker=replace(worker,'function token()','function token(options={})'); // 必要な時だけ無言の強制更新を伝えます。
worker=replace(worker,"postMessage({type:'token',id});","postMessage({type:'token',id,options});"); // 接続要求にトークンそのものを含めません。
worker=replace(worker,"reject(new Error('Microsoft接続を確認してください。'));},30000)","reject(Object.assign(new Error('Microsoft接続の応答がありません。時間を置いて再試行してください。'),{code:'NETWORK'}));},120000)"); // MSALの待機と制限付き再試行を許し応答不明を再認証扱いにしません。
worker=replace(worker,'item.reject(new Error(m.error))','item.reject(Object.assign(new Error(m.error),{code:m.code}))'); // 安全なエラー分類をGraphまで渡します。
worker=worker.split('\n').map(line=>line.includes('function token(')||line.includes("m.type==='tokenResult'")?line+' // 認証要求のオプションと安全な分類を保存Workerへ引き継ぎます。':line).join('\n'); // 変更した各行へ処理の説明を付けます。
await writeFile(join(web,'worker.js'),worker); // 従来のDBパスとタブ排他を保持します。
let service=await readFile(join(web,'core/service.mjs'),'utf8'); // 同期開始前の確認も同じ実行にまとめます。
service="import {connectionDiagnostics} from './connection.mjs'; // Worker側の安全な通信診断を書き出せるようにします。\n"+service; // 個人データは診断履歴へ追加しません。
service=replace(service,"run(name,args={}) {const task=this.chain.catch(()=>{}).then(()=>this.execute(name,args));this.chain=task;return task;}","run(name,args={}) {if(name==='sync'&&this.syncTask&&this.chain===this.syncTask)return this.syncTask;const task=this.chain.catch(()=>{}).then(()=>this.execute(name,args)).finally(()=>{if(this.syncTask===task)this.syncTask=null;});this.chain=task;if(name==='sync')this.syncTask=task;return task;} // 連続した同期要求だけを共有し間に入った保存を飛ばしません。"); // 既存の直列キューへ入れる前に重複同期をまとめます。
service=replace(service,"cloudConfigured:Boolean(this.engine)","cloudConfigured:Boolean(this.engine),connectionEvents:connectionDiagnostics()"); // 診断エクスポートへ分類・時刻・回数だけを追加します。
service=service.split('\n').map(line=>line.includes("if(name==='sync')")||line.includes("if(name==='diagnostics')")?line+' // 同期の重複を抑止し安全な診断だけを書き出します。':line).join('\n'); // 変更した各行の目的を明記します。
await writeFile(join(web,'core/service.mjs'),service); // 保存・受信・依存確認の必須処理を保持します。
let app=await readFile(join(web,'app.mjs'),'utf8'); // 認証操作と同期画面の接続を更新します。
app="import {connectionDiagnostics} from './core/connection.mjs'; // 認証側の匿名診断を既存の書出しに加えます。\n"+app; // 自動的な外部送信は行いません。
app=replace(app,'getToken:async()=>{','getToken:async(options)=>{',2); // Workerと添付で同じ更新経路を使います。
app=replace(app,'await auth.token()','await auth.token(options)',2); // 401の更新指定をAuthへ渡します。
app=replace(app,'physicalDeviceVerification:false','physicalDeviceVerification:false,authConnectionEvents:connectionDiagnostics()'); // 元エラーやトークンを記録しません。
app=replace(app,'async function connectCloud(create=false){','let connectionFlight=null; // 起動時と利用者操作の接続重複を防ぎます。\nasync function connectCloud(create=false){if(connectionFlight)return connectionFlight;connectionFlight=performConnectCloud(create);try{return await connectionFlight;}finally{connectionFlight=null;accountStatus();}} // 接続の成否を共有し再接続ループを作りません。\nasync function performConnectCloud(create=false){'); // 既存のフォルダー検証と同期を一回だけ開始します。
app=replace(app,'if(!cloudReady||sending)return;','if(!cloudReady||sending||auth.needsInteraction)return;'); // 明示再認証待ちの間は自動同期を止めます。
app=replace(app,"window.addEventListener('online',()=>guard(synchronize));","window.addEventListener('online',()=>guard(()=>initialized&&!connecting&&!cloudReady&&auth.account&&!auth.needsInteraction?connectCloud(false):synchronize())); // 通信復帰時は既存フォルダーだけを再確認し未接続のまま放置しません。"); // 初回フォルダー作成への同意を自動化しません。
app=app.split('\n').map(line=>line.startsWith('async function openWorker()')||line.startsWith('async function performConnectCloud(')||line.startsWith("$('diagnostics').onclick")?line+' // 本人境界を維持し接続要求と匿名診断を扱います。':line).join('\n'); // 変更した各行へ説明を付けます。
await writeFile(join(web,'app.mjs'),app); // 保存成功と同期結果の表示は引き続き分離します。
for(const [name,count]of [['config.mjs',1],['core/service.mjs',1],['index.html',2],['sw.js',2]]){const file=join(web,name);let text=await readFile(file,'utf8');text=replace(text,'1.3.1','1.3.2',count);if(name==='sw.js')text=replace(text,"'./core/graph.mjs'","'./core/graph.mjs','./core/connection.mjs'");await writeFile(file,text);} // 通常更新で新しい通信コードを配信し既存キャッシュを削除しません。
for(const name of ['production-scenarios.mjs','save-status-browser.mjs','catalog-browser.mjs','reference-browser.mjs','media-browser.mjs','upgrade-check.mjs']){const file=join(root,'tools',name),text=await readFile(file,'utf8');assert(text.includes('1.3.1'));await writeFile(file,text.replaceAll('1.3.1','1.3.2').replaceAll('1\\.3\\.1','1\\.3\\.2'));} // 既存の合格条件を残し対象版だけを更新します。
