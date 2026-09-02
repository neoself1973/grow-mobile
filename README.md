# grow-mobile

**React Native（Expo）で iOS／Android のネイティブアプリを設計・実装。iOS は実機動作を動画で提示、Android は APK を配布。ストアには未公開。**

Grow（[app.grow-app.jp](https://app.grow-app.jp) の仕事の振り返りサービス）のネイティブクライアントです。
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

## ビルド2系統

| | 本人用（`personal`） | 公開用（`demo`） |
|---|---|---|
| 接続先 | 本番 | **デモ環境のみ** |
| 配布 | しない（本人の端末だけ） | GitHub Releases（段5） |
| 設定 | `.env.prod` | `.env.demo` |

公開前に `scripts/check-demo-build.sh <APK>` を通します。展開物に本番の Supabase プロジェクト ref と
本番ドメインが**0件**であることが公開の条件です（走査ファイル数と総バイト数も同時に出して、空振りの0件を弾きます）。

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

## いまできること（段2 時点）

登録・ログイン・オンボーディング（5項目）まで。対話→結論の一周は段3、三層の数字とオフライン下書きは段4、
ビルド2系統と配布は段5 です。
