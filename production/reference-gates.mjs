import {readFile,writeFile} from 'node:fs/promises'; // 検証用ハーネスだけを修正します。
import {join,resolve} from 'node:path'; // 対象を作業コピーの試験フォルダーに限定します。
import assert from 'node:assert/strict'; // 想定した試験版にだけ適用します。
const root=resolve(process.argv[2]); // 公開ソースではなくテストの場所を指定します。
async function patch(name,before,after){const file=join(root,'tools',name);const text=await readFile(file,'utf8');assert.equal(text.split(before).length,2,'Reference test patch mismatch: '+before.slice(0,90));await writeFile(file,text.replace(before,after));} // 元の合格条件は削除しません。
await patch('network-browser.mjs','(core\\/[\\w-]+\\.mjs)$','(core\\/[\\w-]+\\.mjs|reference-links\\.mjs)$'); // Graphのモデルが必要とする新規の純粋モジュールもハーネスから配信します。
await patch('reference-browser.mjs',"failure=true;await page.locator('[data-reference-add]').click();","failure=true;await page.locator('#items .reference-box').first().evaluate(e=>e.open=true);await page.locator('[data-reference-add]').click();"); // 保存後に閉じる資料欄を開いてから、失敗時の操作を検証します。
await patch('reference-browser.mjs',"external.push({url:target.href,headers:request.headers()});return route.fulfill", "external.push({url:target.href,headers:request.headers()});if(target.href!=='https://example.com/instruction.pdf'){errors.push({engine,message:'Unexpected external reference request: '+target.href});return route.abort();}return route.fulfill"); // 明示操作で開く一つの合成リンク以外の外部通信は拒否します。
await patch('reference-browser.mjs',"await page.screenshot({path:join(reports,engine+'-references.png'),fullPage:true});", "await page.screenshot({path:join(reports,engine+'-references.png'),fullPage:true});assert.equal(external.length,1);"); // 全シナリオ終了時にも無断の先読みが増えていないことを確認します。
console.log('Reference test harness includes the new module; all native-fetch and reference assertions retained.'); // 実ブラウザ試験の合格をこの準備だけで主張しません。
