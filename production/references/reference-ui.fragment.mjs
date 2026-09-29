let referenceTarget=null;let referenceBusy=false; // 資料の編集先と接続確認中の状態を保持します。
function currentReferenceAccess(){return referenceAccess({initialized,connected:cloudReady,online:navigator.onLine,authenticated:Boolean(auth.account),scope:auth.scope(),needsInteraction:auth.needsInteraction,blocked:state?.blocked,error:Boolean(syncFailure||state?.lastError)});} // 本人の有効な接続を画面でも確認します。
function referenceMarkup(item,index,editable=false){ // ファイル本体を読み込まずリンクだけを表示します。
  const list=validateReferences(item.references);if(!editable&&!list.length)return ''; // 旧データに不要な欄は増やしません。
  const entries=list.map(ref=>`<li><div><a href="${e(ref.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${e(ref.title)} ↗</a><small>${e(new URL(ref.url).hostname)}</small></div>${editable?`<div class="reference-actions"><button type="button" data-reference-edit="${e(ref.id)}" data-reference-row="${index}">変更</button><button type="button" data-reference-remove="${e(ref.id)}" data-reference-row="${index}" aria-label="${e(ref.title)}の関連付けを外す">外す</button></div>`:''}</li>`).join(''); // 実際のリンク先を示し表示文字列をエスケープします。
  return `<details class="reference-box" data-field="references"><summary>参考資料${list.length?'（'+list.length+'件）':''}</summary><ul class="reference-list">${entries}</ul>${editable?`<button type="button" data-reference-add="${index}">＋ リンクを追加</button><small class="reference-hint"></small>`:''}<small>リンク先で開きます。閲覧権限や元ファイルは変更しません。</small></details>`; // 空欄時は折りたたんで場所を取りません。
} // 資料欄の表示を閉じます。
function refreshReferenceControls(){ // 接続・切断時に追加ボタンを更新します。
  const access=currentReferenceAccess();document.querySelectorAll('[data-reference-add],[data-reference-edit]').forEach(button=>{const index=Number(button.dataset.referenceAdd??button.dataset.referenceRow);button.disabled=saving||referenceBusy||!access.allowed||(button.dataset.referenceAdd!==undefined&&(rows[index]?.references||[]).length>=MAX_REFERENCES);}); // 解除と閲覧は切断しても残します。
  document.querySelectorAll('#items .reference-hint').forEach((node,index)=>{node.textContent=(rows[index]?.references||[]).length>=MAX_REFERENCES?`1メニュー${MAX_REFERENCES}件まで登録できます。`:access.reason;}); // 操作できない理由を短く示します。
  $('referenceApply').disabled=referenceBusy||!access.allowed;$('referenceApply').textContent=referenceBusy?'接続を確認中…':'このメニューに反映'; // 確認中の連打を防ぎます。
  if($('referenceDialog').open&&!referenceBusy&&!access.allowed)$('referenceError').textContent=access.reason; // ダイアログ内でも切断を説明します。
} // 操作状態の更新を閉じます。
function openReferenceDialog(index,id=null){ // 新規追加と名前・URLの変更を同じ画面で扱います。
  const access=currentReferenceAccess();if(!access.allowed)throw new Error(access.reason);gather();const row=rows[index];if(!row)return; // 未接続時は入力画面を開きません。
  const existing=id?(row.references||[]).find(ref=>ref.id===id):null;if(id&&!existing)throw new Error('変更する参考資料が見つかりません。'); // 変更先の一致を確認します。
  if(!existing&&(row.references||[]).length>=MAX_REFERENCES)throw new Error(`参考資料は1メニュー${MAX_REFERENCES}件までです。`); // 上限を画面操作でも適用します。
  referenceTarget={row,index,id,scope:auth.scope(),bridge};$('referenceTitle').value=existing?.title||'';$('referenceUrl').value=existing?.url||'';$('referenceError').textContent='';$('referenceDialog').showModal();refreshReferenceControls();$('referenceUrl').focus(); // 元の行を記憶して別メニューへの誤反映を防ぎます。
} // 資料の入力開始を閉じます。
$('closeReference').onclick=()=>$('referenceDialog').close(); // キャンセルではメニューを変更しません。
$('referenceDialog').addEventListener('close',()=>{referenceTarget=null;}); // 閉じた後の遅い応答は採用しません。
$('referenceForm').addEventListener('submit',async event=>{ // 資料入力の確定だけを扱い、計画全体は別途保存します。
  event.preventDefault();if(referenceBusy)return;const target=referenceTarget;if(!target)return; // 二重送信や閉じた画面を除外します。
  try{const access=currentReferenceAccess();if(!access.allowed)throw new Error(access.reason);const input={title:$('referenceTitle').value,url:$('referenceUrl').value};const proposed=makeReference(input,target.id||undefined);const preview=[...(target.row.references||[]).filter(ref=>ref.id!==target.id),proposed];validateReferences(preview); // 通信前にURLと重複を検査します。
    referenceBusy=true;$('referenceError').textContent='';refreshReferenceControls();const checked=await request('referenceCheck',{input:proposed}); // 既存の本人OneDrive領域を読取確認します。
    if(referenceTarget!==target||rows[target.index]!==target.row||bridge!==target.bridge||auth.scope()!==target.scope||checked.scope!==target.scope)throw new Error('編集先またはアカウントが変わりました。追加し直してください。'); // 非同期処理中の切替を検出します。
    const after=currentReferenceAccess();if(!after.allowed)throw new Error(after.reason);const reference=makeReference(checked.reference,proposed.id); // 反映直前も接続が有効であることを要求します。
    const next=[...(target.row.references||[])];if(target.id)next[next.findIndex(ref=>ref.id===target.id)]=reference;else next.push(reference);target.row.references=validateReferences(next);dirty=true; // 元プランを変更せず編集中の参照だけを更新します。
    $('referenceDialog').close();renderRows();$('items').children[target.index].querySelector('.reference-box').open=true;saveFeedback('参考資料を反映しました。「練習を保存」で登録してください。'); // 保存前であることを明示します。
  }catch(error){$('referenceError').textContent=error.message||'リンクを追加できませんでした。';}finally{referenceBusy=false;refreshReferenceControls();} // 入力内容は失敗しても残します。
}); // 資料の確定処理を閉じます。
document.addEventListener('click',event=>{ // 既存のメニュー操作とは別に資料の操作を受け取ります。
  const button=event.target.closest('button');if(!button||saving)return;guard(async()=>{ // 保存中に資料を変更しません。
    if(button.dataset.referenceAdd!==undefined)openReferenceDialog(Number(button.dataset.referenceAdd)); // 新しい参考資料を追加します。
    if(button.dataset.referenceEdit)openReferenceDialog(Number(button.dataset.referenceRow),button.dataset.referenceEdit); // 保存済みの資料名やリンクを変更します。
    if(button.dataset.referenceRemove){gather();const index=Number(button.dataset.referenceRow);const row=rows[index];if(!row)return;row.references=(row.references||[]).filter(ref=>ref.id!==button.dataset.referenceRemove);dirty=true;renderRows();$('items').children[index].querySelector('.reference-box').open=true;saveFeedback('このメニューから関連付けを外しました。元ファイルは削除していません。保存して確定してください。');} // オフラインでも関連付けだけを解除できます。
  }); // 操作失敗は既存の案内で表示します。
}); // 資料操作の受付を閉じます。
