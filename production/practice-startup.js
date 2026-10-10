(function (root) {
  'use strict';
  const get = id => document.getElementById(id);
  const dialog = get('practiceStartupDialog'), notice = get('practiceStartupNotice');
  if (!dialog || !notice) return;
  let phase = 'files', finished = false, failed = false, attempt = 0, executing = false, reloadGuard = null;
  const labels = { files: 'アプリの読み込み', account: '接続の確認', storage: '端末保存の準備' };
  const version = document.querySelector('.rail .version')?.textContent.match(/\d+\.\d+\.\d+\s*$/)?.[0].trim() || 'current';
  function show(message, error = false) {
    get('practiceStartupMessage').textContent = message;
    get('practiceStartupNoticeText').textContent = message;
    notice.hidden = false; notice.dataset.error = String(error);
  }
  function code(error) { return ['SecurityError', 'TypeError', 'SyntaxError', 'QuotaExceededError', 'NotAllowedError', 'NotSupportedError'].includes(error?.name) ? error.name : 'StartupError'; }
  function fail(error) {
    if (finished) return;
    failed = true; clearTimeout(slow);
    const kind = code(error);
    const message = kind === 'SecurityError' ? 'SafariのWebサイトデータへのアクセスを確認してください。保存データを削除せず、プライバシー設定やコンテンツブロッカーを確認してから再読み込みしてください。'
      : phase === 'files' ? 'アプリを読み込めませんでした。通信やSafariのコンテンツブロッカーを確認してから再読み込みしてください。'
      : 'アプリの準備を完了できませんでした。ほかのPRACTICEタブを閉じてから再読み込みしてください。';
    show(message, true);
    get('practiceStartupCode').textContent = '確認箇所：' + labels[phase] + ' / ' + kind;
    get('practiceStartupReload').hidden = false;
    const cloud = get('practiceStartupCloud'); if (cloud) cloud.querySelector('.zoc-caption').textContent = '要確認';
    const storage = get('storageStatus'); if (storage) storage.textContent = 'アプリの起動を完了できませんでした。';
    // Report only a fixed category. Never export an exception message, URL or token.
    root.PracticeStartup.state = { phase, status: 'failed', code: kind, attempt };
  }
  function ready() {
    if (finished) return;
    finished = true; failed = false; clearTimeout(slow); notice.hidden = true;
    root.PracticeStartup.state = { phase: 'ready', status: 'ready', attempt };
    if (dialog.open) { get('practiceStartupMessage').textContent = '準備ができました。雲アイコンから接続・同期を利用できます。'; get('practiceStartupCode').textContent = ''; get('practiceStartupReload').hidden = true; get('practiceStartupOpen').hidden = false; }
  }
  root.PracticeStartup = { state: { phase, status: 'loading', attempt }, guard(callback) { reloadGuard = callback; }, executing() { executing = true; }, phase(value) { if (!finished && labels[value]) { phase = value; root.PracticeStartup.state.phase = phase; get('practiceStartupMessage').textContent = labels[phase] + 'をしています…'; } }, ready, fail };
  get('practiceStartupCloud').onclick = () => dialog.showModal();
  get('practiceStartupClose').onclick = () => dialog.close();
  function reload() { if (reloadGuard && !reloadGuard()) { show('編集中の内容を保存し、保存・写真や動画の取込が終わってから再読み込みしてください。', true); return; } root.location.reload(); }
  get('practiceStartupReload').onclick = reload; get('practiceStartupNoticeReload').onclick = reload;
  get('practiceStartupOpen').onclick = () => { dialog.close(); document.querySelector('#zeroOneConnection .zoc-primary')?.click(); };
  const slow = setTimeout(() => { if (!finished && !failed) { show(labels[phase] + 'に時間がかかっています。処理は続いています。続く場合は再読み込みしてください。'); get('practiceStartupReload').hidden = false; root.PracticeStartup.state.status = 'slow'; } }, 15000);
  async function load() {
    attempt++; root.PracticeStartup.state.attempt = attempt;
    try { await import('./app.mjs'); }
    catch (error) {
      // A module download can fail before the app executes. Retry once only there;
      // never repeat partially executed startup, authentication or database writes.
      if (code(error) === 'TypeError' && !executing) {
        attempt++; root.PracticeStartup.state.attempt = attempt;
        try { await import('./app.mjs?startup-retry=' + encodeURIComponent(version)); return; } catch (retryError) { error = retryError; }
      }
      fail(error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true }); else load();
})(globalThis);
