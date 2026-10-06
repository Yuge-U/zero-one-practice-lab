import { readFile, writeFile, mkdir } from 'node:fs/promises'; // 画像ファイルだけを処理します。
import { createHash } from 'node:crypto'; // 転送前後の一致を検証します。
import assert from 'node:assert/strict'; // 相違のある画像を本番へ渡しません。
const manifest = JSON.parse(await readFile('branding/import/manifest.json', 'utf8')); // 承認済みのハッシュを読みます。
await mkdir('branding/import/evidence', { recursive: true }); // 入力と検証結果の証拠を保存します。
const results = []; // 実際の転送結果だけを記録します。
for (const asset of manifest.assets) { // 指定された画像だけを扱います。
  assert(/^[a-z0-9-]+\.webp$/.test(asset.name)); // パスを固定範囲へ制限します。
  let bytes = await readFile('branding/import/' + asset.name); // 検証用ブランチの受信画像を読みます。
  const receivedSha256 = createHash('sha256').update(bytes).digest('hex'); // 受信したバイトのハッシュを記録します。
  await writeFile('branding/import/evidence/' + asset.name, bytes); // 未加工の受信画像を証拠に残します。
  if (asset.base64Repairs?.length) { // 転送文字列の誤りだけを指定位置で修復します。
    assert.equal(receivedSha256, asset.receivedSha256, 'Unexpected input; repair aborted'); // 入力が異なる場合は修復しません。
    let text = bytes.toString('base64'); // 符号化時の文字ずれを検証します。
    let end = text.length; // 後ろからの修正で位置の変化を避けます。
    for (const repair of [...asset.base64Repairs].sort((a,b) => b.offset-a.offset)) { // 正確な位置に限定して修復します。
      assert(Number.isInteger(repair.offset) && repair.offset >= 0 && repair.offset + repair.before.length <= end); // 重複範囲と範囲外を拒否します。
      assert.equal(text.slice(repair.offset, repair.offset + repair.before.length), repair.before, 'Unexpected transfer text'); // あいまいな置換を行いません。
      text = text.slice(0, repair.offset) + repair.after + text.slice(repair.offset + repair.before.length); // 指定範囲のみ置換します。
      end = repair.offset; // 次の修正範囲の上限を更新します。
    } // 指定箇所の修復を閉じます。
    bytes = Buffer.from(text, 'base64'); // 原本ハッシュを確認するためバイトへ戻します。
  } // 入力修復を閉じます。
  const actual = createHash('sha256').update(bytes).digest('hex'); // 修復後も原本一致を必須にします。
  const result = { name: asset.name, bytes: bytes.length, receivedSha256, sha256: actual, expected: asset.sha256, matched: actual === asset.sha256 }; // 診断情報だけを記録します。
  results.push(result); // 不一致も証拠として残します。
  if (!result.matched) continue; // 不一致の画像はGitオブジェクトとして登録しません。
  assert.equal(bytes.subarray(0,4).toString('ascii'), 'RIFF'); // WebPの先頭形式を確認します。
  assert.equal(bytes.subarray(8,12).toString('ascii'), 'WEBP'); // 別形式のファイルを拒否します。
  const response = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + '/git/blobs', { method:'POST', signal:AbortSignal.timeout(30000), headers:{ Authorization:'Bearer '+process.env.GITHUB_TOKEN, Accept:'application/vnd.github+json', 'Content-Type':'application/json', 'X-GitHub-Api-Version':'2022-11-28' }, body:JSON.stringify({content:bytes.toString('base64'),encoding:'base64'}) }); // 一致した画像だけを同じリポジトリへ登録します。
  assert(response.ok === true, 'Image object upload failed: ' + response.status); // ネイティブFetchのokは関数ではなく真偽値です。
  const data = await response.json(); // 実際に登録されたGitオブジェクトを受け取ります。
  const expectedGitSha = createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'); // Gitと同じ方法でオブジェクトIDを計算します。
  assert.equal(data.sha, expectedGitSha, 'Git object mismatch'); // サーバー側の一致も検証します。
  result.gitBlobSha = data.sha; // 後続の原子的な反映に利用するIDだけを残します。
  await writeFile('branding/import/evidence/' + asset.name, bytes); // 一致した画像を最終証拠へ残します。
} // 画像処理を閉じます。
await writeFile('branding/import/evidence/results.json', JSON.stringify(results,null,2)); // 受信から検証までを追跡可能にします。
console.log(JSON.stringify(results,null,2)); // ハッシュと合否だけをログへ出します。
assert(results.every(result => result.matched && result.gitBlobSha), 'Artwork transfer mismatch; production remains unchanged'); // 全画像が一致するまで本番反映を許可しません。
