import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const app=process.argv[2],web=join(app,'web');
const pinned=JSON.parse(await readFile('production/release.json','utf8'));

for(const name of ['zero-one-update.js','zero-one-update.css'])await copyFile('production/safe-update/'+name,join(web,name));
let runtime=await readFile(join(web,'app.mjs'),'utf8');
const before="async function guard(fn){try{await fn();}catch(error){message(error.message||'操作に失敗しました。',true);if(initialized)try{refreshState(await request('state'));}catch{}}}";
assert(runtime.includes(before));runtime=runtime.replace(before,"async function guard(fn){zeroOneUpdateOperations++;try{await fn();}catch(error){message(error.message||'操作に失敗しました。',true);if(initialized)try{refreshState(await request('state'));}catch{}}finally{zeroOneUpdateOperations--;}}")
 .replace("registration.addEventListener('updatefound',()=>message('更新を検出しました。編集を保存してからこのアプリのすべてのタブを閉じると新しい版に切り替わります。'));",'');
const registrationBefore="const registration=await navigator.serviceWorker.register('./sw.js');";
assert(runtime.includes(registrationBefore));runtime=runtime.replace(registrationBefore,"const registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href).href)||(navigator.onLine&&!globalThis.ZeroOneUpdate?.authReturn(new URL(location.href))?await navigator.serviceWorker.register('./sw.js',{scope:new URL('./',location.href).href,updateViaCache:'none'}):null);if(!registration)return;");
const readyBefore="navigator.serviceWorker.ready.then(r=>r.active?.postMessage({type:'offlineCheck'}));";
assert(runtime.includes(readyBefore));runtime=runtime.replace(readyBefore,"navigator.serviceWorker.ready.then(r=>r.active?.postMessage({type:'offlineCheck'})).catch(()=>message('アプリ本体の事前取得は未完了です。通信復帰後に確認してください。',true));");
runtime=runtime.replace('let saving = false;','let saving = false; let zeroOneUpdateOperations=0;');
runtime+="\nwindow.ZeroOneUpdateGuard=()=>({ready:initialized,busy:Boolean(saving||sending||mediaImporting||referenceBusy||connecting||zeroOneUpdateOperations||timer?.running||mediaSession?.busy),dirty:Boolean(dirty||$('reflection').value.trim()||(currentDetail&&$('actualMinutes').value!==String(currentDetail.operation.body.payload.totalMinutes))||referenceTarget||document.querySelector('#canvasDialog[open],#referenceDialog[open]')),message:'編集中の練習・振り返りを保存し、入力画面を閉じてから更新してください。'});\n";
await writeFile(join(web,'app.mjs'),runtime);
const source=await readFile('production/safe-update/update-worker.js','utf8');await writeFile(join(web,'sw.js'),source.replace('__ZERO_ONE_APP__','PRACTICE').replace('__ZERO_ONE_CACHE_PREFIX__','zero-one-practice-lab-release-').replace('__ZERO_ONE_VERSION__',pinned.version));
await copyFile('production/brand-entry.js',join(web,'brand-entry.js')); // URL switching remains in practice-startup.js; brand entry never redirects.
for(const name of ['apple-touch-zero-one-180-20261007m.png','apple-touch-icon.png','apple-touch-icon-precomposed.png','safari-practice-180-20261007g.png','safari-practice-192-20261007g.png','favicon.ico','favicon-practice-20261007f.ico','favicon-practice-32-20261007f.png'])await copyFile(join('production/icons',name),join(web,name));

const files=[...new Set([...Object.keys(pinned.files).filter(name=>name!=='app-version.json'&&['.mjs','.js','.html','.css','.json','.wasm','.webmanifest','.svg','.png','.webp'].includes(extname(name))),'zero-one-update.js','zero-one-update.css','brand-entry.js','brand-logo.svg','apple-touch-zero-one-180-20261007m.png','apple-touch-icon.png','apple-touch-icon-precomposed.png','safari-practice-180-20261007g.png','safari-practice-192-20261007g.png','favicon.ico','favicon-practice-20261007f.ico','favicon-practice-32-20261007f.png'])];
const appAssets=files.filter(name=>['.mjs','.js','.html','.css','.json','.wasm','.webmanifest','.svg','.png','.webp'].includes(extname(name)));
const config=join(app,'tools/update-release.config.json');await writeFile(config,JSON.stringify({root:web,app:'PRACTICE',files:appAssets,worker:'sw.js',versionMount:'#settings'}));
execFileSync(process.execPath,['production/safe-update/build-update-release.mjs',config],{stdio:'inherit'});
execFileSync(process.execPath,['production/safe-update/build-update-release.mjs',config,'--check'],{stdio:'inherit'});

for(const name of ['safe-update.test.cjs','safe-update.browser.cjs','update-worker.fixture.js'])await copyFile('production/safe-update/'+name,join(app,'tests',name));
