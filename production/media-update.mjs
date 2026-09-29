import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises'; // 公開候補だけを読み書きします。
import {join,resolve} from 'node:path'; // 既存の作業コピーを更新します。
import assert from 'node:assert/strict'; // 想定外の版へ適用しません。
const root=resolve(process.argv[2]),web=join(root,'web'); // 利用者の端末やOneDriveには直接アクセスしません。
function replace(text,before,after,count=1){assert.equal(text.split(before).length-1,count,'Media patch mismatch: '+before.slice(0,100));return text.replaceAll(before,after);} // 置換件数の不一致は公開を止めます。
async function patch(name,changes,prefix=''){let value=await readFile(join(web,name),'utf8');for(const [before,after,count]of changes)value=replace(value,before,after,count);await writeFile(join(web,name),prefix+value);} // 既存の保存先やIDを変更しません。
for(const name of ['media-model.mjs','media-store.mjs','media-cloud.mjs','media-session.mjs','media-import-policy.mjs'])await copyFile(join('production/media',name),join(web,name)); // 検査可能な独立部品を配置します。
await patch('core/model.mjs',[["itemIds.add(item.id);","itemIds.add(item.id); mediaList(item.media);"]],"import {mediaList} from '../media-model.mjs'; // 任意の添付メタデータを検証します。\n"); // 過去の添付なし操作は書き換えません。
await patch('core/planner.mjs',[["const id = row.id || uuid();","const media=mediaList(row.media??row.pinned?.media);const id = row.id || uuid();"],["section: row.section, category, ...referenceFields };","section: row.section, category, media, ...referenceFields };"],["section:row.section, category, minutes:","section:row.section, category, media, minutes:"]],"import {mediaList} from '../media-model.mjs'; // 新規・コピーとも添付参照を引き継ぎます。\n"); // 写真・動画の実体をDBへ埋め込みません。
await patch('core/repository.mjs',[["return { scope: this.scope, deviceId:","return { mediaRefs:savedMedia(this.operations()),scope: this.scope, deviceId:"]],"import {savedMedia} from '../media-model.mjs'; // 保存された過去の添付も同期候補として保持します。\n"); // SQL表や既存操作のハッシュを移行しません。
await patch('core/service.mjs',[["if(name==='sync')","if(name==='mediaConnection'){ensure(this.cloud&&this.graph,'AUTH','OneDriveに接続してください。');await this.cloud.check();return {folderId:this.cloud.folderId,scope:r.scope};} // 確認済み本人フォルダーだけを添付処理へ渡します。\n    if(name==='sync')"]]); // 添付の大きな通信をDBの直列処理へ入れません。
await patch('draft.mjs',[["const errors = [];","const errors = [];"],["for (const [index, item] of input.items.entries()) {","for (const [index, item] of input.items.entries()) {try{mediaList(item.media);}catch(error){add('media',`${index+1}番目：${error.message}`,index);}"],["section: item.section || 'BODY',","media:mediaList(item.media),section: item.section || 'BODY',"]],"import {mediaList} from './media-model.mjs'; // コピー時も添付の固定参照を保持します。\n"); // 必須入力とコピー原本の保護を維持します。
await patch('catalog.mjs',[["item.drillHash,item.variationHash,referenceKey(item.references)])","item.drillHash,item.variationHash,referenceKey(item.references),item.media||[]])"]]); // 添付が違うメニューを同一候補にまとめません。
let app=await readFile(join(web,'app.mjs'),'utf8'); // 実画面へ任意の添付操作を追加します。
app="import {mediaImportAccess,authorizeMediaImport,assertMediaImportPermit} from './media-import-policy.mjs'; // 添付はOneDrive同期を利用できるときだけ許可します。\nimport {mediaList,mediaRef,mediaSize,MEDIA_COUNT} from './media-model.mjs'; // 添付を安全な参照として扱います。\nimport {MediaStore} from './media-store.mjs'; // 本人の端末へ写真・動画を保存します。\nimport {MediaCloud} from './media-cloud.mjs'; // 本人のOneDriveへ添付を送受信します。\nimport {MediaSession} from './media-session.mjs'; // 計画保存を妨げず添付を送信します。\nimport {GraphClient} from './core/graph.mjs'; // 既存の認証とGraph境界を使います。\nlet mediaSession=null,mediaImporting=false,mediaImportAbort=null; // 読込・送信を現在のアカウントへ限定します。\n"+app; // 通常の保存と同期経路を残します。
app=replace(app,"const scope=auth.scope();const active=new Worker", "const scope=auth.scope();initializeMedia(scope);const active=new Worker"); // アカウントごとに添付領域を開きます。
app=replace(app,"if(!state)return;refreshPresentation();", "if(!state)return;updateMediaState();refreshPresentation();"); // 保存された添付だけを送信候補へ反映します。
app=replace(app,"category:'',references:[],name:''", "category:'',references:[],media:[],name:''"); // 空のメニューでは添付を必要としません。
app=replace(app,"<div class=\"item-foot\">", "${mediaEditor(r)}<div class=\"item-foot\">"); // 各メニュー内に折りたたみ式の添付欄を置きます。
app=replace(app,"if(selected&&$('detail').hidden===false)await openDetail(selected);", "void startMediaSync();if(selected&&$('detail').hidden===false)await openDetail(selected);"); // 計画同期が成功した後に添付送信を開始します。
app=replace(app,'<div class="actions"><button data-reuse="${index}">','${(item.media||[]).length?`<details class="media-box" open><summary>写真・動画（${item.media.length}件）</summary>${mediaCards(item.media)}</details>`:\'\'}<div class="actions"><button data-reuse="${index}">'); // 保存済みの詳細から写真と動画を開けます。
app=replace(app,'if(saving){message(',"if(mediaImporting){message('写真・動画を取り込み中です。完了してから操作してください。');return false;}if(saving){message("); // 読込中の画面切替で添付先を失いません。
app=replace(app,'if(!b||saving)return;','if(!b||saving||mediaImporting)return;'); // 添付取込中のメニュー入替を防ぎます。
app=replace(app,"!rows[0].rule&&!rows[0].canvasRaw&&!(rows[0].references||[]).length)","!rows[0].rule&&!rows[0].canvasRaw&&!(rows[0].references||[]).length&&!(rows[0].media||[]).length)"); // 写真だけ入った未完成メニューを黙って捨てません。
app=replace(app,"if(row.name.trim()&&!confirm(","if((row.name.trim()||(row.media||[]).length)&&!confirm("); // 添付のある欄を他メニューで置き換えるときにも確認します。
app=replace(app,"if(connecting||sending||saving)return;","if(connecting||sending||saving||mediaImporting)return;"); // 取込中のアカウント変更を防ぎます。
app=replace(app,"clearTimeout(autoSync);cloudReady=false;await request('close');","clearTimeout(autoSync);cloudReady=false;releaseMediaPreview();mediaSession?.close();await request('close');"); // サインアウトで添付送信も中断します。
app=replace(app,"if(worker){await request('close');","releaseMediaPreview();mediaSession?.close();if(worker){await request('close');",2); // 認証先を変える前に旧アカウントの添付処理を止めます。
app=replace(app,"accountStatus();refreshReferenceControls(); // 入力前", "accountStatus();refreshReferenceControls();renderMediaStatus(); // 入力前"); // 省スペースの同期枠にも添付の状態を表示します。
app=replace(app,"if(editRevision&&!dirty){", "if(mediaImporting)throw new Error('写真・動画の取込完了後に保存してください。');if(editRevision&&!dirty){"); // 途中の添付を含めて保存した扱いにしません。
app=replace(app,"$('handoff').onclick=()=>guard(async()=>download('ZERO_ONE_Handoff.data',await request('handoff',{revisionId:selected})));","$('handoff').onclick=()=>guard(async()=>{await startMediaSync();const refs=currentDetail?.operation.body.payload.items.flatMap(item=>item.media||[])||[];if(refs.some(ref=>mediaSession.status.get(ref.hash)!=='remote'))throw new Error('写真・動画の送信が未完了です。同期を完了してから引継ぎ票を作成してください。');download('ZERO_ONE_Handoff.data',await request('handoff',{revisionId:selected}));}); // 添付の送信確認前に引継ぎ完了としません。"); // 写真・動画のある計画の引継ぎを保護します。
app=replace(app,"$('items').addEventListener('input',event=>{","$('items').addEventListener('input',event=>{if(event.target.matches('[data-media-file]'))return;"); // 拒否した添付選択では入力変更を記録しません。
app=replace(app,"$('planForm').addEventListener('input',event=>{","$('planForm').addEventListener('input',event=>{if(event.target.matches('[data-media-file]'))return;"); // 拒否した添付選択では入力変更を記録しません。
app+= '\n'+await readFile('production/media/media-ui.fragment.mjs','utf8');await writeFile(join(web,'app.mjs'),app); // 添付用のUI処理を追加します。
let html=await readFile(join(web,'index.html'),'utf8'); // 入力と表示に必要な要素だけを追加します。
html=replace(html,"img-src 'self' data:;", "img-src 'self' data: blob:; media-src 'self' blob:;"); // Blobで確認済みの画像・動画だけを表示します。
html=replace(html,'<small id="draftSyncHint" hidden></small>','<small id="draftSyncHint" hidden></small><small id="mediaSyncStatus" hidden></small>'); // 既存の同期枠を大きな別枠にしません。
html=replace(html,'<p id="connectionExplanation"></p>','<p id="connectionExplanation"></p><p id="mediaSyncDetail"></p>'); // 添付同期の詳しいエラーは設定で確認できます。
html=replace(html,'>全体バックアップ</button>','>計画バックアップ</button>'); // 実ファイルを含むバックアップとは誤表示しません。
html=replace(html,'バックアップには個人の練習・振り返りが含まれます。','計画バックアップには写真・動画の本体は含まれません。添付の送信完了を確認し、元ファイルも保管してください。バックアップには個人の練習・振り返りが含まれます。'); // 保存範囲を明示して端末故障時の誤解を防ぎます。
html=replace(html,'画像・動画の実体はこの版では取り込みません。JSONの原文と参照情報を保持します。','ここは作戦JSON用です。写真・動画はOneDrive接続中のみ、各メニューの「写真・動画」から追加できます。'); // 旧版の未対応説明を更新します。
html=replace(html,'<noscript>','<dialog id="mediaDialog"><div class="section-head"><h2 id="mediaPreviewTitle">写真・動画</h2><button id="closeMedia" type="button">閉じる</button></div><p id="mediaPreviewMessage" role="status"></p><div id="mediaPreviewBody"></div><button id="mediaOriginal" type="button" disabled>元ファイルを保存</button></dialog><noscript>'); // 一度に一つの写真・動画だけを読み込みます。
html=replace(html,'作戦図・参考資料は任意です。','作戦図・参考資料・写真・動画は任意です。'); // 休憩など添付不要なメニューを妨げません。
html=replace(html,'<section class="panel"><h3>保全と引継ぎ</h3>','<section class="panel"><h3>写真・動画の取扱い</h3><p class="subtle">選手が映る場合は撮影・保存の同意を確認してください。新しい添付はOneDriveに接続して同期を利用できる場合に限ります。オフラインや再認証が必要なときは追加できません。添付はこの端末と本人のOneDriveに保管します。AIや公開サイトには送信しません。元の画質・位置情報などは変換せず保持します。別端末では「表示」を押すと取得し、確認のための読戻しでも通信量が発生します。</p></section><section class="panel"><h3>保全と引継ぎ</h3>'); // 誤って公開されるとの不安や通信量の誤解を避けます。
await writeFile(join(web,'index.html'),html); // 既存フォームのIDを維持します。
await writeFile(join(web,'series.css'),await readFile(join(web,'series.css'),'utf8')+await readFile('production/media/media.css','utf8')); // ブランドとコンパクトな同期表示を維持します。
await patch('sw.js',[["'./picker.mjs',","'./picker.mjs','./media-model.mjs','./media-store.mjs','./media-cloud.mjs','./media-session.mjs','./media-import-policy.mjs',"]]); // 実際の個人ファイルはSWの共有キャッシュに入れません。
for(const name of ['web/config.mjs','web/index.html','web/sw.js','web/core/service.mjs','tools/production-scenarios.mjs','tools/upgrade-check.mjs','tools/save-status-browser.mjs','tools/catalog-browser.mjs','tools/reference-browser.mjs']){const file=join(root,name);const text=await readFile(file,'utf8');assert(text.includes('1.2.1'),name);await writeFile(file,text.replaceAll('1.2.1','1.3.0'));} // キャッシュ・診断・検証の版を揃えます。
for(const name of ['tools/production-scenarios.mjs','tools/upgrade-check.mjs']){const file=join(root,name);await writeFile(file,replace(await readFile(file,'utf8'),'1\\.2\\.1','1\\.3\\.0'));} // 旧保存・コピーの期待版だけを更新します。
await copyFile('production/media/fixtures.mjs',join(root,'tools/media-fixtures.mjs')); // 人物を含まない実画像・動画の合成素材を試験に配置します。
await mkdir(join(root,'tests'),{recursive:true});await copyFile('production/media/media.test.mjs',join(root,'tests/media.test.mjs'));await copyFile('production/media/media-browser.mjs',join(root,'tools/media-browser.mjs')); // 専用試験を既存の必須試験へ追加します。
for(const name of ['media-import-policy.test.mjs','media-import-ui.test.mjs'])await copyFile(join('production/media',name),join(root,'tests',name)); // OneDrive限定の取込条件を単体試験へ配置します。
await copyFile('production/media/media-ui.fragment.mjs',join(root,'tests/media-ui.fixture.mjs')); // 実ブラウザの代用ではなく、模擬DOMでの関数検査用です。
console.log('PRACTICE 1.3.0 candidate: optional photo/video attachments; no personal OneDrive access.'); // ビルド成功と本人アカウント試験を区別します。

const networkPath=join(root,'tools/network-browser.mjs');let network=await readFile(networkPath,'utf8');network=replace(network,'reference-links\\.mjs','reference-links\\.mjs|media-model\\.mjs');await writeFile(networkPath,network); // 隔離した通信ハーネスにも実際の依存モジュールを配信します。
