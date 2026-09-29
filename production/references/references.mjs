export const MAX_REFERENCES=8; // 一つのメニューへ関連付けられる件数です。
function requireValue(ok,message){if(!ok){const error=new Error(message);error.code='REFERENCE';throw error;}} // 入力の不備を保存エラーとして説明します。
export function referenceUrl(value){ // ファイルを取得せずリンク文字列だけを検査します。
  requireValue(typeof value==='string'&&value.length<=2048,'リンクは2048文字以内で入力してください。'); // 想定外の型と過大入力を拒否します。
  const raw=value.trim();requireValue(raw&&!/[\u0000-\u0020\u007f\\]/u.test(raw),'リンク内の空白・改行を確認してください。'); // 制御文字や区切りの曖昧なURLを拒否します。
  let url;try{url=new URL(raw);}catch{throw Object.assign(new Error('https://から始まる閲覧用リンクを入力してください。'),{code:'REFERENCE'});} // 相対パスは受け入れません。
  requireValue(url.protocol==='https:'&&!url.username&&!url.password,'HTTPSの閲覧用リンクを使用してください。端末内のパスや認証情報付きURLは登録できません。'); // 実行可能な方式とパスワード付きURLを拒否します。
  const host=url.hostname.toLowerCase().replace(/\.$/,'');requireValue(host.includes('.')&&!host.includes(':')&&!host.startsWith('[')&&!/^\d+(\.\d+){3}$/.test(host)&&!/(^|\.)(localhost|local|internal|test|invalid)$/.test(host),'外部サービスの閲覧用リンクを使用してください。端末内・ローカルネットワークの参照は対象外です。'); // ローカルパスや数値IPを対象外にします。
  requireValue([...url.searchParams.keys()].every(key=>!['access_token','id_token','refresh_token','client_secret'].includes(key.toLowerCase())),'認証トークンではなく、資料の閲覧用リンクを入力してください。'); // アクセストークンを参考資料として保存しません。
  requireValue(url.href.length<=2048,'リンクは2048文字以内で入力してください。');return url.href; // 通常の共有用クエリと再生位置は保持します。
} // URLの文字列検査を閉じます。
export function normalizeReferences(value){ // 任意項目として過去の計画とも互換にします。
  if(value===undefined)return [];requireValue(Array.isArray(value)&&value.length<=MAX_REFERENCES,`参考資料は1メニュー${MAX_REFERENCES}件までです。`);const seen=new Set(); // 無指定と空の一覧を許可します。
  return value.map(ref=>{requireValue(ref&&typeof ref==='object'&&!Array.isArray(ref)&&Object.keys(ref).every(key=>['title','url'].includes(key)),'参考資料の形式を確認してください。');requireValue(typeof ref.title==='string'&&ref.title.trim()&&ref.title.length<=160,'資料名は1〜160文字で入力してください。');const url=referenceUrl(ref.url);requireValue(!seen.has(url),'同じリンクがこのメニューに登録されています。');seen.add(url);return {title:ref.title.trim(),url};}); // 元の配列を変更せず最小限の情報だけを返します。
} // 参考資料の検査を閉じます。
export function referenceProvider(value){const host=new URL(referenceUrl(value)).hostname.toLowerCase();const under=domain=>host===domain||host.endsWith('.'+domain);if(under('1drv.ms')||under('onedrive.live.com')||under('sharepoint.com'))return 'OneDrive / SharePoint';if(under('drive.google.com')||under('docs.google.com'))return 'Google Drive';if(under('dropbox.com'))return 'Dropbox';if(under('icloud.com'))return 'iCloud Drive';if(under('youtube.com')||under('youtu.be'))return 'YouTube';return 'Webリンク';} // 名称はホストから導き、閲覧権限の確認済みとは表示しません。
export function referenceAccess({initialized=false,account=false,scope='',storageScope='',connected=false,online=true,needsInteraction=false,blocked=false,error=false}={}){ // 新しい関連付けだけにOneDrive利用条件を適用します。
  if(!initialized)return '保存領域を準備しています。';if(!account||!/^ms-[a-f0-9]{64}$/.test(scope)||scope!==storageScope||!connected)return 'リンクの追加にはOneDriveへの接続が必要です。';if(needsInteraction)return 'OneDriveへ再接続してから追加してください。';if(!online)return 'オンラインに戻ってから追加してください。';if(blocked||error)return '同期の問題を解消してから追加してください。';return ''; // 同期処理の実行中だけに追加を限定しません。
} // 画面で使う理由表示を閉じます。
export function hasNewReferences(input,operations){const known=new Set();for(const op of operations)if(op.body.kind==='practice')for(const item of op.body.payload.items||[])for(const ref of normalizeReferences(item.references))known.add(ref.url);return (input.items||[]).some(row=>normalizeReferences(row.references??row.pinned?.references).some(ref=>!known.has(ref.url)));} // 過去の同一アカウントの参照をコピーする操作と、新URLの登録を分離します。
