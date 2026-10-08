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
  $('syncNow').hidden=!cloudReady;
  updateSeriesConnection();
}`);
app += `
const seriesConnection = globalThis.ZeroOneConnection.create({
  mount: '#zeroOneConnection',
  connect: () => connectionAction(), retry: () => connectionAction(),
  switchAccount: () => connectionAction(true), signOut: seriesSignOut,
  settings: () => page('settings')
});
function updateSeriesConnection(){
  const status=auth.connectionStatus?.()||{state:auth.initError?'error':auth.needsInteraction?'auth':auth.account?'connected':'disconnected',username:auth.account?.username||'',account:Boolean(auth.account)};
  // Authentication and the account's sync folder must both be ready.
  if(status.state==='connected'&&!cloudReady){status.state=connectionFlight||connecting?'connecting':'error';status.detail='OneDriveの保存先を確認してください。';}
  seriesConnection.update({...status,busy:connecting||sending||saving,disabled:!initialized});
}
auth.onStatusChange?.(updateSeriesConnection);
`;
await writeFile(join(web, 'app.mjs'), app);
let html = await readFile(join(web, 'index.html'), 'utf8');
html = replace(html, '</head>', '<link rel="stylesheet" href="./zero-one-connection.css?v=20261008-login2"></head>');
html = replace(html, '<main>', '<main><section id="zeroOneConnection" aria-label="OneDrive接続"></section>');
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
for (const name of ['connection-browser.mjs', 'catalog-browser.mjs', 'save-status-browser.mjs', 'sync-latency-browser.mjs', 'reference-browser.mjs', 'media-browser.mjs', 'production-browser.mjs', 'production-scenarios.mjs']) {
  const file = join(resolve(process.argv[2]), 'tools', name);
  let script = await readFile(file, 'utf8');
  script = script.replaceAll("'#connectCloud'", "'#zeroOneConnection .zoc-primary'")
    .replaceAll("'#quickConnect'", "'#zeroOneConnection .zoc-primary'")
    .replaceAll("document.getElementById('quickConnect')", "document.querySelector('#zeroOneConnection .zoc-primary')");
  await writeFile(file, script);
}
