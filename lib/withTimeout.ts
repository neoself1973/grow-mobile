import { STARTUP_TIMEOUT_MS } from '../constants/app'

/**
 * 約束（Promise）に時間の上限を付ける。上限を超えたら `{ timedOut: true }` を返す。
 * **元の処理は止めない**——遅れて返ってきた結果は呼び出し側が受け取って使える（入力を奪わない条件つきで）。
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = STARTUP_TIMEOUT_MS,
): Promise<{ timedOut: boolean; value?: T }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms)
  })
  try {
    return await Promise.race([
      promise.then((value) => ({ timedOut: false as const, value })),
      timeout,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
