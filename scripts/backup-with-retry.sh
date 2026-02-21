#!/bin/bash
# バックアップスクリプト（リトライ機能付き）- ログ出力最適化版

MAX_RETRIES=3
RETRY_DELAY=10

cd /root/clawd || exit 1

for i in $(seq 1 $MAX_RETRIES); do
  git add -A 2>/dev/null
  
  if git diff --staged --quiet; then
    exit 0  # 変更なし
  fi
  
  git commit -m "Auto backup: $(date '+%Y-%m-%d %H:%M')" &>/dev/null || continue
  
  if git push origin main &>/dev/null; then
    bash /root/clawd/scripts/notify.sh \
      "💾 自動バックアップ完了" \
      "GitHubへのバックアップが成功しました。" \
      "1464650064357232948" \
      "success" 2>/dev/null &
    exit 0
  else
    sleep $RETRY_DELAY
  fi
done

# エラー時のみ出力
echo "❌ バックアップ失敗（最大試行回数到達）" >&2
bash /root/clawd/scripts/notify.sh \
  "💾 自動バックアップ失敗" \
  "最大試行回数に達しました。手動確認が必要です。" \
  "1464650064357232948" \
  "error" 2>/dev/null
exit 1
