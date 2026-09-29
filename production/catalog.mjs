// カテゴリーは公式分類の転記ではなく、練習を探すための初期候補です。
export const DEFAULT_CATEGORIES = [ // 技術・戦術・準備・振り返りを横断する大項目です。
  ['ウォーミングアップ','warm up warmup アップ 準備運動'], // 練習開始前の準備です。
  ['コーディネーション','coordination コーディネーション 運動遊び'], // 身体操作を扱います。
  ['フットワーク','footwork ステップ 足運び'], // 攻守の足運びです。
  ['アジリティ・反応','agility reaction 敏捷性 反応'], // 方向転換と反応です。
  ['バランス・姿勢','balance stance スタンス'], // 姿勢と重心の扱いです。
  ['ボールハンドリング','ball handling ハンドリング'], // ボールを扱う基礎です。
  ['ドリブル','dribble dribbling'], // ドリブルの技術です。
  ['パス・キャッチ','pass passing catch catching パッシング'], // パスと受ける技術です。
  ['ピボット・ストップ','pivot stop stopping ジャンプストップ'], // 停止と方向転換です。
  ['シュート','shoot shooting シューティング'], // シュート全般です。
  ['フリースロー','free throw FT'], // フリースローです。
  ['レイアップ・フィニッシュ','layup finishing finish レイアップ'], // ゴール付近の得点技術です。
  ['リバウンド','rebound rebounding'], // ボールを確保する技術です。
  ['ボックスアウト','box out block out スクリーンアウト'], // リバウンド前の位置取りです。
  ['1対1','1on1 1v1 ワンオンワン'], // 対人の攻防です。
  ['数的優位・不利','advantage disadvantage 2on1 3on2 2対1 3対2'], // 人数差のある攻防です。
  ['少人数ゲーム','small sided games SSG 2on2 3on3 2対2 3対3'], // 小人数での判断と連携です。
  ['スペーシング','spacing 5out 5アウト'], // 攻撃の間隔です。
  ['オフボール','off ball offball ボールを持たない'], // ボールを持たない動きです。
  ['カット','cut cutting カッティング'], // 空間への移動です。
  ['スクリーン','screen screening オフボールスクリーン'], // スクリーンの連携です。
  ['ピック＆ロール','pick and roll pick roll PNR P&R ピックアンドロール'], // ボールスクリーンの攻防です。
  ['ポストプレー','post play post move'], // ポストでの攻防です。
  ['チームオフェンス','team offense offence OF 攻撃'], // チームの攻撃です。
  ['対人ディフェンス','individual defense defence DF オンボール'], // 個人の守備です。
  ['クローズアウト','closeout close out'], // ボールマンへの接近です。
  ['ヘルプ・ローテーション','help rotation ヘルプディフェンス'], // 守備の助け合いです。
  ['チームディフェンス','team defense defence DF 守備'], // チームの守備です。
  ['プレス・プレスブレイク','press press break プレスダウン'], // 全面の守備とその攻略です。
  ['トランジション','transition fast break 速攻 切り替え'], // 攻守の切り替えです。
  ['セットプレー','set play set offense'], // 共通の開始配置と連携です。
  ['スローイン','inbound inbounds BLOB SLOB アウトオブバウンズ'], // 境界線からの再開です。
  ['特殊状況','situations end game 終盤 時計 得点差'], // 時間と得点差を含む状況です。
  ['ゲーム・スクリメージ','game scrimmage 5on5 5対5'], // 実戦形式です。
  ['体力・コンディショニング','conditioning fitness 持久力'], // 身体の準備と体力です。
  ['筋力・体幹','strength core 自重'], // 筋力と体幹です。
  ['モビリティ・柔軟性','mobility flexibility stretching ストレッチ'], // 可動性を扱います。
  ['クールダウン','cool down cooldown 整理運動'], // 練習後の整理です。
  ['コミュニケーション','communication 声掛け チームビルディング'], // 意思疎通を扱います。
  ['ミーティング・振り返り','meeting reflection review ミーティング'], // 目標共有と学びの整理です。
  ['給水・休憩','water hydration break rest 給水'], // 練習中の休憩です。
  ['その他','other'], // 初期候補に当てはまらない内容です。
  ['未分類','uncategorized'], // 旧データを勝手に分類しないための項目です。
].map(([name,keywords])=>Object.freeze({name,keywords})); // 初期候補を共通形式にします。
export const NO_TERM = Object.freeze({ID:'ZEROONE_INTERNAL_NO_TERM','正式/標準用語':'関連用語なし','日本語推奨表記':'未指定',zeroOneNoTerm:true}); // 公式用語ではない内部の未指定状態です。
export function searchKey(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0x60)).replace(/\s+/g,' ').trim();} // 大小文字・全半角・かな表記の差を吸収します。
export function matches(value,query){const hay=searchKey(value);return searchKey(query).split(' ').filter(Boolean).every(part=>hay.includes(part));} // 複数語でも検索できます。
export function categoryName(value){const name=String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim();return DEFAULT_CATEGORIES.find(c=>searchKey(c.name)===searchKey(name))?.name||name||'未分類';} // 空白は未分類として扱い、意味を推測しません。
export function categoryChoices(practices=[],rows=[]){ // このアカウントの保存済みメニューから追加候補を集めます。
  const result=new Map(DEFAULT_CATEGORIES.map(c=>[searchKey(c.name),c])); // 初期候補の並びを維持します。
  const add=value=>{if(typeof value!=='string'||!value.trim())return;const name=categoryName(value);if(name.length<=80&&!result.has(searchKey(name)))result.set(searchKey(name),{name,keywords:name,custom:true});}; // 自由入力の重複を防ぎます。
  for(const practice of practices)for(const head of practice.heads||[])for(const item of head.body?.payload?.items||[])add(item.category); // 過去に保存したカテゴリーも保持します。
  rows.forEach(row=>add(row.category));return [...result.values()]; // 未保存の候補も編集中は選択できます。
} // カテゴリー候補を閉じます。
export function menuChoices(practices=[],category='',query=''){ // 再利用できる最新の保存済みメニューを選びます。
  const items=[]; // 計画名や実施記録は複製対象にしません。
  for(const practice of practices){if(practice.heads?.length!==1)continue;const head=practice.heads[0];if(head.body.payload.archived||head.readiness?.ready===false)continue; // 競合・関連不足・アーカイブは勝手に採用しません。
    for(const [index,item]of head.body.payload.items.entries()){const name=categoryName(item.category);if(category&&searchKey(name)!==searchKey(categoryName(category)))continue; // 選んだ大項目だけに絞ります。
      const variant=item.resolved?.variationName||'基本条件';const searchable=[item.name,name,variant,item.resolved?.rule,head.body.payload.title].join(' ');if(!matches(searchable,query))continue; // メニュー名・条件・出典で検索できます。
      items.push({name:item.name,category:name,variation:variant,minutes:item.minutes,rule:item.resolved?.rule||'',revisionId:head.body.opId,index,planTitle:head.body.payload.title,date:head.body.createdAt,key:JSON.stringify([name,item.name,item.minutes,item.termHash,item.canvasHash,item.drillHash,item.variationHash])}); // コピー元の固定版を識別します。
    } // 計画内メニューの収集を終えます。
  } // 計画一覧の収集を終えます。
  items.sort((a,b)=>b.date.localeCompare(a.date)||a.revisionId.localeCompare(b.revisionId));const seen=new Set();return items.filter(item=>{if(seen.has(item.key))return false;seen.add(item.key);return true;}); // 同じ内容の複製を並べ過ぎません。
} // メニュー候補を閉じます。
export function termChoices(terms,query=''){return [NO_TERM,...terms.filter(t=>t.ID!==NO_TERM.ID)].filter(t=>matches(Object.values(t).filter(v=>typeof v==='string').join(' '),query));} // 英語・日本語・略語・定義で検索します。
