import { useEffect, useState, useSyncExternalStore } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfileVersion, subscribeProfile } from '../lib/profile'
import { colors } from '../constants/colors'

// 入口の規則は Web と同じにする（正本 §0.10 (2)）:
//   セッション無し            → /(auth)/sign-in
//   セッション有り・display_name 空 → /onboarding
//   セッション有り・display_name 有 → /dashboard
// Web は `app/page.tsx` が同じ判定をしている。ネイティブだけがオンボーディングを飛ばす経路を作らない。
export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [hasName, setHasName] = useState<boolean | null>(null)
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
  useEffect(() => {
    if (!session) {
      setHasName(null)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setHasName(!!data?.display_name)
      })
    return () => { cancelled = true }
  }, [session, profileVersion])

  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === '(auth)'
    if (!session) {
      if (!inAuth) router.replace('/(auth)/sign-in')
      return
    }
    if (hasName === null) return // profiles の読み出し待ち
    // ★入口（"/"＝segments[0] が undefined）も転送の対象に含める。含めないと、セッションが
    //   復元された状態でアプリを起動したとき "/" の読み込み表示から先へ進まない
    //   （2026-09-03 のシミュレータ実測で検出。Web は毎回サーバーが判定するため起きない）。
    const atEntry = segments[0] === undefined
    if (hasName && (inAuth || atEntry || segments[0] === 'onboarding')) router.replace('/dashboard')
    if (!hasName && segments[0] !== 'onboarding') router.replace('/onboarding')
  }, [ready, session, hasName, segments, router])

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
