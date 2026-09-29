import assert from 'node:assert/strict'; // 公開URLの実測結果を判定します。
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'; // 合成テストの証拠だけを保存します。
import { join } from 'node:path'; // 検証専用の保存先を組み立てます。
import { tmpdir } from 'node:os'; // 本人のブラウザと別の領域を作ります。
import { createHash } from 'node:crypto'; // 配信中のコードを公開候補と照合します。
import { chromium, webkit } from 'playwright'; // 固定した二つのブラウザで確認します。
const url = new URL(process.env.SITE_URL || 'https://yuge-u.github.io/zero-one-practice-lab/'); // このアプリの公開先だけを対象にします。
assert.equal(url.href, 'https://yuge-u.github.io/zero-one-practice-lab/'); // 別サイトへの自動書込み操作を拒否します。
const lock = JSON.parse(await readFile('release-lock.json', 'utf8')); // 既知の公開ファイルの検査値を取得します。
const report = { url: url.href, release: lock.release, physicalIPhone: false, realMicrosoft: false, results: [], errors: [], files: [], warmup: [] }; // 実端末や本人クラウドの検証とは区別します。
await mkdir('reports/live', { recursive: true }); // 実際の公開検査の結果を保存します。
async function check(engine, name, run) { // 実行した検査だけを集計します。
  try { await run(); report.results.push({ engine, name, status: 'passed' }); console.log('PASS', engine, name); } // 正常終了を記録します。
  catch (error) { report.results.push({ engine, name, status: 'failed', error: error.message }); throw error; } // 失敗を合格へ置換しません。
} // 一件の検査処理を閉じます。
async function ready(page) { await page.waitForFunction(() => Boolean(document.getElementById('editorFields')) && !document.getElementById('editorFields').disabled, {}, { timeout: 45000 }); } // 実際のSQLite初期化を待ちます。
try { // 公開ファイルとブラウザ操作を順番に検証します。
  let available = false; // Pagesの反映待ちだけを限定的に許可します。
  for (let attempt = 1; attempt <= 6; attempt++) { // 無制限の再試行は行いません。
    try { const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000), cache: 'no-store' }); report.warmup.push({ attempt, status: response.status }); available = response.ok; } catch (error) { report.warmup.push({ attempt, error: error.message }); } // 一時的な公開反映待ちも隠さず記録します。
    if (available) break; await new Promise(resolve => setTimeout(resolve, 5000)); // 公開後の短い反映待ちに限定します。
  } // 配信待ちを終えます。
  assert(available, 'Public HTTPS page was not available'); // ページがなければ操作試験を始めません。
  await check('https', 'L01 公開ファイル27点の完全一致', async () => { // 非配信用の.nojekyll以外をすべて確認します。
    for (const [name, expected] of Object.entries(lock.files).filter(([name]) => name !== '.nojekyll')) { // 個人データでなく静的コードだけを取得します。
      const response = await fetch(new URL(name, url), { redirect: 'error', signal: AbortSignal.timeout(20000), cache: 'no-store' }); // 認証ヘッダーなしで公開URLへアクセスします。
      assert.equal(response.status, 200, name); const bytes = Buffer.from(await response.arrayBuffer()); // エラー画面を部品として扱いません。
      const actual = createHash('sha256').update(bytes).digest('hex'); assert.equal(actual, expected, name); // 1バイトでも違えば不合格にします。
      if (name.endsWith('.wasm')) assert.match(response.headers.get('content-type') || '', /application\/wasm/i); // WASMの配信形式を確認します。
      if (name.endsWith('.mjs')) assert.match(response.headers.get('content-type') || '', /javascript/i); // モジュールを実行できる配信形式か確認します。
      report.files.push({ name, sha256: actual, status: response.status, contentType: response.headers.get('content-type') }); // 公開物の検査値を記録します。
    } // ファイルの照合を終えます。
  }); // HTTPSファイル検査を閉じます。
  for (const [engine, type] of Object.entries({ chromium, webkit })) { // 実装の異なるブラウザを独立に確認します。
    const root = await mkdtemp(join(tmpdir(), 'zero-one-live-')); const home = join(root, 'home'); await mkdir(home); // OS保存領域も検証用に分離します。
    const context = await type.launchPersistentContext(join(root, 'profile'), { headless: true, env: { ...process.env, HOME: home, CFFIXED_USER_HOME: home, XDG_DATA_HOME: join(home, 'data'), XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: join(home, 'cache') } }); // 個人プロファイルは使用しません。
    const page = await context.newPage(); page.setDefaultTimeout(25000); page.on('pageerror', error => report.errors.push({ engine, message: error.message })); // 未捕捉エラーを合否へ反映します。
    try { // ブラウザごとの結果を分けて残します。
      await check(engine, 'L02 HTTPSでSQLite起動', async () => { const response = await page.goto(url.href); assert.equal(response.status(), 200); await ready(page); assert.match(await page.locator('#environment').innerText(), /SQLite.*OPFS/); assert.match(await page.locator('#accountLabel').innerText(), /ゲスト/); }); // 本人ログインなしで実行を確認します。
      await check(engine, 'L03 二つの練習項目を保存', async () => { await page.locator('#title').fill('公開確認用の架空練習'); await page.locator('#goal').fill('検証用データの保持'); await page.locator('[data-field="name"]').first().fill('確認ドリルA'); await page.locator('#addItem').click(); await page.locator('[data-field="name"]').nth(1).fill('確認ドリルB'); await page.getByRole('button', { name: '端末に保存', exact: true }).click(); await page.waitForFunction(() => document.getElementById('notice').textContent.includes('この端末への保存が完了')); }); // 送信先のないゲストDBにのみ合成データを保存します。
      await check(engine, 'L04 再読込後に明細が一致', async () => { await page.reload(); await ready(page); await page.getByRole('button', { name: '保存した練習', exact: true }).click(); await page.locator('[data-open]').first().click(); await page.waitForFunction(() => document.getElementById('detail').hidden === false); assert.deepEqual(await page.locator('#detailItems h3').allTextContents(), ['確認ドリルA 10分', '確認ドリルB 10分']); }); // 表示だけでなく実際に永続化された内容を照合します。
      await check(engine, 'L05 振り返りを別保存', async () => { await page.locator('#reflection').fill('これは公開確認用の合成メモです'); await page.locator('#saveReflection').click(); await page.waitForFunction(() => document.getElementById('records').textContent.includes('公開確認用の合成メモ')); assert.equal(await page.locator('#detailItems article').count(), 2); }); // 練習計画を書き換えずに記録できることを確認します。
      await check(engine, 'L06 二重タブの入力を停止', async () => { const other = await context.newPage(); try { await other.goto(url.href); await other.waitForFunction(() => document.getElementById('notice').textContent.includes('別のタブ')); assert.equal(await other.locator('#title').isDisabled(), true); } finally { await other.close(); } }); // 同じDBへの衝突を防ぎます。
      await check(engine, 'L07 スコープと390px表示', async () => { await page.waitForFunction(() => document.getElementById('offlineStatus').textContent.includes('事前取得済み')); assert.equal(await page.locator('#redirectUri').innerText(), url.href); assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope), url.href); await page.setViewportSize({ width: 390, height: 844 }); const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })); assert(size.scroll <= size.width + 1); await page.screenshot({ path: 'reports/live/' + engine + '-mobile.png', fullPage: true }); }); // 物理iPhoneではなく実HTTPS上の画面幅を確認します。
    } catch (error) { report.errors.push({ engine, message: error.message }); await page.screenshot({ path: 'reports/live/' + engine + '-failure.png', fullPage: true }).catch(() => {}); } // 失敗時の実画面も残します。
    finally { await context.close(); } // 個人状態を持たない検証ブラウザを終了します。
  } // 全エンジンの確認を終えます。
} catch (error) { report.errors.push({ engine: 'setup-or-https', message: error.message }); } // 初期化や通信の失敗も記録します。
report.executed = report.results.length; report.passed = report.results.filter(item => item.status === 'passed').length; // 実行した件数だけを数えます。
report.status = report.executed === 13 && report.passed === 13 && report.errors.length === 0 ? 'passed' : 'failed'; // 未実行項目を成功扱いしません。
report.createdAt = new Date().toISOString(); await writeFile('reports/live/results.json', JSON.stringify(report, null, 2)); // 実際の検証証拠を保存します。
console.log(JSON.stringify(report, null, 2)); if (report.status !== 'passed') process.exitCode = 1; // 本人認証の完了とは別にCIの成否を返します。
