import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from './serve-project.mjs';
import {connectFromMenu,openSettings} from './connection-menu-test.mjs';
const live=process.env.SITE_URL,reports=live?'reports/multiple-terms-live':'reports/multiple-terms',results=[],errors=[];await mkdir(reports,{recursive:true});let server,url=live;
if(live)assert.equal(live,'https://yuge-u.github.io/zero-one-practice-lab/');else{server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));url=`http://127.0.0.1:${server.address().port}/zero-one-practice-lab/`;}
const A={ID:'TEST_SCREEN','正式/標準用語':'Screen away','日本語推奨表記':'スクリーンアウェイ',定義:'ボールから離れてスクリーンをかける'},B={ID:'TEST_CUT','正式/標準用語':'Cut','日本語推奨表記':'カット',定義:'空いた場所へ移動する'},C={ID:'TEST_HTML','正式/標準用語':'<img src=x onerror=alert(1)>','日本語推奨表記':'テスト',定義:'表示確認'};
const sdk=`globalThis.msal={PublicClientApplication:class{async initialize(){}async handleRedirectPromise(){return null;}getAllAccounts(){return [{homeAccountId:'multiple-terms-synthetic',username:'synthetic@example.invalid'}];}setActiveAccount(){}async acquireTokenSilent(args){return {accessToken:'synthetic-not-a-real-token',account:args.account};}}};`;
const ready=page=>page.waitForFunction(()=>document.getElementById('editorFields')&&!document.getElementById('editorFields').disabled);
const saved=page=>page.waitForFunction(()=>document.getElementById('saveFeedback').textContent.includes('練習を保存しました'));
const synced=page=>page.waitForFunction(()=>document.getElementById('storageStatus').textContent.includes('OneDrive同期済み'));
async function open(page,title){await page.locator('[data-tab="library"]').click();await page.locator('.saved-card').filter({has:page.getByRole('heading',{name:title,exact:true})}).locator('[data-open]').click();await page.waitForFunction(t=>!document.getElementById('detail').hidden&&document.getElementById('detailTitle').textContent===t,title);}
async function backup(page){await openSettings(page);const waiting=page.waitForEvent('download');await page.locator('#backup').click();const stream=await(await waiting).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString()).body;}
async function check(engine,name,fn){await fn();results.push({engine,name,pass:true});console.log('PASS',engine,name);}
try{for(const [engine,type]of Object.entries({chromium,webkit})){
  const contexts=[],files=new Map();let folder=false;const meta=name=>({id:name,name,file:{},size:Buffer.byteLength(files.get(name)||'')});
  async function launch(){const home=await mkdtemp(join(tmpdir(),'practice-multi-terms-')),context=await type.launchPersistentContext(join(home,'profile'),{headless:true,viewport:{width:390,height:844},serviceWorkers:'block',env:{...process.env,HOME:home,CFFIXED_USER_HOME:home,XDG_DATA_HOME:join(home,'data'),XDG_CACHE_HOME:join(home,'cache'),XDG_CONFIG_HOME:join(home,'config')}});contexts.push(context);
    await context.route('**/*',async route=>{const req=route.request(),target=new URL(req.url()),reply=(status,value)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value),headers:{'Access-Control-Allow-Origin':'*'}});
      if(target.origin===new URL(url).origin){if(target.pathname.endsWith('/vendor/msal-browser.min.js'))return route.fulfill({contentType:'text/javascript',body:sdk});return route.continue();}
      if(!['graph.microsoft.com','zero-one-synthetic.1drv.com'].includes(target.hostname))return route.abort();const path=decodeURIComponent(target.pathname);
      if(target.hostname==='zero-one-synthetic.1drv.com'){assert(!req.headers().authorization);return files.has(path.slice(1))?route.fulfill({contentType:'application/json',body:files.get(path.slice(1)),headers:{'Access-Control-Allow-Origin':'*'}}):reply(404,{});}
      assert.equal(req.headers().authorization,'Bearer synthetic-not-a-real-token');if(path.endsWith('/special/approot'))return reply(200,{id:'root',folder:{}});
      if(path.endsWith('/items/root/children')){if(req.method()==='POST'){folder=true;return reply(201,{id:'folder',folder:{}});}return reply(200,{value:folder?[{id:'folder',name:'ZERO_ONE_PRACTICE_LAB_V02',folder:{}}]:[]});}
      if(path.endsWith('/items/folder/children'))return reply(200,{value:[...files.keys()].map(meta)});const match=/\/items\/folder:\/(.+?)(:\/content)?$/.exec(path);
      if(match){const name=match[1];if(match[2]&&req.method()==='PUT'){files.set(name,req.postData());return reply(201,meta(name));}return files.has(name)?reply(200,meta(name)):reply(404,{});}
      const name=path.split('/items/')[1];return name&&files.has(name)?reply(200,{...meta(name),'@microsoft.graph.downloadUrl':'https://zero-one-synthetic.1drv.com/'+encodeURIComponent(name)}):reply(404,{});
    });const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push({engine,message:error.message}));page.on('dialog',dialog=>dialog.accept());return page;
  }
  const page=await launch();try{
    await page.goto(url);await ready(page);await connectFromMenu(page);await page.waitForFunction(()=>/接続済み|同期済み/.test(document.getElementById('storageStatus').textContent));await openSettings(page);await page.locator('#termsFile').setInputFiles({name:'terminology.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([A,B,C]))});await page.waitForFunction(()=>document.getElementById('termsInfo').textContent.includes('用語を読込済み'));
    await page.locator('[data-tab="editor"]').click();await page.locator('#title').fill('複数用語の練習');await page.locator('#goal').fill('連携を確認');await page.locator('[data-field="name"]').fill('連携');await page.locator('[data-term-picker]').click();
    await check(engine,'T01 選択時に検索と複数チェックを表示・HTMLは文字表示',async()=>{assert(await page.locator('#pickerQuery').isVisible());assert.equal(await page.locator('#pickerResults input[type="checkbox"]').count(),3);assert.equal(await page.locator('#pickerResults img').count(),0);assert.equal(await page.locator('#pickerSelectedCount').textContent(),'選択中 0語');});
    await page.locator('#pickerQuery').fill('ＳＣＲＥＥＮ');await page.locator('[data-picker-key="TEST_SCREEN"]').check();await page.locator('#pickerQuery').fill('かっと');await page.locator('[data-picker-key="TEST_CUT"]').check();
    await check(engine,'T02 検索を変更しても両方の選択を保持',async()=>{assert.equal(await page.locator('#pickerSelectedCount').textContent(),'選択中 2語');assert.equal(await page.locator('#pickerSelected button').count(),2);});
    await page.locator('#pickerApply').click();await page.locator('#searchPicker').waitFor({state:'hidden'});
    await check(engine,'T03 選択をまとめて反映・保存前は記録されない',async()=>{assert.deepEqual(await page.locator('#items .selected-term').allTextContents(),[A['正式/標準用語'],B['正式/標準用語']]);assert.equal(await page.locator('.saved-card').count(),0);await page.waitForFunction(()=>document.querySelector('[data-term-picker]')===document.activeElement);});
    await page.locator('[data-term-picker]').click();await page.locator('#pickerClear').click();await page.locator('#pickerClose').click();
    await check(engine,'T04 閉じる・Escapeで未反映の選択を取り消す',async()=>{assert.equal(await page.locator('.selected-term').count(),2);await page.locator('[data-term-picker]').click();await page.locator('#pickerClear').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.selected-term').count(),2);});
    await page.locator('#savePlan').click();await saved(page);await synced(page);const original=await backup(page);await page.reload();await ready(page);await synced(page);await open(page,'複数用語の練習');
    await check(engine,'T05 保存・再起動後に名称と定義を両方表示',async()=>{const text=await page.locator('#detailItems').innerText();for(const term of [A,B]){assert(text.includes(term['正式/標準用語']));assert(text.includes(term.定義));}});
    await page.locator('#copyPlan').click();await page.waitForFunction(()=>document.getElementById('title').value.endsWith('（コピー）'));await page.locator('#title').fill('条件変更コピー');await page.locator('[data-field="rule"]').fill('次の判断');await page.locator('#savePlan').click();await saved(page);await synced(page);await open(page,'条件変更コピー');
    await check(engine,'T06 条件を編集しても複数用語と原本を保持',async()=>{assert.equal(await page.locator('.detail-term').count(),2);const now=await backup(page);for(const op of original.operations)assert.deepEqual(now.operations.find(item=>item.hash===op.hash),op);});
    await page.locator('[data-tab="editor"]').click();await page.locator('#newPlan').click();await page.locator('#addPastMenu').click();await page.locator('.picker-option').first().click();await page.locator('#searchPicker').waitFor({state:'hidden'});
    await check(engine,'T07 過去のメニューから追加でも両方の用語を引き継ぐ',async()=>{assert.equal(await page.locator('.selected-term').count(),2);});
    await page.locator('[data-term-picker]').click();await page.locator('#pickerQuery').fill('Screen');await page.locator('[data-picker-key="TEST_SCREEN"]').focus();await page.keyboard.press('Space');
    await check(engine,'T08 キーボードで解除できてフォーカスを保つ',async()=>{assert(!await page.locator('[data-picker-key="TEST_SCREEN"]').isChecked());assert(await page.locator('[data-picker-key="TEST_SCREEN"]').evaluate(input=>input===document.activeElement));});
    await page.locator('#pickerApply').click();await page.locator('#searchPicker').waitFor({state:'hidden'});
    await check(engine,'T09 選択から一語だけ外せる',async()=>{assert.deepEqual(await page.locator('.selected-term').allTextContents(),[B['正式/標準用語']]);});
    await page.locator('[data-term-picker]').click();await page.locator('#pickerClear').click();await page.locator('#pickerApply').click();await page.locator('#searchPicker').waitFor({state:'hidden'});
    await check(engine,'T10 関連用語なしにも戻せる',async()=>{assert.equal(await page.locator('.selected-term').count(),0);assert.equal(await page.locator('[data-field="termId"]').inputValue(),'ZEROONE_INTERNAL_NO_TERM');});
    const second=await launch();await second.goto(url);await ready(second);await connectFromMenu(second);await synced(second);await open(second,'複数用語の練習');
    await check(engine,'T11 独立した端末相当へOneDrive同期で全用語を引き継ぐ',async()=>{assert.equal(await second.locator('.detail-term').count(),2);assert((await second.locator('#detailItems').innerText()).includes(B.定義));});
    await second.locator('#editPlan').click();await second.locator('[data-term-picker]').click();
    await check(engine,'T12 現在のカタログにない保存済み用語も選択を保持',async()=>{assert.equal(await second.locator('#pickerSelectedCount').textContent(),'選択中 2語');await second.locator('#pickerQuery').fill('かっと');assert(await second.locator('[data-picker-key="TEST_CUT"]').isChecked());});
    await check(engine,'T13 小画面の検索と選択一覧がはみ出さない',async()=>{for(const width of [320,390,1280]){await second.setViewportSize({width,height:844});assert(await second.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));assert(await second.evaluate(()=>document.getElementById('searchPicker').scrollWidth<=document.getElementById('searchPicker').clientWidth+1));}await second.setViewportSize({width:390,height:844});await second.screenshot({path:join(reports,engine+'-picker.png'),fullPage:true});});
    await second.locator('#pickerClose').click();await second.locator('[data-tab="library"]').click();
  }catch(e){errors.push({engine,message:e.stack});await page.screenshot({path:join(reports,engine+'-failure.png'),fullPage:true}).catch(()=>{});}finally{for(const context of contexts)await context.close();}
}}finally{if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}const passed=errors.length===0&&results.length===26;await writeFile(join(reports,'results.json'),JSON.stringify({passed,results,errors,realMicrosoft:false,physicalIPhone:false},null,2));if(!passed){console.error(errors);process.exitCode=1;}}
