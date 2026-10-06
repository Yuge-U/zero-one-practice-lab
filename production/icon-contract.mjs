import assert from 'node:assert/strict'; // 不正な参照や画像を合格にしません。
export function resolveAppleTouchIcon(href, pageURL) { // 更新番号と画像本体の参照を分けて検証します。
  assert.equal(typeof href, 'string', 'Apple touch icon reference is missing'); // 未指定を拒否します。
  assert(href.length > 0 && href === href.trim(), 'Invalid icon reference'); // 空値と曖昧な空白を拒否します。
  const expected = new URL('./icons/apple-touch-icon.png', pageURL); // 現在のアプリ専用パスを基準にします。
  const actual = new URL(href, pageURL); // 相対URLをブラウザと同じ方法で解決します。
  assert(['http:', 'https:'].includes(actual.protocol), 'Invalid icon protocol'); // 埋込データや実行可能URLを拒否します。
  assert.equal(actual.origin, expected.origin, 'Icon must stay on the app origin'); // 外部サイトへの置換を拒否します。
  assert.equal(actual.pathname, expected.pathname, 'Unexpected Apple touch icon path'); // 別アプリや別画像への参照を拒否します。
  assert(!actual.username && !actual.password && !actual.hash, 'Unexpected icon URL components'); // 資格情報とフラグメントを許可しません。
  const parameters = [...actual.searchParams]; // 更新番号だけを個別に調べます。
  assert(parameters.length <= 1, 'Duplicate or extra icon parameters'); // 重複した更新番号や余分な指定を拒否します。
  for (const [key, value] of parameters) { // 許可する更新番号の形式を固定します。
    assert.equal(key, 'v', 'Only the icon version parameter is allowed'); // 更新番号以外を拒否します。
    assert(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value), 'Invalid icon version'); // 安全な版名だけを受け付けます。
  } // 更新番号の検査を閉じます。
  return actual.href; // 検証済みの実URLを返します。
} // URLの契約を閉じます。
export function assertApplePng(bytes) { // 拡張子ではなくPNG本体を調べます。
  const data = Buffer.from(bytes); // バイト列として扱います。
  assert(data.length > 32, 'Apple touch icon is empty or truncated'); // 空ファイルを拒否します。
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Not a PNG image'); // PNGシグネチャを確認します。
  assert.equal(data.readUInt32BE(8), 13, 'Invalid PNG IHDR length'); // 画像ヘッダーの構造を確認します。
  assert.equal(data.subarray(12, 16).toString('ascii'), 'IHDR', 'Missing PNG IHDR'); // 寸法を読み取る場所を確認します。
  assert.equal(data.readUInt32BE(16), 180, 'Unexpected Apple icon width'); // iPhone用の幅を確認します。
  assert.equal(data.readUInt32BE(20), 180, 'Unexpected Apple icon height'); // iPhone用の高さを確認します。
} // PNGの契約を閉じます。
export async function verifyAppleTouchIcon(page) { // 実ブラウザで参照と画像の読み込みを検査します。
  const link = page.locator('link[rel="apple-touch-icon"]'); // 専用のアイコン指定を選択します。
  assert.equal(await link.count(), 1, 'Exactly one Apple touch icon is required'); // 競合する複数指定を拒否します。
  const url = resolveAppleTouchIcon(await link.getAttribute('href'), page.url()); // 更新番号を許容しつつ正しいパスを必須にします。
  const response = await page.request.get(url); // 公開対象の画像本体を取得します。
  assert(response.ok(), 'Apple touch icon HTTP error: ' + response.status()); // 画像の取得失敗を見逃しません。
  assert.equal(response.url(), url, 'Unexpected icon redirect'); // 別の画像への転送を拒否します。
  assert.match(response.headers()['content-type'] || '', /^image\/png(?:;|$)/i); // HTMLの代替応答を拒否します。
  assertApplePng(await response.body()); // 実ファイルの形式と寸法も確認します。
  const size = await page.evaluate(async source => { // ブラウザ内でも画像を復号します。
    const image = new Image(); // 保存領域には触れない検査用画像を作ります。
    image.src = source; // 検証済みのURLだけを読みます。
    await image.decode(); // 破損したPNGやCSPによる拒否を検出します。
    return [image.naturalWidth, image.naturalHeight]; // 実際に復号した寸法を返します。
  }, url); // 実ブラウザの読み込みを完了させます。
  assert.deepEqual(size, [180, 180], 'Apple touch icon failed to decode'); // 復号まで成功した場合だけ合格にします。
} // 実画像検証を閉じます。
