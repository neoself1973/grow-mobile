import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { todayGrowDate } from '../lib/growDay'
import {
  ChatApiError,
  conclude as apiConclude,
  question as apiQuestion,
  summarize as apiSummarize,
  type Aphorism,
  type ChatTurn,
} from '../lib/chatApi'
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
  const scrollRef = useRef<ScrollView>(null)

  const today = todayGrowDate()

  // 今日の Grow日の積み上げと、その会話を読む。
  // **結論済みの Grow日は再度 conclude できない**（Web と同じ＝保存済みの会話をそのまま表示する）。
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // ★getUser() は初回起動時、SecureStore からのセッション復元より先に呼ばれると null を返す。
        //   さらに「null なら早期 return」にしていると `ready` が永久に false のままになり、
        //   読み込み表示から進まない（2026-09-03 のシミュレータ実測で検出）。
        //   セッションは復元済みのものを見る（getSession）＋ 失敗しても必ず ready にする。
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return
        const { data: report } = await supabase
          .from('daily_reports')
          .select('id, content')
          .eq('user_id', user.id)
          .eq('report_date', today)
          .maybeSingle()
        if (cancelled) return
        if (report) {
          setReportId(report.id as string)
          setReportContent(report.content as string)
          setReportSaved(true)
          const { data: conv } = await supabase
            .from('conversations')
            .select('messages, phase')
            .eq('report_id', report.id)
            .maybeSingle()
          if (cancelled) return
          if (conv?.phase === 'concluded') applyConversation(conv.messages as Record<string, unknown>)
        }
      } catch (e) {
        // 読めなくても画面は出す（入力はできる）。黙って読み込み表示のまま止めない。
        console.error('load today failed:', e)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [today])

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
      setErrorText('一時的に処理できませんでした。時間をおいてもう一度お試しください。')
      return
    }
    setReportId(data.id as string)
    setReportSaved(true)
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
      setErrorText(e instanceof ChatApiError ? e.message : '一時的に処理できませんでした。時間をおいてもう一度お試しください。')
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
    setErrorText(e instanceof ChatApiError ? e.message : '一時的に処理できませんでした。時間をおいてもう一度お試しください。')
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

      {/* 積み上げの入力（まだ保存していないとき） */}
      {!reportSaved && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: ink.primary, fontSize: 22, fontWeight: '500', marginBottom: 10 }}>今日はどうでしたか</Text>
          <Text style={[ui.note, { marginBottom: 24 }]}>今日の仕事を、静かに書き出してみてください</Text>
          <TextInput
            value={reportContent}
            onChangeText={setReportContent}
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
