const permits=new WeakSet(); // 検証済みの一時的な取込許可だけを受け入れます。
const deny=(code,message)=>({allowed:false,code,message}); // 画面と処理で同じ停止理由を使います。
export function mediaImportAccess(value={}){ // 通信中の瞬間ではなく、OneDrive同期を利用できる状態か判定します。
  if(value.initialized!==true)return deny('NOT_READY','保存の準備が完了してから添付してください。'); // 初期化途中では追加しません。
  if(value.protected)return deny('PROTECTED','記録の保護中は添付を追加できません。表示された案内を確認してください。'); // データ保護の停止を優先します。
  if(value.closed)return deny('CLOSED','接続先が切り替わりました。接続を確認してファイルを選び直してください。'); // 閉じたアカウントへ追加しません。
  if(value.needsInteraction)return deny('REAUTH','添付するにはMicrosoftへの再接続が必要です。'); // 再認証を必要とする状態を接続済み扱いしません。
  if(!value.account||typeof value.scope!=='string'||!value.scope.startsWith('ms-'))return deny('SIGN_IN','写真・動画の追加にはOneDriveへの接続が必要です。'); // ゲストと未認証の過去記録モードを拒否します。
  if(value.scope!==value.storeScope||value.scope!==value.recordScope)return deny('ACCOUNT_CHANGED','アカウントの確認中です。接続が完了してから添付してください。'); // 計画・添付・認証の本人一致を求めます。
  if(value.connected!==true)return deny('NOT_CONNECTED','写真・動画の追加にはOneDriveへの接続が必要です。'); // Microsoftサインインだけでは許可しません。
  if(value.online!==true)return deny('OFFLINE','オフラインでは添付を追加できません。通信とOneDrive接続を確認してください。'); // 端末だけへの新規取込を禁止します。
  if(value.syncError)return deny('SYNC_ERROR','OneDriveとの通信を確認できません。同期を再試行してから添付してください。'); // 未完了の接続確認を成功扱いしません。
  return {allowed:true,code:'READY',message:'OneDrive接続中のみ追加できます。プラン保存後に添付を同期します。'}; // 転送していない待機時も接続が有効なら利用できます。
} // 許可条件の判定を閉じます。
function rejection(view){const error=new Error(view.message);error.code='MEDIA_IMPORT_'+view.code;return error;} // UIと試験で識別できるエラーにします。
export async function authorizeMediaImport(getState,verifyCloud,{signal}={}){ // ファイルの中身を読む前に接続を確認します。
  if(typeof getState!=='function'||typeof verifyCloud!=='function')throw rejection(deny('UNVERIFIED','OneDriveの接続を確認できません。')); // 確認関数の省略を許可しません。
  const initial=getState(),scope=initial?.scope; // 取込開始時の本人領域を固定します。
  const checkpoint=()=>{signal?.throwIfAborted();const current=getState();const access=mediaImportAccess(current);if(!access.allowed)throw rejection(access);if(current.scope!==scope)throw rejection(deny('ACCOUNT_CHANGED','アカウントが変わりました。ファイルを選び直してください。'));}; // 非同期処理の後も本人と接続を再確認します。
  checkpoint(); // 未接続ならクラウド確認やファイル読込にも進みません。
  const connection=await verifyCloud(); // 既存の本人用OneDrive領域を読取確認します。
  checkpoint(); // 確認待ちの間の切断やアカウント切替を検出します。
  if(connection?.scope!==scope||typeof connection?.folderId!=='string'||!connection.folderId.trim())throw rejection(deny('UNVERIFIED','OneDriveの同期先が一致しません。再接続してください。')); // 別人や未確認のフォルダーへ追加しません。
  const permit=Object.freeze({scope,assert:checkpoint});permits.add(permit);return permit; // トークンやフォルダーIDは許可証に保存しません。
} // 取込許可の発行を閉じます。
export function assertMediaImportPermit(permit,scope){ // 保存処理でも許可済みかを再検証します。
  if(!permit||!permits.has(permit)||permit.scope!==scope)throw rejection(deny('UNVERIFIED','添付には有効なOneDrive接続が必要です。接続してから選び直してください。')); // ボタンの有効化だけで制限を回避できないようにします。
  permit.assert(); // 期限切れ・切断・本人切替を保存直前まで検出します。
} // 保存層の取込制御を閉じます。
