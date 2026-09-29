import {readFile,writeFile,copyFile} from 'node:fs/promises'; // 公開候補の表示だけを更新します。
import {join,resolve} from 'node:path'; // ビルド先を限定します。
import assert from 'node:assert/strict'; // 想定した旧コード以外には適用しません。
const root=resolve(process.argv[2]),web=join(root,'web'); // 利用者のデータには触れません。
function replace(text,before,after){assert.equal(text.split(before).length,2,'UX patch mismatch: '+before.slice(0,70));return text.replace(before,after);} // 置換箇所が一つであることを要求します。
function line(text,start,after){const found=text.split('\n').filter(s=>s.startsWith(start));assert.equal(found.length,1,start);return text.replace(found[0],after);} // 一行関数の変更範囲を固定します。
let app=await readFile(join(web,'app.mjs'),'utf8'); // 現行1.0.1の画面制御を読みます。
app="import {syncView,saveHint,draftWarning} from './save-status.mjs'; // 保存操作とクラウド状態の言葉を統一します。\n"+app; // 検証可能な表示関数だけを追加します。
app=line(app,'function message(',"function message(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);} // 同期エラーを練習の保存失敗へ置き換えません。"); // 保存エラーは保存処理自身で表示する既存経路を使います。
app=line(app,'function refreshState(',"function refreshState(next){if(next)state=next;if(!state)return;refreshPresentation();$('savedPlans').innerHTML=practiceCards(state.practices);if(state.blocked)$('editorFields').disabled=true;} // 保存済み一覧とデータ保護は維持します。"); // 表示部分だけを専用関数に分離します。
app=line(app,'async function synchronize(',"async function synchronize(){if(!cloudReady||sending)return;if(!navigator.onLine){refreshPresentation();message('オフラインです。保存済みの練習はこの端末に残り、通信が戻ると自動同期します。');return;}sending=true;refreshState();message('OneDriveと同期中です。入力中の変更は「練習を保存」を押して登録してください。');try{const result=await request('sync');refreshState(result.state);const view=syncView(result.state,{connected:cloudReady,online:navigator.onLine});message(view.title+'。'+view.detail+(dirty?'\\n'+draftWarning(true):''));if(selected&&$('detail').hidden===false)await openDetail(selected);}finally{sending=false;refreshState(await request('state'));}} // 同期待ち・同期中・同期済みを実際の応答に合わせます。"); // 同期方式・自動同期の時刻や保存処理は変更しません。
app=replace(app,"totals();} \nfunction resetDraft", "totals();refreshPresentation();} \nfunction resetDraft"); // 項目追加・順序変更・コピーの未保存表示を更新します。
app=replace(app,"saveFeedback('✓ 端末に保存しました。'", "saveFeedback('✓ 練習を保存しました。'"); // ボタンと完了メッセージの用語を合わせます。
app=replace(app,"finally{saving=false;$('editorFields').disabled=!initialized||Boolean(state?.blocked);}","finally{saving=false;$('editorFields').disabled=!initialized||Boolean(state?.blocked);refreshPresentation();}"); // 保存処理の終了時に通常ボタンへ戻します。
app=app.replaceAll('「端末に保存」','「練習を保存」'); // コピーの案内文も操作名と一致させます。
app=replace(app,"node.setAttribute('role',kind==='error'?'alert':'status');}","node.setAttribute('role',kind==='error'?'alert':'status');refreshPresentation();}"); // 入力・保存結果に応じて補足案内を更新します。
app+=`\nfunction refreshPresentation(){ // データを変更せず保存と同期の状況を描画します。
  const online=navigator.onLine;const view=syncView(state,{connected:cloudReady,busy:sending,online,account:Boolean(auth.account)}); // オンラインの表示だけでは成功判定しません。
  $('storageStatus').textContent=view.title;$('connectionStatus').textContent=view.detail;$('syncNow').textContent=view.action;$('syncNow').disabled=!cloudReady||sending||!online; // 同期中は二重操作を防ぎます。
  $('storageStatus').closest('.statusbar').dataset.tone=view.tone; // 状態を色と文字の両方で示します。
  $('draftSyncHint').textContent=draftWarning(dirty);$('draftSyncHint').hidden=!dirty; // 入力中の変更は同期済み表示の対象外だと知らせます。
  $('savePlan').textContent=saving?'保存中…':'練習を保存';$('saveHint').textContent=saveHint({connected:cloudReady,online,pending:state?.pending||0,busy:sending,error:Boolean(state?.lastError),saved:Boolean(editRevision)&&!dirty}); // 利用者が押す主操作を一つにまとめます。
  document.querySelector('.save-dock').dataset.active=String(dirty||saving||$('saveFeedback').classList.contains('error')); // 入力前の固定パネルでフォームを隠しません。
} // 表示の更新を閉じます。
window.addEventListener('offline',refreshPresentation); // 通信が切れたら前回成功のままにしません。
`; // 切断時も端末の記録はそのままにします。
await writeFile(join(web,'app.mjs'),app); // 画面制御の変更だけを保存します。
let html=await readFile(join(web,'index.html'),'utf8'); // 既存のフォームとボタンを維持します。
html=replace(html,'<section class="statusbar" aria-live="polite">','<section class="statusbar" role="status" aria-live="polite" aria-atomic="true">'); // 状態変化を読み上げでも伝えます。
html=replace(html,'<button id="syncNow" disabled>同期する</button></section>','<button id="syncNow" disabled>今すぐ同期</button><small id="draftSyncHint" hidden></small><details class="sync-help"><summary>保存と同期の違い</summary><p>「練習を保存」は入力した計画を登録する操作です。OneDrive接続済みなら、保存後に自動同期します。「今すぐ同期」は保存済みの内容を送受信する操作で、入力途中の内容は保存しません。別の端末では、同じMicrosoftアカウントで接続して同期してください。</p></details></section>'); // 詳細説明は必要な時だけ開けるようにします。
html=replace(html,'<small>「端末保存」と「OneDriveへの同期」は別です。</small>','<small id="saveHint">このブラウザ内に保存します。</small>'); // 内部実装の違いではなく操作の意味を説明します。
html=replace(html,'id="savePlan" class="primary">端末に保存','id="savePlan" class="primary">練習を保存'); // 保存先の選択と誤解されないボタン名にします。
html=replace(html,'端末保存 · AIなしでも利用可','練習の計画・記録 · AIなしでも利用可'); // 同期済みでも端末限定と見える固定表示をなくします。
await writeFile(join(web,'index.html'),html); // DB識別子やフォームの入力は変更しません。
let css=await readFile(join(web,'series.css'),'utf8'); // 承認済みのブランド配色を維持します。
css+=`\n.statusbar{border-left:4px solid #718096}.statusbar[data-tone="success"]{border-left-color:#08766c}.statusbar[data-tone="warning"]{border-left-color:#b77617}.statusbar[data-tone="error"]{border-left-color:#b83729}.statusbar[data-tone="busy"]{border-left-color:#1688ff}.statusbar[data-tone="busy"] strong{color:#1763a8}.statusbar #connectionStatus{flex:1;min-width:180px;overflow-wrap:anywhere} /* 通信中と完了を文字と枠色で区別します。 */
.sync-help{flex-basis:100%;font-size:12px;color:#627788}.sync-help summary{cursor:pointer;padding:3px 0}.sync-help p{margin:6px 0;line-height:1.65}#draftSyncHint{flex-basis:100%;color:#955b10;background:#fff7e9;padding:6px 9px;border-radius:6px}#draftSyncHint[hidden]{display:none} /* 未保存の入力はクラウド状態とは別に知らせます。 */
.save-dock{position:static}.save-dock[data-active="true"]{position:sticky} /* 入力前はフォームを覆わず編集後だけ保存操作を近くに置きます。 */
`; // スピナーの速い点滅や色だけの表現は使いません。
await writeFile(join(web,'series.css'),css); // 保存状況の見た目だけを追加します。
await copyFile('production/save-status.mjs',join(web,'save-status.mjs')); // 単体検証した表示関数を配置します。
await copyFile('production/save-status.test.mjs',join(root,'tests/save-status.test.mjs')); // 表示と状態の対応をCIで検証します。
await copyFile('production/save-status-browser.mjs',join(root,'tools/save-status-browser.mjs')); // 保存から自動同期まで実画面で確認します。
for(const name of ['web/config.mjs','web/index.html','web/sw.js','web/core/service.mjs','tools/production-scenarios.mjs','tools/upgrade-check.mjs']){const file=join(root,name);const text=await readFile(file,'utf8');assert(text.includes('1.0.1'),name);await writeFile(file,text.replaceAll('1.0.1','1.0.2'));} // 旧1.0.1からの表示更新を配信版へ反映します。
for(const name of ['tools/production-scenarios.mjs','tools/upgrade-check.mjs']){const file=join(root,name);let text=await readFile(file,'utf8');text=replace(text,'1\\.0\\.1','1\\.0\\.2');text=text.replaceAll("includes('端末に保存しました')","includes('練習を保存しました')");await writeFile(file,text);} // 保存やデータ保全の検査条件を残し、操作名と版だけを合わせます。
const pages=join(root,'tools/browser-project.mjs');let test=await readFile(pages,'utf8');test=replace(test,"name:'端末に保存',exact:true","name:'練習を保存',exact:true");await writeFile(pages,test); // 旧版更新試験の旧ボタン名は変更しません。
const swPath=join(web,'sw.js');let sw=await readFile(swPath,'utf8');sw=replace(sw,"'./draft.mjs',","'./draft.mjs','./save-status.mjs',");await writeFile(swPath,sw); // オフライン用の新規表示部品を事前取得します。
console.log('PRACTICE 1.0.2: clarified save action and truthful sync states; storage and network logic preserved.'); // 未実機の結果を成功と呼びません。
