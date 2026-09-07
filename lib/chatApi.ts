import { API_BASE_URL, supabase } from './supabase'
import { GENERIC_RETRY, OFFLINE } from './authErrorMessage'

// 対話3経路（正本 §0.10 (3)）。契約は grow_mobile_spec §13-(c) のとおり。
// 認証は段1 で足したヘッダ経路＝`Authorization: Bearer <access_token>`（Cookie は使わない）。

export type ChatTurn = {
  role: 'ai' | 'user'
  content: string
  kind?: 'opening' | 'question' | 'confirm'
}

export type Aphorism = {
  maxim: string | null
  quote: { text: string; person: string } | null
  psychFact: { text: string } | null
  referral: string | null
}

export type SummarizeResponse = { reply: string; keyPoint: string; isFree: boolean }
export type QuestionResponse = { reply: string; mode: 'question' | 'confirm' }
export type ConcludeResponse = {
  conclusion: string
  nextStep: string | null
  newHypothesis: string | null
  closing: string
  cardHeading: string | null
  aphorism: Aphorism | null
  winPattern: { id: string; theme: string; title: string | null; count: number; threshold: number; status: string } | null
  promoted: boolean
}

// 失敗の表示は2文だけ（正本 §0.10・`lib/authErrorMessage.ts` からの流用。新しい文言を作らない）。
//   通信断・デモ環境の休止 → OFFLINE ／ API 上限到達・5xx など → GENERIC_RETRY
export class ChatApiError extends Error {}

async function postChat<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ChatApiError(GENERIC_RETRY)

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch (e) {
    // fetch 自体が失敗＝通信断、またはデモ環境が休止している。
    console.error(`${path} fetch failed:`, e)
    throw new ChatApiError(OFFLINE)
  }

  if (!res.ok) {
    // 401（セッション切れ）・404（profiles 行が無い）・500（LLM 応答の JSON 破れ・API 上限）。
    // 原因を特定できていない場面で原因を示唆しない（2026-08-16 の文言の原則）ため一律この1文。
    console.error(`${path} failed: status=${res.status}`)
    throw new ChatApiError(GENERIC_RETRY)
  }

  try {
    return (await res.json()) as T
  } catch (e) {
    console.error(`${path} invalid json:`, e)
    throw new ChatApiError(GENERIC_RETRY)
  }
}

export function summarize(reportContent: string) {
  // feedback（前回の一手の答え合わせ）は Web のチェックイン UI が作る。ネイティブは段3 の範囲外＝渡さない。
  return postChat<SummarizeResponse>('/api/chat/summarize', { reportContent })
}

export function question(args: {
  reportContent: string
  keyPoint: string
  turns: ChatTurn[]
  autoSelect?: boolean
  userExtend?: boolean
}) {
  // mode（次も質問か・確認へ移るか）を決めるのは**サーバー**。回数の上限（MAX10）も question ルートが担保する。
  return postChat<QuestionResponse>('/api/chat/question', args)
}

export function conclude(args: {
  reportId: string
  reportContent: string
  keyPoint: string
  turns: ChatTurn[]
}) {
  return postChat<ConcludeResponse>('/api/chat/conclude', args)
}
