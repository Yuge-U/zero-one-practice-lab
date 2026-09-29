export const MAX_REFERENCES = 8; // 1メニューに登録できる資料数を制限します。
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/; // 既存の明細と同じ形式の識別子を使います。
function requireValue(ok,message){if(!ok)throw Object.assign(new Error(message),{code:'INVALID'});} // 不正な入力を保存前に止めます。
export function referenceUrl(value){ // リンクを検証するだけで接続先への通信は行いません。
  requireValue(typeof value==='string'&&value.trim().length>0&&value.length<=2048,'参考資料のHTTPSリンクを2048文字以内で入力してください。'); // 長さと入力型を検査します。
  const raw=value.trim();requireValue(!/[\u0000-\u0020\u007f\\]/.test(raw)&&/^https:\/\//i.test(raw),'ブラウザで開けるHTTPSリンクを入力してください。'); // ローカルパス・別スキーム・制御文字を拒否します。
  let url;try{url=new URL(raw);}catch{throw Object.assign(new Error('リンクの形式を確認してください。'),{code:'INVALID'});} // 解釈できないURLは登録しません。
  requireValue(url.protocol==='https:'&&!url.username&&!url.password,'認証情報を含まないHTTPSリンクを使用してください。'); // URL内のユーザー名やパスワードを保存しません。
  const host=url.hostname.toLowerCase().replace(/\.$/,''); // 判定用のホスト名を揃えます。
  requireValue(host.includes('.')&&!host.includes(':')&&!/^(?:\d+\.){3}\d+$/.test(host)&&!/(^|\.)(localhost|local|internal|test|invalid)$/.test(host),'端末内やローカルネットワークではなく、公開サービスのHTTPSリンクを使用してください。'); // 端末固有アドレスは同期対象にしません。
  const secrets=/^(access_token|id_token|refresh_token|client_secret|api_key|apikey|password)$/i; // 認証応答を誤って貼ることを防ぎます。
  for(const key of [...url.searchParams.keys(),...new URLSearchParams(url.hash.slice(1)).keys()])requireValue(!secrets.test(key),'認証トークンではなく、資料の閲覧用リンクを貼り付けてください。'); // OneDriveの通常の共有リンクはそのまま扱います。
  requireValue(url.href.length<=2048,'参考資料のリンクは2048文字以内にしてください。');return url.href; // 正規化した閲覧URLだけを返します。
} // URL検証を閉じます。
export function makeReference(input,id=globalThis.crypto.randomUUID()){ // 新しく追加する資料情報を作ります。
  const url=referenceUrl(input?.url);requireValue(typeof input?.title==='string','資料名を文字で入力してください。'); // URLと表示名を独立して確認します。
  const title=input.title.trim()||new URL(url).hostname;requireValue(title.length<=160&&!/[\u0000-\u001f\u007f]/.test(title),'資料名は160文字以内の1行にしてください。'); // 名前の省略時は実際のドメイン名を表示します。
  requireValue(ID.test(id),'参考資料の識別子が不正です。');return {id,title,url}; // 資格情報やファイル本体を含めません。
} // 資料情報の作成を閉じます。
export function validateReferences(list){ // 保存・同期・バックアップの全経路で同じ検証を使います。
  if(list===undefined)return [];requireValue(Array.isArray(list)&&list.length<=MAX_REFERENCES,`参考資料は1メニュー${MAX_REFERENCES}件までです。`); // 旧データの省略はそのまま許可します。
  const ids=new Set(),urls=new Set();return list.map(item=>{ // 同じメニューで重複する情報を防ぎます。
    requireValue(item&&typeof item==='object'&&!Array.isArray(item)&&Object.keys(item).every(k=>['id','title','url'].includes(k)),'参考資料には名前と閲覧リンクだけを保存してください。'); // 保存項目を限定します。
    requireValue(typeof item.id==='string'&&ID.test(item.id),'参考資料の識別子が不正です。');const ref=makeReference(item,item.id); // 検証で識別子を勝手に補いません。
    requireValue(!ids.has(ref.id)&&!urls.has(ref.url),'同じメニューに同じ参考資料が重複しています。');ids.add(ref.id);urls.add(ref.url);return ref; // 入力を変更せず別の値を返します。
  }); // 個別の検査を閉じます。
} // 資料一覧の検査を閉じます。
export function referenceAccess({initialized=false,connected=false,online=false,authenticated=false,scope='',needsInteraction=false,blocked=false,error=false}={}){ // 新しい関連付けの利用条件を判定します。
  if(!initialized||blocked)return {allowed:false,reason:'保存領域の準備・確認が必要です。'}; // 準備前や保護停止中は追加しません。
  if(!authenticated||!connected||!scope.startsWith('ms-'))return {allowed:false,reason:'追加・変更にはOneDriveへの接続が必要です。'}; // ゲストとサインインだけの状態を除外します。
  if(!online)return {allowed:false,reason:'オフラインのため追加・変更できません。'}; // 新規登録だけをオンラインに限定します。
  if(needsInteraction||error)return {allowed:false,reason:'OneDriveに再接続・再同期してから追加してください。'}; // 有効でない接続を成功と見せません。
  return {allowed:true,reason:'資料名とHTTPSリンクだけを保存します。'}; // 実際の送受信中だけに限定しません。
} // 許可条件を閉じます。
export function referenceKey(list){return JSON.stringify(validateReferences(list).map(({title,url})=>[title,url]));} // リンクが異なるメニューを候補一覧で混ぜません。
