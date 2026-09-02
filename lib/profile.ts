// オンボーディングの保存を入口の判定（`app/_layout.tsx`）へ知らせるための最小の通知。
//
// ★これが無いと: オンボーディングで display_name を保存してダッシュボードへ進んでも、
//   入口の判定が古い「display_name は空」を持ったままでオンボーディングへ送り返す
//   （2026-09-02 のデモ環境での実測で検出した。5項目を入れ終えた直後に1問目へ戻る）。
//   保存の成否ではなく**判定材料の鮮度**の問題なので、保存側から一度だけ知らせる形にする。
let version = 0
const listeners = new Set<() => void>()

export function markProfileUpdated() {
  version += 1
  listeners.forEach((l) => l())
}

export function subscribeProfile(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getProfileVersion() {
  return version
}
