# grow-mobile 引き継ぎ（状態文書）

> 本書は「状態」を持つ（古くなれば上書きされる）。**設計の「決定」は Grow 本体側**——
> `daily-report-app/docs/grow_plan_master.md` §0.10（正本）と `daily-report-app/docs/specs/grow_mobile_spec.md`。
> 正本にない判断が要るときは、こちらで決めずに向こうの HANDOFF の PENDING へ起票する。

## PENDING（未裁定）
- （なし）

---

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
