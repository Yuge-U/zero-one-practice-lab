import { readFile, writeFile, mkdir, copyFile, cp, rm } from 'node:fs/promises'; // 公開対象と証拠だけを扱います。
import { resolve, join, dirname } from 'node:path'; // 固定したビルド領域を使用します。
import { createHash } from 'node:crypto'; // 配布バイトの一致を検証します。
import { execFileSync } from 'node:child_process'; // 旧版確認後に明示的な修正を適用します。
import assert from 'node:assert/strict'; // 検査値が違えば公開を止めます。
const app=resolve('upstream/practice-ui-lab/app'); // 旧リポジトリを変更せず作業コピーだけを使います。
const base=JSON.parse(await readFile('reports/release-build.json','utf8'));assert.equal(base.release,'0.3.2'); // 最初に既存の28ファイル照合が済んだことを要求します。
await cp(join(app,'web'),join(app,'baseline-web'),{recursive:true}); // 旧版を別保管し更新前後で実データが残るか試験します。
execFileSync(process.env.IMAGE_PYTHON||'python3',['production/prepare-icons.py'],{stdio:'inherit'}); // 承認済み画像からホーム画面用PNGを作ります。
const iconData={};for(const name of ['icon-192.webp','icon-512.webp','apple-touch-icon.png'])iconData[name]=(await readFile(join('production/icons',name))).toString('base64'); // 既存パッチへ検査済みの実画像を渡します。
await writeFile('production/icons.json',JSON.stringify(iconData)); // ビルド内でだけ画像の配置情報を用意します。
execFileSync(process.execPath,['production/patch.mjs',app],{stdio:'inherit'}); // コピーと保存案内と外観を変更します。
const appPath=join(app,'web/app.mjs');let runtime=await readFile(appPath,'utf8');const timerBefore="catch{timer=null;}page('detail');";assert.equal(runtime.split(timerBefore).length,2);runtime=runtime.replace(timerBefore,"catch{timer=null;}$('timer').textContent=timer?formatTime(timer.elapsedMs):'00:00';page('detail');");await writeFile(appPath,runtime); // 計画切替の瞬間にも別計画の時間を表示しません。
await mkdir(join(app,'tests'),{recursive:true}); // 追加の純粋な保存試験を置きます。
await copyFile('production/draft.test.mjs',join(app,'tests/production.test.mjs')); // 本番の保存処理をNode SQLiteでも検証します。
await copyFile('production/browser-check.mjs',join(app,'tools/production-scenarios.mjs'));await copyFile('production/upgrade-check.mjs',join(app,'tools/upgrade-check.mjs')); // 主要操作と版更新の検証を分離して用意します。
await writeFile(join(app,'tools/production-browser.mjs'),"await import('./production-scenarios.mjs'); // 保存とコピーの全画面シナリオを実行します。\nif(!process.env.SITE_URL&&!process.exitCode)await import('./upgrade-check.mjs'); // 公開前には旧版からのデータ継続も検証します。\n"); // どちらかの失敗でもCIを失敗させます。
const expected=JSON.parse(await readFile('production/release.json','utf8'));assert.equal(expected.version,'1.0.0'); // 認めた新しい版以外を配信しません。
const output=resolve('_site');await rm(output,{recursive:true,force:true});await mkdir(output); // ビルド専用の公開物だけを作り直し利用者データには触れません。
const files=[]; // 配信するバイトの証拠を残します。
for(const [name,hash]of Object.entries(expected.files)){assert(!name.includes('..')&&!name.startsWith('/'));const bytes=await readFile(join(app,'web',name));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'Production bytes mismatch: '+name);await mkdir(dirname(join(output,name)),{recursive:true});await writeFile(join(output,name),bytes);files.push({name,sha256:hash,bytes:bytes.length});} // 許可した静的コードだけを成果物へ出力します。
const worker=await readFile(join(app,'web/worker.js'),'utf8');const auth=await readFile(join(app,'web/auth.mjs'),'utf8');assert(worker.includes("directory:'/.zero-one-browser-lab-v02/'+sha(scope)"));assert(worker.includes("new pool.OpfsSAHPoolDb('/core.db')"));assert(auth.includes("'guest-local'")); // 既存SQLiteの保存先とゲスト境界を変えていないことを検査します。
await writeFile('reports/production-build.json',JSON.stringify({version:expected.version,sourceCommit:base.sourceCommit,files,existingDataPathsPreserved:true,realMicrosoft:false,physicalIPhone:false},null,2)); // 本人認証や実機試験とは区別して記録します。
console.log('Production candidate prepared with preserved storage identity; browser gates must pass before deployment.'); // 準備成功を公開成功と混同しません。
