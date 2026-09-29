import test from 'node:test'; // 標準テストランナーを使います。
import assert from 'node:assert/strict'; // 表示の意味を厳密に検査します。
import {syncView,saveHint,draftWarning} from '../web/save-status.mjs'; // 配信する表示ロジックそのものを検査します。
const checked={pending:0,operationCount:1,lastCheckedAt:'2026-09-29T05:18:14Z',lastError:'',practices:[]}; // 本人情報を含まない状態を用意します。
const connected={connected:true}; // OneDriveへの接続を確認済みの条件です。
test('空の接続では練習を同期済みと表示しない',()=>{const v=syncView({...checked,operationCount:0},connected);assert.equal(v.title,'✓ OneDrive接続済み');assert.match(v.detail,/まだ練習は保存されていません/);}); // 初回接続時の誤認を防ぎます。
test('確認済みの保存記録は時刻付き同期済み',()=>{const v=syncView(checked,connected);assert.equal(v.title,'✓ OneDrive同期済み');assert.match(v.detail,/最終同期/);}); // 実際の確認日時を要求します。
test('送信待ち0件でもクラウド確認前は成功にしない',()=>{assert.notEqual(syncView({...checked,lastCheckedAt:null},connected).tone,'success');}); // 件数だけの誤判定を防ぎます。
test('通信中は前回の成功より優先する',()=>{const v=syncView(checked,{...connected,busy:true});assert.equal(v.tone,'busy');assert.equal(v.action,'同期中…');}); // 時間のかかる同期を見えるようにします。
test('保存直後の同期待ちと変更件数',()=>{const v=syncView({...checked,pending:2},connected);assert.match(v.title,/同期待ち/);assert.match(v.detail,/変更が2件/);}); // 練習2件とは表現しません。
test('通信エラー時は前回成功をそのまま表示しない',()=>{const v=syncView({...checked,lastError:'NETWORK'},connected);assert.equal(v.tone,'error');assert.equal(v.action,'同期を再試行');}); // 保存済みの練習を再作成させません。
test('オフラインでは前回の同期と現在を分ける',()=>{const v=syncView(checked,{...connected,online:false});assert.equal(v.tone,'warning');assert.match(v.detail,/前回の同期/);}); // 古い確認時刻が今の成功に見えるのを防ぎます。
test('オフラインの変更は再接続待ち',()=>{const v=syncView({...checked,pending:1},{...connected,online:false});assert.match(v.title,/同期待ち/);}); // ローカル記録を消しません。
test('サインインだけではOneDrive接続済みにしない',()=>{assert.equal(syncView(checked,{account:true}).title,'OneDrive未接続');}); // 本人保存とクラウド接続の段階を区別します。
test('ゲストではこの端末だけと案内する',()=>{assert.equal(syncView(checked).title,'この端末のみで利用中');assert.match(saveHint(),/このブラウザ内/);}); // ゲストの自動移行は案内しません。
test('保護停止と競合は成功より優先する',()=>{assert.equal(syncView({...checked,blocked:'SCHEMA'},connected).tone,'error');assert.equal(syncView({...checked,practices:[{heads:[{},{}]}]},connected).tone,'warning');}); // データ保護の状態を保持します。
test('関連データ不足を同期済みにしない',()=>{assert.equal(syncView({...checked,practices:[{heads:[{cloudConfirmed:true,readiness:{ready:false}}]}]},connected).tone,'warning');}); // 作戦図の不足を見逃しません。
test('未保存の入力と保存済みの同期は別表示',()=>{assert.match(draftWarning(true),/入力中の変更は未保存/);assert.equal(draftWarning(false),'');assert.equal(syncView(checked,connected).title,'✓ OneDrive同期済み');}); // 同期ボタンを保存と誤認させません。
test('保存ボタンは接続後の自動同期を案内する',()=>{assert.match(saveHint(connected),/押すと練習を登録/);assert.match(saveHint({...connected,online:false}),/オフラインでも保存/);}); // 操作の意味を示します。
test('保存後の同期失敗は保存を繰り返させない',()=>{assert.match(saveHint({...connected,saved:true,error:true}),/同期を再試行/);assert.doesNotMatch(saveHint({...connected,saved:true,error:true}),/保存に失敗/);}); // 端末保存の成功を誤って否定しません。
