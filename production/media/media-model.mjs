export const MEDIA_LIMIT = 50_000_000; // 一つの写真・動画は50MBまでとし、ブラウザのメモリ消費を制限します。
export const MEDIA_COUNT = 8; // 一メニューに添付できる件数を制限します。
export const MEDIA_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','video/mp4','video/quicktime','video/webm']); // 実行可能なSVGやHTMLを許可しません。
export function mediaAssert(ok,message,code='MEDIA'){if(!ok)throw Object.assign(new Error(message),{code});} // 保存本体の失敗とは区別できるエラーを返します。
export function mediaRef(value){ // 外部入力から必要なメタデータだけを取り出します。
  mediaAssert(value&&typeof value==='object'&&!Array.isArray(value),'添付の情報が不正です。'); // 空データや配列の混入を拒否します。
  mediaAssert(typeof value.hash==='string'&&/^[a-f0-9]{64}$/.test(value.hash),'添付の識別情報が不正です。'); // 任意のURLやパスを保存先へ流用しません。
  mediaAssert(typeof value.name==='string'&&value.name.trim()&&value.name.length<=180&&!/[\u0000-\u001f\u007f/\\]/.test(value.name),'添付のファイル名が不正です。'); // ファイル名にパスや制御文字を許可しません。
  mediaAssert(MEDIA_TYPES.has(value.type),'この写真・動画の形式には対応していません。'); // 許可したMIME型だけを使用します。
  mediaAssert(Number.isSafeInteger(value.size)&&value.size>0&&value.size<=MEDIA_LIMIT,'写真・動画は1ファイル50MB以内にしてください。'); // 大きさを読み込み前にも検査します。
  return {hash:value.hash,name:value.name,type:value.type,size:value.size}; // URL・資格情報・任意の追加属性はコピーしません。
} // 添付情報の検査を閉じます。
export function mediaList(values){if(values===undefined)return [];mediaAssert(Array.isArray(values)&&values.length<=MEDIA_COUNT,'写真・動画は1メニュー8件までです。');const result=values.map(mediaRef);mediaAssert(new Set(result.map(r=>r.hash)).size===result.length,'同じ写真・動画が重複しています。');return result;} // 未添付の過去データをそのまま読み込めます。
export function savedMedia(operations){const result=new Map();for(const op of operations){if(op.body?.kind!=='practice')continue;for(const item of op.body.payload.items)for(const ref of mediaList(item.media)){const old=result.get(ref.hash);mediaAssert(!old||(old.size===ref.size&&old.type===ref.type),'同じ添付の内容情報が一致しません。');result.set(ref.hash,ref);}}return [...result.values()];} // 過去の計画を含めて保存された添付だけを同期対象とします。
export async function digestBlob(blob){mediaAssert(blob instanceof Blob&&blob.size>0&&blob.size<=MEDIA_LIMIT,'写真・動画は1ファイル50MB以内にしてください。');const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');} // バイナリの検査値を求め、Base64をDBへ保存しません。
export async function inspectMedia(file){ // 拡張子だけでなくファイル先頭の識別子を確認します。
  mediaAssert(file instanceof Blob&&file.size>0&&file.size<=MEDIA_LIMIT,'空のファイルは添付できません。写真・動画は1ファイル50MB以内にしてください。'); // 大容量ファイルを全読込する前に止めます。
  const bytes=new Uint8Array(await file.slice(0,64).arrayBuffer());const at=(offset,text)=>[...text].every((ch,i)=>bytes[offset+i]===ch.charCodeAt(0));let type=''; // ごく小さい先頭領域だけでコンテナーを判定します。
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';else if(at(0,'\x89PNG\r\n\x1a\n'))type='image/png';else if(at(0,'GIF87a')||at(0,'GIF89a'))type='image/gif';else if(at(0,'RIFF')&&at(8,'WEBP'))type='image/webp'; // 一般的な画像の識別子を確認します。
  else if(at(4,'ftyp')){const brands=new TextDecoder('ascii').decode(bytes.slice(8));if(/avif|avis/.test(brands))type='image/avif';else if(/heic|heix|hevc|hevx/.test(brands))type='image/heic';else if(/mif1|msf1/.test(brands))type='image/heif';else if(at(8,'qt  '))type='video/quicktime';else if(/isom|iso[2-9]|mp4[12]|M4V |MSNV|avc1/.test(brands))type='video/mp4';} // iPhoneのHEIC・MOVも元形式のまま保持します。
  else if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3&&new TextDecoder().decode(bytes).includes('webm'))type='video/webm'; // WebMの識別情報も確認します。
  mediaAssert(type,'対応形式はJPEG・PNG・WebP・GIF・AVIF・HEIC/HEIF・MP4・MOV・WebMです。形式を確認してください。'); // HTML・SVG・未知のファイルを受け付けません。
  const name=String(file.name||'添付ファイル').replace(/[\u0000-\u001f\u007f/\\]/g,'_').trim().slice(0,180)||'添付ファイル'; // 表示名だけを安全な文字列へ整えます。
  return mediaRef({hash:await digestBlob(file),name,type,size:file.size}); // 元ファイルは変換せず、参照情報だけを返します。
} // ファイル確認を閉じます。
export function mediaFilename(ref){return 'M_'+mediaRef(ref).hash+'.bin';} // クラウドの実ファイル名を固定し、同じ内容を再利用します。
export function mediaSize(size){return size<1_000_000?Math.ceil(size/1000)+'KB':(size/1_000_000).toFixed(1)+'MB';} // 一覧では短いサイズ表記を使用します。
