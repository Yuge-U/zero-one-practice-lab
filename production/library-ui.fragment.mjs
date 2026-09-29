function currentCategories(){return categoryChoices(state?.practices||[],rows);} // 保存済みと編集中のカテゴリーを候補にします。
function openCategoryPicker(index){gather();const row=rows[index];if(!row)return;picker.open({title:'カテゴリーを選ぶ・追加',help:'検索して選択、または自由入力できます。新しいカテゴリーは練習の保存時に登録されます。',maxLength:80,allowCreate:true,createLabel:'使う',items:(_,query)=>currentCategories().filter(c=>matches(c.name+' '+c.keywords,query)).map(c=>({label:c.name,detail:c.custom?'追加したカテゴリー':'標準候補',value:c.name})),onChoose:value=>{rows[index].category=categoryName(value);dirty=true;renderRows();}});} // コーチングの進行区分とは別に分類します。
function openMenuPicker(index){gather();const row=rows[index];if(!row)return;picker.open({title:'保存済みメニューを選ぶ',help:'選ぶと時間・関連用語・Variation・条件・作戦をコピーします。元のメニューと実績は変更しません。',filter:row.category?categoryName(row.category):'',categories:currentCategories().map(c=>c.name),allowCreate:true,maxLength:160,createLabel:'新規入力する',items:(category,query)=>menuChoices(state?.practices||[],category,query).map(item=>({label:item.name,detail:`${item.category} · ${item.minutes}分 · ${item.variation} / ${item.planTitle}`,value:item})),onChoose:async value=>{ // 元の固定版を選択してから内容を読み込みます。
  if(typeof value==='string'){rows[index].name=value;rows[index].pinned=null;dirty=true;renderRows();return;} // 新しい名前はコピー元を作らず入力します。
  const detail=await request('detail',{revisionId:value.revisionId});const copied=rowsFromDetail(detail,true)[value.index];if(!copied)throw new Error('選択したメニューが見つかりません。'); // 関連不足のコピーを許しません。
  if(rows[index]!==row)throw new Error('編集中のメニューが変わりました。選び直してください。'); // 非同期読込中の入替を検出します。
  if(row.name.trim()&&!confirm('この欄の内容を選んだメニューで置き換えます。元の保存済みメニューは変更しません。続けますか？'))return; // 編集中の内容を黙って捨てません。
  if(copied.term&&!terms.some(t=>t.ID===copied.termId)&&copied.termId!==NO_TERM.ID)terms.push(copied.term);rows[index]=copied;dirty=true;renderRows();saveFeedback('メニューをコピーしました。内容を変更して「練習を保存」を押してください。'); // 保存するまで新しい記録を作りません。
}});} // 保存済みメニュー選択を閉じます。
function openTermPicker(index){gather();if(!rows[index])return;picker.open({title:'関連用語を検索',help:'英語・日本語・略語・定義で検索できます。関連用語なしでも保存できます。',maxLength:160,items:(_,query)=>termChoices(terms,query).map(term=>({label:term['正式/標準用語'],detail:[term['日本語推奨表記'],term.定義].filter(Boolean).join(' / '),value:term})),onChoose:term=>{rows[index].term=structuredClone(term);rows[index].termId=term.ID;rows[index].catalogRevision=catalogRevision;rows[index].pinned=null;dirty=true;renderRows();}});} // 選択した既存IDと定義を保存します。
let connecting=false; // 同じ本人接続を並行開始させません。
async function connectionAction(chooseAccount=false){ // 一つの入口で認証と保存フォルダーの接続を進めます。
  if(connecting||sending||saving)return;if(!initialized)throw new Error('保存領域の準備が完了してから接続してください。');connecting=true;refreshPresentation(); // 二重タップと準備前の接続を防ぎます。
  try{if(auth.account&&!auth.needsInteraction&&!chooseAccount){if(!cloudReady)await connectCloud(true);else await synchronize();return;} // 認証済みならMicrosoft画面を開き直しません。
    if(!requireDraftSafe())return;auth.setRemember?.($('rememberAccount').checked);auth.armConnection?.();clearTimeout(autoSync);cloudReady=false; // 本人が接続を押した時だけ認証へ進みます。
    if(worker){await request('close');bridge?.shutdown();bridge=null;worker=null;} // アカウントを切り替える前に旧DBを閉じます。
    try{await auth.signIn({chooseAccount});}catch(error){auth.clearConnectionIntent?.();const opened=await openWorker();initialized=true;refreshState(opened.state);throw error;} // 認証開始に失敗しても保存済み記録へ戻します。
  }finally{connecting=false;accountStatus();refreshPresentation();} // 正常時と失敗時の表示を更新します。
} // 一括接続を閉じます。
