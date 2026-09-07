#!/usr/bin/env bash
# 正本 §12-7 の機械照合（**公開の可否を決める**）。段5 で公開 APK に対して実行する。
#
#   使い方: scripts/check-demo-build.sh <公開用 APK のパス>
#
# 判定: 展開物に本番の Supabase プロジェクト ref と本番ドメインが **0件** であること。
#       走査ファイル数と総バイト数が 0 でないことも同時に示す（grep が空振りしただけ、を弾く）。
set -euo pipefail

APK="${1:-}"
if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "使い方: $0 <公開用 APK のパス>" >&2
  exit 2
fi

PROD_MARKERS=('qxiwiohtaopxqwhqkmsq' 'app.grow-app.jp')

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# -o: 同名エントリを黙って上書きする。APK には同名の資源が複数入ることがあり、
# 付けないと対話プロンプトで止まる（2026-09-07 実物で判明）。
unzip -qo "$APK" -d "$WORK"

FILES=$(find "$WORK" -type f | wc -l | tr -d ' ')
BYTES=$(find "$WORK" -type f -exec cat {} + | wc -c | tr -d ' ')
echo "走査対象ファイル数: $FILES"
echo "総バイト数: $BYTES"
if [ "$FILES" -eq 0 ] || [ "$BYTES" -eq 0 ]; then
  echo "NG: 展開物が空。grep の 0 件は無意味なので不合格にする。" >&2
  exit 1
fi

# -a: 実体はバイナリ（classes.dex・アセット）なので、テキストとして走査する。
STATUS=0
echo "本番マーカー:"
for marker in "${PROD_MARKERS[@]}"; do
  # grep は不一致で終了コード1。pipefail と set -e に拾わせないため || true を付ける。
  HITS=$( { grep -ral "$marker" "$WORK" || true; } | wc -l | tr -d ' ')
  echo "  $marker: ${HITS} 件"
  [ "$HITS" -eq 0 ] || STATUS=1
done

# 秘密の文字列。anon キーは公開前提なので入っていてよい（クライアントに配る鍵）。
# 入っていてはならないのは service role の鍵と、その名前で渡された値。
SECRET_MARKERS=('service_role' 'SUPABASE_SERVICE_ROLE_KEY' 'ANTHROPIC_API_KEY' 'sk-ant-')
echo "秘密の文字列（anon キーは公開前提のため対象外）:"
for marker in "${SECRET_MARKERS[@]}"; do
  # grep は不一致で終了コード1。pipefail と set -e に拾わせないため || true を付ける。
  HITS=$( { grep -ral "$marker" "$WORK" || true; } | wc -l | tr -d ' ')
  echo "  $marker: ${HITS} 件"
  [ "$HITS" -eq 0 ] || STATUS=1
done

if [ "$STATUS" -eq 0 ]; then
  echo "OK: 公開用ビルドに本番への経路は無い（§12-7）。"
else
  echo "NG: 本番マーカーを検出。**公開しないこと。**" >&2
fi
exit "$STATUS"
