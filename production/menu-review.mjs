// Completion is a page-session memo only. No storage, worker or cloud calls.
export function createMenuChecks(){
  let account;const revisions=new Map();
  function checks(scope,revision){if(account!==scope){account=scope;revisions.clear();}if(!revisions.has(revision))revisions.set(revision,new Set());return revisions.get(revision);}
  return {
    has:(scope,revision,index)=>checks(scope,revision).has(index),
    count:(scope,revision,length)=>[...checks(scope,revision)].filter(i=>i<length).length,
    set(scope,revision,index,complete){if(!Number.isSafeInteger(index)||index<0)throw new Error('Invalid menu index');const selected=checks(scope,revision);if(complete)selected.add(index);else selected.delete(index);}
  };
}

// Replace only the untouched starter row; keep all meaningful draft input.
export function isStarterRow(row,noTermId){
  return !row.name&&!row.category&&!row.rule&&!row.canvasRaw&&Number(row.minutes)===10&&
    row.termId===noTermId&&row.variationName==='基本条件'&&row.reason==='今日のゴールに合わせる'&&
    !(row.references||[]).length&&!(row.media||[]).length&&!row.pinned;
}
