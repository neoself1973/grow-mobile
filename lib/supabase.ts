import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

// ネイティブでしか出せないものの1つ（正本 §0.10）＝**トークンの安全な保管**。
// セッション（access_token / refresh_token）は SecureStore（iOS Keychain / Android Keystore）に置く。
// 書きかけの積み上げ＝オフライン下書きは AsyncStorage（段4）。**両者を混ぜない。**
//
// SecureStore は1項目 2048 バイトを超えると警告が出るため、値を分割して保存する。
// 分割数はインデックスキーに持ち、読み出しと削除で同じ数だけ辿る。
const CHUNK_SIZE = 1800

// Web（`npx expo start --web` での動作確認用）には SecureStore が無い。
// **公開ビルドは iOS / Android のみ**（正本 §0.10）で、Web は Xcode / Android SDK 未導入の間の
// 代替確認手段でしかない。localStorage に落ちるのはその経路だけ。
const webStorage = {
  getItem: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
  setItem: async (k: string, v: string) => { globalThis.localStorage?.setItem(k, v) },
  removeItem: async (k: string) => { globalThis.localStorage?.removeItem(k) },
}

const secureStorage = {
  async getItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}__chunks`)
    if (!count) return await SecureStore.getItemAsync(key)
    const parts: string[] = []
    for (let i = 0; i < Number(count); i++) {
      parts.push((await SecureStore.getItemAsync(`${key}__${i}`)) ?? '')
    }
    return parts.join('')
  },
  async setItem(key: string, value: string) {
    await secureStorage.removeItem(key)
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value)
      return
    }
    const chunks = Math.ceil(value.length / CHUNK_SIZE)
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
    }
    await SecureStore.setItemAsync(`${key}__chunks`, String(chunks))
  },
  async removeItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}__chunks`)
    if (count) {
      for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}__${i}`)
      await SecureStore.deleteItemAsync(`${key}__chunks`)
    }
    await SecureStore.deleteItemAsync(key)
  },
}

// 値はビルド時に渡す（.env.demo / .env.prod は git 管理外）。
// ★service_role キーはここにも EXPO_PUBLIC_* にも**置かない**。載せた瞬間に配布物に鍵が乗る。
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // ネイティブに URL のセッションは無い（Web のマジックリンク前提の挙動を持ち込まない）。
    detectSessionInUrl: false,
  },
})
