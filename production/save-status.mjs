export function syncView(state, {connected=false, busy=false, online=true, account=false}={}) { // 保存済みデータの同期状態だけを表示用に整理します。
  const view=(title,tone,detail,action='今すぐ同期')=>({title,tone,detail,action}); // 色だけに依存せず状態を言葉でも伝えます。
  if(!state)return view('保存の準備中…','busy','準備が完了するまでお待ちください。'); // 未初期化を保存成功に見せません。
  const pending=Number(state.pending)||0;const count=Number(state.operationCount)||0;const practices=state.practices||[]; // 記録と送信待ちの実数を使います。
  const date=new Date(state.lastCheckedAt||NaN);const checked=Number.isFinite(date.getTime());const time=checked?date.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}):''; // 日付付きで最後に確認した時刻を示します。
  if(state.blocked)return view('⚠ データの確認が必要です','error','記録を保護するため保存・同期を停止しています。詳細は上の案内を確認してください。'); // 保護停止を成功表示より優先します。
  if(practices.some(p=>p.heads.length>1))return view('⚠ 練習の変更が重複しています','warning','「保存した練習」で採用する内容を確認してください。'); // 競合時は自動解決済みと表示しません。
  if(!connected)return view(account?'OneDrive未接続':'この端末のみで利用中','local',account?'「接続・バックアップ」からOneDriveに接続してください。':'練習はこのブラウザ内に保存します。他の端末には反映されません。','OneDrive未接続'); // ゲストの記録が自動移行されるとは案内しません。
  if(busy)return view('↻ OneDriveと同期中…','busy','保存済みの練習・記録を送受信しています。','同期中…'); // 通信の開始から完了まで処理中を表示します。
  if(!online)return view(pending?'オフライン・同期待ち':'オフライン・同期未確認','warning',(pending?'この端末には保存済み。通信が戻ると自動同期します。':'今はOneDriveを確認できません。')+(checked?' 前回の同期 '+time:''),'通信の復帰待ち'); // ネットワーク接続だけで同期成功とは判定しません。
  if(state.lastError)return view('⚠ OneDriveの同期が未完了です','error','保存済みの記録はこの端末に残っています。「同期を再試行」を押してください。','同期を再試行'); // 通信エラーを端末の保存失敗と混同しません。
  if(pending)return view('↑ OneDriveへ同期待ち','warning',`この端末には保存済み。反映待ちの変更が${pending}件あります。`); // 待ち件数は練習数でなく変更数として表現します。
  if(!checked)return view('OneDrive接続済み・確認待ち','local','保存済みの内容をOneDriveと確認します。'); // 送信待ち0件だけでは同期済みにしません。
  if(!count)return view('✓ OneDrive接続済み','success','まだ練習は保存されていません。「練習を保存」で登録すると自動同期します。 接続確認 '+time); // 空のアカウントを練習の保存完了と誤認させません。
  if(practices.some(p=>p.heads.some(o=>o.cloudConfirmed===false||o.readiness?.ready===false)))return view('OneDriveの反映を確認してください','warning','練習と関連データの確認が揃っていません。再度同期してください。'); // 関連図や固定版の不足も成功にしません。
  return view('✓ OneDrive同期済み','success','保存済みの練習・記録を確認しました。 最終同期 '+time); // 確認した範囲と時刻をセットで表示します。
} // 同期状態の判定を閉じます。
export function saveHint({connected=false,online=true,pending=0,busy=false,error=false,saved=false}={}) { // 保存ボタンの意味を接続状態に合わせます。
  if(!connected)return 'このブラウザ内に保存します。他の端末にはまだ反映されません。'; // サインインだけで同期すると誤解させません。
  if(!online)return 'オフラインでも保存できます。通信が戻るとOneDriveへ自動同期します。'; // オフラインでの保存を許可した既存動作を説明します。
  if(error)return '保存済みの記録はこの端末にあります。上の「同期を再試行」でOneDriveへ反映します。'; // 保存を連打させず再同期へ案内します。
  if(busy)return 'この端末の保存済みデータをOneDriveに反映しています。'; // 同期と入力確定を区別します。
  if(saved&&pending)return 'この端末への保存は完了しました。OneDriveへ自動同期します。'; // 端末保存の完了を先に伝えます。
  if(saved)return 'この練習は保存済みです。変更したら、もう一度「練習を保存」を押してください。'; // 同期結果は上の状態カードで別途確認します。
  return '押すと練習を登録し、OneDriveへ自動同期します。'; // 主操作は保存ボタン一つであることを説明します。
} // 保存案内を閉じます。
export const draftWarning=dirty=>dirty?'入力中の変更は未保存です。「練習を保存」を押してください。':''; // 同期ボタンだけでは入力を登録しないことを明示します。
