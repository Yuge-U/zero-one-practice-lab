import { spawnSync } from 'node:child_process'; // 試験ごとに独立した終了コードを使います。
import { readFileSync } from 'node:fs'; // 失敗時の診断をログへ出します。
import { dirname, resolve, join } from 'node:path'; // 検査スクリプトの位置を固定します。
import { fileURLToPath } from 'node:url'; // 実行ファイルを正確に判定します。
export function runSuites(run, live = false) { // 公開前後の必須試験を明示します。
  const suites = live ? ['production-scenarios.mjs'] : ['production-scenarios.mjs', 'upgrade-check.mjs']; // ローカルの更新検査だけを公開後から除きます。
  let failed = false; // 過去工程の終了コードに依存させません。
  for (const suite of suites) { // 前の失敗でも次の診断を収集します。
    const result = run(suite); // 個別プロセスの結果を受け取ります。
    failed = failed || result.status !== 0 || Boolean(result.error) || Boolean(result.signal); // 失敗・異常終了・起動不能を保持します。
  } // 全試験の判定を閉じます。
  return failed ? 1 : 0; // 一つでも失敗すれば公開を止めます。
} // 再利用可能な判定関数を閉じます。
const self = fileURLToPath(import.meta.url); // このスクリプトの位置を取得します。
if (process.argv[1] && resolve(process.argv[1]) === self) { // 単体試験のimportではブラウザを起動しません。
  const root = dirname(self); // 同じtoolsディレクトリの試験だけを実行します。
  process.exitCode = runSuites(suite => { // 各試験を独立して実行します。
    const result = spawnSync(process.execPath, [join(root, suite)], { stdio: 'inherit', env: process.env }); // 標準ログと既存環境を維持します。
    console.log('Browser suite:', suite, 'exit:', result.status, 'signal:', result.signal); // 止まった工程を明示します。
    if (result.error) console.error(result.error.message); // 起動エラーを隠しません。
    if (result.status !== 0 && suite === 'production-scenarios.mjs') { // 最初の失敗理由も出力します。
      try { console.error(readFileSync(resolve(process.env.SITE_URL ? 'reports/production-live/results.json' : 'reports/production/results.json'), 'utf8')); } catch (error) { console.error('Diagnostic report unavailable:', error.message); } // 診断の有無と試験失敗を区別します。
    } // 診断出力を閉じます。
    return result; // 終了コードを集約へ渡します。
  }, Boolean(process.env.SITE_URL)); // 公開後は実URLを検査します。
} // 直接実行の入口を閉じます。
