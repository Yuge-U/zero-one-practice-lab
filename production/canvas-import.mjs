import {indexCanvases,canvasEntries} from './canvas-library.mjs';

export function createCanvasImport({request,getScope,readFile,onChoose}) {
  const $=id=>document.getElementById(id);
  const dialog=$('canvasDialog'),choices=$('canvasChoices'),status=$('canvasImportStatus');
  const search=$('canvasSearch'),browser=$('canvasBrowser'),crumbs=$('canvasBreadcrumbs');
  let cache=null,scope=null,path=[],target=null,session=0,listing=null,reading=false,error='',limit=50;
  const current=()=>scope===getScope();
  function text(tag,value,className) {const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
  function button(label,action,className) {const node=text('button',label,className);node.type='button';node.onclick=action;return node;}
  function render() {
    if(!dialog.open)return;
    if(!current()){scope=getScope();cache=null;path=[];search.value='';error='接続アカウントが変わりました。一覧を読み込み直してください。';}
    const busy=reading||Boolean(listing&&listing.scope===scope);
    choices.setAttribute('aria-busy',String(busy));
    $('listCanvases').disabled=busy;$('canvasFile').disabled=busy;search.disabled=busy;
    $('listCanvases').textContent=busy?'読み込み中…':cache?'一覧を再読み込み':'OneDriveのCANVASデータを読取';
    status.classList.toggle('ci-loading',busy);
    const message=reading?'CANVASデータを読み込み中…':busy?'OneDriveのフォルダとファイルを読み込み中…':error|| (cache?cache.files.length+'件のCANVASデータを読み込みました。':'');
    if(status.textContent!==message)status.textContent=message;
    status.classList.toggle('ci-error',Boolean(error&&!busy));
    browser.hidden=!cache;choices.replaceChildren();crumbs.replaceChildren();
    if(!cache)return;
    const query=search.value;
    const root=button('CANVAS',()=>navigate([]));root.disabled=busy;crumbs.append(root);
    path.forEach((name,index)=>{crumbs.append(text('span','›'));const node=button(name,()=>navigate(path.slice(0,index+1)));node.disabled=busy;crumbs.append(node);});
    crumbs.lastElementChild?.setAttribute('aria-current','location');
    $('canvasUp').hidden=!path.length||Boolean(query.trim());$('canvasUp').disabled=busy;
    const entries=canvasEntries(cache,path,query);
    const info=query.trim()?'全フォルダの検索結果：'+entries.length+'件':'フォルダを選んで探せます。検索は全フォルダが対象です。';
    if($('canvasSearchInfo').textContent!==info)$('canvasSearchInfo').textContent=info;
    for(const entry of entries.slice(0,limit)) {
      const node=button('',()=>entry.kind==='folder'?navigate(entry.path):choose(entry),'ci-entry');
      node.disabled=busy;
      const icon=text('span',entry.kind==='folder'?'📁':'▤','ci-icon');icon.setAttribute('aria-hidden','true');node.append(icon);
      const labels=text('span','','ci-label');labels.append(text('span',entry.name));
      if(entry.kind==='folder')labels.append(text('small',entry.count+'件のCANVASデータ'));
      else if(query.trim())labels.append(text('small',entry.folders.join('/')||'CANVAS直下'));
      node.append(labels);node.setAttribute(entry.kind==='folder'?'data-canvas-folder':'data-canvas-choice',entry.kind==='folder'?entry.path.join('/'):entry.id);
      if(entry.kind==='folder')node.setAttribute('aria-label','フォルダ '+entry.name+'、'+entry.count+'件');
      choices.append(node);
    }
    if(!entries.length)choices.append(text('p',query.trim()?'一致するCANVASデータはありません。':'このフォルダにCANVAS JSONはありません。'));
    if(entries.length>limit){const more=button('さらに表示（残り'+(entries.length-limit)+'件）',()=>{const previous=limit;limit+=50;render();choices.children[previous]?.focus();});more.disabled=busy;choices.append(more);}
  }
  function navigate(next) {path=next.slice();search.value='';limit=50;render();crumbs.lastElementChild?.focus();}
  async function load() {
    if(reading||listing)return;
    if(!current()){scope=getScope();cache=null;path=[];search.value='';}
    error='';const pending={scope};listing=pending;render();
    try {const items=await request('canvasLibrary');if(listing===pending&&scope===pending.scope&&current()){cache=indexCanvases(items);path=[];limit=50;}}
    catch(cause){if(scope===pending.scope&&current())error=displayError(cause);}
    finally{if(listing===pending)listing=null;render();}
  }
  function displayError(cause){return (cause?.message||'読み込みが完了しませんでした。再試行してください。').replaceAll('作戦','CANVAS');}
  async function read(action) {
    if(reading||listing||!current())return;
    const captured={session,scope,target};reading=true;error='';render();
    try {
      const result=await action();
      if(dialog.open&&captured.session===session&&captured.scope===scope&&current()) {
        // The app verifies row identity; a stale result never replaces another menu.
        onChoose(result,captured.target);dialog.close();
      }
    }catch(cause){if(dialog.open&&captured.session===session&&current())error=displayError(cause);}
    finally{reading=false;$('canvasFile').value='';render();}
  }
  const choose=entry=>read(()=>request('readCanvas',{id:entry.id}));
  $('listCanvases').onclick=load;
  $('canvasFile').onchange=()=>{const file=$('canvasFile').files[0];if(file)read(async()=>{const raw=await readFile(file),info=await request('inspectCanvas',{raw});return {raw,info,source:'manual-import'};});};
  $('closeCanvas').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{session++;target=null;});
  dialog.addEventListener('cancel',()=>{session++;target=null;});
  search.oninput=()=>{limit=50;render();};
  $('canvasUp').onclick=()=>navigate(path.slice(0,-1));
  return {open(row) {
    session++;target=row;error='';
    if(scope!==getScope()){scope=getScope();cache=null;listing=null;path=[];search.value='';}
    dialog.showModal();render();
  }};
}
