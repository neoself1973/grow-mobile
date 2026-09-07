import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { todayGrowDate } from '../lib/growDay'
import {
  ChatApiError,
  conclude as apiConclude,
  question as apiQuestion,
  requestWeeklyGenerate,
  summarize as apiSummarize,
  type Aphorism,
  type ChatTurn,
} from '../lib/chatApi'
import { GENERIC_RETRY, OFFLINE } from '../lib/authErrorMessage'
import { clearDraft, loadDraft, saveDraft } from '../lib/draft'
import { withTimeout } from '../lib/withTimeout'
import { ui } from '../constants/ui'
import { colors, ink } from '../constants/colors'

// 対話→結論の一周（正本 §0.10 (3)）。**Web の `app/dashboard/page.tsx` と同じ順序・同じ材料**:
//   積み上げを保存（daily_reports upsert）→ summarize → question×n（サーバーが confirm を決める）
//   → conclude → 結論の表示。
// 文言はすべて Web からの転記。三層の数字・過去の積み上げ一覧・チェックイン・勝ち筋確定演出は
// この段の範囲外（段4／範囲外）。金はまだ使わない（§13 の列挙・spec §9）。

type Phase = 'idle' | 'loading' | 'chatting' | 'concluded'
type LoadingKind = 'summarize' | 'question' | 'conclude'

// 「今なにを待っているか」を1行だけ添える（Web `app/dashboard/page.tsx:45-49` の転記）。
const LOADING_TEXT: Record<LoadingKind, string> = {
  summarize: 'Growが、今日の積み上げを読んでいます',
  question: 'Growが深掘りをしています',
  conclude: 'Growが、今日の結論をまとめています',
}

const REPORT_PLACEHOLDER = '・何をしたか\n・うまくいったこと、いかなかったこと\n・感じたこと、迷ったこと\n\nどんな形式でもOKです。'

export default function Dashboard() {
  const [ready, setReady] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [reportId, setReportId] = useState<string | null>(null)
  const [reportSaved, setReportSaved] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [loadingKind, setLoadingKind] = useState<LoadingKind>('summarize')
  const [keyPoint, setKeyPoint] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [newHypothesis, setNewHypothesis] = useState<string | null>(null)
  const [closing, setClosing] = useState('')
  const [cardHeading, setCardHeading] = useState<string | null>(null)
  const [aphorism, setAphorism] = useState<Aphorism | null>(null)
  // 失敗の表示。**直前の入力は state に残したまま**にする（永続化は段4）。
  const [errorText, setErrorText] = useState<string | null>(null)
  // 三層の数字（正本 §6.1・§3 の「常設は静かな残高表示だけ」）。Web と同じ3クエリ・同じ定義。
  const [conclusionCount, setConclusionCount] = useState(0)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [predictionHits, setPredictionHits] = useState(0)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  // 短期レポートの生成の依頼を1マウント1回に制限する latch（連続レンダーでの多重 POST 防止）。
  const weeklyRequestedRef = useRef(false)
  // 本人が入力欄に触れたか。遅れて返ってきた DB の結果で**入力を奪わない**ための印。
  const userTouchedRef = useRef(false)
  const scrollRef = useRef<ScrollView>(null)

  const today = todayGrowDate()

  // 今日の Grow日の積み上げと、その会話を読む。
  // **結論済みの Grow日は再度 conclude できない**（Web と同じ＝保存済みの会話をそのまま表示する）。
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // セッションの読み出しは端末内（SecureStore）で完結する＝ネットワークを待たない。
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return
        setUserId(user.id)

        // ★① 下書きの復元は**ネットワークより先に、無条件で**行う（2026-09-07 段5-0b）。
        //   AsyncStorage だけで完結するので、DB の応答を待つ理由が無い。圏外でも必ずここまで来る。
        const draft = await loadDraft(user.id, today)
        if (cancelled) return
        if (draft) setReportContent(draft)
        // ここで画面を出す。以降の DB の読み出しは**待たせない**。
        setReady(true)

        // ★② DB の読み出しには時間の上限を置く（constants/app.ts）。超えたらそのまま入力できる状態に留まる。
        const result = await withTimeout(
          (async () => {
            const { data: report } = await supabase
              .from('daily_reports')
              .select('id, content')
              .eq('user_id', user.id)
              .eq('report_date', today)
              .maybeSingle()
            if (!report) return { report: null as null, conv: null as null }
            const { data: conv } = await supabase
              .from('conversations')
              .select('messages, phase')
              .eq('report_id', report.id)
              .maybeSingle()
            return { report, conv }
          })(),
        )
        if (cancelled) return

        // ★③ 遅れて返ってきた結果で入力を奪わない。本人が入力欄に触れていたら差し替えない。
        if (!result.timedOut && result.value?.report && !userTouchedRef.current) {
          const { report, conv } = result.value
          setReportId(report.id as string)
          setReportContent(report.content as string)
          setReportSaved(true)
          if (conv?.phase === 'concluded') applyConversation(conv.messages as Record<string, unknown>)
        }

        await loadStats(user.id)
      } catch (e) {
        // 読めなくても画面は出す（入力はできる）。黙って読み込み表示のまま止めない。
        console.error('load today failed:', e)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [today])

  // 三層の数字（Web の loadStats・`app/dashboard/page.tsx:383-398` と同じ3クエリ）。
  // 新しい API は作らず、anon キー＋本人の JWT で Supabase を直接読む（RLS が本人の行だけに効く）。
  async function loadStats(uid: string) {
    // 結論ログ：確定した結論の累計
    const { count: concluded } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('phase', 'concluded')
    // 読みが当たった回数：翌日の答え合わせ（やった＝当たった / ちょっと＝半分）を hit とみなす
    const { count: hits } = await supabase
      .from('next_action_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .in('feedback_status', ['done', 'partially_done'])
    // 勝ち筋（確定）：status='confirmed' の数
    const { data: wp } = await supabase
      .from('win_patterns')
      .select('id, status')
      .eq('user_id', uid)
    setConclusionCount(concluded ?? 0)
    setPredictionHits(hits ?? 0)
    setConfirmedCount((wp ?? []).filter((w) => w.status === 'confirmed').length)
    setStatsLoaded(true)
  }

  // 保存済み会話を表示用に戻す（Web の hydrateConversation / applyConversation と同じ形。
  // 旧形式 question1..answer2 はネイティブに存在しないので新形式 turns だけを見る）。
  function applyConversation(m: Record<string, unknown>) {
    setKeyPoint((m.keyPoint as string) ?? '')
    setTurns(Array.isArray(m.turns) ? (m.turns as ChatTurn[]) : [])
    setConclusion((m.conclusion as string) ?? '')
    setNextStep((m.nextStep as string) ?? '')
    setNewHypothesis((m.newHypothesis as string) ?? null)
    setClosing((m.closing as string) ?? '')
    setCardHeading((m.cardHeading as string) ?? null)
    setAphorism((m.aphorism as Aphorism) ?? null)
    setPhase('concluded')
  }

  // 短期レポートの生成の引き金（正本 §0.10 (5)）。ダッシュボード到達時に1回だけ投げ、結果を待たない。
  // 窓が完了していなければサーバーが {generated:false} を返すだけで、LLM は呼ばれない。
  useEffect(() => {
    if (!ready || !userId) return
    if (weeklyRequestedRef.current) return
    weeklyRequestedRef.current = true
    void requestWeeklyGenerate()
  }, [ready, userId])

  // 下書きの自動保存（入力の変更時・デバウンス）。保存先は AsyncStorage（SecureStore には入れない）。
  useEffect(() => {
    if (!userId || reportSaved) return
    const t = setTimeout(() => { void saveDraft(userId, today, reportContent) }, 500)
    return () => clearTimeout(t)
  }, [userId, today, reportContent, reportSaved])

  const scrollBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50)
  }, [])

  async function saveReport() {
    if (!reportContent.trim()) return
    setErrorText(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Web と同じ upsert（(user_id, report_date) の一意制約＝1 Grow日 1 行）。
    const { data, error } = await supabase
      .from('daily_reports')
      .upsert({ user_id: user.id, report_date: today, content: reportContent }, { onConflict: 'user_id,report_date' })
      .select('id')
      .maybeSingle()
    if (error || !data) {
      console.error('daily_reports upsert failed:', error)
      // 通信断は OFFLINE、それ以外は GENERIC_RETRY（正本 §0.10 の2文だけを使う）。
      // supabase-js は fetch の失敗をそのまま message に載せる（'Network request failed' 等）。
      const offline = /network request failed|failed to fetch|load failed/i.test(error?.message ?? '')
      setErrorText(offline ? OFFLINE : GENERIC_RETRY)
      return
    }
    setReportId(data.id as string)
    setReportSaved(true)
    // 保存できた時点で下書きを消す（結論の確定を待たない。spec §11「いつ消すか」）。
    await clearDraft(user.id, today)
    await runSummarize()
  }

  async function runSummarize() {
    setLoadingKind('summarize')
    setPhase('loading')
    setErrorText(null)
    try {
      const data = await apiSummarize(reportContent)
      setKeyPoint(data.keyPoint ?? '')
      // 入口は「引っかかり＋最初の質問」の1発話（Web と同じ）。
      setTurns([{ role: 'ai', kind: 'opening', content: data.reply ?? '' }])
      setPhase('chatting')
      scrollBottom()
    } catch (e) {
      // 失敗しても積み上げ本文は消さない。保存済みなので、そのまま再試行できる。
      setErrorText(e instanceof ChatApiError ? e.message : GENERIC_RETRY)
      setPhase('idle')
    }
  }

  // 回答を受けて、次の質問 or 確認 or 結論へ（Web の submitAnswer と同じ分岐）。
  async function submitAnswer(auto = false, extend = false) {
    const text = auto ? '（わからない — 過去のデータから推測してほしい）' : currentAnswer.trim()
    if (!text) return
    const lastAi = [...turns].reverse().find((t) => t.role === 'ai')
    const newTurns: ChatTurn[] = [...turns, { role: 'user', content: text }]
    setTurns(newTurns)
    setCurrentAnswer('')
    setErrorText(null)
    const toConclude = lastAi?.kind === 'confirm' && !extend
    setLoadingKind(toConclude ? 'conclude' : 'question')
    setPhase('loading')
    scrollBottom()
    if (toConclude) await runConclude(newTurns, text)
    else await runQuestion(newTurns, auto, extend, text)
  }

  async function runQuestion(currentTurns: ChatTurn[], auto: boolean, extend: boolean, sentText: string) {
    try {
      const data = await apiQuestion({ reportContent, keyPoint, turns: currentTurns, autoSelect: auto, userExtend: extend })
      const kind: ChatTurn['kind'] = data.mode === 'confirm' ? 'confirm' : 'question'
      setTurns([...currentTurns, { role: 'ai', kind, content: data.reply ?? '' }])
      setPhase('chatting')
      scrollBottom()
    } catch (e) {
      recoverFromChatError(e, currentTurns, sentText, auto)
    }
  }

  async function runConclude(currentTurns: ChatTurn[], sentText: string) {
    try {
      const data = await apiConclude({ reportId: reportId ?? '', reportContent, keyPoint, turns: currentTurns })
      setConclusion(data.conclusion)
      setNextStep(data.nextStep ?? '')
      setNewHypothesis(data.newHypothesis ?? null)
      setClosing(data.closing)
      setCardHeading(data.cardHeading ?? null)
      setAphorism(data.aphorism ?? null)
      setPhase('concluded')
      scrollBottom()
    } catch (e) {
      // ★Web の conclude にはエラー分岐が無い（500 でも何も出ない＝Web 側の不具合として
      //   正本 §9 Backlog に置かれている）。ネイティブでは同じ2文の流用で必ず分岐を持つ。
      recoverFromChatError(e, currentTurns, sentText, false)
    }
  }

  // 失敗したら、送った回答を入力欄に戻して対話を続けられる状態にする（入力を失わない）。
  function recoverFromChatError(e: unknown, currentTurns: ChatTurn[], sentText: string, auto: boolean) {
    setErrorText(e instanceof ChatApiError ? e.message : GENERIC_RETRY)
    setTurns(currentTurns.slice(0, -1))
    if (!auto) setCurrentAnswer(sentText)
    setPhase('chatting')
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.mint} />
      </View>
    )
  }

  const lastAi = [...turns].reverse().find((t) => t.role === 'ai')
  const isConfirm = lastAi?.kind === 'confirm'

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: colors.base }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 56 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={{ color: ink.dim, fontSize: 12 }}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {errorText && <Text style={[ui.error, { marginTop: 16 }]}>{errorText}</Text>}

      {/* 三層の「静かな棚」（正本 §3 の柱3＝常設は静かな残高表示だけ）。
          何も無い新規ユーザーには出さない（うるさくしない）。演出・バッジ・streak は置かない。 */}
      {statsLoaded && (conclusionCount > 0 || confirmedCount > 0) && (
        <View style={{ marginTop: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.015)', paddingHorizontal: 18, paddingVertical: 16 }}>
          <Text style={{ color: colors.mint, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>これまでの蓄積</Text>
          <View style={{ flexDirection: 'row' }}>
            <Shelf value={conclusionCount} label="結論ログ" color={ink.primary} />
            {/* ★金を使うのはここだけ（§13 の列挙＝三層の数字のうち「勝ち筋（確定）」）。増やすと金が死ぬ。 */}
            <Shelf value={confirmedCount} label="勝ち筋（確定）" color={colors.gold} />
            <Shelf value={predictionHits} label="読みが当たった" color={colors.mint} />
          </View>
        </View>
      )}

      {/* 積み上げの入力（まだ保存していないとき） */}
      {!reportSaved && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: ink.primary, fontSize: 22, fontWeight: '500', marginBottom: 10 }}>今日はどうでしたか</Text>
          <Text style={[ui.note, { marginBottom: 24 }]}>今日の仕事を、静かに書き出してみてください</Text>
          <TextInput
            value={reportContent}
            onChangeText={(v) => { userTouchedRef.current = true; setReportContent(v) }}
            style={[ui.input, { height: 220, textAlignVertical: 'top', lineHeight: 24 }]}
            placeholder={REPORT_PLACEHOLDER}
            placeholderTextColor={ink.placeholder}
            multiline
          />
          <TouchableOpacity
            onPress={saveReport}
            disabled={!reportContent.trim() || phase === 'loading'}
            style={[ui.primaryButton, (!reportContent.trim() || phase === 'loading') && ui.primaryButtonDisabled, { marginTop: 16 }]}
          >
            <Text style={[ui.primaryLabel, (!reportContent.trim() || phase === 'loading') && ui.primaryLabelDisabled]}>送信</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 保存後：積み上げ本文 → 対話 → 結論 */}
      {reportSaved && (
        <View style={{ marginTop: 24, gap: 24 }}>
          <View>
            <Text style={{ color: ink.faint, fontSize: 12, marginBottom: 8 }}>今日積み上げたもの</Text>
            <Text style={{ color: ink.muted, fontSize: 14, lineHeight: 24 }}>{reportContent}</Text>
          </View>

          {turns.map((t, i) =>
            t.role === 'ai' ? (
              t.kind === 'confirm' ? (
                // 「確認」だけは残る成果物として質感を分ける（Web と同じ扱い）
                <View key={i} style={[ui.card, { marginTop: 0, borderColor: 'rgba(143,214,200,0.25)' }]}>
                  <Text style={{ color: colors.mint, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>確認</Text>
                  <Text style={{ color: ink.body, fontSize: 15, lineHeight: 26 }}>{t.content}</Text>
                </View>
              ) : (
                <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mint, marginTop: 9 }} />
                  <Text style={{ color: ink.muted, fontSize: 15, lineHeight: 26, flex: 1 }}>{t.content}</Text>
                </View>
              )
            ) : (
              <View key={i} style={{ alignItems: 'flex-end' }}>
                <View style={{ maxWidth: '85%', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <Text style={{ color: ink.muted, fontSize: 15, lineHeight: 24 }}>{t.content}</Text>
                </View>
              </View>
            )
          )}

          {phase === 'loading' && (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
              <ActivityIndicator color={colors.mint} />
              <Text style={{ color: ink.faint, fontSize: 14 }}>{LOADING_TEXT[loadingKind]}</Text>
            </View>
          )}

          {/* 回答入力（対話中） */}
          {phase === 'chatting' && (
            <View>
              {isConfirm && <Text style={[ui.note, { marginBottom: 10 }]}>合っていれば「はい」、違えば違いを教えてください</Text>}
              <TextInput
                value={currentAnswer}
                onChangeText={setCurrentAnswer}
                style={[ui.input, { height: 96, textAlignVertical: 'top', lineHeight: 22 }]}
                placeholder="自由に答えてください（改行OK・送信はボタン）"
                placeholderTextColor={ink.placeholder}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => submitAnswer()}
                  disabled={!currentAnswer.trim()}
                  style={[ui.primaryButton, !currentAnswer.trim() && ui.primaryButtonDisabled, { flex: 1 }]}
                >
                  <Text style={[ui.primaryLabel, !currentAnswer.trim() && ui.primaryLabelDisabled]}>
                    {isConfirm ? '返答する' : '回答する'}
                  </Text>
                </TouchableOpacity>
                {/* 「もう少し掘る」＝対話の終わりを決めるのはユーザー。MAX10 はサーバーが担保する。 */}
                {isConfirm && (
                  <TouchableOpacity
                    onPress={() => submitAnswer(false, true)}
                    disabled={!currentAnswer.trim()}
                    style={[ui.secondaryButton, { paddingHorizontal: 14 }]}
                  >
                    <Text style={[ui.secondaryLabel, { fontSize: 12 }]}>もう少し掘る</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => submitAnswer(true)} style={[ui.secondaryButton, { paddingHorizontal: 14 }]}>
                  <Text style={[ui.secondaryLabel, { fontSize: 12 }]}>わからない</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 結論（残る成果物。最も静かに見せる） */}
          {phase === 'concluded' && conclusion !== '' && (
            <View style={{ gap: 16 }}>
              <View style={[ui.card, { marginTop: 0 }]}>
                {/* 状態別に見出しが変わる（今日の原則／気づき／見方／立て直し／回復メモ／軽い一手）。 */}
                <Text style={{ color: colors.mint, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
                  {cardHeading ?? '今日の結論'}
                </Text>
                <Text style={{ color: ink.body, fontSize: 15, lineHeight: 28 }}>{conclusion}</Text>
                {/* アフォリズム：正常化（psychFact）→承認（maxim / quote）。 */}
                {aphorism && (aphorism.psychFact || aphorism.maxim || aphorism.quote) && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', gap: 10 }}>
                    {aphorism.psychFact && <Text style={{ color: ink.dim, fontSize: 13, lineHeight: 22 }}>{aphorism.psychFact.text}</Text>}
                    {aphorism.maxim && <Text style={{ color: ink.muted, fontSize: 14, lineHeight: 26, fontStyle: 'italic' }}>{aphorism.maxim}</Text>}
                    {aphorism.quote && (
                      <Text style={{ color: ink.dim, fontSize: 13, lineHeight: 22 }}>
                        「{aphorism.quote.text}」 — {aphorism.quote.person}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* 臨床サイン時：なだめて済ませず、相談先の存在に軽く触れる */}
              {aphorism?.referral && (
                <View style={[ui.card, { marginTop: 0 }]}>
                  <Text style={{ color: ink.muted, fontSize: 13, lineHeight: 22 }}>{aphorism.referral}</Text>
                </View>
              )}

              {nextStep !== '' && (
                <View style={[ui.card, { marginTop: 0, borderColor: 'rgba(143,214,200,0.25)' }]}>
                  <Text style={{ color: colors.mint, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>明日の一手</Text>
                  <Text style={{ color: ink.onTeal, fontSize: 16, lineHeight: 28, fontWeight: '500' }}>{nextStep}</Text>
                </View>
              )}

              {newHypothesis && (
                <View style={[ui.card, { marginTop: 0 }]}>
                  {/* ★Web はこの見出しに金を使うが、ネイティブでの金の適用先は「三層の数字の勝ち筋」だけ
                      （spec §9）。ここは無彩色にする——金は増やすと死ぬ（§13）。 */}
                  <Text style={{ color: ink.dim, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>現時点の勝ち筋候補</Text>
                  <Text style={{ color: ink.muted, fontSize: 15, lineHeight: 28 }}>{newHypothesis}</Text>
                </View>
              )}

              {closing !== '' && (
                <Text style={{ color: ink.faint, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingVertical: 12 }}>{closing}</Text>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

// 三層の数字の1つ分。数字と見出しだけを置く（Web の並び・文言のまま）。
function Shelf({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color, fontSize: 24, fontWeight: '600' }}>{value}</Text>
      <Text style={{ color: ink.faint, fontSize: 11, marginTop: 4 }}>{label}</Text>
    </View>
  )
}
