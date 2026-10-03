import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises'; // 既存の検証用コピーだけを更新します。
import {join,resolve} from 'node:path'; // 適用先を既存ビルド領域へ固定します。
import {execFileSync} from 'node:child_process'; // 接続の単体試験を必須として実行します。
import assert from 'node:assert/strict'; // 想定外の差分があれば公開を止めます。
const root=resolve(process.argv[2]); // 本人データとは別のアプリコピーです。
const changes=JSON.parse(await readFile('production/reliability/patches.json','utf8')); // レビュー済みの差分を読みます。
for(const change of changes){ // 現行1.3.1の既知の箇所だけを書き換えます。
  assert(!change.file.includes('..')&&!change.file.startsWith('/'));const file=join(root,'web',change.file),text=await readFile(file,'utf8');assert.equal(text.split(change.before).length,(change.count||1)+1,'Unexpected source: '+change.file);await writeFile(file,text.replaceAll(change.before,change.after)); // 不一致のコードを強制上書きしません。
} // DB位置、所有者、固定版の形式は変更しません。
for(const name of ['production-scenarios.mjs','save-status-browser.mjs','catalog-browser.mjs','reference-browser.mjs','media-browser.mjs','upgrade-check.mjs']){ // 元の全ブラウザ検証を継続します。
  const file=join(root,'tools',name),text=await readFile(file,'utf8');assert(text.includes('1.3.1'));await writeFile(file,text.replaceAll('1.3.1','1.3.2').replaceAll('1\\.3\\.1','1\\.3\\.2')); // 対象の版表示だけを更新します。
} // 過去データの更新と添付試験も維持します。
const networkFile=join(root,'tools/network-browser.mjs');let network=await readFile(networkFile,'utf8'); // 通信回数の新しい上限を検査します。
const before=network.split('\n').find(line=>line.includes('worker preserves true network failure'));assert(before&&before.includes('hits.length,1'));const after=before.replace('hits.length,1','hits.length,3');network=network.replace(before,after);await writeFile(networkFile,network); // 未接続エラーは保持し、有限三回の再試行を要求します。
await mkdir(join(root,'tests'),{recursive:true});await copyFile('production/reliability/connection.test.mjs',join(root,'tests/connection.test.mjs')); // 実SQLiteで保存・同期の並行性を検査します。
execFileSync(process.execPath,['--test','tests/connection.test.mjs'],{cwd:root,stdio:'inherit'}); // 単体試験を省略して配信しません。
await copyFile('production/reliability/connection-browser.mjs',join(root,'tools/connection-browser.mjs')); // 故障注入の実画面試験を配置します。
const browserFile=join(root,'tools/connection-browser.mjs');const browser=await readFile(browserFile,'utf8');assert.equal(browser.split("'reports/connection-live'").length,2);await writeFile(browserFile,browser.replace("'reports/connection-live'","'reports/production-live/connection'")); // 公開後の新しい検証証拠も既存の成果物に含めます。
const entry=join(root,'tools/production-browser.mjs');const original=await readFile(entry,'utf8');assert(!original.includes('connection-browser.mjs'));await writeFile(entry,original+"if(!process.exitCode)await import('./connection-browser.mjs'); // 接続・保存の追加試験を公開前後とも必須にします。\n"); // 既存の公開前後検証を置き換えません。
console.log('1.3.2 connection candidate prepared; all browser and live gates remain mandatory.'); // 公開完了とは区別します。
