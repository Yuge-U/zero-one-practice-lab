import {chromium,webkit} from 'playwright'; // 実ブラウザで画面と保存を確認します。
import assert from 'node:assert/strict'; // 未確認の状態を成功としません。
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises'; // 合成データの検証結果だけを保存します。
import {join} from 'node:path'; // 証拠とブラウザを分離します。
import {tmpdir} from 'node:os'; // 他の端末の保存領域と分離します。
import {createServer} from './serve-project.mjs'; // 既存と同じサブパスでアプリを配信します。
const live=process.env.SITE_URL;let server,url=live;const results=[],errors=[];const reports=live?'reports/save-status-live':'reports/save-status';await mkdir(reports,{recursive:true}); // 公開前と実URLの結果を分けます。
if(live)assert.equal(live,'https://yuge-u.github.io/zero-one-practice-lab/');else{server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));url=`http://127.0.0.1:${server.address().port}/zero-one-practice-lab/`;} // 公開先を限定し本人クラウドは使いません。
const syntheticAuth=`export class Auth { // CI専用の架空アカウントです。
 constructor(){this.account={username:'synthetic@example.invalid'};this.client={};this.redirectUri=new URL('./',location.href).href;} // 本人トークンを取りません。
 async init(){} scope(){return 'ms-'+'a'.repeat(64);} async token(){return 'synthetic-not-a-real-token';} lastOfflineScope(){return null;} // 保存の本体は実SQLiteのままです。
}`; // 認証のみ合成し、HTTP通信と永続保存は実ブラウザを通します。
async function record(engine,name,fn){await fn();results.push({engine,name,pass:true});console.log('PASS',engine,name);} // 失敗時は以後を成功に数えません。
try{for(const [engine,type]of Object.entries({chromium,webkit})){ // 両エンジンで同じ画面遷移を検査します。
 const home=await mkdtemp(join(tmpdir(),'practice-save-status-'));const context=await type.launchPersistentContext(join(home,'profile'),{headless:true,viewport:{width:390,height:844},hasTouch:true,env:{...process.env,HOME:home,CFFIXED_USER_HOME:home,XDG_DATA_HOME:join(home,'data'),XDG_CACHE_HOME:join(home,'cache'),XDG_CONFIG_HOME:join(home,'config')}}); // WebKitのOS共有保存も分離します。
 const files=new Map();let folder=false,failure=false,hold=false;let releaseHold;let held=new Promise(done=>{releaseHold=done;});const meta=(name)=>({id:name,name,file:{},size:Buffer.byteLength(files.get(name)||'')}); // 合成OneDriveのファイルだけをメモリへ保管します。
 await context.route('**/*',async route=>{ // ネイティブfetchの後段だけで合成Graph応答を返します。
  const request=route.request(),target=new URL(request.url()),local=new URL(url);const reply=(status,value)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value),headers:{'Access-Control-Allow-Origin':'*'}}); // 認証情報を外部へ転送しません。
  if(target.origin===local.origin){if(target.pathname===local.pathname+'auth.mjs')return route.fulfill({status:200,contentType:'text/javascript',body:syntheticAuth});return route.continue();} // 本体コード・SQLiteは通常の配信を使います。
  if(!['graph.microsoft.com','zero-one-synthetic.1drv.com'].includes(target.hostname))return route.abort(); // 未定義の外部宛先は拒否します。
  if(hold)await held;if(failure)return route.abort('failed'); // 長い同期と通信失敗を制御して表示を確認します。
  const path=decodeURIComponent(target.pathname);if(target.hostname==='zero-one-synthetic.1drv.com'){const name=path.slice(1);assert(!request.headers().authorization);if(!files.has(name))return reply(404,{});return route.fulfill({status:200,contentType:'application/json',body:files.get(name),headers:{'Access-Control-Allow-Origin':'*'}});} // 事前認証URLにBearerを送らないことも確認します。
  assert.equal(request.headers().authorization,'Bearer synthetic-not-a-real-token'); // 本人の秘密情報ではないことを保証します。
  if(path.endsWith('/special/approot'))return reply(200,{id:'root',folder:{}}); // アプリ領域の取得です。
  if(path.endsWith('/items/root/children')){if(request.method()==='POST'){folder=true;return reply(201,{id:'folder',folder:{}});}return reply(200,{value:folder?[{id:'folder',name:'ZERO_ONE_PRACTICE_LAB_V02',folder:{}}]:[]});} // 接続の明示同意と作成を再現します。
  if(path.endsWith('/items/folder/children'))return reply(200,{value:[...files.keys()].map(meta)}); // 保存した合成記録の一覧を返します。
  const match=/\/items\/folder:\/(.+?)(:\/content)?$/.exec(path);if(match){const name=match[1];if(match[2]&&request.method()==='PUT'){files.set(name,request.postData());return reply(201,meta(name));}return files.has(name)?reply(200,meta(name)):reply(404,{});} // 本体の保存形式で書込と読戻しを確認します。
  const name=path.split('/items/')[1];if(name&&files.has(name))return reply(200,{...meta(name),'@microsoft.graph.downloadUrl':'https://zero-one-synthetic.1drv.com/'+encodeURIComponent(name)}); // ハッシュ検証用の署名済みURLを模擬します。
  return reply(404,{}); // 不明な要求を成功に変えません。
 }); // 合成ネットワークの準備を閉じます。
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push({engine,message:e.message}));const title=()=>page.locator('#storageStatus').innerText();const waitTitle=text=>page.waitForFunction(text=>document.getElementById('storageStatus').textContent.includes(text),text,{timeout:20000});const saved=()=>page.waitForFunction(()=>document.getElementById('saveFeedback').textContent.includes('練習を保存しました'),null,{timeout:20000});const ops=()=>[...files.keys()].filter(k=>k.startsWith('O_')).length; // 表示と保存データを両方検査します。
 try{ // エンジン単位で失敗を記録します。
  await page.goto(url);await page.waitForFunction(()=>document.getElementById('editorFields')&&!document.getElementById('editorFields').disabled); // 実SQLiteの初期化を待ちます。
  await record(engine,'U01 サインインだけでは未接続',async()=>{assert.equal(await title(),'OneDrive未接続');assert.equal(await page.locator('#savePlan').textContent(),'練習を保存');assert.equal(await page.locator('.save-dock').evaluate(e=>getComputedStyle(e).position),'static');}); // 初期画面でフォームを覆わないことも確認します。
  await page.getByRole('button',{name:'接続・バックアップ',exact:true}).click();await page.locator('#consentCloud').check();await page.locator('#connectCloud').click();await waitTitle('✓ OneDrive接続済み'); // 本物のWorkerと通信処理で合成領域へ接続します。
  await record(engine,'U02 空データの接続と保存完了を区別',async()=>{assert.match(await page.locator('#connectionStatus').innerText(),/まだ練習は保存されていません/);assert.equal(ops(),0);}); // 同期済みだが練習未登録という誤解を防ぎます。
  await page.getByRole('button',{name:'練習をつくる',exact:true}).click();await page.locator('#title').fill('同期表示の受入');await page.locator('#goal').fill('見る対象を言語化する');await page.locator('[data-field="name"]').first().fill('2対2'); // 合成の練習を入力します。
  await record(engine,'U03 同期ボタンは未保存入力を勝手に登録しない',async()=>{assert.equal(await page.locator('#draftSyncHint').isVisible(),true);await page.locator('#syncNow').click();await waitTitle('✓ OneDrive接続済み');assert.equal(ops(),0);assert.equal(await page.locator('.saved-card').count(),0);assert.equal(await page.locator('#draftSyncHint').isVisible(),true);}); // 保存と同期の違いを実操作で確認します。
  hold=true;await page.locator('#savePlan').click();await saved(); // クラウドの応答だけを止めて端末保存の完了を確認します。
  await record(engine,'U04 保存後はOneDriveへの同期待ち',async()=>{assert.match(await title(),/同期待ち/);assert.equal(await page.locator('.saved-card').count(),1);assert.equal(await page.locator('#draftSyncHint').isVisible(),false);}); // 保存ボタン一つで自動同期が予約される状態です。
  await waitTitle('同期中');await record(engine,'U05 自動同期中を表示して二重操作を停止',async()=>{assert.equal(await page.locator('#syncNow').isDisabled(),true);assert.equal(await page.locator('#syncNow').textContent(),'同期中…');}); // 保存後に同期ボタンを別途押していません。
  hold=false;releaseHold();await waitTitle('✓ OneDrive同期済み'); // 書込みと読戻しを完了させます。
  await record(engine,'U06 完了後は時刻付き同期済み',async()=>{assert.match(await page.locator('#connectionStatus').innerText(),/最終同期/);assert.equal(ops(),1);assert.equal(await page.locator('#syncNow').textContent(),'今すぐ同期');}); // 実際の合成クラウドに記録があることを確認します。
  failure=true;await page.locator('#goal').fill('次回の判断を説明する');await page.locator('#savePlan').click();await saved();await waitTitle('同期が未完了'); // 保存後の通信失敗を起こします。
  await record(engine,'U07 同期失敗でも練習の保存は成功として保持',async()=>{assert.match(await page.locator('#saveFeedback').innerText(),/練習を保存しました/);assert.match(await page.locator('#saveHint').innerText(),/同期を再試行/);assert.equal(ops(),1);assert.equal(await page.locator('#savePlan').isEnabled(),true);}); // 保存をやり直させず同期だけを再試行させます。
  failure=false;await page.locator('#syncNow').click();await waitTitle('✓ OneDrive同期済み');await record(engine,'U08 再同期は保存を重複させない',async()=>{assert.equal(ops(),2);assert.equal(await page.locator('.saved-card').count(),1);}); // 同じ計画の二改訂だけであることを確認します。
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));});await waitTitle('オフライン'); // 実回線ではなくブラウザ状態イベントの表示試験です。
  await page.locator('#goal').fill('通信復帰後の練習');await page.locator('#savePlan').click();await saved();await record(engine,'U09 オフライン保存は同期待ちと明示',async()=>{assert.match(await title(),/オフライン・同期待ち/);assert.equal(ops(),2);}); // 現在の成功と前回の同期を区別します。
  await page.evaluate(()=>{delete navigator.onLine;window.dispatchEvent(new Event('online'));});await waitTitle('✓ OneDrive同期済み');await record(engine,'U10 通信復帰イベントで自動同期する',async()=>{assert.equal(ops(),3);}); // 同期ボタンなしで復帰後に送信する既存処理を確認します。
  await page.locator('#goal').fill('まだ保存していない変更');await record(engine,'U11 同期済みでも編集中は未保存と明示',async()=>{assert.equal(await title(),'✓ OneDrive同期済み');assert.match(await page.locator('#draftSyncHint').innerText(),/入力中の変更は未保存/);assert.equal(ops(),3);}); // 完了表示を入力途中の内容へ誤用しません。
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));}await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(reports,engine+'-status.png'),fullPage:true}); // 狭い画面で状態と入力が読めるか証拠を残します。
 }catch(error){errors.push({engine,message:error.message});await page.screenshot({path:join(reports,engine+'-failure.png'),fullPage:true}).catch(()=>{});}finally{hold=false;releaseHold();await context.close();} // 試験途中の失敗も隠さず終了します。
}}finally{if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}const pass=results.length===22&&errors.length===0;await writeFile(join(reports,'results.json'),JSON.stringify({version:'1.0.2',results,errors,passed:pass,realMicrosoft:false,physicalIPhone:false,network:'native fetch with synthetic auth and Graph HTTP fixtures; offline event is simulated'},null,2));if(!pass)process.exitCode=1;} // 全条件を実行できた時だけ合格にします。
