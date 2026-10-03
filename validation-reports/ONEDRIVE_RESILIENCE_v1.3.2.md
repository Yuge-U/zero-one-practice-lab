# ZERO ONE PRACTICE 1.3.2 — OneDrive認証・通信の安定化

2026-10-03。修正ブランチ `fix/onedrive-resilience`。本番未反映。実Microsoftアカウントによる受入は未実施。
開始時・最終再確認時のmain: `2cc6646daaab4a006ce5bf5c77936098e2a60180`。
既存のONEDRIVE_FIX、SAVE_SYNC_UX、および現行の検証・配信手順を確認した。

## 確認できた不具合と、断定していない点

1. 修正前のAuthにMSALの `no_network_connectivity` を与えると、1回で `needsInteraction=true` となる。Graphへ到達する前の通信断でも「再認証が必要」となることを、修正前mainの認証コードを使ってChromium・WebKitで再現した。修正後は最大3回でNETWORKとなり、再認証・自動リダイレクトを要求しない。
2. WorkerBridgeとGraphClientも独立に全トークン取得失敗をAUTHへ変換していた。Authだけを修正しても分類を保持できないため、Window→Worker→Graphの全経路を修正した。
3. Graphの通信切断には再試行がなく、401後にキャッシュを迂回する無言更新もなかった。応答本文の読込中の切断も含めて検証した。
4. 既存のサービスは直列キューで並列書込を防いでいるが、連続同期要求はキュー内で順に繰り返された。追加試験で確認し、キュー投入前に連続同期だけをまとめた。間に保存が入った場合の後続同期は残す。

以上は再現できたコード上の問題であり、利用者の端末で報告された現象の根本原因が同じだったと確定したものではない。実端末のエラーコード・更新版・通信状況の確認が残る。過去のfetch呼出元不具合は修正済みで、その回帰試験も維持した。

## 比較対象と共有キャッシュ

比較対象は `Yuge-U/basketball-tactics-board` のmain `0a1537578ffaa94297782acd4994e5f86674c800` にある `1_App/js/onedrive-storage.js` と `onedrive-config.js`。読み取りのみ実施した。

両アプリの既定アプリID、consumers authority、Files.ReadWrite.AppFolder権限は同じ。通常のlocalStorageは同じオリジン内で共有されるため、アプリのURLパスだけではMSALキャッシュを分離できない。比較対象はInteractionRequiredAuthErrorだけを認証リダイレクトへ進め、他の取得失敗はそのまま返す。一方、Graphの401と403は同じpermission-deniedにしている。

PRACTICEは既存の「前回本人のscopeを優先」「前回本人が不在なら別人を自動採用しない」「複数候補を勝手に選ばない」を維持した。比較対象のgetActiveAccount優先とは異なる。実Storageと合成SDKの複数アカウント候補で、別アプリがBを選択していてもPRACTICEがAを維持し、A不在時はBへ切り替わらないことを両ブラウザで検査した。

これはアカウント選択の干渉に対する試験である。実MSALの暗号化キャッシュ、共有端末のサインアウト、実Microsoftリダイレクトの同時実行が今回の実障害を起こしたことは確認していない。キャッシュの全削除、アプリID変更、独自のトークンコピーは行っていない。

## 変更

- 通信、本人操作が必要な認証、権限不足、処理中、不明な認証障害を分類。不明なタイムアウトを期限切れと決めつけない。
- MSALの明確な一時通信障害は最大3回。GraphのGET・同じ内容の固定名PUTは最大3回。Retry-Afterを尊重し、60秒超の指定では待機を切り詰めて再送せず利用者へ案内。作成POSTの応答不明は自動再送しない。
- Graph 401では一度だけforceRefresh。更新後も401の場合、明示した再接続を求める。403では認証更新・自動リダイレクトをしない。
- 同時トークン取得、サインイン遷移、起動時とボタン操作の接続、連続した同期要求を一本化。認証待ち中のオンライン・表示復帰イベントから再接続ループを起こさない。
- オンライン復帰時に未接続なら既存フォルダーだけを確認。本人の明示操作なしで保存フォルダーを新規作成しない。
- 既存の端末保存成功表示、同期失敗表示、固定名への書込み後の読戻し検証、未送信保持を維持。
- WindowとWorkerに直近100件の安全な診断をメモリ保持し、既存の「診断情報」書出しへ追加。時刻・処理段階・許可済み分類・試行回数・HTTPステータスのみ。トークン、氏名、メール、URL、ファイルID、データ本文、生の例外は記録しない。再読込でこのメモリ履歴はリセットされる。
- 通常のService Worker更新に必要な版を1.3.2に更新。追加・変更コードの各行に処理の説明コメントを付けた。

配信差分は9既存ファイルと1新規モジュール。33ファイルは1.3.1と完全同一。モデル、repository、SyncEngine、写真動画の保存実装、参考資料、SQLite/vendor、アプリID・authority・scopeは変更していない。workerのDBディレクトリと `/core.db`、guest-localと本人scope、ZERO_ONE_PRACTICE_LAB_V02とmedia-v1を維持した。

## ローカル試験

macOS 27.0 arm64 / Node 24.19.0 / Playwright 1.63.0。ChromiumとWebKitを両方実行。CIのNode 22.16.0・Ubuntu 24.04/macOS 15とは環境が異なる。

| 検査 | 実行数 | 結果 |
|---|---:|---|
| 既存193件＋追加20件の単体試験 | 213 | 合格、失敗0、skip0 |
| ネイティブfetch・Window/Worker | 18 | 合格 |
| 既存保存・同期表示 | 22 | 合格 |
| 既存画面・配信停止・タブ排他 | 22 | 合格 |
| 保存・コピー・詳細表示 | 30 | 合格 |
| 0.3.2から同一URL・同一プロファイルで更新 | 2 | 合格 |
| 分類・認証復帰・本人/ゲスト分離 | 28 | 合格 |
| 参考資料リンク・合成端末間受信 | 34 | 合格 |
| 写真動画・OPFS・PNG表示・MP4再生・再送 | 36 | 合格 |
| 今回の実Auth/Bridge/Worker経路と修正前比較 | 36 | 合格 |

ブラウザ欄は両エンジンを合わせた228実行で、すべて異なる機能という意味ではない。新規試験では再認証の明示操作、認証通信断・403の区別、書込み完了後の応答切断、固定名PUT再送、通信遮断と復帰、保存/同期成功の区別、同一ドメインの候補アカウント干渉も検査した。

認証SDK応答とGraph/ダウンロードHTTP応答は合成。Auth・Bridge・Worker・SQLite/OPFS・ネイティブfetchは本体。新規認証応答の試験だけService Workerをblockし、実Service Workerの更新・オフライン動作は既存の必須スイートで実施した。Playwrightのoffline設定・イベント/配信停止は物理iPhoneの機内モードとは異なる。

必須テストの削除・skipはない。既存A10の架空のError('expired')には実際の判定コードlogin_requiredを付け、「再認証を案内するが勝手にリダイレクトしない」という元の条件を保持した。ネイティブ通信断試験は旧「送信1回」を新「正確に3回」へ変更し、NETWORK分類・Bearer境界・禁止宛先検査は維持した。

開発途中の失敗も合格に数えていない。追加ブラウザ試験の旧consentCloudセレクタを現行UIへ合わせた。ハーネスを単独コピーした際に必要なreference-links配信設定が欠けて停止した実行は終了し、既存の正式ビルド手順で再構成した。重複同期の追加試験は実装位置の誤りを検出し、直列キュー投入前へ修正後に再実行した。最終候補の全配信バイト照合を必須のまま維持した。

## 実アカウントで残る受入

本番へは未反映。本人のMicrosoftサインイン、実OneDriveでの作成・読込・保存、PCと物理iPhone間の引継ぎは未確認で、上記の合成試験をその代替としない。

公開承認後、入力を保存してPRACTICEのタブをすべて閉じ、通常更新で1.3.2になったことを確認する。同じ本人アカウント・同じURLで既存計画、振り返り、送信待ち、写真動画、参考リンクを確認する。実通信切断中に保存し、復帰後に同じ計画が一度だけ反映されるか別端末でも確認する。問題が残る場合は削除操作をせず、再接続前に安全な診断を書き出して分類・時刻・HTTPステータスを確認する。

Microsoftのアプリ登録、権限、アプリIDは変更しない。Webサイトデータの全削除は解決手順にしない。

## 根拠資料

- Microsoft: [MSAL Browser errors](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/errors)
- Microsoft: [MSAL cache](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/caching)
- Microsoft: [Graph best practices](https://learn.microsoft.com/en-us/graph/best-practices-concept)
- Microsoft: [Graph throttling](https://learn.microsoft.com/en-us/graph/throttling)

## CIの最終確認

コードコミット `f44e3a44fe66dd9d3de3b0c670b7ba3f6f4c886a` の [CI 37102240200](https://github.com/Yuge-U/zero-one-practice-lab/actions/runs/37102240200) は、Ubuntu 24.04・macOS 15の両buildでsuccess。Node 22.16.0 / Playwright 1.63.0を使用し、配信バイト照合、新旧認証再現、既存画面、更新保持、分類、参考資料、写真動画の全必須ステップがsuccessであることをジョブ結果とログで確認した。単体は各OS213件・失敗0・skip0。

検証ブランチのため公開成果物の配信処理、deploy、公開後verify-liveは実行していない。公開後試験が合格したという意味ではない。[Draft PR #12](https://github.com/Yuge-U/zero-one-practice-lab/pull/12) に修正と検証記録をまとめ、実アカウント受入を未確認のまま完了扱いにしていない。
