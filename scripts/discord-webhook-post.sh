#!/bin/bash
# Discord Webhook経由で投稿

WEBHOOK_URL="${DISCORD_WEBHOOK_URL}"
MESSAGE="$1"

if [ -z "$WEBHOOK_URL" ]; then
    echo "❌ DISCORD_WEBHOOK_URL が設定されていません"
    exit 1
fi

# Discord Webhookに投稿
curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"content\": $(echo "$MESSAGE" | jq -Rs .)}" \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Discord投稿成功"
else
    echo "❌ Discord投稿失敗"
    exit 1
fi
