// Grow日（正本 §6.1）＝**9:00 を境界とする1日**。conclude は Grow日あたり1回。暦日で数えてはならない。
//
// ★日付の計算を自分で発明しない。Web の実装をそのまま移植する:
//   移植元: daily-report-app/app/dashboard/page.tsx:290
//     const today = new Date().toISOString().split('T')[0]
//   根拠のコメント: daily-report-app/lib/weekly.ts:5
//     「= daily_reports.report_date。9:00 境界＝実装上は UTC 暦日。V1 で実データ確認済み」
//
// なぜ UTC 暦日が 9:00 境界になるか: JST は UTC+9。JST 9:00 ちょうどが UTC 0:00 に当たるため、
// UTC の暦日を取ると JST 9:00 で切り替わる。∴ 端末の時計が JST でなくても（UTC を見るので）
// Web と同じ Grow日になる。`(user_id, report_date)` の一意制約が「1 Grow日 1 conclude」を構造的に保証する。
export function todayGrowDate(): string {
  return new Date().toISOString().split('T')[0]
}
