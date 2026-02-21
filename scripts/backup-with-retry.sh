#!/bin/bash
# バックアップスクリプト（リトライ機能付き）

MAX_RETRIES=3
RETRY_DELAY=10

cd /root/clawd || exit 1

for i in $(seq 1 $MAX_RETRIES); do
  echo "バックアップ試行 $i/$MAX_RETRIES"
  
  # 変更を追加
  git add -A
  
  # 変更があるかチェック
  if git diff --staged --quiet; then
    echo "変更なし"
    exit 0
  fi
  
  # コミット
  git commit -m "Auto backup: $(date '+%Y-%m-%d %H:%M')" || {
    echo "コミット失敗"
    continue
  }
  
  # プッシュ
  if git push origin main; then
    echo "バックアップ成功"
    bash /root/clawd/scripts/notify.sh \
      "💾 自動バックアップ完了" \
      "GitHubへのバックアップが成功しました。" \
      "1464650064357232948" \
      "success" 2>/dev/null &
    exit 0
  else
    echo "プッシュ失敗、${RETRY_DELAY}秒後にリトライ..."
    sleep $RETRY_DELAY
  fi
done

echo "バックアップ失敗（最大試行回数に到達）"
bash /root/clawd/scripts/notify.sh \
  "💾 自動バックアップ失敗" \
  "最大試行回数に達しました。手動確認が必要です。" \
  "1464650064357232948" \
  "error" 2>/dev/null
exit 1
