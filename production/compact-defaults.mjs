import {readFile,writeFile} from 'node:fs/promises'; // 今回の公開候補だけを読み書きします。
import {join,resolve} from 'node:path'; // 作業コピーのパスを固定します。
import assert from 'node:assert/strict'; // 想定した旧版への適用を確認します。
const root=resolve(process.argv[2]),web=join(root,'web'); // 利用者のブラウザやOneDriveには接続しません。
function replace(text,before,after,count=1){assert.equal(text.split(before).length-1,count,'Compact patch mismatch: '+before.slice(0,90));return text.replaceAll(before,after);} // 変更箇所の件数が違えば配信を停止します。
let html=await readFile(join(web,'index.html'),'utf8'); // 1.1.0の画面を読みます。
html=replace(html,'<span class="chip">練習の計画・記録 · AIなしでも利用可</span>',''); // 指定された説明バッジを削除します。
html=replace(html,'value="8" required','value="15" required'); // 初回表示の人数を15人にします。
html=replace(html,'value="120" required','value="180" required'); // 初回表示の全体時間を180分にします。
html=replace(html,'0 / 120分','0 / 180分'); // 初期の時間集計表示も揃えます。
const help=html.match(/<details class="sync-help">[\s\S]*?<\/details>/g);assert.equal(help?.length,1); // 移動する既存説明を一つだけ抽出します。
html=replace(html,help[0],''); // 同期カードから長い説明欄を外します。
const detailHelp=replace(help[0],'<summary>保存と同期の違い</summary>','<summary>同期の詳細・保存との違い</summary><p id="connectionExplanation"></p>'); // 最新の詳細説明は設定画面で確認できます。
html=replace(html,'<details><summary>接続設定・サインアウト</summary>',detailHelp+'<details><summary>接続設定・サインアウト</summary>'); // 接続設定内へ折りたたみ式で移します。
html=replace(html,'<strong id="storageStatus">','<div class="sync-copy"><strong id="storageStatus">'); // 状態名と補足を一つの小さいまとまりにします。
html=replace(html,'<span id="connectionStatus">未接続</span>','<span id="connectionStatus">未接続</span></div><div class="sync-actions">'); // 右側に接続・同期操作を配置します。
html=replace(html,'今すぐ同期</button><small id="draftSyncHint"','今すぐ同期</button></div><small id="draftSyncHint"'); // 未保存警告は操作行の下に残します。
await writeFile(join(web,'index.html'),html); // フォームの識別子や保存キーは変更しません。
let app=await readFile(join(web,'app.mjs'),'utf8'); // 新規プランの初期化と表示だけを更新します。
app=replace(app,"$('players').value='8';$('totalMinutes').value='120';","$('players').value='15';$('totalMinutes').value='180';"); // 新規作成時だけを変更し、保存済みの編集・コピー値は維持します。
app=replace(app,"$('connectionStatus').textContent=view.detail;","$('connectionStatus').textContent=compactConnectionDetail(view);$('connectionExplanation').textContent=view.detail;"); // 通常表示は短くし、完全な説明は設定に残します。
app+=`\nfunction compactConnectionDetail(view){ // 同期の判定結果は変更せず、完了時だけ補足を短くします。
  if(view.title==='✓ OneDrive同期済み'){const at=view.detail.indexOf('最終同期 ');if(at>=0)return view.detail.slice(at);} // 同期済みの確認日時は常に表示します。
  if(view.title==='✓ OneDrive接続済み')return 'まだ練習は保存されていません。'; // 空の接続を練習の保存完了とは表示しません。
  return view.detail; // 同期待ち・通信中・オフライン・失敗の説明は省略しません。
} // 文字列の表示処理を閉じます。
`; // 入力内容と同期エンジンは変更しません。
await writeFile(join(web,'app.mjs'),app); // 本人の保存先とアカウント境界を維持します。
let css=await readFile(join(web,'series.css'),'utf8'); // 承認済みの配色とフォントを維持します。
css+=`\n.statusbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;padding:8px 10px;margin:8px 0;border-radius:10px;box-shadow:none;align-items:center} /* 状態と操作を横並びにして枠の高さを抑えます。 */
.statusbar .sync-copy{display:grid;gap:2px;min-width:0}.statusbar strong{width:auto;min-width:0;font-size:13px;line-height:1.4;overflow-wrap:anywhere}.statusbar #connectionStatus{display:block;min-width:0;font-size:12px;line-height:1.45;overflow-wrap:anywhere} /* 状態・確認日時は小画面でも切り捨てません。 */
.statusbar .sync-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;max-width:130px}.statusbar button{margin:0;padding:6px 10px;min-height:44px;min-width:44px;font-size:12px;line-height:1.4}.statusbar [hidden]{display:none} /* タップ領域は44px以上を保ちます。 */
.statusbar #draftSyncHint{grid-column:1/-1;margin:0;padding:4px 6px;min-width:0;font-size:12px;line-height:1.45;overflow-wrap:anywhere}.connection-panel #connectionExplanation{white-space:pre-wrap}.topbar{margin-bottom:14px} /* 未保存やエラーの案内は必要な高さまで自然に広げます。 */
`; // 固定高さや省略記号で重要な状態を隠しません。
await writeFile(join(web,'series.css'),css); // 同期枠とバッジの余白だけを更新します。
for(const name of ['web/config.mjs','web/index.html','web/sw.js','web/core/service.mjs','tools/production-scenarios.mjs','tools/upgrade-check.mjs','tools/save-status-browser.mjs','tools/catalog-browser.mjs']){const file=join(root,name);const text=await readFile(file,'utf8');assert(text.includes('1.1.0'),name);await writeFile(file,text.replaceAll('1.1.0','1.1.1'));} // キャッシュ・診断・検査の版を揃えます。
for(const name of ['tools/production-scenarios.mjs','tools/upgrade-check.mjs']){const file=join(root,name);await writeFile(file,replace(await readFile(file,'utf8'),'1\\.1\\.0','1\\.1\\.1'));} // 正規表現の期待版も更新します。
const file=join(root,'tools/production-scenarios.mjs');let checks=await readFile(file,'utf8'); // 実画面の既存受入試験を拡張します。
const initial="assert.equal(await page.locator('.topbar .chip').count(),0);assert(!(await page.locator('.topbar').innerText()).includes('AIなしでも利用可'));assert.equal(await page.locator('#players').inputValue(),'15');assert.equal(await page.locator('#totalMinutes').inputValue(),'180');assert.match(await page.locator('#totalLabel').innerText(),/180分/);assert.equal(await page.locator('.statusbar .sync-help').count(),0);assert.equal(await page.locator('.connection-panel .sync-help').count(),1);for(const width of [320,390]){await page.setViewportSize({width,height:844});const box=await page.locator('.statusbar').boundingBox();assert(box.height<=150,'Guest status height: '+box.height);const button=await page.locator('#quickConnect').boundingBox();assert(button.height>=44);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));}"; // 初期値と省スペース、タップしやすさを検査します。
checks=replace(checks,"await page.locator('.brand img').evaluate(img=>img.decode());",initial+"await page.locator('.brand img').evaluate(img=>img.decode());"); // 既存のアイコン検査はそのまま実施します。
checks=replace(checks,"await page.locator('#title').fill('本番受入・原本');","await page.locator('#players').fill('8');await page.locator('#title').fill('本番受入・原本');"); // 旧初期値で作った原本が新規初期値に置換されないことを検査します。
checks=replace(checks,"assert.equal(await page.locator('#title').inputValue(),'本番受入・原本（コピー）');","assert.equal(await page.locator('#title').inputValue(),'本番受入・原本（コピー）');assert.equal(await page.locator('#players').inputValue(),'8');assert.equal(await page.locator('#totalMinutes').inputValue(),'60');"); // コピーでは原本の人数と時間を維持します。
checks=replace(checks,"await page.locator('#newPlan').click();assert.equal(await page.locator('.saved-card').count(),2);","await page.locator('#newPlan').click();assert.equal(await page.locator('#players').inputValue(),'15');assert.equal(await page.locator('#totalMinutes').inputValue(),'180');assert.equal(await page.locator('.saved-card').count(),2);"); // 新規へ戻した時だけ指定の初期値にします。
const rest="await check(name,'R15 休憩はメニュー名と時間のみで保存・再表示',async()=>{await page.locator('#newPlan').click();assert.equal(await page.locator('#players').inputValue(),'15');assert.equal(await page.locator('#totalMinutes').inputValue(),'180');await page.locator('#title').fill('休憩の最小入力確認');await page.locator('#goal').fill('給水時間を確保する');await page.locator('[data-field=\"category\"]').first().fill('給水・休憩');await page.locator('[data-field=\"name\"]').first().fill('給水休憩');await page.locator('[data-field=\"minutes\"]').first().fill('5');await page.locator('[data-field=\"variationName\"]').first().fill('');await page.locator('[data-field=\"rule\"]').first().fill('');await page.locator('#savePlan').click();await saved(page);await page.reload();await ready(page);await open(page,'休憩の最小入力確認');assert.match(await page.locator('#detailItems').innerText(),/給水休憩/);assert.match(await page.locator('#detailItems').innerText(),/5分/);await page.locator('#editPlan').click();await page.waitForFunction(()=>document.getElementById('draftMode').textContent.includes('編集モード'));assert.equal(await page.locator('#players').inputValue(),'15');assert.equal(await page.locator('#totalMinutes').inputValue(),'180');assert.equal(await page.locator('[data-field=\"category\"]').first().inputValue(),'給水・休憩');assert.equal(await page.locator('[data-field=\"variationName\"]').first().inputValue(),'基本条件');});"; // 関連用語・条件・図を追加せず休憩を保存できることを確認します。
checks=replace(checks,"await page.setViewportSize({width:390,height:844});await page.screenshot",rest+"await page.setViewportSize({width:390,height:844});await page.screenshot"); // 最後に休憩の受入試験を追加します。
checks=replace(checks,'const expected=live?26:28','const expected=live?28:30'); // 各エンジンで追加した一試験も実行数に含めます。
await writeFile(file,checks); // 旧試験の合格条件を残して新規条件を追加します。
const statusPath=join(root,'tools/save-status-browser.mjs');let status=await readFile(statusPath,'utf8'); // 同期済み時の小さい枠も実画面で測ります。
status=replace(status,"assert.equal(ops(),1);assert.equal(await page.locator('#syncNow').textContent(),'今すぐ同期');","assert.equal(ops(),1);assert.equal(await page.locator('#syncNow').textContent(),'今すぐ同期');await page.setViewportSize({width:390,height:844});const box=await page.locator('.statusbar').boundingBox();assert(box.height<=100,'Confirmed status height: '+box.height);console.log('Confirmed status height',engine,box.height);assert.match(await page.locator('#connectionExplanation').textContent(),/保存済みの練習・記録を確認しました/);"); // 完了日時と省略しない詳細の保持も確認します。
await writeFile(statusPath,status); // 同期待ち・通信失敗・未保存表示の既存試験は維持します。
console.log('PRACTICE 1.1.1: compact status and 15-person/180-minute new defaults; rest validation and saved records unchanged.'); // 実装と本人実機の確認は区別します。
