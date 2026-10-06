import { test } from 'node:test'; // 構造回帰をビルドの前に検査します。
import assert from 'node:assert/strict'; // 不一致を明確な失敗にします。
import { resolveAppleTouchIcon, assertApplePng } from '../icon-contract.mjs'; // 本番と同じ検査関数を使用します。
import { runSuites } from '../browser-runner.mjs'; // 終了コードの集約を検証します。
const base = 'https://yuge-u.github.io/zero-one-practice-lab/'; // 合成URLだけを使います。
for (const href of ['./icons/apple-touch-icon.png', './icons/apple-touch-icon.png?v=20261006d', './icons/apple-touch-icon.png?v=approved-20261006', '/zero-one-practice-lab/icons/apple-touch-icon.png?v=1.0']) { // 従来形式と更新番号付きの回帰を作ります。
  test('accept icon reference: ' + href, () => assert.equal(new URL(resolveAppleTouchIcon(href, base)).pathname, '/zero-one-practice-lab/icons/apple-touch-icon.png')); // 同じ画像の更新を誤検出しません。
} // 正常な参照の検査を閉じます。
for (const href of [null, '', ' ', './icons/missing.png', '../icons/apple-touch-icon.png', 'https://example.com/zero-one-practice-lab/icons/apple-touch-icon.png', 'data:image/png;base64,AA==', './icons/apple-touch-icon.png?v=', './icons/apple-touch-icon.png?x=1', './icons/apple-touch-icon.png?v=1&v=2', './icons/apple-touch-icon.png?v=1#other', './icons/apple-touch-icon.png?v=%2F']) { // 不正な参照の境界条件を検証します。
  test('reject icon reference: ' + String(href), () => assert.throws(() => resolveAppleTouchIcon(href, base))); // 別画像や不正URLを合格にしません。
} // 不正参照の検査を閉じます。
function header() { const bytes = Buffer.alloc(40); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(13, 8); bytes.write('IHDR', 12); bytes.writeUInt32BE(180, 16); bytes.writeUInt32BE(180, 20); return bytes; } // 寸法検査専用の合成ヘッダーを作ります。
test('PNG header contract accepts correct dimensions', () => assert.doesNotThrow(() => assertApplePng(header()))); // 復号試験とは別の構造検査です。
test('PNG header contract rejects HTML', () => assert.throws(() => assertApplePng(Buffer.from('<html>' + 'x'.repeat(60))))); // 200応答のHTMLでも不合格にします。
test('PNG header contract rejects truncated bytes', () => assert.throws(() => assertApplePng(Buffer.alloc(8)))); // 欠損を検出します。
test('PNG header contract rejects wrong dimensions', () => { const bytes = header(); bytes.writeUInt32BE(192, 16); assert.throws(() => assertApplePng(bytes)); }); // 別サイズへの置換を検出します。
test('all suites passing returns zero', () => assert.equal(runSuites(() => ({ status: 0 })), 0)); // 正常終了を確認します。
test('first failure survives a successful upgrade', () => { const calls = []; assert.equal(runSuites(name => { calls.push(name); return { status: calls.length === 1 ? 1 : 0 }; }), 1); assert.equal(calls.length, 2); }); // 後続成功で前の失敗を消しません。
test('upgrade failure blocks release', () => assert.equal(runSuites(name => ({ status: name.startsWith('upgrade') ? 1 : 0 })), 1)); // 更新時のデータ保持を必須にします。
test('signal or process startup failure blocks release', () => assert.equal(runSuites(() => ({ status: null, signal: 'SIGTERM' })), 1)); // 異常終了を成功扱いしません。
test('live suite never pretends to run local upgrade', () => { const calls = []; assert.equal(runSuites(name => { calls.push(name); return { status: 0 }; }, true), 0); assert.deepEqual(calls, ['production-scenarios.mjs']); }); // 実行範囲を正確に保ちます。

test("accept dedicated Safari artwork", () => assert.equal(new URL(resolveAppleTouchIcon("./safari-practice-180-20261007g.png", base)).pathname, "/zero-one-practice-lab/safari-practice-180-20261007g.png"));
test("reject another app Safari artwork", () => assert.throws(() => resolveAppleTouchIcon("../zero-one-roster/safari-roster-180-20261007g.png", base)));
