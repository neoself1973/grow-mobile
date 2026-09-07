import { useEffect, useState, useSyncExternalStore } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfileVersion, subscribeProfile } from '../lib/profile'
import { withTimeout } from '../lib/withTimeout'
import { colors } from '../constants/colors'

// 入口の規則は Web と同じにする（正本 §0.10 (2)）:
//   セッション無し            → /(auth)/sign-in
//   セッション有り・display_name 空 → /onboarding
//   セッション有り・display_name 有 → /dashboard
// Web は `app/page.tsx` が同じ判定をしている。ネイティブだけがオンボーディングを飛ばす経路を作らない。
export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [hasName, setHasName] = useState<boolean | null>(null)
  // profiles が上限の時間内に読めなかった（＝圏外など）。入口の判定を待たせず先へ倒すための印。
  const [entryTimedOut, setEntryTimedOut] = useState(false)
  const [ready, setReady] = useState(false)
  // オンボーディングでの保存を拾う（保存直後に古い判定でオンボーディングへ送り返さないため）。
  const profileVersion = useSyncExternalStore(subscribeProfile, getProfileVersion, getProfileVersion)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // display_name は profiles から読む（行はトリガー handle_new_user が作る＝クライアントは insert しない）。
  // ★読み出しには時間の上限を置く（2026-09-07 段5-0b）。圏外だと応答が返らず、入口の読み込み表示から
  //   動かなくなるため。上限を超えたら**下書きの書ける画面（ダッシュボード）へ倒す**。
  //   未ログインの判定は端末内（SecureStore）で完結するので従来どおり待たせない。
  useEffect(() => {
    if (!session) {
      setHasName(null)
      setEntryTimedOut(false)
      return
    }
    let cancelled = false
    void (async () => {
      const result = await withTimeout(
        (async () => {
          const { data } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle()
          return data
        })(),
      )
      if (cancelled) return
      if (result.timedOut) setEntryTimedOut(true)
      else setHasName(!!result.value?.display_name)
    })()
    return () => { cancelled = true }
  }, [session, profileVersion])

  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === '(auth)'
    if (!session) {
      if (!inAuth) router.replace('/(auth)/sign-in')
      return
    }
    // 上限を超えたら、判定を待たずにダッシュボードへ倒す（そこには下書きが戻っている）。
    // ★一度倒したらこの起動の間は戻さない——後から profiles が届いてもオンボーディングへ引き戻すと
    //   書きかけの入力を奪うため。次回の起動で通常どおり判定される。
    if (hasName === null && entryTimedOut) {
      if (segments[0] !== 'dashboard') router.replace('/dashboard')
      return
    }
    if (hasName === null) return // profiles の読み出し待ち
    // ★入口（"/"＝segments[0] が undefined）も転送の対象に含める。含めないと、セッションが
    //   復元された状態でアプリを起動したとき "/" の読み込み表示から先へ進まない
    //   （2026-09-03 のシミュレータ実測で検出。Web は毎回サーバーが判定するため起きない）。
    const atEntry = segments[0] === undefined
    if (hasName && (inAuth || atEntry || segments[0] === 'onboarding')) router.replace('/dashboard')
    if (!hasName && segments[0] !== 'onboarding') router.replace('/onboarding')
  }, [ready, session, hasName, entryTimedOut, segments, router])

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.base },
        }}
      />
    </>
  )
}
