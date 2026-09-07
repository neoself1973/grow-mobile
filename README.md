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
| 配布 | しない（本人の端末だけ） | GitHub Releases（段5） |
| 設定 | `.env.prod` | `.env.demo` |

公開前に `scripts/check-demo-build.sh <APK>` を通します。展開物に本番の Supabase プロジェクト ref と
本番ドメインが**0件**であることが公開の条件です（走査ファイル数と総バイト数も同時に出して、空振りの0件を弾きます）。
`service_role` などの秘密の文字列も同時に見ます（**anon キーは公開前提の鍵なので入っていて構いません**）。

### 実測（2026-09-07・demo プロファイルの APK）

```
走査対象ファイル数: 1233 ／ 総バイト数: 124,819,095
本番マーカー: 0 件 ／ service_role・SUPABASE_SERVICE_ROLE_KEY・ANTHROPIC_API_KEY・sk-ant-: いずれも 0 件
```

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
