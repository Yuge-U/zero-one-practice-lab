import {readFile,writeFile,mkdir,copyFile,cp,rm} from 'node:fs/promises'; // 公開候補と検証証拠だけを扱います。
import {resolve,join,dirname} from 'node:path'; // ビルド領域を固定します。
import {createHash} from 'node:crypto'; // 公開バイトを照合します。
import {execFileSync} from 'node:child_process'; // 既存の検証済みビルドを呼び出します。
import assert from 'node:assert/strict'; // 不一致があれば公開を止めます。
const app=resolve('upstream/practice-ui-lab/app'); // 既存アプリとは別の作業コピーです。
const base=JSON.parse(await readFile('reports/release-build.json','utf8'));assert.equal(base.release,'0.3.2'); // 旧版の照合を必須とします。
await cp(join(app,'web'),join(app,'baseline-web'),{recursive:true}); // 既存の更新検証と旧通信コード再現の基準を残します。
execFileSync(process.env.IMAGE_PYTHON||'python3',['production/prepare-icons.py'],{stdio:'inherit'}); // 承認済みアイコンの変換条件を維持します。
const iconData={};for(const name of ['icon-192.webp','icon-512.webp','apple-touch-icon.png'])iconData[name]=(await readFile(join('production/icons',name))).toString('base64'); // 検証済み画像を準備します。
await writeFile('production/icons.json',JSON.stringify(iconData)); // ビルド内だけで画像情報を渡します。
execFileSync(process.execPath,['production/patch.mjs',app],{stdio:'inherit'}); // 既存1.0.0の保存・コピー・外観をそのまま再構成します。
const appPath=join(app,'web/app.mjs');let runtime=await readFile(appPath,'utf8');const timerBefore="catch{timer=null;}page('detail');";assert.equal(runtime.split(timerBefore).length,2);runtime=runtime.replace(timerBefore,"catch{timer=null;}$('timer').textContent=timer?formatTime(timer.elapsedMs):'00:00';page('detail');");await writeFile(appPath,runtime); // 既存のタイマー表示修正を維持します。
await mkdir(join(app,'tests'),{recursive:true}); // 単体試験を配置します。
await copyFile('production/draft.test.mjs',join(app,'tests/production.test.mjs')); // 既存の原本保護試験を維持します。
await copyFile('production/browser-check.mjs',join(app,'tools/production-scenarios.mjs'));await copyFile('production/upgrade-check.mjs',join(app,'tools/upgrade-check.mjs')); // 既存の実画面・更新試験を維持します。
await writeFile(join(app,'tools/production-browser.mjs'),"await import('./production-scenarios.mjs'); // 保存とコピーを実際の画面で検証します。\nif(!process.env.SITE_URL&&!process.exitCode)await import('./upgrade-check.mjs'); // 公開前は旧データの保持も検証します。\n"); // 失敗した場合は公開しません。
execFileSync(process.execPath,['production/network-fix.mjs',app],{stdio:'inherit'}); // ネイティブfetchの呼出元だけを修正して1.0.1へ更新します。
execFileSync(process.execPath,['production/save-ux.mjs',app],{stdio:'inherit'}); // 保存操作と同期の表示だけを1.0.2へ更新します。
execFileSync(process.execPath,['production/save-status-errors.mjs',app],{stdio:'inherit'}); // 同期開始前の通信失敗も再試行状態として表示します。
execFileSync(process.execPath,['production/plan-menu-labels.mjs',app],{stdio:'inherit'}); // 全体名と個別メニュー名の表示を1.0.3へ更新します。
execFileSync(process.execPath,['production/catalog-update.mjs',app],{stdio:'inherit'}); // 大項目・検索・コピーと本人接続を1.1.0へ更新します。
execFileSync(process.execPath,['production/catalog-gates.mjs',app],{stdio:'inherit'}); // 非同期完了の待機と認証遷移の診断を追加します。
execFileSync(process.execPath,['production/compact-defaults.mjs',app],{stdio:'inherit'}); // 同期枠と新規初期値だけを1.1.1へ更新します。
await copyFile('production/compact-defaults.test.mjs',join(app,'tests/compact-defaults.test.mjs')); // 休憩の最小入力と既存値保護を検証します。
execFileSync(process.execPath,['production/reference-update.mjs',app],{stdio:'inherit'}); // 現行の参考資料機能を維持します。
execFileSync(process.execPath,['production/reference-gates.mjs',app],{stdio:'inherit'}); // 既存参照検証も維持します。
await cp(join(app,'web'),join(app,'pre-media-web'),{recursive:true}); // 直前の1.2.1を互換性検査用に保持します。
execFileSync(process.execPath,['production/media-update.mjs',app],{stdio:'inherit'}); // 任意の写真・動画添付と専用試験を1.3.0へ追加します。
execFileSync(process.execPath,['production/media-gates.mjs',app],{stdio:'inherit'}); // メタデータ先読みと模擬HTTPの診断を検証へ追加します。
await copyFile('production/media/media-compatibility.test.mjs',join(app,'tests/media-compatibility.test.mjs')); // 参考資料と旧版の互換性を確認します。
execFileSync(process.execPath,['production/detail-label.mjs',app],{stdio:'inherit'}); // 保存内容は変えず表示を詳細に統一します。
execFileSync(process.execPath,['production/connection-update.mjs',app],{stdio:'inherit'}); // 接続の復旧と端末保存の独立性を改善し必須検証へ追加します。
const expected=JSON.parse(await readFile('production/release.json','utf8'));assert.equal(expected.version,'1.3.2'); // 許可した修正版だけを配信します。
const output=resolve('_site');await rm(output,{recursive:true,force:true});await mkdir(output); // ビルド出力のみを作り直します。
const files=[]; // 公開バイトの証拠を収集します。
for(const [name,hash]of Object.entries(expected.files)){assert(!name.includes('..')&&!name.startsWith('/'));const bytes=await readFile(join(app,'web',name));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'Production bytes mismatch: '+name);await mkdir(dirname(join(output,name)),{recursive:true});await writeFile(join(output,name),bytes);files.push({name,sha256:hash,bytes:bytes.length});} // 許可した静的ファイルだけを公開領域へコピーします。
const worker=await readFile(join(app,'web/worker.js'),'utf8');const auth=await readFile(join(app,'web/auth.mjs'),'utf8');assert(worker.includes("directory:'/.zero-one-browser-lab-v02/'+sha(scope)"));assert(worker.includes("new pool.OpfsSAHPoolDb('/core.db')"));assert(auth.includes("'guest-local'")); // DB名と本人・ゲストの境界を保持します。
await writeFile('reports/production-build.json',JSON.stringify({version:expected.version,sourceCommit:base.sourceCommit,files,existingDataPathsPreserved:true,realMicrosoft:false,physicalIPhone:false},null,2)); // 本人端末の検証とは区別して記録します。
console.log('1.3.2 candidate verified; browser gates must pass before deployment.'); // ビルドと公開の完了を混同しません。
