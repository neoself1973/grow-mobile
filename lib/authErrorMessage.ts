import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'

// **Web の `lib/authErrorMessage.ts` からの転記**（正本 §0.10「文言は Web の確定文言をそのまま使う」）。
// 中身を書き換えない・言い換えない。Web 側を直したらここも同じ内容にする。
//
// 文言の原則（2026-08-16 裁定）:
//   ・原因を特定できていない場面で原因を示唆しない（断定禁止）。5xx は一律「一時的に」へ倒す
//   ・励まし・煽り・謝罪の重ね掛けを置かない。静かな1行
//   ・ユーザーに「自分が間違えた」という誤った罪悪感を与えない

const GENERIC_RETRY = '一時的に処理できませんでした。時間をおいてもう一度お試しください。'
const OFFLINE = '通信に失敗しました。接続を確認して、もう一度お試しください。'
const RATE_LIMITED = '短時間に何度も試行されました。しばらく待ってからお試しください。'

function transportMessage(error: AuthError): string | null {
  if (!isAuthRetryableFetchError(error)) return null
  return error.status === 0 ? OFFLINE : GENERIC_RETRY
}

export function signUpErrorMessage(error: AuthError): string {
  const transport = transportMessage(error)
  if (transport) return transport

  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'このメールアドレスは登録済みです。ログインからお進みください。'
    case 'weak_password':
      return 'パスワードが安全ではありません。より長く、推測されにくいものにしてください。'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'メールアドレスの形式が正しくありません。'
    case 'email_address_not_authorized':
      return 'このメールアドレスには確認メールを送信できませんでした。別のメールアドレスをお試しください。'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return RATE_LIMITED
    case 'signup_disabled':
    case 'email_provider_disabled':
      return '現在、新規登録を受け付けていません。'
    default:
      return 'アカウントを作成できませんでした。時間をおいてもう一度お試しください。'
  }
}

export function signInErrorMessage(error: AuthError): string {
  const transport = transportMessage(error)
  if (transport) return transport

  switch (error.code) {
    case 'invalid_credentials':
      return 'メールアドレスまたはパスワードが正しくありません。'
    case 'email_not_confirmed':
      return 'メールアドレスの確認が済んでいません。確認メールのリンクを開いてください。'
    case 'user_banned':
      return 'このアカウントはご利用いただけません。'
    case 'over_request_rate_limit':
      return RATE_LIMITED
    default:
      return GENERIC_RETRY
  }
}
