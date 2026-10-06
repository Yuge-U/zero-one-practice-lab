import {readFile,writeFile} from 'node:fs/promises'; // 検証用コピーの表示と試験だけを変更します。
import {join,resolve} from 'node:path'; // 対象アプリの位置を固定します。
import {createHash} from 'node:crypto'; // 直前の配信バイトとの一致を確認します。
import assert from 'node:assert/strict'; // 想定外の差分があれば配信を止めます。
const root=resolve(process.argv[2]); // 既存ビルドが作成した作業コピーを使います。
const hashes={'app.mjs':'228110281cbb91d86339d8b59cf87d5af58bfbd61d187c4fdc93386920151062','config.mjs':'df10fc1be5468364197bcb28a9ba447dbfe4ea59cf486926090920e441e184d8','core/service.mjs':'b98d921f0525cb420e748a7e910a22f97db8ac2a1f228b1ba9f171d446220dd2','index.html':'2aa94cd71b7545f82f692f6375e7cb603390795d6490c4751dd49fed4df0bf42','sw.js':'aeb1d3b3edda17b13fa62b814e7da69e9ee0344113f0b761ac9418ce26091b79'}; // 検証済み1.3.0からの表示変更だけを許可します。
for(const [name,hash]of Object.entries(hashes)){ // Core実行ファイルだけを固定バイトで照合します。\n  const bytes=await readFile(join(root,'web',name));if(name!=='index.html')assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'Unexpected 1.3.0 bytes: '+name); // HTMLはブランド・favicon変更を許可します。\n} // 既存データやOneDriveへアクセスする処理はありません。
const appFile=join(root,'web/app.mjs');let app=await readFile(appFile,'utf8'); // メニュー編集画面のテンプレートだけを読みます。
const oldLabel='<label>変更する条件・声掛け<textarea data-field="rule"';const newLabel='<label>詳細<textarea data-field="rule"'; // 内部フィールド名と入力内容を維持します。
assert.equal(app.split(oldLabel).length,2);app=app.replace(oldLabel,newLabel);await writeFile(appFile,app); // ラベルだけを一か所変更します。
for(const [name,count]of [['config.mjs',1],['core/service.mjs',1],['index.html',2],['sw.js',2]]){ // 更新を認識する版表示とキャッシュ識別子だけを変更します。
  const file=join(root,'web',name);const text=await readFile(file,'utf8');assert.equal(text.split('1.3.0').length,count+1);await writeFile(file,text.replaceAll('1.3.0','1.3.1')); // 保存先・DB形式・同期処理は変えません。
} // 旧版を手動削除しない通常のアプリ更新を維持します。
for(const name of ['production-scenarios.mjs','save-status-browser.mjs','catalog-browser.mjs','reference-browser.mjs','media-browser.mjs','upgrade-check.mjs']){ // 既存の全ブラウザ検証を残します。
  const file=join(root,'tools',name);const text=await readFile(file,'utf8');assert(text.includes('1.3.0'));await writeFile(file,text.replaceAll('1.3.0','1.3.1').replaceAll('1\\.3\\.0','1\\.3\\.1')); // 検証対象版だけを更新します。
} // 旧版からのデータ保護と添付試験も省略しません。
const scenarios=join(root,'tools/production-scenarios.mjs');let test=await readFile(scenarios,'utf8'); // 公開前後に実行する既存試験へ表示確認を加えます。
function change(before,after){assert.equal(test.split(before).length,2,'Unexpected test marker: '+before);test=test.replace(before,after);} // 一致する試験箇所だけを変更します。
change("async function open(page,title){","async function detailField(page){const field=page.locator('[data-field=\"rule\"]').first();assert.equal(await field.evaluate(node=>node.closest('label').firstChild.textContent.trim()),'詳細');return field;} // 入力済み本文を含めず、実際の見出し文字と入力欄の対応を検証します。\nasync function open(page,title){"); // 保存後のtextarea本文をラベル文字と混同しない試験にします。
const labelCheck="assert.equal(await page.getByLabel('メニュー名',{exact:true}).getAttribute('data-field'),'name');"; // 既存メニュー名の確認を基点にします。
change(labelCheck,labelCheck+"assert.equal(await page.getByLabel('詳細',{exact:true}).getAttribute('data-field'),'rule');assert.equal(await page.getByLabel('変更する条件・声掛け',{exact:true}).count(),0);"); // 新ラベルと旧ラベルの非表示を実画面で要求します。
change("await page.locator('[data-field=\"rule\"]').first().fill('2ドリブル');","await (await detailField(page)).fill('2ドリブル');"); // 詳細の新ラベルを使って元の内容を保存します。
change("await page.locator('[data-field=\"rule\"]').first().fill('1ドリブル');","await (await detailField(page)).fill('1ドリブル');"); // コピー先も新ラベルで一部変更します。
const persisted="}); // 実OPFSへの永続保存を確認します。"; // 保存と再読込の既存ケースを強化します。
change(persisted,"await page.locator('#editPlan').click();await page.waitForFunction(()=>document.getElementById('draftMode').textContent.includes('編集モード'));assert.equal(await (await detailField(page)).inputValue(),'1ドリブル');await open(page,'本番受入・原本');await page.locator('#editPlan').click();await page.waitForFunction(()=>document.getElementById('draftMode').textContent.includes('編集モード'));assert.equal(await (await detailField(page)).inputValue(),'2ドリブル');"+persisted); // 再編集でもコピーの変更と原本の内容が別々に保持されることを確認します。
await writeFile(scenarios,test); // 実際に実行する既存の必須試験を保存します。
console.log('Detail label updated; rule data and all existing regression gates preserved.'); // 公開完了ではなく候補の組立結果を記録します。
