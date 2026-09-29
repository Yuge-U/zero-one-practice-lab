import {readFile,writeFile,copyFile} from 'node:fs/promises'; // 公開候補だけを読み書きします。
import {resolve,join} from 'node:path'; // 検証用の展開先を指定します。
import assert from 'node:assert/strict'; // 不明な版へ修正を適用しません。
import {createHash} from 'node:crypto'; // 旧通信モジュールの内容を固定します。
const root=resolve(process.argv[2]); // 本人の端末データではなくビルド先を使います。
const file=join(root,'web/core/graph.mjs');let source=await readFile(file,'utf8'); // 1.0.0の通信コードを読みます。
assert.equal(createHash('sha256').update(source).digest('hex'),'baa222cecad1e02aa3769a7d2fd8a55d39459002882674ae76c8ffcfc8508ed1'); // 再現対象と同じ版であることを確認します。
const before='fetcher=globalThis.fetch,';assert.equal(source.split(before).length,2); // 変更は既定fetchの一箇所に限定します。
source=source.replace(before,'fetcher=globalThis.fetch.bind(globalThis),'); // WindowまたはWorkerの正しい呼出元を保持します。
await writeFile(file,source); // 認証・権限・通信先・保存パスは変更しません。
for(const name of ['web/config.mjs','web/index.html','web/sw.js','web/core/service.mjs','tools/production-scenarios.mjs','tools/upgrade-check.mjs']){ // 実行版と更新試験の期待版を一致させます。
  const path=join(root,name);const text=await readFile(path,'utf8');assert(text.includes('1.0.0'),name); // 想定した旧版を検査します。
  await writeFile(path,text.replaceAll('1.0.0','1.0.1')); // 条件を緩めず版識別子だけ変更します。
} // 版更新を完了します。
for(const name of ['tools/production-scenarios.mjs','tools/upgrade-check.mjs']){ // 画面検査の正規表現にも同じ新バージョンを要求します。
  const path=join(root,name);const text=await readFile(path,'utf8');const before='1\\.0\\.0';assert.equal(text.split(before).length,2,name); // 旧版用の期待値が一箇所にあることを確認します。
  await writeFile(path,text.replace(before,'1\\.0\\.1')); // 保存・コピー・データ保持の条件は一切変えません。
} // バージョン正規表現の更新を終えます。
await copyFile('production/network-browser.mjs',join(root,'tools/network-browser.mjs')); // ネイティブ通信を使うブラウザ回帰試験を配置します。
await copyFile('production/network.test.mjs',join(root,'tests/network.test.mjs')); // 呼出元を厳密に確認する単体試験を配置します。
console.log('Bound native fetch to its global receiver. Storage, identity, permissions and redirect restrictions unchanged.'); // 実際の変更範囲を記録します。
