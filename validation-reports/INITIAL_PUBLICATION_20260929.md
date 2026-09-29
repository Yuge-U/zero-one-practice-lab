# ZERO ONE PRACTICE 0.3.2 — 初回HTTPS公開確認

確認日：2026-09-29。
公開URL： https://yuge-u.github.io/zero-one-practice-lab/
実行記録： https://github.com/Yuge-U/zero-one-practice-lab/actions/runs/36508671987
公開コミット： `2f0a0d2cad5d130a745d453e46a07e442b574137`。

## 結果

build、deploy、verify-liveの3ジョブは全てsuccess。
公開前のPages相当パス試験は22実行・22合格・errors=[]。Ubuntu 24.04のChromium／WebKitで、同じ11シナリオを実行した。
公開対象28ファイルは、配布済み0.3.2のSITE_MANIFESTとSHA-256が全て一致した。
公開後の実HTTPS検査は13実行・13合格・errors=[]。最初の接続でHTTP 200となり、公開反映待ちの再試行は行っていない。

公開後13件の内訳は、静的ファイル検査1件と、各ブラウザ6シナリオ×2エンジン。13種類の独立した機能試験ではない。

| 検査 | 実測結果 |
|---|---|
| 実HTTPSで公開ファイル27点を再取得 | 全てHTTP 200、全バイトのSHA-256一致。非配信用.nojekyllは対象外 |
| Chromiumで起動・二項目保存・再読込・振り返り・第二タブ拒否・390px表示とスコープ | 6/6合格 |
| WebKitで同じ主要操作 | 6/6合格 |

実ブラウザはLinux上のPlaywright 1.63.0。個人の保存領域ではなく、空の永続プロファイルと独立したOS保存領域を使用した。検証入力は「公開確認用の架空練習」等の合成データのみ。
ブラウザは公開URLから本物のSQLite WASM／OPFSを起動した。アプリのMicrosoftサインイン、本人OneDriveの作成・同期は実行していない。
本作業で公開サイトを閲覧するWeb取得ツールはアクセス不可を返したが、別のGitHub CIからの実HTTPS取得と実ブラウザ操作は上記の通り成功した。

## 証拠

`practice-release-preflight`：成果物11007724926、SHA-256 `73a6305e4bdf6c70b4371c19a37f2b8be03180263e33153239cc0f965c0e72e3`。
`practice-live-https`：成果物11007949125、SHA-256 `5b080266b61cdddb07b5e405f8a13a561020d1eded856f3014bdec213764ae36`。
両成果物をダウンロードし、取得後のSHA-256、結果JSON、WebKitの390px画面を確認した。
GitHub Actionsの証拠保持期間は14日。公開サイトにはレポートや試験用DBを含めていない。

## 今回変更した範囲

新規 `Yuge-U/zero-one-practice-lab` に公開処理、検査値、ビルド・実URL検査、案内を配置し、このリポジトリのPagesへ初回公開した。
既存CANVAS／TERMINOLOGYの実行コード、既存アプリのPages設定、Microsoftアプリ登録、本人OneDriveは変更していない。
初回ビルドは既存検証ソースの固定コミット `b9390aa320ec39a19f649849a1111e26e4968453` を読取専用で利用する。元の可変ブランチへ自動追随せず、元リポジトリへ書き込まない。

## 残る本人受入

物理iPhoneのSafari／ホーム画面版、機内モード、長時間ロック、本人Microsoft認証、実OneDrive同期、PC→iPhone→PCの引継ぎは別途確認が必要。
現時点で本人のMicrosoft設定を読取確認していない。同期を始める前に、既存アプリ登録のSPA戻り先へ公開URLを追加・確認する。既存URIは削除しない。
初期のゲスト領域は本人Microsoft領域へ自動移行しない。同期用の実機試験データは、本人サインインと検証フォルダ接続後に作成する。
今回の公開をもって一般配布の受入完了、本番の唯一の記録先としての保証とはしない。
