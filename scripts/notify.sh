#!/bin/bash
# ============================================
# notify.sh - 汎用Discord完了通知スクリプト
# 使い方: bash notify.sh "タスク名" "結果メッセージ" [チャンネルID] [success|error|info]
# デフォルト: #一般 (1464650064357232948)
# ============================================

TASK_NAME="${1:-タスク}"
MESSAGE="${2:-完了しました}"
CHANNEL_ID="${3:-1464650064357232948}"
STATUS="${4:-success}"

# ステータスに応じた絵文字を設定
case "$STATUS" in
  success|ok|done)
    EMOJI="✅"
    ;;
  error|fail|failed)
    EMOJI="❌"
    ;;
  warning|warn)
    EMOJI="⚠️"
    ;;
  info)
    EMOJI="ℹ️"
    ;;
  *)
    EMOJI="🔔"
    ;;
esac

# 現在時刻 (JST)
TIMESTAMP=$(TZ='Asia/Tokyo' date '+%Y-%m-%d %H:%M JST')

# Discordに送信
FULL_MESSAGE="${EMOJI} **${TASK_NAME}**
${MESSAGE}

🕐 ${TIMESTAMP}
🤖 自動完了通知"

clawdbot message send \
  --channel discord \
  --target "$CHANNEL_ID" \
  --message "$FULL_MESSAGE" \
  2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[notify.sh] ✅ Discord通知送信完了 → channel:$CHANNEL_ID"
else
  echo "[notify.sh] ❌ Discord通知送信失敗 (exit: $EXIT_CODE)"
fi

exit $EXIT_CODE
