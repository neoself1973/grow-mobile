import { Text, TouchableOpacity, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { ui } from '../constants/ui'
import { ink } from '../constants/colors'

// 段4 で作る画面の置き場所。**この段では文言を置かない**（正本 §0.10・確定文言だけを使う規律）。
// 三層の数字は既存の読み方のまま（anon キー＋本人の JWT で Supabase を直接読む）で段4 に実装する。
export default function Dashboard() {
  return (
    <View style={ui.screen}>
      <Text style={{ color: ink.dim, fontSize: 13, textAlign: 'center' }}>ダッシュボード（段4）</Text>
      <TouchableOpacity onPress={() => supabase.auth.signOut()} style={[ui.secondaryButton, { marginTop: 24 }]}>
        <Text style={ui.secondaryLabel}>ログアウト</Text>
      </TouchableOpacity>
    </View>
  )
}
