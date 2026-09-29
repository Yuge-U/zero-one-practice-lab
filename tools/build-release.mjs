import { readFile, writeFile, mkdir, copyFile, lstat } from 'node:fs/promises'; // 公開対象のコードだけを扱います。
import { resolve, dirname, sep } from 'node:path'; // 保存先の境界を検査します。
import { createHash } from 'node:crypto'; // 検証済みのバイト列と照合します。
import { execFileSync } from 'node:child_process'; // 固定したソースの準備処理を実行します。
import assert from 'node:assert/strict'; // 不一致があれば公開前に停止します。
const root = process.cwd(); // 新しい公開用リポジトリを基準にします。
const lock = JSON.parse(await readFile(resolve(root, 'release-lock.json'), 'utf8')); // 承認済みの版と検査値を読みます。
assert.equal(lock.release, '0.3.2'); // 今回の公開候補以外を受け入れません。
assert.equal(lock.sourceRepository, 'Yuge-U/basketball-tactics-board'); // 元コードの所有者と保存先を確認します。
assert.equal(Object.keys(lock.files).length, 28); // 公開対象の抜けや追加を検出します。
const upstream = resolve(root, 'upstream'); // 既存アプリとは別の作業コピーを使用します。
const verifiedCommit = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); // 実際に取得した版を確認します。
assert.equal(verifiedCommit, lock.sourceCommit); // 可変ブランチの最新へ自動追随しません。
for (const script of ['practice-ui-lab/prepare-ui.mjs', 'practice-ui-lab/patch-ui-tests.mjs', 'practice-publication-lab/prepare-pages.mjs']) { // 過去の合格版と同じ手順を使います。
  execFileSync(process.execPath, [script], { cwd: upstream, stdio: 'inherit', timeout: 240000 }); // 固定ソースの検査を省略せず実行します。
} // アプリと試験の準備を終えます。
const web = resolve(upstream, 'practice-ui-lab/app/web'); // 公開可能な静的ファイルだけを選びます。
await copyFile(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(web, 'THIRD_PARTY_NOTICES.md')); // 元の第三者部品案内を同梱します。
const output = resolve(root, '_site'); // Pagesへ送る成果物を他の資料から分離します。
await mkdir(output, { recursive: true }); // 公開専用のフォルダを準備します。
const files = []; // 検査済みファイルの証拠を収集します。
for (const [name, expected] of Object.entries(lock.files)) { // 明示された28ファイルだけを公開します。
  const source = resolve(web, name); const target = resolve(output, name); // 読取元と公開先を求めます。
  assert(source.startsWith(web + sep) && target.startsWith(output + sep)); // 作業フォルダ外の指定を拒否します。
  assert((await lstat(source)).isFile()); // シンボリックリンクやディレクトリを公開しません。
  const bytes = await readFile(source); // 検証済み候補の実バイト列を読みます。
  const actual = createHash('sha256').update(bytes).digest('hex'); // ファイル全体の検査値を求めます。
  assert.equal(actual, expected, 'Release bytes differ: ' + name); // 1バイトでも異なれば配信を止めます。
  await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes); // 合致したコードだけを成果物へコピーします。
  files.push({ name, sha256: actual, bytes: bytes.length }); // 公開対象と検査結果だけを記録します。
} // ホワイトリストの検査を終えます。
await mkdir(resolve(root, 'reports'), { recursive: true }); // 証拠は公開フォルダの外へ保存します。
await writeFile(resolve(root, 'reports/release-build.json'), JSON.stringify({ release: lock.release, sourceCommit: verifiedCommit, files, personalDataIncluded: false, realMicrosoft: false, createdAt: new Date().toISOString() }, null, 2)); // 個人データを含まないビルド記録を保存します。
console.log('Verified 28 exact v0.3.2 files. Deployment is performed only after browser tests pass.'); // ビルド成功と公開成功を区別します。
