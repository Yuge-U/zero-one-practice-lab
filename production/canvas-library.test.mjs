import test from 'node:test';
import assert from 'node:assert/strict';
import {indexCanvases,canvasEntries} from '../web/canvas-library.mjs';
const items=[{id:'a',path:'Shared/ピック.json'},{id:'b',path:'U15/BLOB/ピック.json'},{id:'c',path:'U15/obu/ＢＬＯＢ_縦スクリーン.json'},{id:'d',path:'root.json'},{id:'e',path:'<b>/__proto__/constructor.json'}];
test('CANVAS root exposes folders and direct files without flattening',()=>{
  const index=indexCanvases(items);assert.equal(index.root.count,5);
  assert.deepEqual(canvasEntries(index).map(i=>[i.kind,i.name]),[['folder','<b>'],['folder','Shared'],['folder','U15'],['file','root.json']]);
});
test('CANVAS folder hierarchy retains original names, paths and IDs',()=>{
  const index=indexCanvases(items);assert.deepEqual(canvasEntries(index,['U15']).map(i=>i.name),['BLOB','obu']);
  assert.equal(canvasEntries(index,['U15','BLOB'])[0].id,'b');assert.equal(canvasEntries(index,['Shared'])[0].id,'a');
  assert.equal(canvasEntries(index,['<b>','__proto__'])[0].id,'e');assert.deepEqual(canvasEntries(index,['missing']),[]);
});
test('CANVAS search spans all folders and normalizes case, kana and fullwidth',()=>{
  const index=indexCanvases(items);assert.deepEqual(canvasEntries(index,['Shared'],'blob すくりーん').map(i=>i.id),['c']);
  assert.deepEqual(new Set(canvasEntries(index,[],'ぴっく').map(i=>i.id)),new Set(['a','b']));
  assert.deepEqual(canvasEntries(index,[],'u15 blob ぴっく').map(i=>i.id),['b']);
});
test('CANVAS indexing and sorting never mutate metadata',()=>{
  const copy=structuredClone(items),index=indexCanvases(items);canvasEntries(index);canvasEntries(index,[],'json');assert.deepEqual(items,copy);
});
test('CANVAS empty libraries and searches return no entries',()=>{
  assert.deepEqual(canvasEntries(indexCanvases([])),[]);assert.deepEqual(canvasEntries(indexCanvases(items),[],'missing'),[]);
});
