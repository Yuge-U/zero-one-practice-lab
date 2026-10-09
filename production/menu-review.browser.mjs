import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from './serve-project.mjs';
import {openSettings} from './connection-menu-test.mjs';
import {rawFixture} from './canvas-fixtures.mjs';
const live=process.env.SITE_URL,reports=live?'reports/menu-review-live':'reports/menu-review',results=[],errors=[];
await mkdir(reports,{recursive:true});let server,url=live;
if(live)assert.equal(live,'https://yuge-u.github.io/zero-one-practice-lab/');
else{server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));url=`http://127.0.0.1:${server.address().port}/zero-one-practice-lab/`;}
const ready=page=>page.waitForFunction(()=>document.getElementById('editorFields')&&!document.getElementById('editorFields').disabled);
const saved=page=>page.waitForFunction(()=>document.getElementById('saveFeedback').textContent.includes('練習を保存しました'));
async function open(page,title){await page.locator('[data-tab="library"]').click();await page.locator('.saved-card').filter({has:page.getByRole('heading',{name:title,exact:true})}).locator('[data-open]').click();await page.waitForFunction(t=>document.getElementById('detailTitle').textContent===t,title);}
async function backup(page){await openSettings(page);const promise=page.waitForEvent('download');await page.locator('#backup').click();const stream=await(await promise).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const {createdAt,...data}=JSON.parse(Buffer.concat(chunks).toString()).body;return data;}
async function check(engine,name,fn){await fn();results.push({engine,name,pass:true});console.log('PASS',engine,name);}
try{for(const [engine,type]of Object.entries({chromium,webkit})){
  const home=await mkdtemp(join(tmpdir(),'practice-review-'));
  const context=await type.launchPersistentContext(join(home,'profile'),{headless:true,viewport:{width:390,height:844},serviceWorkers:'block',env:{...process.env,HOME:home,CFFIXED_USER_HOME:home,XDG_DATA_HOME:join(home,'data'),XDG_CACHE_HOME:join(home,'cache'),XDG_CONFIG_HOME:join(home,'config')}});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push({engine,message:e.message}));page.on('dialog',dialog=>dialog.accept());
  try{
    await page.goto(url);await ready(page);await page.locator('#title').fill('確認用の練習');await page.locator('#goal').fill('判断を確認');
    await page.locator('[data-field="category"]').fill('ウォーミングアップ');await page.locator('[data-field="name"]').fill('体幹');await page.locator('[data-field="rule"]').fill('右・左の順番');await page.locator('[data-field="variationName"]').fill('27秒');
    await page.locator('[data-canvas]').click();const raw=rawFixture();await page.locator('#canvasFile').setInputFiles({name:'fixed.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.locator('#canvasDialog').waitFor({state:'hidden'});
    await page.locator('#addItem').click();await page.locator('[data-field="category"]').nth(1).fill('コーディネーション');await page.locator('[data-field="name"]').nth(1).fill('<スナップ>');await page.locator('[data-field="rule"]').nth(1).fill('高く投げる');await page.locator('#savePlan').click();await saved(page);
    const original=await backup(page);await open(page,'確認用の練習');
    await check(engine,'M01 詳細には完了チェックとCANVAS再生のみ',async()=>{assert.equal(await page.locator('[data-reuse],[data-export-canvas]').count(),0);assert.equal(await page.locator('[data-menu-complete]').count(),2);assert.equal(await page.locator('#detailItems [data-view-canvas]').count(),1);assert.equal(await page.locator('#menuCheckCount').textContent(),'完了 0 / 2');});
    await page.locator('[data-menu-complete]').first().focus();await page.keyboard.press('Space');
    await check(engine,'M02 キーボードでチェックを付ける・外す',async()=>{assert(await page.locator('[data-menu-complete]').first().isChecked());assert.equal(await page.locator('#menuCheckCount').textContent(),'完了 1 / 2');await page.locator('[data-menu-complete]').first().uncheck();assert.equal(await page.locator('#menuCheckCount').textContent(),'完了 0 / 2');await page.locator('[data-menu-complete]').nth(1).check();});
    await open(page,'確認用の練習');
    await check(engine,'M03 同じ計画の再表示でもチェックを維持・保存なし',async()=>{assert(await page.locator('[data-menu-complete]').nth(1).isChecked());assert.deepEqual(await backup(page),original);});
    await page.reload();await ready(page);await open(page,'確認用の練習');
    await check(engine,'M04 再起動でチェックを消して原本を保持',async()=>{assert.equal(await page.locator('[data-menu-complete]:checked').count(),0);assert.deepEqual(await backup(page),original);});
    await page.locator('[data-tab="editor"]').click();await page.locator('#title').fill('再利用した練習');await page.locator('#goal').fill('次の判断');await page.locator('#addPastMenu').click();
    await check(engine,'M05 過去のメニューをカテゴリー別に表示',async()=>{assert.deepEqual(await page.locator('.picker-group').allTextContents(),['ウォーミングアップ','コーディネーション']);assert.equal(await page.locator('.picker-option').count(),2);assert.equal(await page.locator('#pickerResults img,#pickerResults スナップ').count(),0);});
    await page.locator('#pickerFilter').selectOption('ウォーミングアップ');await page.locator('#pickerQuery').fill('体幹');await page.locator('.picker-option').click();await page.locator('#searchPicker').waitFor({state:'hidden'});
    await check(engine,'M06 初期空白を残さず時間・条件・CANVAS固定版を追加',async()=>{assert.equal(await page.locator('.item-card').count(),1);assert.equal(await page.locator('[data-field="name"]').inputValue(),'体幹');assert.equal(await page.locator('[data-field="variationName"]').inputValue(),'27秒');assert.equal(await page.locator('[data-field="rule"]').inputValue(),'右・左の順番');assert.equal(await page.locator('#items [data-view-canvas]').count(),1);});
    await page.locator('#addPastMenu').click();await page.locator('#pickerQuery').fill('スナップ');await page.locator('.picker-option').click();await page.locator('#searchPicker').waitFor({state:'hidden'});
    await check(engine,'M07 既存入力を保ち末尾に追加・未保存では原本不変',async()=>{assert.deepEqual(await page.locator('[data-field="name"]').evaluateAll(inputs=>inputs.map(i=>i.value)),['体幹','<スナップ>']);assert.deepEqual(await backup(page),original);});
    await page.locator('[data-tab="editor"]').click();await page.locator('[data-field="rule"]').first().fill('応用');await page.locator('#savePlan').click();await saved(page);
    await open(page,'再利用した練習');await page.locator('[data-menu-complete]').first().check();await open(page,'確認用の練習');
    await check(engine,'M08 コピー先の変更・チェックが原本へ影響しない',async()=>{assert.match(await page.locator('#detailItems').innerText(),/右・左の順番/);assert.equal(await page.locator('[data-menu-complete]:checked').count(),0);const now=await backup(page);for(const op of original.operations)assert.deepEqual(now.operations.find(item=>item.hash===op.hash),op);assert(now.objects.some(item=>item.body.kind==='canvas'&&item.body.payload.raw===raw));});
    await open(page,'確認用の練習');await page.locator('[data-menu-complete]').first().check();await page.locator('#reflection').fill('変更を確認');await page.locator('#saveReflection').click();await page.waitForFunction(()=>document.getElementById('records').textContent.includes('変更を確認'));
    await check(engine,'M09 記録保存による再表示でもチェックを維持',async()=>{assert(await page.locator('[data-menu-complete]').first().isChecked());});
    await check(engine,'M10 小画面のチェックとカテゴリー選択がはみ出さない',async()=>{for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));await page.locator('[data-tab="editor"]').click();await page.locator('#addPastMenu').click();assert(await page.evaluate(()=>document.getElementById('searchPicker').scrollWidth<=document.getElementById('searchPicker').clientWidth+1));await page.locator('#pickerClose').click();await open(page,'確認用の練習');}await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(reports,engine+'-detail.png'),fullPage:true});});
  }catch(e){errors.push({engine,message:e.stack});await page.screenshot({path:join(reports,engine+'-failure.png'),fullPage:true}).catch(()=>{});}finally{await context.close();}
}}finally{if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}const passed=errors.length===0&&results.length===20;await writeFile(join(reports,'results.json'),JSON.stringify({passed,results,errors,realMicrosoft:false,physicalIPhone:false},null,2));if(!passed){console.error(errors);process.exitCode=1;}}
