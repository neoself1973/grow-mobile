# grow-mobile 引き継ぎ（状態文書）

> 本書は「状態」を持つ（古くなれば上書きされる）。**設計の「決定」は Grow 本体側**——
> `daily-report-app/docs/grow_plan_master.md` §0.10（正本）と `daily-report-app/docs/specs/grow_mobile_spec.md`。
> 正本にない判断が要るときは、こちらで決めずに向こうの HANDOFF の PENDING へ起票する。

## PENDING（未裁定）
- （なし）

---

## 現在地（2026-09-07・段3 完了時点）

- **できていること**: 骨格（Expo SDK 57 / expo-router）・登録・ログイン・オンボーディング（5項目）・入口の判定・**対話→結論の一周**（積み上げの保存 → summarize → question×n → conclude → 結論の表示）。
- **できていないこと**: 三層の数字とオフライン下書き（段4）／短期レポートの生成の引き金（段4）／ビルド2系統の実ビルドと APK 配布（段5）。
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

## 途中で見つけて直したもの

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
