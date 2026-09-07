import AsyncStorage from '@react-native-async-storage/async-storage'

// オフライン下書き（正本 §0.10「ネイティブでしか出せないもの」／spec §11）。
//
// 何を: 積み上げの入力欄の本文1件のみ。**対話の途中経過（turns）は持たない**（サーバー側の状態と食い違うため）。
// どこに: AsyncStorage。**SecureStore には置かない**——SecureStore はトークン専用とし、保管先を役割で分ける。
// キー: ユーザー ID でスコープし（同一端末の別アカウントと混ぜない）、Grow日で分ける。
// いつ消すか: **`daily_reports` への保存が成功した時点**（結論の確定を待たない。spec §11）。
// 復元: 起動時に在れば入力欄へ戻す。**戻したことを文言で知らせない**（新しい文言を作らない）。
const key = (userId: string, growDate: string) => `draft:${userId}:${growDate}`

export async function loadDraft(userId: string, growDate: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(userId, growDate))
  } catch (e) {
    // 下書きが読めなくても入力はできる。黙って空から始める（画面に何も出さない）。
    console.error('draft load failed:', e)
    return null
  }
}

export async function saveDraft(userId: string, growDate: string, text: string) {
  try {
    if (text.trim() === '') await AsyncStorage.removeItem(key(userId, growDate))
    else await AsyncStorage.setItem(key(userId, growDate), text)
  } catch (e) {
    console.error('draft save failed:', e)
  }
}

export async function clearDraft(userId: string, growDate: string) {
  try {
    await AsyncStorage.removeItem(key(userId, growDate))
  } catch (e) {
    console.error('draft clear failed:', e)
  }
}
