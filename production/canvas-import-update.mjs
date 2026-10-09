import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const app=process.argv[2],web=join(app,'web');
const replace=(text,before,after)=>{assert.equal(text.split(before).length,2,'CANVAS import patch target: '+before);return text.replace(before,after);};
for(const name of ['canvas-library.mjs','canvas-import.mjs','canvas-import.css'])await copyFile(join('production',name),join(web,name));
let runtime=await readFile(join(web,'app.mjs'),'utf8');
runtime="import {createCanvasImport} from './canvas-import.mjs';\n"+runtime;
runtime=replace(runtime,"if(b.dataset.canvas!==undefined){gather();canvasRow=Number(b.dataset.canvas);$('canvasChoices').innerHTML='';$('canvasDialog').showModal();}","if(b.dataset.canvas!==undefined){gather();canvasImport.open(rows[Number(b.dataset.canvas)]);}");
runtime=replace(runtime,"if(b.dataset.chooseCanvas){const result=await request('readCanvas',{id:b.dataset.chooseCanvas});rows[canvasRow]={...rows[canvasRow],canvasRaw:result.raw,canvasName:result.info.name,canvasSource:result.source,pinned:null};dirty=true;renderRows();$('canvasDialog').close();}",'');
runtime=replace(runtime,"$('closeCanvas').onclick=()=>$('canvasDialog').close();",'');
runtime=replace(runtime,"$('canvasFile').onchange=()=>guard(async()=>{const raw=await fileText($('canvasFile').files[0]);const info=await request('inspectCanvas',{raw});rows[canvasRow]={...rows[canvasRow],canvasRaw:raw,canvasName:info.name,canvasSource:'manual-import',pinned:null};dirty=true;renderRows();$('canvasDialog').close();$('canvasFile').value='';});",'');
runtime=replace(runtime,"$('listCanvases').onclick=()=>guard(async()=>{const list=await request('canvasLibrary');$('canvasChoices').innerHTML=list.map(item=>`<button data-choose-canvas=\"${e(item.id)}\">${e(item.path)}</button>`).join('')||'<p>このアプリ領域にCANVAS JSONはありません。</p>';});",'');
runtime=replace(runtime,'guard(boot);',`const canvasImport=createCanvasImport({request,getScope:()=>auth.scope(),readFile:fileText,onChoose:(result,target)=>{
  const index=rows.indexOf(target);if(index<0)throw new Error('対象のメニューが変更されました。CANVAS importを開き直してください。');
  rows[index]={...target,canvasRaw:result.raw,canvasName:result.info.name,canvasSource:result.source,pinned:null};dirty=true;renderRows();
}});
guard(boot);`);
runtime=runtime.replace('canvasRow=null,','');
await writeFile(join(web,'app.mjs'),runtime);
let html=await readFile(join(web,'index.html'),'utf8');
html=replace(html,'</head>','<link rel="stylesheet" href="./canvas-import.css">\n</head>');
html=replace(html,'<div id="canvasChoices"></div>',`<p id="canvasImportStatus" role="status" aria-live="polite" aria-atomic="true"></p>
<div id="canvasBrowser" hidden>
  <label for="canvasSearch">CANVASを検索</label><input id="canvasSearch" type="search" placeholder="ファイル名・フォルダ名で検索" autocomplete="off">
  <p id="canvasSearchInfo" class="subtle" role="status" aria-live="polite"></p>
  <nav id="canvasBreadcrumbs" aria-label="CANVASフォルダ"></nav>
  <button id="canvasUp" type="button" hidden>ひとつ上へ</button>
  <div id="canvasChoices"></div>
</div>`);
await writeFile(join(web,'index.html'),html);
let sw=await readFile(join(web,'sw.js'),'utf8');sw=replace(sw,"'./app.mjs'","'./canvas-library.mjs','./canvas-import.mjs','./canvas-import.css','./app.mjs'");await writeFile(join(web,'sw.js'),sw);
await copyFile('production/canvas-library.test.mjs',join(app,'tests/canvas-library.test.mjs'));
await copyFile('production/canvas-import.browser.mjs',join(app,'tools/canvas-import.browser.mjs'));
