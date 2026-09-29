import {readFile,writeFile} from 'node:fs/promises'; // 検査済みのビルド出力だけを更新します。
import {join,resolve} from 'node:path'; // 個人データとは別の作業先を指定します。
import assert from 'node:assert/strict'; // 想定外の旧版への適用を停止します。
const root=resolve(process.argv[2]),web=join(root,'web'); // 1.0.2からの表示変更を対象にします。
function replace(text,before,after,count=1){assert.equal(text.split(before).length-1,count,'Label patch mismatch: '+before);return text.replaceAll(before,after);} // 置換件数を確認し名称だけを変更します。
async function patch(path,replacements){let text=await readFile(path,'utf8');for(const [before,after,count]of replacements)text=replace(text,before,after,count);await writeFile(path,text);} // 識別子や保存先は置換対象に含めません。
await patch(join(web,'index.html'),[ // 全体名と個別名の役割を画面で区別します。
  ['練習名・対象・人数・全体時間・ゴール・各項目名と時間','練習プラン名・対象・人数・全体時間・ゴール・各メニュー名と時間'], // 必須欄の案内をラベルに合わせます。
  ['<label>練習名<input id="title"','<label>練習プラン名<input id="title"'], // 上部は一回分の計画につける名前です。
  ['placeholder="例：ペイント侵入後の判断"','placeholder="例：U15｜判断力を磨く日"'], // 計画全体の入力例を示します。
  ['<h2>練習の流れ</h2>','<h2>メニュー構成</h2>'], // 個別メニューを並べる見出しに変更します。
  ['<div id="items"></div>','<p class="form-hint">1回分の練習プランに、ウォーミングアップやドリルなどのメニューを組み合わせます。</p><div id="items"></div>'], // 全体と個別の関係を一文で説明します。
  ['＋ 練習を追加','＋ メニューを追加'], // 個別項目の追加と新規計画の作成を区別します。
  ['各練習項目の「作戦を選ぶ」','各メニューの「作戦を選ぶ」'] // 接続設定側の案内も同じ言葉にします。
]); // 静的画面の変更を閉じます。
await patch(join(web,'app.mjs'),[ // 動的に増やすカードにも同じラベルを適用します。
  ['<label>練習名<input data-field="name"','<label>メニュー名<input data-field="name" placeholder="例：2対1 判断トレーニング"'], // 項目名の保存キーはnameのまま維持します。
  ['練習名・ゴール・練習項目を入力して保存してください。','練習プラン名・ゴール・メニューを入力して保存してください。',2] // 起動時と新規作成時の案内を揃えます。
]); // 入力や保存処理の動作は変更しません。
await patch(join(web,'draft.mjs'),[ // 保存前のエラーでも新しいラベルを使用します。
  ["'練習名'","'練習プラン名'"], // 上部の未入力箇所を正しく案内します。
  ['練習項目を1〜100件追加してください。','メニューを1〜100件追加してください。'], // 項目数の制限はそのままです。
  ['番目の練習項目名','番目のメニュー名'], // 何番目のメニューかを保持します。
  ['練習項目の合計は','メニューの合計は'] // 合計時間の検査条件は変えません。
]); // 表示文字列だけを置き換えます。
await patch(join(web,'core/model.mjs'),[["text(p.title, '練習名', 120)","text(p.title, '練習プラン名', 120)"]]); // 読込時の検証エラー名だけを統一します。
await patch(join(web,'core/planner.mjs'),[["text(input.title, '練習名', 120)","text(input.title, '練習プラン名', 120)"],["text(row.name, '練習項目名', 160)","text(row.name, 'メニュー名', 160)"]]); // 保存項目名・制限値・モデルは維持します。
for(const name of ['web/config.mjs','web/index.html','web/sw.js','web/core/service.mjs','tools/production-scenarios.mjs','tools/upgrade-check.mjs','tools/save-status-browser.mjs']){const path=join(root,name);const text=await readFile(path,'utf8');assert(text.includes('1.0.2'),name);await writeFile(path,text.replaceAll('1.0.2','1.0.3'));} // キャッシュと診断の版識別子を更新します。
for(const name of ['tools/production-scenarios.mjs','tools/upgrade-check.mjs'])await patch(join(root,name),[['1\\.0\\.2','1\\.0\\.3']]); // 既存の版検査を新バージョンに合わせます。
const checks="assert.equal(await page.getByLabel('練習プラン名',{exact:true}).getAttribute('id'),'title');assert.equal(await page.getByLabel('メニュー名',{exact:true}).getAttribute('data-field'),'name');assert.equal(await page.getByRole('heading',{name:'メニュー構成',exact:true}).count(),1);assert.equal(await page.getByLabel('練習名',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'＋ メニューを追加',exact:true}).count(),1);"; // 二つの入力欄を名前で一意に選べることを検証します。
await patch(join(root,'tools/production-scenarios.mjs'),[ // ローカルと公開後の両ブラウザ試験へ同じ確認を追加します。
  ["await page.locator('.brand img').evaluate(img=>img.decode());",checks+"await page.locator('.brand img').evaluate(img=>img.decode());"], // 既存の起動・アイコン検査も維持します。
  ['/練習名を入力/','/練習プラン名を入力/'], // 未入力時に新しい上部ラベルを表示することを要求します。
  ["assert.equal(await page.locator('#title').getAttribute('aria-invalid'),'true');","assert.match(await page.locator('#saveFeedback').innerText(),/1番目のメニュー名を入力/);assert.equal(await page.locator('#title').getAttribute('aria-invalid'),'true');"] // 下部のエラーも番号付きの別名で説明することを確認します。
]); // 保存・コピー・更新の既存判定は削除しません。
for(const name of ['index.html','app.mjs','draft.mjs'])assert(!(await readFile(join(web,name),'utf8')).includes('練習名')); // 上下で同じ旧ラベルが残っていないことを検査します。
console.log('PRACTICE 1.0.3: plan/menu labels and input guidance updated; storage keys and synchronization unchanged.'); // 完了した変更範囲だけを出力します。
