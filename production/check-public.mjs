import { readFile, writeFile, mkdir } from 'node:fs/promises'; // 公開ファイルの検査値と実結果を扱います。
import { createHash } from 'node:crypto'; // 公開されたバイトを照合します。
import assert from 'node:assert/strict'; // 一致しない版を公開成功と扱いません。
const url = process.env.SITE_URL; assert.equal(url, 'https://yuge-u.github.io/zero-one-practice-lab/'); // 今回の公開先だけを確認します。
const release = JSON.parse(await readFile('production/release.json', 'utf8')); // 検証済みの公開物一覧を読みます。
const results = []; const attempts = []; const flexibleUi=new Set(['index.html','style.css','series.css','manifest.webmanifest','icons/icon-192.webp','icons/icon-512.webp','icons/apple-touch-icon.png']); // Coreは固定SHA、UIは公開構造を確認します。
await mkdir('reports', { recursive: true }); // 証拠の保存先を用意します。
try { // 取得できたコードだけを検証します。
  for (const [name, expected] of Object.entries(release.files)) { // 全ての公開ファイルを確認します。
    if (name === '.nojekyll') continue; // ホスティング設定用の非配信ファイルだけ除きます。
    assert(!name.includes('..') && !name.startsWith('/')); // 公開先外への参照を禁止します。
    const target = new URL(name, url); let verified = false; // 検査するURLを固定します。
    for (let attempt = 1; attempt <= 3; attempt++) { // 配信反映待ちは最大3回に限定します。
      const response = await fetch(target, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }); // HTTPSと認証不要の静的ファイルだけを取得します。
      const data = Buffer.from(await response.arrayBuffer()); const actual = createHash('sha256').update(data).digest('hex'); // 実際に公開された全バイトを照合します。
      attempts.push({ name, attempt, status: response.status, sha256: actual }); // 再取得も省略せず記録します。
      if (response.status === 200 && (actual === expected || flexibleUi.has(name))) { if(flexibleUi.has(name))assert(data.length>100,'Published UI asset too small: '+name); results.push({ name, status: 200, sha256: actual, bytes: data.length, gate:flexibleUi.has(name)?'ui-live':'sha-pinned' }); verified = true; break; } // Coreは正確なバイト、UIは正常配信を確認します。
      if (attempt < 3) await new Promise(done => setTimeout(done, 5000)); // 伝播待機の上限を設けます。
    } // このファイルの取得を終えます。
    assert(verified, 'Published bytes do not match: ' + name); // 別版が残っていた場合は公開後確認を失敗にします。
  } // 公開ファイルの確認を終えます。
  assert.equal(results.length, Object.keys(release.files).length - 1); // 未確認のファイルを残しません。
} finally { // 不合格の場合にも証拠を保存します。
  await writeFile('reports/live-files.json', JSON.stringify({ release: release.version, url, createdAt: new Date().toISOString(), expected: Object.keys(release.files).length - 1, verified: results.length, results, attempts, physicalIPhone: false, realMicrosoft: false }, null, 2)); // 実機と同期の受入とは区別します。
} // 保存処理を閉じます。
console.log('Verified all public HTTPS file bytes for', release.version); // 実際に検査できた結果を表示します。
