import {chromium,webkit} from 'playwright';
import {createServer} from './serve-project.mjs';
import {canvasFixture,rawFixture} from './canvas-fixtures.mjs';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const live=process.env.SITE_URL,reports=live?'reports/canvas-viewer-live':'reports/canvas-viewer';
await mkdir(reports,{recursive:true});
let server,url=live;const results=[],errors=[];
if(live)assert.equal(live,'https://yuge-u.github.io/zero-one-practice-lab/');
else{server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));url=`http://127.0.0.1:${server.address().port}/zero-one-practice-lab/`;}
const inspect=page=>page.evaluate(async()=>{const m=await import('./canvas-viewer.mjs');return m.viewerState();});
const wait=async(page,expected)=>{await page.evaluate(async()=>{window.__cvTestState=(await import('./canvas-viewer.mjs')).viewerState;});await page.waitForFunction(expected=>{const state=window.__cvTestState();return Object.entries(expected).every(([key,value])=>key==='minElapsed'?state.elapsed>=value:key==='minCompleted'?state.completed>=value:state[key]===value);},expected);};
async function check(engine,name,fn){await fn();results.push({engine,name,pass:true});console.log('PASS',engine,name);}
try{for(const [engine,type] of Object.entries({chromium,webkit})){
  const browserRoot=await mkdtemp(join(tmpdir(),'practice-viewer-'));const context=await type.launchPersistentContext(join(browserRoot,'profile'),{headless:true,viewport:{width:390,height:844},serviceWorkers:'block',env:{...process.env,HOME:browserRoot,CFFIXED_USER_HOME:browserRoot,XDG_DATA_HOME:join(browserRoot,'data'),XDG_CACHE_HOME:join(browserRoot,'cache'),XDG_CONFIG_HOME:join(browserRoot,'config')}});const page=await context.newPage();
  const requests=[],faults=[];page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>faults.push(error.message));
  try{
    await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('editorFields')&&!document.getElementById('editorFields').disabled);
    await check(engine,'P01 閲覧コードは作戦を開くまで読まない',async()=>{assert(!requests.some(url=>/canvas-(viewer|playback|compat)\.mjs/.test(url)));assert.equal(await page.locator('[data-view-canvas]').count(),0);});
    await page.locator('#title').fill('作戦プレビューの練習');await page.locator('#goal').fill('判断してパス');await page.locator('[data-field="name"]').first().fill('2対2');
    await page.locator('[data-canvas]').first().click();await page.locator('#canvasFile').setInputFiles({name:'synthetic-canvas.json',mimeType:'application/json',buffer:Buffer.from(rawFixture())});
    await page.locator('[data-view-canvas]').first().click();await page.locator('#canvasViewer').waitFor({state:'visible'});
    await check(engine,'P02 未保存の作戦も入力を保持して表示',async()=>{assert.equal(await page.locator('#title').inputValue(),'作戦プレビューの練習');assert.match(await page.locator('#cvTitle').textContent(),/人工作戦/);const state=await inspect(page);assert.equal(state.open,true);assert.equal(Object.keys(state.positions.players).length,3);assert.equal(Object.keys(state.positions.balls).length,2);});
    await page.locator('#cvNext').click();await wait(page,{running:false,completed:1});
    await check(engine,'P03 1動作ずつコマ送りし複数ボールが進む',async()=>{const state=await inspect(page);assert.deepEqual(state.positions.players.o1,{x:430,y:550});assert.deepEqual(state.positions.balls['ball-two'],{x:540,y:500});});
    await page.locator('#cvPrevious').click();await check(engine,'P04 コマ戻しで開始位置へ戻る',async()=>assert.equal((await inspect(page)).completed,0));
    await page.locator('#cvPlay').click();await wait(page,{minElapsed:151});await page.locator('#cvPlay').click();const stopped=await inspect(page);await page.waitForTimeout(220);
    await check(engine,'P05 一時停止では位置保持・描画を停止',async()=>{const state=await inspect(page);assert.equal(state.running,false);assert.equal(state.scheduled,false);assert.equal(state.draws,stopped.draws);assert.deepEqual(state.positions,stopped.positions);});
    await page.locator('#cvPlay').click();await wait(page,{minCompleted:1});await page.locator('#cvPlay').click();
    await check(engine,'P06 途中から連続再生を再開',async()=>assert.equal((await inspect(page)).completed,1));
    await page.locator('#cvStep').selectOption('1');await page.locator('#cvNext').click();await wait(page,{running:false,completed:1});
    await check(engine,'P07 STEP選択後の連続パスを順番通りに再生',async()=>assert.deepEqual((await inspect(page)).positions.balls.ball,{x:640,y:400}));
    await page.locator('#cvNext').click();await check(engine,'P08 動作のないSTEPもコマ送りできる',async()=>{assert.equal((await inspect(page)).step,2);assert.equal(await page.locator('#cvNext').isDisabled(),true);});
    await page.locator('#cvReset').click();await page.locator('#cvSpeed').selectOption('2');await page.locator('#cvLoop').click();await page.locator('#cvPlay').click();await wait(page,{step:2});await wait(page,{step:0});await page.locator('#cvPlay').click();
    await check(engine,'P09 速度変更・繰り返し再生',async()=>assert.equal(await page.locator('#cvLoop').getAttribute('aria-pressed'),'true'));
    await page.locator('#cvStep').selectOption('0');await page.locator('#cvPlay').click();await wait(page,{minElapsed:101});
    await page.locator('#cvClose').click();await page.waitForTimeout(60);const closed=await inspect(page);await page.waitForTimeout(180);
    await check(engine,'P10 閉じたらループ・描画・メモリーを解放',async()=>{const state=await inspect(page);assert.equal(state.open,false);assert.equal(state.scheduled,false);assert.equal(state.draws,closed.draws);assert.equal(state.positions,undefined);assert.equal(await page.locator('#cvCanvas').getAttribute('width'),'1');});
    await page.locator('#savePlan').click();await page.waitForFunction(()=>document.getElementById('saveFeedback').textContent.includes('練習を保存しました'));await page.locator('[data-tab="library"]').click();await page.locator('.saved-card [data-open]').first().click();
    await page.locator('#detailItems [data-view-canvas]').click();await page.locator('#canvasViewer').waitFor({state:'visible'});
    await check(engine,'P11 保存した練習の固定版から表示',async()=>assert.equal((await inspect(page)).step,0));
    for(const size of [{width:320,height:568},{width:844,height:390},{width:1280,height:900}]){await page.setViewportSize(size);await page.waitForTimeout(100);await check(engine,'P12 縦横・PC幅で操作が画面内 '+size.width,async()=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));const box=await page.locator('#cvNext').boundingBox();assert(box.x>=0&&box.x+box.width<=size.width+1);assert(box.y>=0&&box.y+box.height<=size.height+1);});}
    await page.setViewportSize({width:390,height:844});await page.locator('.cv-notes summary').click();await check(engine,'P13 STEPメモと移動線の表示切替',async()=>{assert.match(await page.locator('#cvNote').textContent(),/侵入/);await page.locator('#cvLines').uncheck();assert.equal(await page.locator('#cvLines').isChecked(),false);});
    await page.screenshot({path:reports+'/'+engine+'-viewer.png'});
    await context.route('**/*',route=>route.abort());const before=requests.length;await page.locator('#cvPlay').click();await wait(page,{minElapsed:151});await page.locator('#cvPlay').click();
    await check(engine,'P14 表示・再生の追加クラウド通信はゼロ',async()=>assert.equal(requests.length,before));
    await page.locator('#cvClose').click();await context.unroute('**/*');
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('editorFields')&&!document.getElementById('editorFields').disabled);await page.locator('[data-tab="library"]').click();await page.locator('.saved-card [data-open]').first().click();
    await page.waitForFunction(()=>document.getElementById('detailTitle').textContent==='作戦プレビューの練習');
    await check(engine,'P15 再読込後も固定作戦と練習データを保持',async()=>{assert.equal(await page.locator('#detailItems [data-view-canvas]').count(),1);assert.equal(await page.locator('#detailTitle').textContent(),'作戦プレビューの練習');});
    await page.locator('#detailItems [data-view-canvas]').click();await check(engine,'P16 キーボードでもコマ送り・コマ戻し',async()=>{await page.locator('#cvPlay').focus();await page.keyboard.press('ArrowRight');await wait(page,{running:false,completed:1});await page.keyboard.press('ArrowLeft');assert.equal((await inspect(page)).completed,0);});
    await page.locator('#cvClose').click();
    await page.evaluate(async raw=>{const m=await import('./canvas-viewer.mjs');m.showCanvas(raw);},JSON.stringify(canvasFixture(90)));
    await check(engine,'P17 回転した作戦もコートと番号を表示',async()=>{const state=await inspect(page);assert.deepEqual(state.positions.players.o1,{x:290,y:330});assert.equal(faults.length,0);});
    await page.locator('#cvPlay').click();await wait(page,{minElapsed:101});
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    const hidden=await inspect(page);await page.waitForTimeout(150);
    await check(engine,'P18 バックグラウンド通知時に自動停止',async()=>{const state=await inspect(page);assert.equal(state.running,false);assert.equal(state.scheduled,false);assert.equal(state.draws,hidden.draws);});
    await page.evaluate(()=>{delete document.hidden;});
    const large=canvasFixture();const sample=large.snapshot.steps[0];
    large.snapshot.steps=Array.from({length:50},(_,index)=>({...structuredClone(sample),id:'large-step-'+index,label:'STEP '+(index+1)}));large.snapshot.steps[0].lines[0].points=Array.from({length:5000},(_,index)=>({x:330+index%100,y:690-index%140}));
    await page.evaluate(async raw=>{const m=await import('./canvas-viewer.mjs');m.showCanvas(raw);},JSON.stringify(large));
    const start=(await inspect(page)).draws;await page.locator('#cvPlay').click();await page.waitForTimeout(400);await page.locator('#cvPlay').click();
    await check(engine,'P19 多数STEP・長い経路でも1つの描画ループで再生',async()=>{const state=await inspect(page);assert(state.draws-start>=3);assert(state.draws-start<90);assert.equal(state.scheduled,false);});
    await page.keyboard.press('Escape');await page.locator('#canvasViewer').waitFor({state:'hidden'});
    await check(engine,'P20 Escapeで閉じても再生を残さない',async()=>{assert.equal((await inspect(page)).scheduled,false);});
  }catch(error){errors.push({engine,message:error.message,faults,state:await inspect(page).catch(()=>null),notice:await page.locator('#notice').textContent().catch(()=>null)});await page.screenshot({path:reports+'/'+engine+'-failure.png'}).catch(()=>{});}finally{await context.close();}
}}finally{if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}const passed=results.length===44&&errors.length===0;await writeFile(reports+'/results.json',JSON.stringify({results,errors,passed,realMicrosoft:false,physicalIPhone:false},null,2));if(!passed)process.exitCode=1;}
