import {openSettings} from './connection-menu-test.mjs';
import {chromium,webkit} from 'playwright';
import {createServer} from './serve-project.mjs';
import {rawFixture} from './canvas-fixtures.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

// Real Auth, WorkerBridge, GraphClient, parsing and SQLite; synthetic SDK/HTTP only.
const sdk=`globalThis.msal={PublicClientApplication:class{async initialize(){}async handleRedirectPromise(){return null;}getAllAccounts(){return [{homeAccountId:'canvas-picker-synthetic',username:'synthetic@example.invalid'}];}setActiveAccount(){}async acquireTokenSilent(args){return {accessToken:'synthetic-not-a-real-token',account:args.account};}}};`;
const live=process.env.SITE_URL,reports=live?'reports/canvas-import-live':'reports/canvas-import',results=[],errors=[];
await mkdir(reports,{recursive:true});
let server,url=live;if(live)assert.equal(live,'https://yuge-u.github.io/zero-one-practice-lab/');
else {server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));url=`http://127.0.0.1:${server.address().port}/zero-one-practice-lab/`;}
const good=rawFixture();
const folder=(id,name)=>({id,name,folder:{}}),file=(id,name)=>({id,name,file:{},size:Buffer.byteLength(id==='bad'?'{}':good)});
const tree={root:[folder('shared','Shared'),folder('u15','U15'),folder('mal','<img src=x onerror=alert(1)>'),file('root-file','root.json'),file('settings','_save-folders.settings.json'),folder('terms','TERMINOLOGY')],shared:[file('a','ピック.json'),file('bad','読めない.json')],u15:[folder('blob','BLOB'),folder('obu','obu')],blob:[file('b','ピック.json')],obu:[file('c','ＢＬＯＢ_縦スクリーン.json')],mal:[file('d','<b>名前</b>.json')]};
async function check(engine,name,action){await action();results.push({engine,name,pass:true});console.log('PASS',engine,name);}
try {for(const [engine,type] of Object.entries({chromium,webkit})) {
  const home=await mkdtemp(join(tmpdir(),'practice-canvas-import-'));
  const context=await type.launchPersistentContext(join(home,'profile'),{headless:true,viewport:{width:390,height:844},serviceWorkers:'block',env:{...process.env,HOME:home,CFFIXED_USER_HOME:home,XDG_DATA_HOME:join(home,'data'),XDG_CACHE_HOME:join(home,'cache'),XDG_CONFIG_HOME:join(home,'config')}});
  let holdList=false,holdRead=false,failList=false,releaseList,releaseRead;
  let listGate=Promise.resolve(),readGate=Promise.resolve();
  const calls=[],downloads=[];
  await context.route('**/*',async route=>{
    const req=route.request(),target=new URL(req.url());
    const reply=(status,value)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value),headers:{'Access-Control-Allow-Origin':'*'}});
    if(target.origin===new URL(url).origin){if(target.pathname.endsWith('/vendor/msal-browser.min.js'))return route.fulfill({contentType:'text/javascript',body:sdk});return route.continue();}
    if(!['graph.microsoft.com','zero-one-synthetic.1drv.com'].includes(target.hostname))return route.abort();
    calls.push({url:target.href,method:req.method()});
    assert.equal(req.method(),'GET','CANVAS imports must never write to OneDrive');
    if(target.hostname==='zero-one-synthetic.1drv.com') {
      assert(!req.headers().authorization);downloads.push(target.pathname);
      if(holdRead)await readGate;
      return route.fulfill({contentType:'application/json',body:target.pathname==='/bad'?'{}':good,headers:{'Access-Control-Allow-Origin':'*'}});
    }
    assert.equal(req.headers().authorization,'Bearer synthetic-not-a-real-token');
    const path=decodeURIComponent(target.pathname);
    if(path.endsWith('/special/approot')){if(holdList)await listGate;if(failList)return reply(403,{error:{code:'accessDenied'}});return reply(200,{id:'root',folder:{}});}
    const children=/\/items\/([^/]+)\/children$/.exec(path);
    if(children){const id=children[1];assert(id!=='terms');return reply(200,{value:tree[id]||[]});}
    const metadata=/\/items\/([^/]+)$/.exec(path);
    if(metadata)return reply(200,{id:metadata[1],name:metadata[1]+'.json',file:{},size:Buffer.byteLength(good),'@microsoft.graph.downloadUrl':'https://zero-one-synthetic.1drv.com/'+metadata[1]});
    return reply(404,{});
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push({engine,message:e.message}));page.on('dialog',d=>d.accept());
  const open=()=>page.locator('[data-canvas]').first().click();
  const loaded=()=>page.waitForFunction(()=>!document.getElementById('listCanvases').disabled&&document.getElementById('canvasBrowser').hidden===false);
  try {
    await page.goto(url);await page.waitForFunction(()=>document.getElementById('editorFields')&&!document.getElementById('editorFields').disabled);
    await page.locator('#title').fill('CANVAS importの練習');await page.locator('#goal').fill('原本と入力を保持する');await page.locator('[data-field="name"]').first().fill('メニュー1');
    await open();holdList=true;listGate=new Promise(resolve=>releaseList=resolve);calls.length=0;
    await page.locator('#listCanvases').click();
    await check(engine,'I01 一覧取得中は即時表示・二重タップ不可',async()=>{assert.match(await page.locator('#canvasImportStatus').innerText(),/読み込み中/);assert(await page.locator('#listCanvases').isDisabled());assert.equal(await page.locator('#canvasImportStatus').getAttribute('role'),'status');assert.equal(await page.locator('#canvasDialog').getAttribute('aria-busy'),null);});
    await page.locator('#closeCanvas').click();await open();
    await check(engine,'I02 閉じて開き直しても同じ読込を待つ',async()=>{assert(await page.locator('#listCanvases').isDisabled());assert.equal(calls.filter(i=>i.url.endsWith('/special/approot')).length,1);});
    holdList=false;releaseList();await loaded();
    const afterList=calls.length;
    await check(engine,'I03 rootはフォルダと直下ファイルのみ・本文は未取得',async()=>{assert.equal(await page.locator('[data-canvas-folder]').count(),3);assert.equal(await page.locator('[data-canvas-choice]').count(),1);assert.equal(downloads.length,0);assert.match(await page.locator('#canvasImportStatus').innerText(),/6件/);assert.equal(await page.locator('#canvasChoices img').count(),0);});
    await page.locator('[data-canvas-folder="U15"]').click();await page.locator('[data-canvas-folder="U15/BLOB"]').focus();await page.keyboard.press('Enter');
    await check(engine,'I04 CANVAS保存と同じ階層・パンくず・戻る・キーボード',async()=>{assert.equal(await page.locator('[data-canvas-choice="b"]').count(),1);assert.match(await page.locator('#canvasBreadcrumbs').innerText(),/U15.*BLOB/s);assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-current')),'location');await page.locator('#canvasUp').click();assert.equal(await page.locator('[data-canvas-folder="U15/obu"]').count(),1);});
    await page.locator('#canvasSearch').fill('blob すくりーん');
    await check(engine,'I05 ファイル名とフォルダ名を全階層から検索',async()=>{assert.equal(await page.locator('[data-canvas-choice="c"]').count(),1);assert.match(await page.locator('[data-canvas-choice="c"]').innerText(),/U15\/obu/);assert.equal(calls.length,afterList);});
    await page.locator('#canvasSearch').fill('ぴっく');
    await check(engine,'I06 同じ名前のファイルも保存先で判別',async()=>{assert.equal(await page.locator('[data-canvas-choice]').count(),2);assert.match(await page.locator('[data-canvas-choice="a"]').innerText(),/Shared/);assert.match(await page.locator('[data-canvas-choice="b"]').innerText(),/U15\/BLOB/);});
    await page.locator('#canvasSearch').fill('見つからない');assert.match(await page.locator('#canvasChoices').innerText(),/ありません/);
    await page.locator('#canvasSearch').fill('');assert.equal(await page.locator('[data-canvas-folder="U15/BLOB"]').count(),1);
    for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});await check(engine,'I07 '+width+'pxで操作が画面内',async()=>{const rect=await page.locator('#canvasSearch').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));});}
    await page.setViewportSize({width:390,height:844});await page.locator('#canvasSearch').fill('ぴっく');await page.screenshot({path:join(reports,engine+'-search.png')});
    holdRead=true;readGate=new Promise(resolve=>releaseRead=resolve);await page.locator('[data-canvas-choice="b"]').click();
    await check(engine,'I08 選択したファイルの読込中も表示',async()=>{assert.match(await page.locator('#canvasImportStatus').innerText(),/CANVASデータを読み込み中/);assert(await page.locator('#canvasFile').isDisabled());});
    holdRead=false;releaseRead();await page.waitForFunction(()=>!document.getElementById('canvasDialog').open);
    await check(engine,'I09 読取専用で取り込み・未保存の入力と再生を保持',async()=>{assert.equal(downloads.length,1);assert.equal(await page.locator('[data-view-canvas]').count(),1);assert.equal(await page.locator('#title').inputValue(),'CANVAS importの練習');assert.equal(await page.locator('[data-field="name"]').first().inputValue(),'メニュー1');});
    await open();failList=true;await page.locator('#listCanvases').click();await page.waitForFunction(()=>document.getElementById('canvasImportStatus').classList.contains('ci-error'));
    await check(engine,'I10 読込失敗の表示・再試行・取得済み一覧を保持',async()=>{assert(!(await page.locator('#listCanvases').isDisabled()));assert.equal(await page.locator('[data-canvas-choice]').count(),2);failList=false;await page.locator('#listCanvases').click();await loaded();});
    await page.locator('#canvasSearch').fill('読めない');await page.locator('[data-canvas-choice="bad"]').click();await page.waitForFunction(()=>document.getElementById('canvasImportStatus').classList.contains('ci-error'));
    await check(engine,'I11 不正なJSONでは既存の取込と練習を変更しない',async()=>{assert(await page.locator('#canvasDialog').isVisible());assert.equal(await page.locator('[data-view-canvas]').count(),1);assert.equal(await page.locator('#title').inputValue(),'CANVAS importの練習');});
    await page.locator('#canvasSearch').fill('ぴっく');holdRead=true;readGate=new Promise(resolve=>releaseRead=resolve);await page.locator('[data-canvas-choice="a"]').click();await page.waitForFunction(()=>document.getElementById('canvasImportStatus').textContent.includes('CANVASデータを読み込み中'));
    await page.locator('#closeCanvas').click();await page.locator('#addItem').click();await page.locator('[data-field="name"]').nth(1).fill('メニュー2');await page.locator('[data-canvas]').nth(1).click();holdRead=false;releaseRead();await page.waitForFunction(()=>!document.getElementById('canvasFile').disabled);
    await check(engine,'I12 閉じた後の遅い応答は別メニューへ反映しない',async()=>{assert.equal(await page.locator('#items .item-card').nth(1).locator('[data-view-canvas]').count(),0);assert(await page.locator('#canvasDialog').isVisible());});
    await page.locator('#canvasFile').setInputFiles({name:'manual.json',mimeType:'application/json',buffer:Buffer.from(good)});await page.waitForFunction(()=>!document.getElementById('canvasDialog').open);
    await page.locator('#savePlan').click();await page.waitForFunction(()=>document.getElementById('saveFeedback').textContent.includes('練習を保存しました'));
    await page.reload();await page.waitForFunction(()=>document.getElementById('editorFields')&&!document.getElementById('editorFields').disabled);await page.locator('[data-tab="library"]').click();await page.locator('.saved-card [data-open]').first().click();await page.waitForFunction(()=>document.getElementById('detailTitle').textContent==='CANVAS importの練習');
    await check(engine,'I13 手動取込と端末保存・再起動後の固定版保持',async()=>{assert.equal(await page.locator('#detailItems [data-view-canvas]').count(),2);assert(calls.every(i=>i.method==='GET'));const downloadPromise=page.waitForEvent('download');await openSettings(page);await page.locator('#backup').click();const downloaded=await downloadPromise;const stream=await downloaded.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const backup=JSON.parse(Buffer.concat(chunks).toString()).body;assert(backup.objects.some(object=>object.body.kind==='canvas'&&object.body.payload.raw===good));});
    // Controller account boundary and batching are exercised with deferred synthetic commands.
    await page.locator('[data-tab="editor"]').click();
    await page.evaluate(async()=>{const {createCanvasImport}=await import('./canvas-import.mjs');window.__ciScope='A';window.__ciApplied=[];window.__ciRequests=[];window.__ciPicker=createCanvasImport({getScope:()=>window.__ciScope,readFile:file=>file.text(),onChoose:(result,target)=>window.__ciApplied.push(target),request:command=>new Promise(resolve=>window.__ciRequests.push({command,resolve}))});window.__ciPicker.open('old-row');});
    await page.locator('#listCanvases').click();await page.evaluate(()=>{window.__ciScope='B';window.__ciRequests[0].resolve([{id:'private-A',path:'private-A.json'}]);});await page.waitForFunction(()=>!document.getElementById('listCanvases').disabled);
    await check(engine,'I14 別アカウントの一覧を表示しない',async()=>{assert(await page.locator('#canvasBrowser').isHidden());await page.locator('#closeCanvas').click();await page.evaluate(()=>window.__ciPicker.open('new-row'));await page.locator('#listCanvases').click();await page.evaluate(()=>window.__ciRequests[1].resolve(Array.from({length:120},(_,n)=>({id:String(n),path:'folder/file'+n+'.json'}))));await loaded();assert.equal(await page.locator('[data-canvas-choice="private-A"]').count(),0);});
    await page.locator('[data-canvas-folder="folder"]').click();
    await check(engine,'I15 大きな一覧は50件ずつ表示・検索は全件対象',async()=>{assert.equal(await page.locator('[data-canvas-choice]').count(),50);await page.getByRole('button',{name:/さらに表示/}).click();assert.equal(await page.locator('[data-canvas-choice]').count(),100);await page.locator('#canvasSearch').fill('file119');assert.equal(await page.locator('[data-canvas-choice="119"]').count(),1);assert.equal(await page.evaluate(()=>window.__ciRequests.length),2);});
    await page.locator('[data-canvas-choice="119"]').click();await page.evaluate(()=>{window.__ciScope='C';window.__ciRequests[2].resolve({raw:'{}',info:{name:'private-B'},source:'onedrive-read-only'});});await page.waitForFunction(()=>!document.getElementById('canvasFile').disabled);
    await check(engine,'I16 別アカウントになった後の読込結果を反映しない',async()=>{assert.equal(await page.evaluate(()=>window.__ciApplied.length),0);assert(await page.locator('#canvasBrowser').isHidden());});
  }catch(e){errors.push({engine,message:e.stack});await page.screenshot({path:join(reports,engine+'-failure.png'),fullPage:true}).catch(()=>{});}
  finally{releaseList?.();releaseRead?.();await context.close();}
}}finally{if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}const passed=errors.length===0&&results.length===36;await writeFile(join(reports,'results.json'),JSON.stringify({url,passed,results,errors,realMicrosoft:false,physicalIPhone:false},null,2));if(!passed){console.error(errors);process.exitCode=1;}}
