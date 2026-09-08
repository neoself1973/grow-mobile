# grow-mobile

**React Native（Expo）で iOS／Android のネイティブアプリを設計・実装。iOS は実機動作を動画で提示、Android は APK を配布。ストアには未公開。**

Grow（仕事の振り返りサービス）のネイティブクライアントです。
既存の Next.js API と Supabase Auth を使う**別クライアント**で、Web を包む WebView の殻ではありません。

- **Swift／Kotlin では書いていません**（React Native です）
- **App Store／Google Play には公開していません**
- 公開用の APK は**デモ環境にだけ**接続します。本番のデータには触れません

## 設計の正はここではない

このリポジトリは実装です。**設計の正は Grow 本体のリポジトリにあります**——
`daily-report-app/docs/grow_plan_master.md`（正本）§0.10 と `daily-report-app/docs/specs/grow_mobile_spec.md`。
画面の文言・色・入れないものの判断はすべて向こうが持ちます。ここで文言を作り直さないこと。

## 動かす

```sh
npm install
cp .env.example .env.demo   # 値を入れる（git 管理外）
npm run start:demo          # 実機・シミュレータ
npm run web:demo            # ブラウザでの確認（Xcode / Android SDK が無いとき）
```

環境変数は3つだけです（`.env.example` 参照）。
**`SUPABASE_SERVICE_ROLE_KEY` と `ANTHROPIC_API_KEY` は置きません**——`EXPO_PUBLIC_*` はクライアントバンドルに埋まるため、置いた瞬間に配布物へ鍵が乗ります。

## 触れるもの（配布物）

- **Android**: `app-release.apk`（demo プロファイル・手元ビルド）。**接続先はデモ環境**で、Grow の実データではありません。読み手はご自分のアカウントを作って触れます。
- **iOS**: 実機で動かしているところを**動画**で提示します。**ストアには公開していません。** iOS の実機に入れる署名は Xcode の**無料の個人チーム**で行うため、**7日で切れます**（切れたら入れ直しが要ります）。Apple Developer Program には登録していません。

## ビルド2系統

| | 本人用（`personal`） | 公開用（`demo`） |
|---|---|---|
| 接続先 | 本番 | **デモ環境のみ** |
| 配布 | しない（本人の端末だけ） | GitHub Releases（**公開リポジトリは未作成**。作成後に APK を置く） |
| 設定 | `.env.prod` | `.env.demo` |

公開前に `scripts/check-demo-build.sh <APK>` を通します。展開物に本番の Supabase プロジェクト ref と
本番ドメインが**0件**であることが公開の条件です（走査ファイル数と総バイト数も同時に出して、空振りの0件を弾きます）。
`service_role` などの秘密の文字列も同時に見ます（**anon キーは公開前提の鍵なので入っていて構いません**）。

### 実測（2026-09-07・demo プロファイルの APK）

```
走査対象ファイル数: 1233 ／ 総バイト数: 124,819,095
本番マーカー: 0 件 ／ service_role・SUPABASE_SERVICE_ROLE_KEY・ANTHROPIC_API_KEY・sk-ant-: いずれも 0 件
```

## ビルドし直すときの手順（Android）

`android/` と `ios/` は `npx expo prebuild` の生成物で、**git 管理外**です。∴ 署名の設定もコミットされません。
prebuild をやり直したら、次を入れ直してください（**恒久化する仕組みは置いていません**——再ビルドの機会が限られるため）。

1. `npx expo prebuild --platform android`
2. `android/app/build.gradle` の `signingConfigs` に公開用の設定を足し、`buildTypes.release` の `signingConfig` をそれに向ける
   （`GROW_DEMO_STORE_FILE` などの Gradle プロパティを参照する形にする）
3. ビルド:

```sh
cd android
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
set -a; . ../.env.demo; set +a
APP_PROFILE=demo ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

**鍵とパスワードはリポジトリに置きません**。鍵は `~/.grow-mobile-keys/`、パスワードは `~/.gradle/gradle.properties` にあります（**値はここに書きません。置き場所だけ**）。

APK は**分割していません**（全 CPU 向けを1本に収めた形。約94MB）。読み手が1つ落とせば済むほうを採っています。

## ビルドし直すときの手順（iOS 実機）

無料の個人チームで自分の iPhone に入れます（**Apple Developer Program には登録しません。署名は7日で切れます**）。

1. iPhone を接続して信頼 → **iPhone の `設定` → `プライバシーとセキュリティ` → `デベロッパモード` をオン**（要再起動）
2. Xcode に Apple ID を追加（Settings → Accounts）
3. ビルドと導入:

```sh
cd ~/grow-mobile
set -a; . ./.env.demo; set +a
APP_PROFILE=demo LANG=en_US.UTF-8 npx expo run:ios --configuration Release --device <UDID>
# UDID は `xcrun xctrace list devices` の値
```

4. **同梱フレームワークの再署名が要ります**（`hermesvm` などが未署名で出力され、インストールが `ApplicationVerificationFailed` になるため）:

```sh
APP=~/Library/Developer/Xcode/DerivedData/Growdemo-*/Build/Products/Release-iphoneos/Growdemo.app
ID=$(security find-identity -v -p codesigning | awk 'NR==1{print $2}')
for f in "$APP"/Frameworks/*.framework; do codesign --force --timestamp=none --sign "$ID" "$f"; done
codesign --force --sign "$ID" "$APP"
xcrun devicectl device install app --device <device id> "$APP"
```

5. 初回だけ iPhone 側で `設定` → `一般` → `VPNとデバイス管理` からデベロッパを**信頼**

## 使っているもの

| パッケージ | 用途 |
|---|---|
| `expo` 57.0.19 / `react-native` 0.86.3 / `react` 19.2.3 | 土台（Expo SDK 57） |
| `expo-router` | 画面遷移（`app/` のファイルがそのまま経路） |
| `@supabase/supabase-js` | 認証と DB（anon キー＋本人の JWT。RLS が本人の行だけに効く） |
| `expo-secure-store` | **セッションの保管**（iOS Keychain / Android Keystore） |
| `@react-native-async-storage/async-storage` | 書きかけの積み上げの下書き（段4） |
| `react-native-web` / `react-dom` | ブラウザでの動作確認用 |

**入れていないもの**: プッシュ通知・ローカル通知・バッジ・streak・第三者の計測 SDK。
続けることを促す仕掛けを置かない、という Grow の設計（正本 §0.10・§13）をそのまま引き継いでいます。
EAS（Expo のクラウドビルド）も使いません——手元でビルドします。

## いまできること（段3 時点）

登録・ログイン・オンボーディング（5項目）と、**対話→結論の一周**（今日の積み上げを書く → Grow が読む →
深掘りの問答 → 確認 → 結論・明日の一手）まで。三層の数字とオフライン下書きは段4、ビルド2系統と配布は段5 です。

### Grow日（9:00 境界）

`daily_reports.report_date` は暦日ではなく **9:00 を境界とする1日**（Grow日）です。結論は Grow日あたり1回。
日付の計算は**発明せず Web から移植**しました——移植元は `daily-report-app/app/dashboard/page.tsx:290`
（`new Date().toISOString().split('T')[0]`）、根拠のコメントは同 `lib/weekly.ts:5`（「9:00 境界＝実装上は UTC 暦日」）。
JST 9:00 が UTC 0:00 に当たるため、UTC の暦日を取ると JST 9:00 で切り替わります。実装は `lib/growDay.ts`。
