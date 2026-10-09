import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMenuChecks,isStarterRow} from '../web/menu-review.mjs';
test('temporary checks survive same revision redraw, isolate plans and reset on reload/account switch',()=>{
  const checks=createMenuChecks();checks.set('A','plan1',1,true);
  assert.equal(checks.has('A','plan1',1),true);assert.equal(checks.has('A','plan2',1),false);
  assert.equal(checks.count('A','plan1',3),1);assert.equal(createMenuChecks().has('A','plan1',1),false);
  checks.set('A','plan1',1,false);assert.equal(checks.count('A','plan1',3),0);
  checks.set('A','plan1',1,true);assert.equal(checks.has('B','plan1',1),false);assert.equal(checks.has('A','plan1',1),false);
  assert.throws(()=>checks.set('A','plan1',NaN,true));
});
test('only an untouched starter row can be replaced when adding a past menu',()=>{
  const row={name:'',category:'',rule:'',canvasRaw:'',minutes:'10',termId:'none',variationName:'基本条件',reason:'今日のゴールに合わせる',references:[],media:[]};
  assert(isStarterRow(row,'none'));
  for(const [field,value]of Object.entries({name:'給水',category:'その他',rule:'休憩',canvasRaw:'{}',minutes:5,termId:'real',variationName:'応用',reason:'目的',references:[{}],media:[{}],pinned:{}}))assert.equal(isStarterRow({...row,[field]:value},'none'),false,field);
});
