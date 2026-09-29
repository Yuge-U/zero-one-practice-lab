# 公開部品の出典

- SQLite WASM 3.53.4：公式配布 `https://sqlite.org/2026/sqlite-wasm-3530400.zip`。
  ZIP SHA3-256: `e4fa7e1750b42f6954115d8e69ffff7dc08da7e9fee6e28a2a0ea6bf228a49f2`。
  公式配布はGitHub Actionsで取得・照合。SQLiteの公開条件は `https://sqlite.org/copyright.html` を参照。
- MSAL Browser：既存公開アプリの固定blob `73ee537d2fcfba56661943b57f6f930112afdf6b`。
  ライセンスは `web/vendor/MSAL-LICENSE.txt` に原文で同梱。
- 用語集：`Yuge-U/zero-one-terminology` の `terms.json`、固定blob `977fbc048c36884f998389f4f42f05fcd80bd043`。
  既存のID・定義・出典欄をそのまま保持。本試作で用語の正しさや「確認済み」表示を再審査したものではない。
- 個人のOneDriveから取得したデータ、API秘密キー、トークン、メールアドレスは同梱していない。

各配布ファイルのSHA-256は `web/vendor/vendor-lock.json` に記録する。
検査値は配布の取り違えや破損の確認用で、悪意ある配布全体に対する電子署名ではない。
