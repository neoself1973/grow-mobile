// 色は正本 §13（視覚規範）のトークン値。**適用先の追加・変更は正本の改訂を要する。**
// 値は Web の globals.css:16-23 と同値であること（画面ごとに色を作らない）。
export const colors = {
  base: '#0b0f18', // 地。アプリの体温
  panel: '#111725', // 面
  mint: '#8fd6c8', // 本人の側（選択状態・現在地）
  teal: '#3a8073', // 本人の側（操作＝ボタン）
  tealHover: '#46927f',
  gold: '#cbb185', // Grow の側（確定した資産と節目）。**適用先は列挙制＝この段では使わない**
} as const

// グレー系は Web でもトークン未定義（生hex）。同値をここで一度だけ定義する。
export const ink = {
  primary: '#eef1f6',
  body: '#e2e6ee',
  muted: '#c4cad6',
  dim: '#8b93a5',
  faint: '#7e889c',
  disabled: '#5b6472',
  placeholder: '#4f5766',
  danger: '#d98a8a',
  field: '#0e131e',
  onTeal: '#f1f5f3',
} as const
