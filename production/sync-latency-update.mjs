import {readFile,writeFile} from 'node:fs/promises'; // 生成したアプリの必要箇所だけを更新します。
import {join,resolve} from 'node:path'; // 修正先を作業コピーへ限定します。
import assert from 'node:assert/strict'; // 基準コードが異なる場合はビルドを止めます。
const root=resolve(process.argv[2]),web=join(root,'web'); // DBや比較対象アプリの保存先は変更しません。
const replace=(text,before,after,count=1)=>{assert.equal(text.split(before).length-1,count,'Latency patch mismatch: '+before);return text.replaceAll(before,after);}; // 想定した変更箇所数を照合します。
let service=await readFile(join(web,'core/service.mjs'),'utf8'); // 保存と通信を直列化していたサービスを読みます。
const oldRun=service.split('\n').find(line=>line.trimStart().startsWith('run(name,args={}')); // 既存の重複同期防止を含む実装を指定します。
service=replace(service,oldRun,`  run(name,args={}) { // 同期の待機中にも同期的なSQLite操作を順番に処理します。
    this.localChain??=Promise.resolve();this.localRevision??=0; // 端末操作の順序と保存要求の世代を保持します。
    const local=['state','detail','backup','diagnostics','inspectTerms','inspectCanvas','savePlan','archive','resolve','record','timer'].includes(name); // awaitを含まないDB操作だけを通信から分離します。
    if(local){if(['savePlan','archive','resolve','record'].includes(name))this.localRevision++;const task=this.localChain.catch(()=>{}).then(()=>this.execute(name,args));this.localChain=task;return task;} // 保存ごとに後続同期の必要性を記録し二重保存は自動実行しません。
    if(name==='sync'&&this.syncTask&&this.chain===this.syncTask&&this.syncRevision===this.localRevision)return this.syncTask; // 保存が増えていない同時同期だけを共有します。
    const barrier=name==='close'||name==='restore';const ready=barrier?Promise.allSettled([this.chain,this.localChain]):this.chain.catch(()=>{}); // DBの閉鎖と復元は先行する通信と端末操作の完了を待ちます。
    const task=ready.then(()=>this.execute(name,args)).finally(()=>{if(this.syncTask===task)this.syncTask=null;});this.chain=task;if(barrier)this.localChain=task; // 閉鎖や復元の途中に新たなDB操作を割り込ませません。
    if(name==='sync'){this.syncTask=task;this.syncRevision=this.localRevision;}return task; // 保存を挟んだ同期要求は後続の一回として実行します。
  } // 通信レーンと端末レーンの受付を閉じます。`); // SQLiteトランザクション自体は変更しません。
await writeFile(join(web,'core/service.mjs'),service); // 保存先・スキーマ・本人境界を維持します。
let bridge=await readFile(join(web,'worker-bridge.mjs'),'utf8'); // 通信待機と保存結果不明を区別します。
bridge=replace(bridge,"const timer=this.timers.setTimeout(()=>this.fail(new Error('応答を確認できません。処理が完了した可能性があるため、自動再保存せず再読込して履歴を確認してください。')),timeoutMs);",`const timer=this.timers.setTimeout(()=>{if(['sync','handoff','receiveHandoff','connectCloud','canvasLibrary','readCanvas','referenceCheck','mediaConnection'].includes(command)){this.pending.delete(id);reject(connectionError('NETWORK'));return;}this.fail(new Error('応答を確認できません。処理が完了した可能性があるため、自動再保存せず再読込して履歴を確認してください。'));},timeoutMs); // 通信だけの期限切れで保存Workerを停止せず、端末書込の結果不明は従来通り保護します。`); // 継続中の同期はサービス側で共有し重複実行させません。
await writeFile(join(web,'worker-bridge.mjs'),bridge); // 遅れて届く通信結果はIDで無視します。
let graph=await readFile(join(web,'core/graph.mjs'),'utf8'); // 取得したばかりのメタデータの二重取得を減らします。
graph=replace(graph,'async readText(item){','async readText(item,{fresh=false}={}){'); // 一覧や古いキャッシュは既定で再確認します。
graph=replace(graph,'const meta=await this.request(`/me/drive/items/${encodeURIComponent(item.id)}`);',"const meta=fresh&&item['@microsoft.graph.downloadUrl']?item:await this.request(`/me/drive/items/${encodeURIComponent(item.id)}`);"); // 同じ要求で得た署名付きURLだけを再利用します。
graph=replace(graph,'await this.client.readText(m)','await this.client.readText(m,{fresh:true})'); // 直前に取得した所有者識別ファイルのメタデータを使用します。
graph=replace(graph,'await this.client.readText(item)','await this.client.readText(item,{fresh:true})'); // 固定ファイルも存在確認直後のメタデータを使用します。
graph=replace(graph,"ensure(!Number.isFinite(meta.size)||meta.size<=LIMIT,'LIMIT','この検証版で扱うファイルは2MiB以下です。');const target=","ensure(!Number.isFinite(meta.size)||meta.size<=LIMIT,'LIMIT','この検証版で扱うファイルは2MiB以下です。');this.textCache??=new Map();this.textCacheBytes??=0;const cached=this.textCache.get(meta.id);if(typeof meta.eTag==='string'&&meta.eTag&&cached?.eTag===meta.eTag)return cached.raw;const target="); // 毎回Graphで存在と版を確認し同じ版の本文だけを再利用します。
graph=replace(graph,"ensure(byteLength(raw)<=LIMIT,'LIMIT','受信ファイルが大きすぎます。');return raw;","ensure(byteLength(raw)<=LIMIT,'LIMIT','受信ファイルが大きすぎます。');if(typeof meta.eTag==='string'&&meta.eTag){if(cached){this.textCache.delete(meta.id);this.textCacheBytes-=cached.bytes;}const bytes=raw.length*2;while(this.textCacheBytes+bytes>4*LIMIT&&this.textCache.size){const [id,entry]=this.textCache.entries().next().value;this.textCache.delete(id);this.textCacheBytes-=entry.bytes;}this.textCache.set(meta.id,{eTag:meta.eTag,raw,bytes});this.textCacheBytes+=bytes;}return raw;"); // キャッシュはWorker内の最大8MiBに限定し認証情報や署名URLを保持しません。
graph=replace(graph,'try{return JSON.parse(await this.client.readText(item,{fresh:true}));}', 'const raw=await this.client.readText(item,{fresh:true});try{return JSON.parse(raw);}'); // 通信の例外をJSON破損へ誤分類せず元の分類を渡します。
graph=graph.split('\n').map(line=>(line.includes('fresh')||line.includes('textCache'))?line+' // 本文の取得・ハッシュ・所有者検査は省略しません。':line).join('\n'); // 変更行の処理を説明します。
await writeFile(join(web,'core/graph.mjs'),graph); // 認証や権限設定は維持します。
let sync=await readFile(join(web,'core/sync.mjs'),'utf8'); // 履歴の順次ダウンロードを最大4件ずつにします。
sync=replace(sync,'export class SyncEngine {',`async function readBatch(values,read) { // リクエスト数を制限して履歴を並列取得します。
  const result=[];for(let offset=0;offset<values.length;offset+=4){const batch=await Promise.allSettled(values.slice(offset,offset+4).map(read));const failed=batch.find(item=>item.status==='rejected');if(failed)throw failed.reason;result.push(...batch.map(item=>item.value));}return result; // 失敗時も同じバッチの終了を待ち次の同期と重ねません。
} // 同期中だけ使用する取得関数を閉じます。
export class SyncEngine {`); // 内容の検証は既存のchecked関数で行います。
sync=replace(sync,"for (const key of keys.filter(k => k.startsWith('O_'))) { const o = await this.checkedOperation(key); if (o) operations.push(o); }","for (const o of await readBatch(keys.filter(k=>k.startsWith('O_')),key=>this.checkedOperation(key))) if(o)operations.push(o); // 操作履歴を最大4件ずつ検証して取得します。"); // 件数上限と所有者検証を維持します。
sync=replace(sync,'for (const o of operations) for (const hash of o.body.objectRefs) await visit(hash);','await readBatch([...new Set(operations.flatMap(o=>o.body.objectRefs))],visit); // 共有する固定版の重複取得を防ぎ最大4系統だけを読み込みます。'); // 各依存の再帰検証は維持します。
const verifyStart=sync.indexOf('    const checked = new Set();'),verifyEnd=sync.indexOf('  async verifiedHandoff',verifyStart); // 既送信データの消失検査も通信数を制限して並列化します。
assert(verifyStart>0&&verifyEnd>verifyStart);sync=sync.slice(0,verifyStart)+`    const acknowledged=this.repo.acknowledged(),objects=new Map(); // 検査対象を今回の同期内で固定します。
    await readBatch(acknowledged,async o=>{const remote=await this.checkedOperation(operationKey(o));ensure(remote&&remote.hash===o.hash,'CLOUD_MISSING','以前保存したクラウド操作がありません。自動的な復活や初期化をせず停止しました。');}); // 保存済みの操作を必ず再確認します。
    for(const o of acknowledged)for(const object of this.repo.closure(o.body.opId).objects)objects.set(object.hash,object); // 固定版の参照を重複なく集めます。
    await readBatch([...objects.keys()],async hash=>{ensure(await this.checkedObject(hash),'CLOUD_MISSING','以前保存した作戦・用語などの固定版が消失しています。未送信分を保持して停止しました。');}); // 欠落や破損を成功扱いせず未送信分を保持します。
  } // 既送信検査を閉じます。
`+sync.slice(verifyEnd); // 後続の引継ぎ検証は変更しません。
await writeFile(join(web,'core/sync.mjs'),sync); // 送信後の読戻しや消失確認を省略しません。
let app=await readFile(join(web,'app.mjs'),'utf8'); // 同期中に追加した未送信保存を次の同期へ引き継ぎます。
app=replace(app,"finally{sending=false;refreshState(await request('state'));}","finally{sending=false;refreshState(await request('state'));if(!syncFailure&&state?.pending&&navigator.onLine&&!document.hidden)scheduleSync();}"); // 成功した同期にだけ続行を予約して失敗ループを防ぎます。
app=app.split('\n').map(line=>line.startsWith('async function synchronize()')?line+' // 同期の途中で増えた端末保存を取りこぼしません。':line).join('\n'); // 変更行の説明を付けます。
await writeFile(join(web,'app.mjs'),app); // 端末保存と同期結果の表示を維持します。
for(const [name,count]of [['config.mjs',1],['core/service.mjs',1],['index.html',2],['sw.js',2]]){const file=join(web,name);await writeFile(file,replace(await readFile(file,'utf8'),'1.3.2','1.3.3',count));} // 通常のアプリ更新で変更を配布します。
for(const name of ['connection-browser.mjs','production-scenarios.mjs','save-status-browser.mjs','catalog-browser.mjs','reference-browser.mjs','media-browser.mjs','upgrade-check.mjs']){const file=join(root,'tools',name);await writeFile(file,(await readFile(file,'utf8')).replaceAll('1.3.2','1.3.3').replaceAll('1\\.3\\.2','1\\.3\\.3'));} // 必須試験の判定を維持して版番号だけを追従します。
