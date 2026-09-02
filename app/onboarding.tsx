import { useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { markProfileUpdated } from '../lib/profile'
import { AUTHORITIES, CONTEXT_NOTE_MAX, INDUSTRIES, TONES } from '../constants/onboarding'
import { ui } from '../constants/ui'
import { colors, ink } from '../constants/colors'

// **Web の `app/onboarding/page.tsx` の転記**（5項目・見出し・注記・選択肢の文言をそのまま）。
// Web の入口は display_name が空なら必ずここを通る。ネイティブだけが飛ばす経路を作らない（正本 §0.10 (2)）。
// 保存するのは profiles の update だけ（行はトリガーが作る）。address_style は DB 既定に任せる（Web と同じ）。
//
// Web と違うところ: 流入元（utm）の転写（syncSignupAttribution）は入れない。LP からの流入がネイティブに無いため。
export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [displayName, setDisplayName] = useState('')
  const [industry, setIndustry] = useState('')
  const [tone, setTone] = useState('')
  const [authorityLevel, setAuthorityLevel] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!displayName || !industry || !tone || !authorityLevel) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const note = contextNote.trim()
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        industry,
        tone,
        authority_level: authorityLevel,
        context_note: note ? note : null,
      })
      .eq('id', user.id)

    if (!error) {
      // 入口の判定に「名前が入った」ことを知らせてから進む（順序を逆にすると送り返される）。
      markProfileUpdated()
      router.replace('/dashboard')
    } else {
      console.error(error)
    }
    setLoading(false)
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingVertical: 48 }} style={{ backgroundColor: colors.base }}>
      <Text style={ui.brand}>GROW</Text>
      <Text style={ui.tagline}>まず、あなたのことを教えてください</Text>

      {/* ステップインジケーター（Web と同じ5段。演出は付けない） */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <View key={s} style={[ui.stepBar, s <= step && ui.stepBarDone]} />
        ))}
      </View>

      <View style={ui.card}>
        {step === 1 && (
          <View>
            <Text style={ui.heading}>どのようにお呼びすればいいですか？</Text>
            <Text style={ui.note}>AIがこの名前で呼びかけます</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={ui.input}
              placeholder="例：田中、Konnno、さとし"
              placeholderTextColor={ink.placeholder}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => setStep(2)}
              disabled={!displayName}
              style={[ui.primaryButton, !displayName && ui.primaryButtonDisabled, { marginTop: 24 }]}
            >
              <Text style={[ui.primaryLabel, !displayName && ui.primaryLabelDisabled]}>次へ</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={ui.heading}>職種・業種を教えてください</Text>
            <Text style={ui.note}>あなたの仕事の文脈を理解するために使います</Text>
            {INDUSTRIES.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setIndustry(item)}
                style={[ui.choice, industry === item && ui.choiceSelected]}
              >
                <Text style={[ui.choiceLabel, industry === item && ui.choiceLabelSelected]}>{item}</Text>
              </TouchableOpacity>
            ))}
            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!industry} />
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={ui.heading}>AIのスタイルを選んでください</Text>
            <Text style={ui.note}>後から設定で変更できます</Text>
            {TONES.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setTone(item.id)}
                style={[ui.choice, tone === item.id && ui.choiceSelected]}
              >
                <Text style={[ui.choiceLabel, tone === item.id && ui.choiceLabelSelected]}>{item.label}</Text>
                <Text style={ui.choiceDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
            <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!tone} />
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={ui.heading}>いまの裁量・立場は？</Text>
            <Text style={ui.note}>明日の一手を、あなたが実際に動かせる範囲で出すために使います</Text>
            {AUTHORITIES.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setAuthorityLevel(item.id)}
                style={[ui.choice, authorityLevel === item.id && ui.choiceSelected]}
              >
                <Text style={[ui.choiceLabel, authorityLevel === item.id && ui.choiceLabelSelected]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <StepNav onBack={() => setStep(3)} onNext={() => setStep(5)} nextDisabled={!authorityLevel} />
          </View>
        )}

        {step === 5 && (
          <View>
            <Text style={ui.heading}>Grow に知っておいてほしいこと</Text>
            <Text style={ui.note}>
              積み上げの内容とつながったときにだけ、Grow が参照します。書かなくても構いません。
            </Text>
            <TextInput
              value={contextNote}
              onChangeText={(v) => setContextNote(v.slice(0, CONTEXT_NOTE_MAX))}
              style={[ui.input, { height: 132, textAlignVertical: 'top' }]}
              placeholder="例：ジェンダー、役職、仕事のサイクル、生活の制約、いま置かれている状況 など。書かなくても構いません。"
              placeholderTextColor={ink.placeholder}
              multiline
            />
            <Text style={{ color: ink.disabled, fontSize: 11, textAlign: 'right', marginTop: 6 }}>
              {contextNote.length} / {CONTEXT_NOTE_MAX}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity onPress={() => setStep(4)} style={[ui.secondaryButton, { flex: 1 }]}>
                <Text style={ui.secondaryLabel}>戻る</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={[ui.primaryButton, loading && ui.primaryButtonDisabled, { flex: 1 }]}
              >
                <Text style={[ui.primaryLabel, loading && ui.primaryLabelDisabled]}>
                  {loading ? '設定中...' : contextNote.trim() ? 'はじめる' : 'スキップしてはじめる'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

function StepNav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
      <TouchableOpacity onPress={onBack} style={[ui.secondaryButton, { flex: 1 }]}>
        <Text style={ui.secondaryLabel}>戻る</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onNext}
        disabled={nextDisabled}
        style={[ui.primaryButton, nextDisabled && ui.primaryButtonDisabled, { flex: 1 }]}
      >
        <Text style={[ui.primaryLabel, nextDisabled && ui.primaryLabelDisabled]}>次へ</Text>
      </TouchableOpacity>
    </View>
  )
}
