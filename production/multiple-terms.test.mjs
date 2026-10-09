import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {AppService} from '../web/core/service.mjs';
import {buildPlan} from '../web/core/planner.mjs';
import {buildPlan as oldBuildPlan} from '../previous-web/core/planner.mjs';
import {validateObject as oldValidateObject,validateOperation as oldValidateOperation,VERSION as oldVersion} from '../previous-web/core/model.mjs';
import {makeObject,VERSION,seal} from '../web/core/model.mjs';
import {rowsFromDetail} from '../web/draft.mjs';
import {NO_TERM} from '../web/catalog.mjs';
import {snapshotTerms,rowTerms,validateSelections} from '../web/multiple-terms.mjs';
const A={ID:'TERM_A','正式/標準用語':'Screen away','日本語推奨表記':'スクリーンアウェイ',定義:'ボールから離れてスクリーンをかける'},B={ID:'TERM_B','正式/標準用語':'Cut','日本語推奨表記':'カット',定義:'空間へ移動する'};
const entries=[{record:A,catalogRevision:'catalog-A'},{record:B,catalogRevision:'catalog-B'}];
const input=(selected=entries)=>({title:'複数用語の練習',goal:'判断を確認',team:'U15',players:15,totalMinutes:60,items:[{section:'BODY',name:'連携',category:'オフボール',minutes:10,term:selected[0]?.record||NO_TERM,catalogRevision:selected[0]?.catalogRevision||'catalog-A',termSelections:structuredClone(selected),rule:'声をかける'}]});
function service(t){const app=new AppService(new DatabaseSync(':memory:'),'guest-local');t.after(()=>app.repo.close());return app;}
async function saved(t){const app=service(t),result=await app.run('savePlan',{input:input()}),detail=await app.run('detail',{revisionId:result.operation.body.opId});return{app,result,detail};}
test('M01 zero and single term keep exact 1.3.6 objects and unchanged schema',()=>{
  assert.equal(VERSION,oldVersion);
  for(const record of [NO_TERM,A]){const plan=input([]);plan.items[0].id='00000000-0000-4000-8000-000000000001';plan.items[0].term=record;delete plan.items[0].termSelections;assert.deepEqual(buildPlan(plan),oldBuildPlan(plan));}
});
test('M02 multiple terms save and read their original IDs, revisions and definitions',async t=>{
  const {result,detail}=await saved(t);const item=result.operation.body.payload.items[0],payload=detail.objects.find(o=>o.hash===item.termHash).body.payload;
  assert.deepEqual(snapshotTerms(payload),entries);assert.equal(payload.id,A.ID);assert.equal(result.operation.body.objectRefs.length,4);assert.deepEqual(rowTerms(rowsFromDetail(detail)[0]),entries);
});
test('M03 copy, past-menu row copy and condition edits keep all terms without changing original',async t=>{
  const {app,result,detail}=await saved(t),before=JSON.stringify(detail),row=rowsFromDetail(detail,true)[0];
  const copy=await app.run('savePlan',{input:{...input(),items:[row]}});assert.equal(copy.operation.body.payload.items[0].termHash,result.operation.body.payload.items[0].termHash);
  row.rule='応用';row.pinned=null;await app.run('savePlan',{input:{...input(),items:[row]}});assert.deepEqual(rowTerms(rowsFromDetail(await app.run('detail',{revisionId:app.repo.state().practices.at(-1).heads[0].body.opId}))[0]),entries);
  assert.equal(JSON.stringify(await app.run('detail',{revisionId:result.operation.body.opId})),before);
});
test('M04 saved menu structures include every selected term',async t=>{
  const {app,detail}=await saved(t);const structure=await app.run('saveMenuStructure',{name:'連携構成',items:rowsFromDetail(detail,true)});
  const copy=await app.run('detail',{revisionId:structure.operation.body.opId});assert.deepEqual(rowTerms(rowsFromDetail(copy,true)[0]),entries);
});
test('M05 sync ingestion and backup restore carry the complete immutable snapshot',async t=>{
  const {app,result}=await saved(t),other=service(t);other.repo.ingest(app.repo.operations(),app.repo.objects());assert(other.repo.readiness(result.operation.body.opId).ready);
  assert.deepEqual(rowTerms(rowsFromDetail(await other.run('detail',{revisionId:result.operation.body.opId}))[0]),entries);
  const restored=service(t);restored.repo.restore(app.repo.backup());assert.deepEqual(restored.repo.objects(),app.repo.objects());assert.deepEqual(restored.repo.pending(),app.repo.pending());
});
test('M06 1.3.6 accepts the optional term field and all existing graph references',async t=>{
  const {app,result}=await saved(t);oldValidateOperation(result.operation,'guest-local');app.repo.objects().forEach(oldValidateObject);
});
test('M07 invalid IDs, duplicate IDs, no-term mixtures and nonarrays are rejected before ingest',async t=>{
  const app=service(t),primary={catalog:'zero-one-terminology',id:A.ID,catalogRevision:'catalog-A',record:A};
  for(const additional of ['bad',[],[{record:A,catalogRevision:'rev'}],[{record:NO_TERM,catalogRevision:'rev'}],[{record:{...B,ID:'<bad>'},catalogRevision:'rev'}],[{record:{...B,'正式/標準用語':''},catalogRevision:'rev'}],Array.from({length:100},(_,i)=>({record:{...B,ID:'T_'+i},catalogRevision:'rev'}))]){
    const wire=makeObject('term',{...primary,additionalTerms:additional});assert.throws(()=>app.repo.ingest([],[wire]));assert.equal(app.repo.objects().length,0);
  }
  assert.throws(()=>validateSelections([{record:A,catalogRevision:'x'},{record:A,catalogRevision:'x'}]));
  assert.throws(()=>validateSelections([{record:Object.assign([],{...A}),catalogRevision:'x'}]));
  assert.throws(()=>validateSelections([Object.assign([],{record:A,catalogRevision:'x'})]));
});
test('M08 changed selections create a new fixed version and preserve old history and pending',async t=>{
  const {app,result,detail}=await saved(t),row=rowsFromDetail(detail)[0];row.termSelections=[entries[1]];row.term=B;row.termId=B.ID;row.catalogRevision='catalog-B';row.pinned=null;
  const edited=await app.run('savePlan',{revisionId:result.operation.body.opId,input:{...input(),items:[row]}});assert.notEqual(edited.operation.body.payload.items[0].termHash,result.operation.body.payload.items[0].termHash);
  assert.deepEqual(rowTerms(rowsFromDetail(await app.run('detail',{revisionId:result.operation.body.opId}))[0]),entries);assert.equal(app.repo.pending().length,2);
});
test('M09 clearing every term saves the existing no-term record',async t=>{
  const app=service(t),result=await app.run('savePlan',{input:input([])}),detail=await app.run('detail',{revisionId:result.operation.body.opId});assert.deepEqual(rowTerms(rowsFromDetail(detail)[0]),[]);const term=detail.objects.find(o=>o.body.kind==='term');assert.equal(term.body.payload.id,NO_TERM.ID);assert(!('additionalTerms' in term.body.payload));
});
test('M10 unrelated legacy objects still validate byte-for-byte',async t=>{
  const app=service(t),result=await app.run('savePlan',{input:input([entries[0]])}),body=structuredClone(result.operation.body);const legacy=seal(body);oldValidateOperation(legacy,'guest-local');assert.equal(app.repo.getOp(legacy.body.opId).hash,legacy.hash);
});
