// **Web の `app/onboarding/page.tsx` からの転記**（選択肢の値・表示文言をそのまま）。
// 値（id）は profiles の CHECK 制約と一致していること。文言を言い換えない（正本 §0.10）。

export const INDUSTRIES = [
  'IT・Web・ゲーム',
  '営業・販売',
  'マーケティング・広告',
  '経営・管理職',
  'クリエイティブ・デザイン',
  'コンサルティング',
  '医療・福祉',
  '教育',
  '製造・建設',
  'その他',
] as const

export const TONES = [
  { id: 'analyst', label: 'アナリスト', description: '対等な研究者として、データに基づき淡々と分析する' },
  { id: 'consultant', label: 'コンサルタント', description: '遠慮なく、歯切れよく本質を指摘する' },
  { id: 'friend', label: 'フレンド', description: '穏やかに、寄り添いながら一緒に考える' },
] as const

// 裁量・立場（選択式・必須）。一手が本人の動かせる範囲に収まるかの確認にだけ使う。
export const AUTHORITIES = [
  { id: 'executive', label: '経営・決裁者' },
  { id: 'manager', label: 'マネージャー（チームあり）' },
  { id: 'lead', label: 'リーダー（決裁なし）' },
  { id: 'member', label: '個人担当' },
  { id: 'freelance', label: 'フリーランス' },
] as const

export const CONTEXT_NOTE_MAX = 500

// Supabase の Minimum password length（Web と同値・2026-08-23 実測）。
export const MIN_PASSWORD_LENGTH = 6

// address_style は DB 既定（'san'）に任せる＝オンボーディングでは触らない（Web と同じ）。
