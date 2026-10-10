import {updateBrandShell} from './brand-shell-update.mjs';
import {stampVersion} from './version-update.mjs';
import {readFile,writeFile,mkdir,copyFile,cp,rm,rename} from 'node:fs/promises'; // 公開候補と検証証拠だけを扱います。
import {resolve,join,dirname} from 'node:path'; // ビルド領域を固定します。
import {createHash} from 'node:crypto'; // 公開バイトを照合します。
import {execFileSync} from 'node:child_process'; // 既存の検証済みビルドを呼び出します。
import assert from 'node:assert/strict'; // 不一致があれば公開を止めます。
import {assertApplePng} from './icon-contract.mjs'; // 画像の構造検査をブラウザ検査と共有します。
execFileSync(process.execPath,['--test','production/tests/build-contract.test.mjs','production/tests/brand-shell-update.test.mjs','production/tests/series-connection.test.cjs','production/tests/version-policy.test.mjs'],{stdio:'inherit'}); // 更新番号と終了コードの回帰を重いビルドより前に検査します。
const app=resolve('upstream/practice-ui-lab/app'); // 既存アプリとは別の作業コピーです。
const base=JSON.parse(await readFile('reports/release-build.json','utf8'));assert.equal(base.release,'0.3.2'); // 旧版の照合を必須とします。
await cp(join(app,'web'),join(app,'baseline-web'),{recursive:true}); // 既存の更新検証と旧通信コード再現の基準を残します。
execFileSync(process.env.IMAGE_PYTHON||'python3',['production/render-practice-icon.py'],{stdio:'inherit'}); // ZERO ONE PRACTICEの既存アイコン変換を実行します。
execFileSync(process.env.IMAGE_PYTHON||'python3',['production/prepare-icons.py'],{stdio:'inherit'}); // アイコンの変換条件を維持します。
const iconData={};for(const name of ['icon-192.webp','icon-512.webp','apple-touch-icon.png'])iconData[name]=(await readFile(join('production/icons',name))).toString('base64'); // 検証済み画像を準備します。
await writeFile('production/icons.json',JSON.stringify(iconData)); // ビルド内だけで画像情報を渡します。
execFileSync(process.execPath,['production/patch.mjs',app],{stdio:'inherit'}); // 既存1.0.0の保存・コピー・外観をそのまま再構成します。
const appPath=join(app,'web/app.mjs');let runtime=await readFile(appPath,'utf8');const timerBefore="catch{timer=null;}page('detail');";assert.equal(runtime.split(timerBefore).length,2);runtime=runtime.replace(timerBefore,"catch{timer=null;}$('timer').textContent=timer?formatTime(timer.elapsedMs):'00:00';page('detail');");await writeFile(appPath,runtime); // 既存のタイマー表示修正を維持します。
await mkdir(join(app,'tests'),{recursive:true}); // 単体試験を配置します。
await copyFile('production/draft.test.mjs',join(app,'tests/production.test.mjs')); // 既存の原本保護試験を維持します。
await copyFile('production/browser-check.mjs',join(app,'tools/production-scenarios.mjs'));await copyFile('production/upgrade-check.mjs',join(app,'tools/upgrade-check.mjs')); // 既存の実画面・更新試験を維持します。
await copyFile('production/icon-contract.mjs',join(app,'tools/icon-contract.mjs')); // URLと実画像の検査を一元化します。
await copyFile('production/browser-runner.mjs',join(app,'tools/production-browser.mjs')); // 長い文字列からのスクリプト生成をやめ、実ファイルを配備します。
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
execFileSync(process.execPath,['production/connection-update.mjs',app],{stdio:'inherit'}); // 通信と認証の分類・再試行・重複防止だけを更新します。
await copyFile('production/connection.test.mjs',join(app,'tests/connection.test.mjs')); // 新しい通信回帰試験を既存検査へ追加します。
await copyFile('production/auth-before.fixture.mjs',join(app,'tools/auth-before.fixture.mjs')); // 修正前の誤分類をブラウザで再現します。
await copyFile('production/connection-browser.mjs',join(app,'tools/connection-browser.mjs')); // 両ブラウザで実Authから保存までを確認します。
execFileSync(process.execPath,['production/sync-latency-update.mjs',app],{stdio:'inherit'}); // 同期中の端末保存と通信失敗後の操作を保ちます。
await copyFile('production/sync-latency.test.mjs',join(app,'tests/sync-latency.test.mjs')); // 遅延と結果不明の回帰を必須にします。
await copyFile('production/sync-latency-browser.mjs',join(app,'tools/sync-latency-browser.mjs')); // 両エンジンで遅延中の保存と復帰を検証します。
execFileSync(process.execPath,['production/sync-minimum-update.mjs',app],{stdio:'inherit'});
await copyFile('production/sync-minimum.test.mjs',join(app,'tests/sync-minimum.test.mjs'));
execFileSync(process.execPath,['production/menu-structure-update.mjs',app],{stdio:'inherit'}); // 同期可能な保存済みメニュー構成と途中追加を実装します。
execFileSync(process.execPath,['production/series-connection-update.mjs',app],{stdio:'inherit'}); // 4アプリ共通の接続操作と状態表示を適用します。
execFileSync(process.execPath,['production/canvas-viewer-update.mjs',app],{stdio:'inherit'}); // 保存した作戦の閲覧・軽量再生を追加します。
execFileSync(process.execPath,['production/canvas-import-update.mjs',app],{stdio:'inherit'}); // 読込状態・保存先の階層・全フォルダ検索を追加します。
execFileSync(process.execPath,['production/menu-review-update.mjs',app],{stdio:'inherit'}); // 一時的な完了チェックとカテゴリー別の過去メニュー追加です。
execFileSync(process.execPath,['production/multiple-terms-update.mjs',app],{stdio:'inherit'});
await rm(join(app,'startup-baseline-web'),{recursive:true,force:true});await cp(join(app,'web'),join(app,'startup-baseline-web'),{recursive:true}); // 起動対策前の1.3.7を症状再現用に残します。
for(const name of ['config.mjs','core/service.mjs','index.html','sw.js']){const path=join(app,'startup-baseline-web',name);await writeFile(path,(await readFile(path,'utf8')).replaceAll('1.3.4','1.3.7'));}
execFileSync(process.execPath,['production/startup-update.mjs',app],{stdio:'inherit'});
await rm(join(app,'previous-web'),{recursive:true,force:true});await cp(join(app,'web'),join(app,'previous-web'),{recursive:true}); // 公開した1.3.8を更新検査用に再構成します。
for(const name of ['config.mjs','core/service.mjs','index.html','sw.js']){const path=join(app,'previous-web',name);await writeFile(path,(await readFile(path,'utf8')).replaceAll('1.3.4','1.3.8'));}
execFileSync(process.execPath,['production/startup-safety-update.mjs',app],{stdio:'inherit'}); // 古い起動コードでも編集中に再読み込みしません。
execFileSync(process.execPath,['production/startup-entry-update.mjs',app],{stdio:'inherit'}); // URL切替前の二重起動を避け、認証戻りのURLは維持します。
await copyFile('production/startup.browser.mjs',join(app,'tools/startup.browser.mjs'));
const expected=JSON.parse(await readFile('production/release.json','utf8'));
await stampVersion(app,expected.version); // 表示・診断・SWと検証記録を一つの公開版番号へ揃えます。
const swPath=join(app,'web/sw.js');const sw=await readFile(swPath,'utf8');const cache=`const CACHE='zero-one-practice-lab-${expected.version}'`;assert(sw.includes(cache));await writeFile(swPath,updateBrandShell(sw.replace(cache,`const CACHE='zero-one-practice-lab-${expected.version}-canvas-picker-20261009'`),expected.version));
const previousSwPath=join(app,'previous-web/sw.js');await writeFile(previousSwPath,updateBrandShell((await readFile(previousSwPath,'utf8')).replace("const CACHE='zero-one-practice-lab-1.3.8'","const CACHE='zero-one-practice-lab-1.3.8-canvas-picker-20261009'"),'1.3.8'));
const output=resolve('_site.candidate');await rm(output,{recursive:true,force:true});await mkdir(output); // 確定前の候補を既存の出力から分離します。
await copyFile('production/brand/zero-one-logo.svg',join(app,'web/brand-logo.svg')); // Splashとヘッダーは共通ZERO ONEロゴを使用します。
await copyFile('production/brand/zero-one-logo.svg',join(app,'previous-web/brand-logo.svg'));
const files=[]; // 公開バイトの証拠を実際のコード行で初期化します。
const flexibleUi=new Set(['index.html','style.css','series.css','manifest.webmanifest','icons/icon-192.webp','icons/icon-512.webp','icons/apple-touch-icon.png']); // Coreは従来どおり固定SHAで検証します。
for(const [name,hash]of Object.entries(expected.files)){assert(!name.includes('..')&&!name.startsWith('/'));const bytes=await readFile(join(app,'web',name));const actual=createHash('sha256').update(bytes).digest('hex');if(!flexibleUi.has(name))assert.equal(actual,hash,'Production bytes mismatch: '+name);await mkdir(dirname(join(output,name)),{recursive:true});await writeFile(join(output,name),bytes);files.push({name,sha256:actual,bytes:bytes.length,gate:flexibleUi.has(name)?'ui-validated':'sha-pinned'});} // 全必須ファイルを照合してから候補へ書き込みます。
for(const name of ['icons/icon-192.webp','icons/icon-512.webp','icons/apple-touch-icon.png']){const bytes=await readFile(join(app,'web',name));assert(bytes.length>1000,'UI icon too small: '+name);} // 空画像や破損した生成物を拒否します。
for(const name of ['apple-touch-zero-one-180-20261007m.png','apple-touch-icon.png','apple-touch-icon-precomposed.png','safari-practice-180-20261007g.png','safari-practice-192-20261007g.png','favicon.ico','favicon-practice-20261007f.ico','favicon-practice-32-20261007f.png']) {
  const bytes=await readFile(join('production/icons',name));
  if(name.endsWith('.ico')) {assert.equal(bytes.readUInt16LE(2),1);assert.equal(bytes.readUInt16LE(4),3);assert.deepEqual([bytes[6],bytes[22],bytes[38]],[16,32,48]);}
  await writeFile(join(app,'web',name),bytes);await writeFile(join(app,'previous-web',name),bytes);await writeFile(join(output,name),bytes);
  files.push({name,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,gate:'ui-validated'});
}
const entryBytes=await readFile('production/brand-entry.js');await writeFile(join(app,'web/brand-entry.js'),entryBytes);await writeFile(join(output,'brand-entry.js'),entryBytes);files.push({name:'brand-entry.js',sha256:createHash('sha256').update(entryBytes).digest('hex'),bytes:entryBytes.length,gate:'ui-validated'});
await writeFile(join(app,'previous-web/brand-entry.js'),entryBytes);
let upgrade=await readFile(join(app,'tools/upgrade-check.mjs'),'utf8');
upgrade=upgrade.replaceAll("reports/upgrade","reports/current-version-upgrade").replaceAll("resolve('baseline-web')","resolve('previous-web')").replaceAll('/0\\.3\\.2/','/1\\.3\\.8/').replaceAll("from:'0.3.2'","from:'1.3.8'").replace("await page.getByRole('button',{name:'端末に保存',exact:true}).click()","await page.locator('#savePlan').click()");
await writeFile(join(app,'tools/current-version-upgrade.mjs'),upgrade);
const brandBytes=await readFile(join(app,'web/brand-logo.svg'));assert(brandBytes.length>500&&brandBytes.toString('utf8').includes('<svg'),'ZERO ONE brand logo invalid');await writeFile(join(output,'brand-logo.svg'),brandBytes); // 共通ロゴも公開候補へ含めます。
assertApplePng(await readFile(join(output,'icons/apple-touch-icon.png'))); // 配信するPNG本体の形式と180pxの寸法を検証します。
const manifest=JSON.parse(await readFile(join(app,'web/manifest.webmanifest'),'utf8'));assert.equal(manifest.name,'ZERO ONE PRACTICE');assert(manifest.icons.some(icon=>icon.src.includes('icon-192.webp')));assert(manifest.icons.some(icon=>icon.src.includes('icon-512.webp'))); // PWAが正式アイコンを参照していることを確認します。
const brandedHtml=await readFile(join(app,'web/index.html'),'utf8');assert(brandedHtml.includes('ZERO ONE'));assert(brandedHtml.includes('PRACTICE'));assert(brandedHtml.includes('apple-touch-zero-one-180-20261007m.png')); // ブランド表示とiPhoneアイコン参照を必須にします。
const worker=await readFile(join(app,'web/worker.js'),'utf8');const auth=await readFile(join(app,'web/auth.mjs'),'utf8');assert(worker.includes("directory:'/.zero-one-browser-lab-v02/'+sha(scope)"));assert(worker.includes("new pool.OpfsSAHPoolDb('/core.db')"));assert(auth.includes("'guest-local'")); // DB名と本人・ゲストの境界を保持します。
await writeFile('reports/production-build.json',JSON.stringify({version:expected.version,sourceCommit:base.sourceCommit,files,existingDataPathsPreserved:true,realMicrosoft:false,physicalIPhone:false},null,2)); // 本人端末の検証とは区別して記録します。
await rm(resolve('_site'),{recursive:true,force:true});await rename(output,resolve('_site')); // 構造検証に合格した候補だけを配信待ちの出力へ確定します。
console.log(expected.version+' candidate verified; existing data paths are unchanged.'); // ビルドと公開の完了を混同しません。
