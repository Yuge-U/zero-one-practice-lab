import test from 'node:test';
import assert from 'node:assert/strict';
import {versionParts,assertVersionIncrease,comparisonCommit} from '../version-policy.mjs';

test('published changes must increase the version numerically',()=>{
  for(const [before,after] of [['1.3.4','1.3.5'],['1.3.9','1.3.10'],['1.9.9','1.10.0'],['1.99.99','2.0.0']])assert.doesNotThrow(()=>assertVersionIncrease(before,after));
  for(const [before,after] of [['1.3.4','1.3.4'],['1.3.4','1.3.3'],['1.3.10','1.3.9'],['2.0.0','1.99.99']])assert.throws(()=>assertVersionIncrease(before,after));
});
test('versions reject ambiguous or unsafe formats',()=>{
  for(const value of ['1.3','v1.3.5','1.3.5-beta','01.3.5','1.3.05','1.3.5\n','1.3.x','1.3.9007199254740992'])assert.throws(()=>versionParts(value));
});
test('release checks use the PR base or previous main commit',()=>{
  const sha='a'.repeat(40);assert.equal(comparisonCommit('pull_request',{pull_request:{base:{sha,ref:'main',repo:{full_name:'Yuge-U/zero-one-practice-lab'}}}},'Yuge-U/zero-one-practice-lab'),sha);
  assert.equal(comparisonCommit('push',{ref:'refs/heads/main',before:sha},'Yuge-U/zero-one-practice-lab'),sha);
  assert.equal(comparisonCommit('workflow_dispatch',{},'Yuge-U/zero-one-practice-lab'),null);
});
test('release checks fail closed on missing, invalid or unrelated comparisons',()=>{
  for(const event of [{ref:'refs/heads/main',before:'main'},{ref:'refs/heads/main',before:'0'.repeat(40)},{ref:'refs/heads/other',before:'a'.repeat(40)}])assert.throws(()=>comparisonCommit('push',event,'Yuge-U/zero-one-practice-lab'));
  assert.throws(()=>comparisonCommit('pull_request',{pull_request:{base:{sha:'a'.repeat(40),ref:'main',repo:{full_name:'other/repo'}}}},'Yuge-U/zero-one-practice-lab'));
});
