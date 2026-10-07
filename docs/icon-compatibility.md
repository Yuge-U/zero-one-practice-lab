# 対応環境と公開アイコンの確認

変更時の対象は Mac、iPhone、Windows、iPad、Android。
共通コードを維持し、環境固有の差分が必要な場合だけ追加する。

公開後の `Four-app icon compatibility` は全4アプリのタブ用、Apple用、
PWA 192/512px画像を、承認済み生成物のSHA-256と照合する。
MacはmacOS上のWebKit/Chromium、WindowsはWindows上のChrome/Edgeで実行する。
iPhone/iPad/Androidはブラウザの端末エミュレーションであり実機検証ではない。
Safariの「お気に入り」キャッシュやOSランチャーの更新は自動試験の対象外で、
実機のタブ・お気に入り・ホーム画面・インストール済みアプリを別途確認する。

[共通の検証とSafari復旧手順](https://github.com/Yuge-U/zero-one-terminology/blob/main/docs/icon-compatibility.md)
