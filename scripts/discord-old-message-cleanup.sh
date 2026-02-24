#!/bin/bash
# Discord #一般チャンネルから10日以上前のメッセージを削除

CHANNEL_ID="1464650064357232948"
CUTOFF_DATE="2026-02-14T01:00:00Z"
DELETE_COUNT=0
ERROR_COUNT=0

# 10日以上前のメッセージを検索して削除
# 注: Discordは14日以上前のメッセージは一括削除できないため、個別削除が必要

echo "🗑️ Searching for messages older than $CUTOFF_DATE..."

# メッセージ検索（最大100件）
MESSAGES=$(clawdbot message search \
  --channel discord \
  --channel-id "$CHANNEL_ID" \
  --before "$CUTOFF_DATE" \
  --limit 100 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to search messages" >&2
  exit 1
fi

# メッセージIDを抽出して削除
MESSAGE_IDS=$(echo "$MESSAGES" | jq -r '.messages[]?.id // empty' 2>/dev/null)

if [ -z "$MESSAGE_IDS" ]; then
  echo "✅ No messages to delete"
  exit 0
fi

# 各メッセージを個別削除
while IFS= read -r MESSAGE_ID; do
  if [ -n "$MESSAGE_ID" ]; then
    if clawdbot message delete \
      --channel discord \
      --channel-id "$CHANNEL_ID" \
      --message-id "$MESSAGE_ID" 2>/dev/null; then
      DELETE_COUNT=$((DELETE_COUNT + 1))
    else
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
    # レート制限対策
    sleep 0.5
  fi
done <<< "$MESSAGE_IDS"

if [ $ERROR_COUNT -gt 0 ]; then
  echo "⚠️ Deleted $DELETE_COUNT messages, $ERROR_COUNT errors" >&2
  exit 1
else
  echo "✅ Deleted $DELETE_COUNT messages"
  exit 0
fi
