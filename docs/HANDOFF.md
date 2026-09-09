# grow-mobile 引き継ぎ（状態文書）

> 本書は「状態」を持つ（古くなれば上書きされる）。**設計の「決定」は Grow 本体側**——
> `daily-report-app/docs/grow_plan_master.md` §0.10（正本）と `daily-report-app/docs/specs/grow_mobile_spec.md`。
> 正本にない判断が要るときは、こちらで決めずに向こうの HANDOFF の PENDING へ起票する。

## PENDING（未裁定）
- （なし）

---

## 現在地（2026-09-07・段5 の締めまで完了。**iOS 実機・録画・push・公開は人間の作業**）

段5-0b（オフラインの是正）・5-1（棚の条件）・5-2（ビルド2系統）・5-3（§12-7 の機械照合）・5-4（APK）・5-5（動画）・5-6（README）まで完了。
**残っているのは人間の作業**: GitHub リポジトリの作成と remote 設定・push・Releases への APK の公開・iOS 実機への配置（無料個人チームの署名は7日で切れる）。

## 現在地（2026-09-07・段4 完了時点）

- **できていること**: 骨格（Expo SDK 57 / expo-router）・登録・ログイン・オンボーディング（5項目）・入口の判定・対話→結論の一周・**三層の数字**・**オフライン下書き**・**短期レポートの生成の引き金**。
- **できていないこと**: ビルド2系統の実ビルドと APK 配布・iOS 実機動画（段5）。
- **接続先**: デモ環境（`deboqbkitywxcvsnmpqg` ＋ Preview の API）。**本番には接続していない。**
- **remote**: 未設定（GitHub の `grow-mobile` は未作成。ローカル `git init` で進めている。remote は人間が後で足す）。

## 段2-B の Verification（実測・2026-09-02）

- `npx tsc --noEmit` exit 0。
- **`npx expo start --web` での確認**（`npm run web:demo`）。**Xcode・Android SDK が未導入のため、実機／シミュレータでの確認は行っていない**——正本 §9 並走線 0-(g) のとおり道具が無い。iOS 実機は段5 で動画を撮るときに要る。
- デモ環境に対して、新規メールで**登録 → 即ログイン状態（Confirm email オフ）→ オンボーディング5項目を保存 → ダッシュボード（段4 のプレースホルダ）へ到達**。
  デモ DB の `profiles` を本人の JWT で読み、`display_name='こんの' / industry='マーケティング・広告' / tone='consultant' / authority_level='manager' / context_note='火曜は終日…' / address_style='san'`（既定）を確認した。
- `git grep` で本番マーカー（本番 Supabase の ref と本番ドメイン）が**1件**——`scripts/check-demo-build.sh` の検査対象リスト自体のみ。`.env.demo` は git 管理外。

## 段3 の Verification（実測・2026-09-07）

- `npx tsc --noEmit` exit 0。
- **iOS シミュレータ（iPhone 17 Pro・Xcode 26.6・Expo Go）で一周を通した**。積み上げの保存 → summarize → question×**8** → 確認 → conclude → 結論・明日の一手・勝ち筋候補・締めの一文まで表示。スクリーンショットは `docs/verification/`（01 積み上げと対話／02 確認カード／03 結論／04 再訪時の復元）。
- **デモ DB の増分**（本人の JWT で読み出し。一周の前に3表とも 0 件であることを確認済み）:

| テーブル | 前 | 後 |
|---|---|---|
| `daily_reports` | 0 | 1（`report_date=2026-09-07`） |
| `conversations` | 0 | 1（`phase='concluded'`） |
| `daily_states` | 0 | 1（`state='stuck'`） |

- **結論済みの Grow日は再度 conclude できない**: アプリを再起動すると `conversations.messages` から会話と結論が復元され、入力欄は出ない（04 のスクリーンショット）。
- **課金**: この一周で **summarize 1 + question 8 + conclude 1 = 10 回**の API 呼び出しが発生した（デモ用ワークスペースの鍵）。**通しの一周は1回のみ**。この他に、段2-A のスモークで 1 回、Web プレビューでの疎通試行で summarize 1 回（**CORS で失敗＝課金なし**）。
- **本番マーカー**（本番 Supabase の ref と本番ドメイン。値は `scripts/check-demo-build.sh` が持つ）は `git grep` で **1件＝そのスクリプトの検査対象リストのみ**。文字列をこの2箇所以外に書かないことで、§12-7 の照合が曖昧にならないようにする。

### 実測で分かった制約（記録）

- **Web プレビューでは対話 API を叩けない**。ブラウザからは別オリジン（デモの Vercel）への `fetch` が CORS で落ちる（Next の API 側に CORS ヘッダは無い＝ネイティブ専用の経路）。**画面は出るが一周は通らない**ので、段3 以降の検証は必ずシミュレータか実機で行う。失敗時の表示（「通信に失敗しました。…」）はこのとき実際に出た＝エラー分岐の動作確認にはなった。
- **シミュレータへの文字入力は母艦の入力ソースを通る**。母艦が日本語入力のため、ASCII を送るとローマ字が仮名に変換される。今回はローマ字で日本語（かな）を入力して一周した。**アプリ側の問題ではない**。

## 段4 の Verification（実測・2026-09-07）

- `npx tsc --noEmit` exit 0。
- **三層の数字**（`docs/verification/05-three-numbers.png`）。Web の `loadStats`（`app/dashboard/page.tsx:383-398`）と同じ3クエリ・同じ定義を、本人 JWT の supabase-js で実行:

| 表示 | 値 | デモ DB の実数 |
|---|---|---|
| 結論ログ | **1** | `conversations` の `phase='concluded'` = 1 |
| 勝ち筋（確定） | **0** | `win_patterns` は1行あるが `status='hypothesis'`＝confirmed は 0 |
| 読みが当たった | **0** | `next_action_feedback` の `feedback_status in ('done','partially_done')` = 0 |

  **金を使うのは「勝ち筋（確定）」の数字だけ**（§13 の列挙内。結論ログは無彩色・読みが当たったは mint＝Web と同じ）。何も無いユーザーには棚ごと出さない（Web と同じ）。演出・バッジ・streak は無し。
  **Web にある「このまま書き出せます →」（`/report` への導線）は入れていない**——勝ち筋レポートは本アプリの範囲外の画面のため。

- **短期レポートの生成の引き金**: ダッシュボード到達時に `POST /api/weekly/generate`（Bearer・引数なし・結果を待たない）。同じ呼び出しを手元から実行した実測: **status 200 / `{"generated":false,"reason":"window not complete"}`**、`weekly_summaries` は **0 → 0**。ルートは窓が未完了ならこの応答で **`chat()` に到達せず return する**（`app/api/weekly/generate/route.ts:57-59`）＝**LLM は呼ばれない**。Anthropic Console の使用量そのものは**未確認**（コンソールを見ていないため）。∴ 課金の不発生は「コードの分岐＋応答＋DB の不変」から言えるところまで。
- **オフライン下書き**（`06`→`07`→`09`）: 入力 → **アプリを完全終了して再起動 → 入力欄に復元**（06/07）。保存が成功した時点で下書きは消える（09＝保存後にその行を DB から消して再起動すると入力欄は**空**＝下書きが残っていない）。保管先は AsyncStorage、キーは `draft:{userId}:{growDate}`（ユーザーでスコープ＝spec §11、Grow日で分ける＝発注）。**SecureStore には入れない。**
- **通信断の表示**（`08`）: `POST /api/chat/summarize` が届かないとき「**通信に失敗しました。接続を確認して、もう一度お試しください。**」。**iOS シミュレータには機内モードが無い**ため、API の宛先を到達不能なホストに差し替えて `fetch` を実際に失敗させた（Supabase 側は到達可能＝積み上げの保存は成功する条件で確認）。同じ画面で `weekly/generate` の失敗は**何も表示せず**コンソールだけに出る（graceful）ことも確認できた。
- **課金**: 本段で対話 API は呼んでいない（`weekly/generate` の no-op のみ）。**Anthropic の呼び出し 0 回。**
- **本番マーカー** は `git grep` で **1件＝`scripts/check-demo-build.sh` のみ**。

## 動画の差し替えと履歴の整理（2026-09-09）

**採用する動画**: `docs/verification/ios-device-walkthrough.mp4` ／ **51.4秒** ／ **14.3MB** ／ 1080×1920 ／ 無音。人間が録画。内容＝起動 → 呼び名 → AIのスタイル → 積み上げ → 対話 → 三層の数字（1・0・0）。**範囲外の画面も個人情報も映っていない。** 50MB 未満なので git にそのまま入れる（GitHub の警告閾値を超えない）。

- **検分（機械）**: 8/20/35/48 秒の各フレームを抽出して内容を確認。解像度 1080×1920 は iPhone 15 の実画面（1179×2556）ともシミュレータ（1206×2622）とも異なる＝**書き出し時に切り出し・縮小がかかっている**（ステータスバーが映っていないのも同じ理由）。入力されている本文は**漢字かな交じりの自然な日本語**で、9/7 のシミュレータ録画（自動入力のためかな書き）とは明確に別物。

**外した動画**: `ios-demo-walkthrough.mp4`（12分5秒・67MB）。**リポジトリの履歴からも外した**（`~/grow-mobile-archive/ios-demo-walkthrough_2026-09-07_simulator_12min.mp4` に退避・SHA-256 一致で無傷）。理由は3つ——(1) **シミュレータの録画**であり（記録時刻 9/7 11:03。実機導入は翌 9/8）、「実機動作を動画で提示」と謳うリポジトリに並べると取り違えのもと (2) `782d954` の**是正前の挙動**（結論後に再起動しないと数字が増えない）を映している (3) `.git` 69MB のうち 67MB がこの1ファイルだった。**9/8 の「記録として残す」は、リポジトリ外に残すことで満たす。**

- **履歴の書き換え**: `git filter-branch --index-filter` で `d099bbf^..HEAD` の**3コミットのみ**を書き換えた（`d099bbf→1071f84`・`66cd650→22bd9ca`・`3d1af3d→3d19829`）。**決定ログと正本が引用する `fd863a9`・`132a0bb`・`782d954`・`d576b69` はいずれも書き換え範囲より前**で、引用は壊れていない（機械で確認）。`.git` は **68MB → 4.2MB**、全リビジョン走査で当該ファイルの参照 **0件**。**push 前に実施**したため remote への影響は無い。

## 段5 の締め（2026-09-07）

### 1. 検査スクリプトの対照実験（§12-7 の判定に含める・決定ログ 2026-09-07）

`|| true` を足した結果「一致0件」と「grep 自体の失敗」が区別できない、という指摘に対し、**両方向を実測した**。

| 対照 | 入力 | 走査 | 本番マーカー | 終了コード |
|---|---|---|---|---|
| ① ダミー在り | demo の APK の複製に `dummy-prod-marker.txt`（本番 ref を1行だけ含む）を zip で足したもの | 1,234ファイル・124,819,136バイト | **1 件** | **exit 1**（「NG: 本番マーカーを検出。**公開しないこと。**」） |
| ② ダミー無し | 本物の demo の APK | 1,233ファイル・124,819,095バイト | **0 件** | **exit 0**（OK） |

差はちょうど**1ファイル・41バイト**＝注入したダミーそのもの。∴ **この検査は「在れば止まり、無ければ通る」**ことが実測で示された（前例＝2026-08-28 の課金文字列 grep の対照）。**ダミーはリポジトリに置いていない**（一時ディレクトリで作り、実験後に削除）。手順は上の表のとおりで、再現するときは APK の複製に本番 ref を含むファイルを1つ足すだけでよい。

### 2. iOS の実機ビルド ＝ **完了**（2026-09-08・demo 接続・実機で遮断確認も実施）

**入った実体**: `jp.growapp.mobile` ／ 表示名「Grow (demo)」 ／ **Release**（JS 同梱＝開発サーバー無しで起動する。停止して実測） ／ 端末 iPhone 15（iOS 26.6.1） ／ 署名 `Apple Development: mkt@twothree-inc.com`（**無料の個人チーム**・Team `NT95B9SDV3`・プロビジョニングは端末1台）。**接続先はデモ環境のみ。本番接続のビルドは作っていない**（`.env.prod` も無い）。**署名は7日で切れる。**

**手順（次回も同じ。人間の操作が要る箇所を明記）**:

1. 【人間】iPhone を USB 接続 →「このコンピュータを信頼」。
2. 【人間】Xcode → Settings → Accounts に Apple ID を追加（**Developer Program には登録しない**）。`security find-identity -v -p codesigning` に `Apple Development: …` が1件出れば準備完了。
3. 【人間】**iPhone の `設定` → `プライバシーとセキュリティ` → `デベロッパモード` をオン → 再起動**。これを忘れると `xcodebuild` が `Developer Mode disabled` で止まる（今回1度踏んだ）。`xcrun devicectl list devices` の State が `connected (no DDI)` から `connected` に変われば有効。
4. 【機械】ビルドと導入:

```sh
cd ~/grow-mobile
set -a; . ./.env.demo; set +a
APP_PROFILE=demo LANG=en_US.UTF-8 npx expo run:ios --configuration Release --device 00008120-001C31163E44A01E
# ↑ UDID は `xcrun xctrace list devices` の値（devicectl の Identifier とは別物。devicectl の UUID を渡すと No device matching で落ちる）
```

5. 【人間】ビルド中にキーチェーンの解錠を求められる → **Mac のログインパスワード**を入れ、**「常に許可」**（「許可」だと署名のたびに止まる）。
6. 【機械・★重要】**同梱フレームワークの再署名**。`hermesvm` / `React` / `ExpoFont` / `ExpoModulesJSI` の4つが**未署名のまま出力され**、インストールが `ApplicationVerificationFailed`（`No code signature found` on `hermesvm.framework`）で弾かれた。同じ証明書で署名し直してから入れる:

```sh
APP=~/Library/Developer/Xcode/DerivedData/Growdemo-*/Build/Products/Release-iphoneos/Growdemo.app
ID=$(security find-identity -v -p codesigning | awk 'NR==1{print $2}')
for f in "$APP"/Frameworks/*.framework; do codesign --force --timestamp=none --sign "$ID" "$f"; done
codesign --force --sign "$ID" "$APP"
xcrun devicectl device install app --device <devicectl の Identifier> "$APP"
```

7. 【人間】初回起動時の「信頼されていないデベロッパ」→ iPhone の `設定` → `一般` → `VPNとデバイス管理` → `Apple Development: …` → **信頼**（この確認には通信が要る＝機内モードでは失敗する）。

**実機での遮断確認（2026-09-08・機内モードで実施＝代用ではない本物の遮断）**: ログイン → 入力欄に数文字（**送信はしない**）→ アプリ完全終了 → **機内モードオン** → 起動。結果は3点とも OK——(1) **数秒で入力画面が出た**（読み込み表示のまま止まらない） (2) **書きかけの文字が入力欄に戻っていた** (3) **新しい文言は出ていない**。機内モードを戻して通常動作も確認し、ログアウトまで実施。**この確認で対話 API は 0 回**（DB で実測: Grow日 2026-09-08 の `daily_reports` は 0 行＝送信されていない）。

### 3. 撮影の準備（**一周は通していない＝課金 0 回**）

- 動画は**新しいデモアカウント**で撮り直す（決定ログ 2026-09-07）。**アカウントの作成と一周は人間が録画しながら行う**ため、Claude Code はここで**登録も対話もしていない**（数字が入ってしまうため）。
- **録画を始められる状態にした**: **実機**に demo ビルドが入り、遮断確認のあとログアウト済み＝**未ログインの起動画面**。シミュレータ側も同じ状態（`17-recording-ready-signed-out.png`）。
- **現行の `docs/verification/ios-demo-walkthrough.mp4`（12分5秒）は消さずに記録として残す。README とポートフォリオからは参照しない**（`782d954` の是正前の挙動を映しており、現在は存在しない動きが含まれるため）。

### 4. Android の署名手順（明文化のみ・仕組み化はしない）

README の「ビルドし直すときの手順（Android）」に記載した。要点は3つ——`npx expo prebuild` をやり直したら `android/app/build.gradle` の署名設定を入れ直す／**鍵は `~/.grow-mobile-keys/`・パスワードは `~/.gradle/gradle.properties`（いずれもリポジトリの外。値は書かない）**／`./gradlew assembleRelease` のコマンド。**config plugin は作らない**・**APK は分割しない**（決定ログ 2026-09-07）。

### 5. README の照合（機械で確認）

- 実績文言は正本 §0.10 の確定文言と**一字一句一致**（Python で文字列比較・`True`）。
- 禁止表現の走査: 「Swift／Kotlin で書いた」「ストアで公開した」「WebView をネイティブと呼ぶ」の**肯定形は 0 件**。`Swift`・`Kotlin`・`WebView` の語自体は出てくるが、いずれも**否定文**（「Swift／Kotlin では書いていません」「Web を包む WebView の殻ではありません」）＝正本の要求どおり。
- 公開リポジトリが未作成である旨を配布の表に明記し、**Releases へのリンクは貼っていない**。

## 段5-1〜5-6 の結果（2026-09-07）

- **5-1 棚の条件を Web に揃えた**: Web は「結論0 かつ勝ち筋の**行が**0件（status 不問）」で隠す（`app/dashboard/page.tsx:804`）。確定数で判定していたのを取得済みの行数に変更（新しいクエリは足していない）。実測＝結論0・仮説1行の状態で**棚が出て 0・0・0**（`15-shelf-condition-matches-web.png`）。
- **5-2 ビルド2系統**: `app.config.ts` の `APP_PROFILE` で解決することを確認。`demo` → name `Grow (demo)` / `extra.profile='demo'`、`personal` → name `Grow` / `extra.profile='personal'`。**personal は設定の解決だけを確認し、本番接続の実ビルドは作っていない**（`.env.prod` も作っていない）。依存は追加していない。
- **5-3 §12-7 の機械照合（実物）**: demo の APK に対して `scripts/check-demo-build.sh` を実行。**走査 1233 ファイル・124,819,095 バイト／本番マーカー 0 件／`service_role`・`SUPABASE_SERVICE_ROLE_KEY`・`ANTHROPIC_API_KEY`・`sk-ant-` いずれも 0 件**（anon キーは公開前提のため対象外＝その旨をスクリプトにも明記）。
  - **スクリプトを2点直した**（実物で動かなかったため。spec §7.1 の趣旨は不変）: (1) `unzip` に `-o`（APK には同名エントリがあり、無いと対話プロンプトで止まる） (2) `grep` に `-a` と `|| true`（実体はバイナリ／不一致の終了コード1が `set -e` に拾われて途中で落ちていた）。あわせて秘密の文字列の検査を追加。
- **5-4 Android の APK**: 手元ビルド（**EAS は使わない**）。`npx expo prebuild --platform android` → `./gradlew assembleRelease`。
  - パス `android/app/build/outputs/apk/release/app-release.apk` ／ **サイズ 98,471,880 バイト（約 94 MB）** ／ profile **demo**（`.env.demo` を読み込んでビルド）。全 ABI を含む universal APK のため大きい。
  - **署名**: 手元で作った鍵（`~/.grow-mobile-keys/grow-demo.keystore`）。**鍵もパスワードもリポジトリの外**（パスワードは `~/.gradle/gradle.properties`）。
  - **申し送り**: `android/` は `.gitignore` 済み（prebuild の生成物）なので、署名設定の追記（`android/app/build.gradle`）は**コミットされない**。prebuild をやり直したら同じ追記が要る。恒久化するなら config plugin にする——ただし依存を足さない方針との兼ね合いがあるため、判断は人間に残す。
- **5-5 iOS の動画**: → **差し替え済み**。下の「動画の差し替え（2026-09-09）」を見よ。当時撮った12分の動画（シミュレータ・是正前の挙動）は**リポジトリから外した**。
- **撮影のついでに見つけて直した**: **conclude のあとに三層の数字を取り直していなかった**（Web の `runConclude` は `loadStats` を呼ぶ）。その訪問の間だけ「結論ログ」が古い数のまま残っていた。取り直すよう修正（動画は修正前のビルドで撮っているため、動画の中では再起動して 1 になるところを見せている）。
- **課金（段5 の合計）**: **対話 API 10 回**（撮影用の一周ぶん＝summarize 1・question 8・conclude 1）。5-0b と 5-1 の検証では対話 API を呼んでいない（0 回）。
- **5-6 README**: 実績文言は正本 §0.10 の確定文言のまま。ストア未公開・iOS は動画／Android は APK・**接続先はデモ環境で Grow の実データではない**こと・設計の正は daily-report-app 側にあること・**iOS の署名は7日で切れる**ことを記載。

## 段5-0b の実装と Verification（2026-09-07）

**やったこと（範囲を広げていない）**:

1. **下書きの復元をネットワークより先に、無条件で行う**（`app/dashboard.tsx`）。`loadDraft` は AsyncStorage だけで完結するので DB の応答を待たない。復元したら**その時点で画面を出す**。
2. **起動時の読み込みと入口の判定に時間の上限を置く**（`constants/app.ts` の `STARTUP_TIMEOUT_MS`・`lib/withTimeout.ts`）。超えたら**下書きの入った入力画面へ倒す**。未ログインの判定は端末内で完結するので従来どおり。
3. **遅れて返ってきた結果で入力を奪わない**。本人が入力欄に触れていなければ（`userTouchedRef`）保存済みの本文・会話で差し替える。触れていたら差し替えない。
4. (c)（オフラインで送信を押したときの挙動）は**変更していない**。
5. **文言を1つも足していない**（上限を超えても画面には何も出さない）。

**上限の値と根拠**: **6000ms のまま採用**。通常起動の実測（iOS シミュレータ・デモ環境・3回）は
`profiles` = **1072 / 1136 / 165 / 109 / 250 / 210 ms**（最悪 1136ms＝初回）、`daily_reports`+`conversations` = **49〜100ms**、`loadStats` まで合計 **155〜263ms**。**最悪値の3倍は約 3.4 秒**で、発注の初期値 6000ms はこれを上回るため調整しなかった（遅い回線を切り捨てない側へ倒す）。

**Verification（遮断は「ホスト名を保ったままポートを塞ぐ」方法）**:

| # | 確認 | 結果 |
|---|---|---|
| 1 | 遮断状態で読み込み表示に止まらない | **OK**（起動9秒後は読み込み中／17秒後には入力画面。Expo Go の起動とバンドル取得を含む値で、上限の6秒はアプリのコードが動き始めてから数える。ビルド済み APK ではバンドル取得が無い） |
| 2 | 前回の下書きが入力欄に戻る | **OK**（`12-offline-draft-restored.png`） |
| 3 | 新しい文言が出ていない | **OK**（画面には既存の文言だけ） |
| 4 | 通常設定で保存済みの本文が復元される | **OK**（`13-normal-server-content-wins.png`＝下書きより**サーバーの本文が勝つ**。本人が入力欄に触れていないため） |
| 5 | オンボーディング未了は従来どおり送られる | **OK**（`14-onboarding-still-routed.png`＝`display_name` を空にして再起動） |

- `npx tsc --noEmit` exit 0。**差分は 2ファイル +67 / -31 行**、新規2ファイル（`constants/app.ts` 13行・`lib/withTimeout.ts` 24行）。触ったのはこの4つだけ。
- **申し送り**: 上限を超えて倒したあとは、その起動の間はオンボーディングへ引き戻さない（書きかけの入力を奪わないため）。オンボーディング未了の人が圏外で起動した場合、その回はダッシュボードに留まる。次回の起動で通常どおり判定される。

## 段5-0 の結果（2026-09-07・**下書きは戻らない。止めて報告した**）

**結論: データベースが到達不能なとき、下書きは戻らない。それ以前に画面が読み込み表示のまま進まない。** 発注の指示に従い**直さずに止めた**（実装は次の指示待ち）。

- **実測**（`docs/verification/10-db-unreachable-hang.png`）: ホスト名は本物のまま**ポートだけ塞いだ** URL（`https://<demo ref>.supabase.co:9`）で起動 → **3分以上、読み込み表示のまま**。コンソールに `load today failed:` は**出ない**（＝例外が飛んでおらず、接続がぶら下がったまま）。同じ設定のまま入力欄に到達できないので、下書きの復元以前の問題。
- **対照**（`11-draft-restored-when-reachable.png`）: 通常の設定に戻すと同じ下書き（「でんぱがないときのしたがきのかくにん。」）が**入力欄に戻る**＝AsyncStorage には残っていた。**消えているのではなく、到達できていない。**
- **原因（コードで特定）**: 起動時の処理が2段とも**ネットワークの応答を待つ作りで、待ち時間の上限が無い**。
  1. `app/_layout.tsx` — `profiles` の `display_name` を読むまで `hasName === null` で転送しない＝入口の読み込み表示から動かない。
  2. `app/dashboard.tsx` — `daily_reports` の問い合わせ → その後に `loadDraft`。問い合わせが返らない限り下書きに到達しない。
  supabase-js は fetch の失敗を**例外にせず `{ error }` で返す**ため、想定していた「例外 → `catch` → 復元に到達しない」ではなく、**そもそも返ってこない**のが実態だった（携帯網の圏外では TCP 接続がタイムアウトするまで数十秒〜数分かかる）。
- **考えられる直し方（案・未実装）**:
  - (a) **下書きの復元をネットワークの前に出す**。`loadDraft` は AsyncStorage だけで完結するので、`daily_reports` の問い合わせを待つ理由が無い。復元してから、後追いで DB の結果が来たら上書きする（サーバー側に保存済みの本文があればそちらが正）。
  - (b) **起動時の問い合わせに時間の上限を付ける**（`AbortController` で数秒）。上限を超えたら「読めなかった」として画面を出す。入口の判定（`hasName`）も同様にして、読めないときは**下書きの書ける画面**へ倒す。
  - (c) 併せて、オフラインで `送信` を押したときの扱い（現状は保存失敗＝「通信に失敗しました。…」を出して本文は画面に残る）を、下書きとして残す前提に整理する。
  ※ (a) と (b) は排他ではない。**どれを採るかは製品の判断**（オフラインでどこまで触れる状態にするか）なので、指示を待つ。
- **方法についての記録（次に同じ検証をする人へ）**: `EXPO_PUBLIC_SUPABASE_URL` の**ホスト名を変えてはいけない**。supabase-js のセッション保存キーは `sb-<ホスト名の先頭ラベル>-auth-token`（`@supabase/supabase-js` の `SupabaseClient` コンストラクタ）で、URL を別ホストにすると**保存済みセッションが見つからず「ログアウト状態」になり、別の現象を測ってしまう**（最初にこれで1回失敗した）。ホスト名を保ったままポートを塞ぐのが正しいやり方。
- **期限切れトークンでの起動**（`getSession()` が更新に失敗する経路）: **未確認**（有効期限まで待つか、保存済みトークンを差し替える手段が要るため、今回は再現していない）。
- `.env.demo` は**書き換えていない**（環境変数で上書きして起動しただけ。md5 `8b729cf4…` のまま・git 管理外）。

## 途中で見つけて直したもの

- **積み上げの保存が通信断で失敗したときに「一時的に処理できませんでした。…」が出ていた**（2026-09-07）。通信断は「通信に失敗しました。…」が正（正本 §0.10 の2文の割り当て）。supabase-js が返す fetch 失敗を判定して2文を出し分けるようにした（**文言は増やしていない**）。
- **セッションがあるのに入口（"/"）の読み込み表示から進まない**（2026-09-07・シミュレータで検出）。入口の判定（`app/_layout.tsx`）が転送の対象を `(auth)` と `onboarding` に限っていたため、"/" に居るときだけどこへも送られなかった。Web は毎リクエストでサーバーが判定するため起きない。`atEntry` を条件に足して解消。
- **今日の積み上げの読み出しに失敗すると読み込み表示のまま止まる**（同上）。`getUser()` がセッション復元前に null を返す経路で早期 return しており `ready` が立たなかった。`getSession()` に変え、`finally` で必ず `ready` にした。
- **オンボーディング保存後に1問目へ送り返される**（2026-09-02・デモ環境で実測）。原因は入口の判定（`app/_layout.tsx`）が
  `display_name` を**セッション取得時にしか読まず**、保存直後は古い「空」を持っていたこと。DB への保存自体は成功していた
  （リロードするとダッシュボードに入れた）。`lib/profile.ts` の最小の通知を足し、保存側から判定側へ一度だけ知らせる形にした。

## 本人用ビルドについての注意

`.env.prod`（本番接続）は**まだ作っていない**。作るときも git 管理外に置き、**公開用の APK には絶対に使わない**（正本 §12-7）。
公開前の判定は `scripts/check-demo-build.sh`。

## Web との対応（文言を作り直さないための対照表）

| ここ | Web の出どころ |
|---|---|
| `components/AuthForm.tsx` | `components/AuthForm.tsx` |
| `lib/authErrorMessage.ts` | `lib/authErrorMessage.ts`（そのまま転記） |
| `constants/onboarding.ts` / `app/onboarding.tsx` | `app/onboarding/page.tsx` |
| `app/_layout.tsx` の入口の判定 | `app/page.tsx` |
| `constants/colors.ts` | `app/globals.css:16-23`（正本 §13） |

**Web と意図的に違うところ**（実装の事実として記録する）:
- `signUp` に `emailRedirectTo` を渡さない。ネイティブに origin が無く、デモ環境は Confirm email をオフにしているため（2026-08-31 裁定）。
- 流入元（utm）の退避・転写を入れない。LP からの流入がネイティブに無いため。
