import { View, ActivityIndicator } from 'react-native'
import { colors } from '../constants/colors'

// 行き先は `_layout.tsx` が決める（Web の `app/page.tsx` と同じ規則）。
// ここは判定が済むまでの待ちだけを持つ。文言は置かない。
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.base, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.mint} />
    </View>
  )
}
