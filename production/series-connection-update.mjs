import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const web = join(resolve(process.argv[2]), 'web');
function replace(text, before, after) {
  assert.equal(text.split(before).length - 1, 1, 'Shared connection patch mismatch: ' + before.slice(0, 100));
  return text.replace(before, after);
}
function replaceLine(text, pattern, after) {
  const matches = text.match(pattern);
  assert.equal(matches?.length, 1, 'Shared connection line mismatch: ' + pattern);
  return text.replace(pattern, after);
}
for (const name of ['zero-one-connection.js', 'zero-one-connection.css']) await copyFile('production/' + name, join(web, name));
let app = await readFile(join(web, 'app.mjs'), 'utf8');
app = "import './zero-one-connection.js';\n" + app;
app = replace(app, 'auth.account&&!auth.needsInteraction&&!chooseAccount', "auth.account&&!auth.needsInteraction&&auth.lastErrorCode!=='PERMISSION'&&!chooseAccount");
// Preserve draft checks and database shutdown in the common sign-out action.
app = replace(app, "$('signOut').onclick=", 'const seriesSignOut=');
app = replaceLine(app, /^\$\('signIn'\)\.onclick=.*$/gm, '');
app = replaceLine(app, /^\$\('connectCloud'\)\.onclick=.*$/gm, '');
app = replaceLine(app, /^function accountStatus\(\).*$/gm, `function accountStatus(){
  $('accountLabel').textContent=auth.account?auth.account.username:auth.offlineScope?'前回の端末記録を利用中（未認証）':'未接続 · この端末のみ';
  $('openOffline').disabled=Boolean(auth.account)||!auth.lastOfflineScope();
  $('rememberAccount').checked=auth.remember?.()??true;

  updateSeriesConnection();
}`);
app += `
const seriesConnection = globalThis.ZeroOneConnection.create({
  mount: '#zeroOneConnection',
  connect: () => connectionAction(), retry: () => connectionAction(),
  switchAccount: () => connectionAction(true), signOut: seriesSignOut,
  presentation: 'compact', sync: () => guard(synchronize), syncId: 'syncNow', extra: '.statusbar',
  settings: () => { if(dirty)message('編集内容はまだ端末保存していません。作成画面に戻って保存してください。');page('settings'); }
});
function updateSeriesConnection(){
  const status=auth.connectionStatus?.()||{state:auth.initError?'error':auth.needsInteraction?'auth':auth.account?'connected':'disconnected',username:auth.account?.username||'',account:Boolean(auth.account)};
  // Authentication and the account's sync folder must both be ready.
  if(status.state==='connected'&&!cloudReady){status.state=connectionFlight||connecting?'connecting':'error';status.detail='OneDriveの保存先を確認してください。';}
  const view=syncView(state?{...state,lastError:syncFailure||state.lastError}:state,{connected:cloudReady,busy:sending,online:navigator.onLine,account:Boolean(auth.account)});
  const syncState=sending?'busy':!navigator.onLine?'offline':view.tone==='error'?'error':view.title.includes('競合')?'conflict':view.title.includes('同期待ち')?'pending':view.title.includes('同期済み')?'synced':view.tone==='warning'?'conflict':'idle';
  const media=mediaSession?.summary();
  const mediaState=cloudReady&&!sending&&media?.count?(media.error?'error':media.busy?'busy':media.pending?'pending':null):null;
  seriesConnection.update({...status,busy:connecting||sending||saving,disabled:!initialized,syncAvailable:cloudReady,syncDisabled:!navigator.onLine,sync:{state:mediaState||syncState,title:view.title,detail:view.detail,action:view.action}});
}
auth.onStatusChange?.(updateSeriesConnection);
`;
app = replace(app, "$('syncNow').onclick=()=>guard(synchronize);", '');
app = replace(app, "function message(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}", "function message(text,error=false){if(!error&&(/^(OneDriveと同期中|本人のOneDrive保存領域に接続|オフラインです|端末保存の準備ができました)/.test(text)||text===draftWarning(true)))text='';$('notice').textContent=text;$('notice').hidden=!text;$('notice').classList.toggle('error',error);}");
app = app.replaceAll('「接続・バックアップ」から', '上部の雲アイコンから');
await writeFile(join(web, 'app.mjs'), app);
let html = await readFile(join(web, 'index.html'), 'utf8');
html = replace(html, '</head>', '<link rel="stylesheet" href="./zero-one-connection.css?v=20261008-hub"></head>');
html = replace(html, '<button data-tab="settings">接続・バックアップ</button>', '<span id="zeroOneConnection" aria-label="OneDrive接続・同期・バックアップ"></span>');
html = replace(html, '<button id="syncNow" disabled>今すぐ同期</button>', '');
html = replace(html, '<p id="notice" class="notice" role="status">', '<p id="notice" class="notice" role="status" hidden>');
let css = await readFile(join(web, 'series.css'), 'utf8');
css += '\n.rail nav{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 60px;align-items:stretch}.rail nav .zoc-primary{height:100%}.zoc-dialog .statusbar{display:block;position:static;margin:12px 0;padding:12px;border-radius:10px;max-height:none;box-shadow:none}.zoc-dialog .statusbar .sync-copy{display:flex;flex-direction:column;gap:6px}.zoc-dialog .statusbar .sync-actions{display:none}.zoc-dialog .statusbar small{display:block;margin-top:8px}.zoc-dialog .statusbar [hidden]{display:none}#notice[hidden]{display:none}\n';
await writeFile(join(web, 'series.css'), css);
// The common control is the sole authentication entry, including on settings pages.
for (const id of ['quickConnect', 'connectCloud', 'signIn', 'signOut']) {
  const pattern = new RegExp('<button id="' + id + '"[^>]*>[^<]*</button>', 'g');
  assert.equal(html.match(pattern)?.length, 1, 'Legacy connection button missing: ' + id);
  html = html.replace(pattern, '');
}
html = replace(html, '<summary>接続設定・サインアウト</summary>', '<summary>端末の保存設定</summary>');
await writeFile(join(web, 'index.html'), html);
let sw = await readFile(join(web, 'sw.js'), 'utf8');
sw = replace(sw, "'./auth.mjs'", "'./auth.mjs','./zero-one-connection.js','./zero-one-connection.css'");
await writeFile(join(web, 'sw.js'), sw);
// Existing browser regressions exercise the new common entry instead of removed buttons.
for (const name of ['connection-browser.mjs', 'catalog-browser.mjs', 'save-status-browser.mjs', 'sync-latency-browser.mjs', 'reference-browser.mjs', 'media-browser.mjs', 'production-browser.mjs', 'production-scenarios.mjs', 'upgrade-check.mjs']) {
  const file = join(resolve(process.argv[2]), 'tools', name);
  let script = await readFile(file, 'utf8');
  script = script.replaceAll("'#connectCloud'", "'#zeroOneConnection .zoc-primary'")
    .replaceAll("'#quickConnect'", "'#zeroOneConnection .zoc-primary'")
    .replaceAll("document.getElementById('quickConnect')", "document.querySelector('#zeroOneConnection .zoc-primary')");
  script = "import {connectFromMenu,syncFromMenu,openSettings,menuText,menuVisible,menuBox} from './connection-menu-test.mjs';\n" + script;
  script = script.replaceAll("await page.getByRole('button',{name:'接続・バックアップ',exact:true}).click()", 'await openSettings(page)')
    .replaceAll("await page.locator('#zeroOneConnection .zoc-primary').click()", 'await connectFromMenu(page)')
    .replaceAll("await second.locator('#zeroOneConnection .zoc-primary').click()", 'await connectFromMenu(second)')
    .replaceAll("await page.locator('#syncNow').click()", 'await syncFromMenu(page)')
    .replaceAll("page.locator('#storageStatus').innerText()", "menuText(page,'#storageStatus')")
    .replaceAll("page.locator('#connectionStatus').innerText()", "menuText(page,'#connectionStatus')")
    .replaceAll("page.locator('#draftSyncHint').isVisible()", "menuVisible(page,'#draftSyncHint')")
    .replaceAll("page.locator('.statusbar').boundingBox()", "menuBox(page,'.statusbar')")
    .replaceAll("document.querySelector('#zeroOneConnection .zoc-primary').textContent==='再接続'", "document.querySelector('#zeroOneConnection').dataset.state==='auth'");
  await writeFile(file, script);
}

await copyFile('production/connection-menu-test.mjs', join(resolve(process.argv[2]), 'tools/connection-menu-test.mjs'));
