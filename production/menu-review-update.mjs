import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const app=process.argv[2],web=join(app,'web');
const replace=(text,before,after)=>{assert.equal(text.split(before).length,2,'Menu review patch target: '+before);return text.replace(before,after);};
for(const name of ['menu-review.mjs','menu-review.css'])await copyFile(join('production',name),join(web,name));
let runtime=await readFile(join(web,'app.mjs'),'utf8');
runtime="import {createMenuChecks,isStarterRow} from './menu-review.mjs';\nconst menuChecks=createMenuChecks();\n"+runtime;
runtime=replace(runtime,'<article class="panel"><span class="label">${e(categoryName(item.category))} · ${index+1}</span>',`<article class="panel \${menuChecks.has(auth.scope(),id,index)?'menu-complete':''}"><div class="menu-check-head"><span class="label">\${e(categoryName(item.category))} · \${index+1}</span><label class="menu-check"><input type="checkbox" data-menu-complete="\${index}" data-check-revision="\${e(id)}" aria-label="\${e(item.name)}の完了チェック" \${menuChecks.has(auth.scope(),id,index)?'checked':''}><span>\${menuChecks.has(auth.scope(),id,index)?'完了':'未完了'}</span></label></div>`);
runtime=replace(runtime,'<button data-reuse="${index}">次の計画に追加</button>','');
runtime=replace(runtime,'<button data-export-canvas="${index}">CANVAS JSONを書出し</button>','');
const reuseStart=runtime.indexOf('if(b.dataset.reuse!==undefined)'),reuseEnd=runtime.indexOf('if(b.dataset.viewCanvas!==undefined)',reuseStart);assert(reuseStart>0&&reuseEnd>reuseStart);runtime=runtime.slice(0,reuseStart)+runtime.slice(reuseEnd);
const exportStart=runtime.indexOf('if(b.dataset.exportCanvas!==undefined)'),exportEnd=runtime.indexOf('}});});',exportStart);assert(exportStart>0&&exportEnd>exportStart);runtime=runtime.slice(0,exportStart)+runtime.slice(exportEnd+1);
runtime=replace(runtime,"$('records').innerHTML=state.records", "updateMenuCheckCount();$('records').innerHTML=state.records");
runtime=replace(runtime,"$('addItem').onclick=", "$('addPastMenu').onclick=()=>{if(!saving&&!mediaImporting)openPastMenuPicker();};$('addItem').onclick=");
runtime=replace(runtime,'guard(boot);',`function updateMenuCheckCount(){if(!currentDetail)return;const id=currentDetail.operation.body.opId;const length=currentDetail.operation.body.payload.items.length;$('menuCheckCount').textContent='完了 '+menuChecks.count(auth.scope(),id,length)+' / '+length;}
$('detailItems').addEventListener('change',event=>{
  const input=event.target;if(!input.matches('[data-menu-complete]')||!currentDetail)return;
  const id=currentDetail.operation.body.opId,index=Number(input.dataset.menuComplete);
  if(input.dataset.checkRevision!==id||index>=currentDetail.operation.body.payload.items.length)return;
  menuChecks.set(auth.scope(),id,index,input.checked);input.nextElementSibling.textContent=input.checked?'完了':'未完了';input.closest('article').classList.toggle('menu-complete',input.checked);updateMenuCheckCount();
});
function openPastMenuPicker(){
  gather();const draft=rows,scope=auth.scope();const choices=menuChoices(state?.practices||[]);
  const categories=currentCategories().map(c=>c.name).filter(name=>choices.some(item=>item.category===name));
  picker.open({title:'過去のメニューから追加する',help:'カテゴリーや検索で選びます。選んだメニューを計画の末尾に追加します。',categories,groupBy:true,emptyText:'保存済みのメニューがありません。カテゴリーや検索条件を確認してください。',items:(category,query)=>{
    const found=menuChoices(state?.practices||[],category,query);
    return categories.flatMap(name=>found.filter(item=>item.category===name).map(item=>({group:name,label:item.name,detail:item.minutes+'分 · '+item.variation+' / '+item.planTitle,value:item})));
  },onChoose:async value=>{
    const detail=await request('detail',{revisionId:value.revisionId});const copied=rowsFromDetail(detail,true)[value.index];
    if(!copied)throw new Error('選択したメニューが見つかりません。');
    if(auth.scope()!==scope||rows!==draft||saving||mediaImporting)throw new Error('編集中の計画が変わりました。選び直してください。');
    gather();if(copied.term&&!terms.some(t=>t.ID===copied.termId)&&copied.termId!==NO_TERM.ID)terms.push(copied.term);
    if(rows.length===1&&isStarterRow(rows[0],NO_TERM.ID))rows.splice(0,1);
    rows.push(copied);dirty=true;renderRows();saveFeedback('過去のメニューを追加しました。「練習を保存」で登録してください。');
  }});
}
guard(boot);`);
await writeFile(join(web,'app.mjs'),runtime);
let picker=await readFile(join(web,'picker.mjs'),'utf8');
picker=replace(picker,'for(const item of all.slice(0,100)){',"let previousGroup;for(const item of all.slice(0,100)){if(options.groupBy&&item.group!==previousGroup){const heading=document.createElement('h3');heading.className='picker-group';heading.textContent=item.group;result.append(heading);previousGroup=item.group;}");
picker=replace(picker,"'候補がありません。新規入力するか、検索条件を変えてください。'","(options.emptyText||'候補がありません。新規入力するか、検索条件を変えてください。')");
await writeFile(join(web,'picker.mjs'),picker);
let html=await readFile(join(web,'index.html'),'utf8');
html=replace(html,'</head>','<link rel="stylesheet" href="./menu-review.css">\n</head>');
html=replace(html,'<button type="button" id="addItem">＋ メニューを追加</button>','<button type="button" id="addItem">＋ メニューを追加</button><button type="button" id="addPastMenu">過去のメニューから追加する</button>');
html=replace(html,'<div id="detailItems"></div>','<div class="menu-check-summary"><strong id="menuCheckCount" role="status" aria-live="polite"></strong><small class="subtle">チェックは保存されません</small></div><div id="detailItems"></div>');
await writeFile(join(web,'index.html'),html);
let sw=await readFile(join(web,'sw.js'),'utf8');sw=replace(sw,"'./app.mjs'","'./menu-review.mjs','./menu-review.css','./app.mjs'");await writeFile(join(web,'sw.js'),sw);
await copyFile('production/menu-review.test.mjs',join(app,'tests/menu-review.test.mjs'));
await copyFile('production/menu-review.browser.mjs',join(app,'tools/menu-review.browser.mjs'));
