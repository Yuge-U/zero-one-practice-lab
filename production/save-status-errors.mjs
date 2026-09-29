import {readFile,writeFile} from 'node:fs/promises'; // 表示用の通信失敗状態だけを修正します。
import {join,resolve} from 'node:path'; // 公開候補へ限定します。
import {createHash} from 'node:crypto'; // 修正対象の版を検査します。
import assert from 'node:assert/strict'; // 想定外のコードを更新しません。
const path=join(resolve(process.argv[2]),'web/app.mjs');let app=await readFile(path,'utf8'); // 同期ロジックではなく画面制御を読みます。
assert.equal(createHash('sha256').update(app).digest('hex'),'d30e8fede1124e45901b5301ea9ec13b8f5fa120c6896ea1702de685f043f8ed'); // 最初のUI候補からの差分を限定します。
function replace(before,after){assert.equal(app.split(before).length,2,before);app=app.replace(before,after);} // 置換は一箇所ずつ検査します。
replace("import {syncView,saveHint,draftWarning} from './save-status.mjs'; // 保存操作とクラウド状態の言葉を統一します。\n","import {syncView,saveHint,draftWarning} from './save-status.mjs'; // 保存操作とクラウド状態の言葉を統一します。\nlet syncFailure=''; // 同期開始前のクラウド確認エラーも表示に保持します。\n"); // cloud.checkの段階の失敗も記録します。
replace("const result=await request('sync');refreshState(result.state);","const result=await request('sync');syncFailure='';refreshState(result.state);"); // 成功応答後にだけ前回エラーを消します。
replace("await openDetail(selected);}finally{sending=false;","await openDetail(selected);}catch(error){syncFailure=error.message||'OneDrive同期未完了';throw error;}finally{sending=false;"); // 通信失敗を同期待ちのままにしません。
replace("const view=syncView(state,{connected:cloudReady,busy:sending","const view=syncView(state?{...state,lastError:syncFailure||state.lastError}:state,{connected:cloudReady,busy:sending"); // 端末DBと今回の通信結果を表示に反映します。
replace("error:Boolean(state?.lastError)","error:Boolean(syncFailure||state?.lastError)"); // 保存は成功したまま再同期だけを案内します。
assert.equal(createHash('sha256').update(app).digest('hex'),'a37fe901c6793555a9254ffa4ab343e9ae52d71392397c07e6f964ec30294d97'); // 確認した最小差分と一致させます。
await writeFile(path,app); // DB・通信権限・送信内容は変更しません。
