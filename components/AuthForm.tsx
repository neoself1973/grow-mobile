import { useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { signInErrorMessage, signUpErrorMessage } from '../lib/authErrorMessage'
import { MIN_PASSWORD_LENGTH } from '../constants/onboarding'
import { ui } from '../constants/ui'
import { ink } from '../constants/colors'

// **Web の `components/AuthForm.tsx` の転記**（見出し・ラベル・ボタン・注記の文言をそのまま）。
// ログインと新規登録で同じフォームを使う（片方だけ直す事故を防ぐ）のも Web と同じ。
//
// Web と違うところ（実装の事実として記録する）:
//   - `emailRedirectTo` を渡さない。ネイティブに origin が無く、**デモ環境は Confirm email をオフ**に
//     しているため確認メールの着地が要らない（2026-08-31 裁定）。∴ 登録した瞬間にセッションが立つ。
//   - 流入元（utm）の退避は入れない。LP からの流入はネイティブに無い。
type Mode = 'signin' | 'signup'
type Notice = { text: string; tone: 'ok' | 'error' }

export function AuthForm({ mode }: { mode: Mode }) {
  const isSignUp = mode === 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const router = useRouter()

  const disabled = loading || !email || !password

  const handleAuth = async () => {
    setLoading(true)
    setNotice(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        // 分類から漏れた原因を後から追えるようにする。入力値（メール・パスワード）は載せない。
        console.error('signUp failed:', error)
        setNotice({ text: signUpErrorMessage(error), tone: 'error' })
      }
      // 成功時は Confirm email オフのため即セッション＝`_layout.tsx` がオンボーディングへ送る。
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        console.error('signIn failed:', error)
        setNotice({ text: signInErrorMessage(error), tone: 'error' })
      }
    }

    setLoading(false)
  }

  return (
    <View style={ui.screen}>
      <Text style={ui.brand}>GROW</Text>
      <Text style={ui.tagline}>あなただけの仕事の成功パターンを見つける</Text>

      <View style={ui.card}>
        <Text style={[ui.heading, { marginBottom: 20 }]}>{isSignUp ? 'アカウント作成' : 'ログイン'}</Text>

        <Text style={ui.label}>メールアドレス</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={ui.input}
          placeholder="your@email.com"
          placeholderTextColor={ink.placeholder}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />

        <Text style={[ui.label, { marginTop: 16 }]}>パスワード</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={ui.input}
          placeholder="••••••••"
          placeholderTextColor={ink.placeholder}
          autoCapitalize="none"
          secureTextEntry
          onSubmitEditing={() => { if (!disabled) void handleAuth() }}
        />
        {/* 要件は新規登録のときだけ添える（ログイン画面では入力の条件ではない）。 */}
        {isSignUp && <Text style={[ui.note, { marginTop: 6, marginBottom: 0 }]}>{MIN_PASSWORD_LENGTH}文字以上</Text>}

        {notice && <Text style={[notice.tone === 'ok' ? ui.ok : ui.error, { marginTop: 16 }]}>{notice.text}</Text>}

        <TouchableOpacity
          onPress={handleAuth}
          disabled={disabled}
          style={[ui.primaryButton, disabled && ui.primaryButtonDisabled, { marginTop: 20 }]}
        >
          <Text style={[ui.primaryLabel, disabled && ui.primaryLabelDisabled]}>
            {loading ? '処理中...' : isSignUp ? 'アカウントを作成' : 'ログイン'}
          </Text>
        </TouchableOpacity>

        {/* 副ボタンは相手の画面へ遷移する（トグルしない）＝画面と URL が常に一致する。 */}
        <TouchableOpacity
          onPress={() => router.replace(isSignUp ? '/(auth)/sign-in' : '/(auth)/sign-up')}
          style={[ui.secondaryButton, { marginTop: 12 }]}
        >
          <Text style={ui.secondaryLabel}>{isSignUp ? 'ログイン' : '新規登録'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
