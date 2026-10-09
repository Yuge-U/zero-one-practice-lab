import {NO_TERM} from './catalog.mjs';
export const MAX_TERMS=100;
const invalid=message=>{throw Object.assign(new Error(message),{code:'INVALID'});};
export function validateSelections(entries){
  if(!Array.isArray(entries)||entries.length>MAX_TERMS)invalid('関連用語は100語まで選択できます。');
  const ids=new Set();
  for(const entry of entries){const record=entry?.record;
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||!record||typeof record!=='object'||Array.isArray(record)||typeof record.ID!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(record.ID)||record.ID===NO_TERM.ID||record.zeroOneNoTerm||ids.has(record.ID))invalid('関連用語のIDが不正または重複しています。');
    if(typeof record['正式/標準用語']!=='string'||!record['正式/標準用語'].trim()||record['正式/標準用語'].length>4000)invalid('関連用語の名称が不正です。');
    if(typeof entry.catalogRevision!=='string'||entry.catalogRevision.length>100)invalid('関連用語の読込元を確認してください。');
    ids.add(record.ID);
  }
  return entries;
}
export function snapshotTerms(payload){
  const primary=payload.record?.ID===NO_TERM.ID||payload.record?.zeroOneNoTerm?[]:[{record:payload.record,catalogRevision:payload.catalogRevision||''}];
  if(payload.additionalTerms!==undefined){
    if(!primary.length||!Array.isArray(payload.additionalTerms)||!payload.additionalTerms.length)invalid('追加の関連用語が不正です。');
    validateSelections([...primary,...payload.additionalTerms]);
  }
  return [...primary,...(payload.additionalTerms||[])];
}
export function rowTerms(row){return row.termSelections===undefined?snapshotTerms({record:row.term,catalogRevision:row.catalogRevision}):validateSelections(row.termSelections);}
export function termPayload(row,record,catalogRevision){
  const selected=rowTerms({...row,catalogRevision});
  if(selected.length?selected[0].record.ID!==record.ID:record.ID!==NO_TERM.ID)invalid('関連用語の選択状態が一致しません。');
  const payload={catalog:'zero-one-terminology',id:record.ID,catalogRevision:selected[0]?.catalogRevision||catalogRevision,record};
  if(selected.length>1)payload.additionalTerms=structuredClone(selected.slice(1));
  return payload;
}
