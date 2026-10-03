export const MENU_STRUCTURE_FORMAT='zero-one-menu-structure'; // 既存の練習記録と保存済み構成を識別します。
export const menuStructureName=practice=>{const value=practice?.heads?.length===1?practice.heads[0].body?.payload?.menuStructure:null;return practice.heads[0].body.kind==='practice'&&value?.format===MENU_STRUCTURE_FORMAT&&practice.heads[0].body.payload.archived===true&&typeof value.name==='string'?value.name:null;}; // アーカイブした互換形式の練習記録だけを構成として読みます。
export function menuStructureChoices(practices=[]){ // 本人の同期済み・未送信の保存履歴から構成候補を作ります。
  const values=new Map(); // 同名構成の改訂を一つの候補へまとめます。
  for(const practice of practices){if(practice.heads?.length!==1)continue;const name=menuStructureName(practice);if(!name)continue;const head=practice.heads[0];const key=name.normalize('NFKC').trim().toLowerCase();const candidate={name,revisionId:head.body.opId,entityId:practice.id,count:head.body.payload.items.length,createdAt:head.body.createdAt};const old=values.get(key);if(!old||candidate.createdAt>old.createdAt)values.set(key,candidate);} // 競合中の構成は誤って読み込みません。
  return [...values.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.name.localeCompare(b.name,'ja')); // 新しい構成から検索候補に並べます。
} // 構成候補を閉じます。
export function findMenuStructure(practices,name){const key=String(name||'').normalize('NFKC').trim().toLowerCase();return menuStructureChoices(practices).find(item=>item.name.normalize('NFKC').trim().toLowerCase()===key)||null;} // 同じ名前の保存は同じ構成履歴を更新します。
