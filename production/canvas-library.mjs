import {matches} from './catalog.mjs';

// Index metadata only. Keep original paths and IDs for the existing read-only API.
export function indexCanvases(items) {
  const root={name:'CANVAS',path:[],folders:new Map(),files:[],count:0};
  const files=[];
  for(const item of items) {
    const parts=String(item.path||item.name||'').split('/').filter(Boolean);
    if(!parts.length)continue;
    const name=parts.pop(),file={...item,name,folders:parts,path:[...parts,name].join('/')};
    files.push(file);let folder=root;folder.count++;
    for(const name of parts) {
      if(!folder.folders.has(name))folder.folders.set(name,{name,path:[...folder.path,name],folders:new Map(),files:[],count:0});
      folder=folder.folders.get(name);folder.count++;
    }
    folder.files.push(file);
  }
  return {root,files};
}
const order=(a,b)=>a.name.localeCompare(b.name,'ja',{numeric:true})||String(a.id||'').localeCompare(String(b.id||''));
export function canvasEntries(index,path=[],query='') {
  if(query.trim())return index.files.filter(file=>matches(file.path,query)).sort(order).map(file=>({kind:'file',...file}));
  let folder=index.root;
  for(const part of path) {folder=folder.folders.get(part);if(!folder)return [];}
  return [
    ...Array.from(folder.folders.values()).sort(order).map(folder=>({kind:'folder',name:folder.name,path:folder.path,count:folder.count})),
    ...folder.files.slice().sort(order).map(file=>({kind:'file',...file}))
  ];
}
