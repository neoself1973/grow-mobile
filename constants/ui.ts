import { StyleSheet } from 'react-native'
import { colors, ink } from './colors'

// 画面をまたいで同じ見た目を使う（画面ごとに色や角丸を作らない＝正本 §13）。
// 演出は置かない: アニメーション・バッジ・streak は入れない（§0.10「入れないもの」）。
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base, padding: 20, justifyContent: 'center' },
  brand: { color: ink.primary, fontSize: 22, fontWeight: '600', letterSpacing: 3, textAlign: 'center' },
  tagline: { color: ink.faint, fontSize: 13, textAlign: 'center', marginTop: 10 },
  card: { backgroundColor: colors.panel, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginTop: 28 },
  heading: { color: ink.primary, fontSize: 17, fontWeight: '500', marginBottom: 6 },
  note: { color: ink.faint, fontSize: 13, marginBottom: 20 },
  label: { color: ink.dim, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: ink.field, color: ink.body, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  primaryButton: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.04)' },
  primaryLabel: { color: ink.onTeal, fontSize: 14, fontWeight: '500' },
  primaryLabelDisabled: { color: ink.disabled },
  secondaryButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  secondaryLabel: { color: ink.muted, fontSize: 14, fontWeight: '500' },
  choice: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 8 },
  choiceSelected: { borderColor: 'rgba(143,214,200,0.5)', backgroundColor: 'rgba(143,214,200,0.1)' },
  choiceLabel: { color: ink.muted, fontSize: 14 },
  choiceLabelSelected: { color: ink.primary },
  choiceDescription: { color: ink.dim, fontSize: 12, marginTop: 2 },
  error: { color: ink.danger, fontSize: 13 },
  ok: { color: colors.mint, fontSize: 13 },
  stepBar: { height: 3, width: 32, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  stepBarDone: { backgroundColor: colors.mint },
})
