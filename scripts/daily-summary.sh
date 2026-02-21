#!/bin/bash
# 毎日の会話をサマリー化してMEMORY.mdに追記

set -e

AGENT_DIR="/root/.clawdbot/agents/main"
SESSION_DIR="$AGENT_DIR/sessions"
MEMORY_DIR="/root/clawd/memory"
TODAY=$(date +%Y-%m-%d)
MEMORY_FILE="$MEMORY_DIR/$TODAY.md"

# 今日のセッションを検索
echo "# $TODAY メモリ" > "$MEMORY_FILE"
echo "" >> "$MEMORY_FILE"

# 今日の会話からユーザーメッセージを抽出
jq -r 'select(.type=="message" and .message.role=="user") | .message.content[]? | select(.type=="text") | .text' \
  "$SESSION_DIR"/*.jsonl 2>/dev/null | \
  grep "$(date +%Y-%m-%d)" | \
  sed 's/^/- /' >> "$MEMORY_FILE"

echo "" >> "$MEMORY_FILE"
echo "**自動生成:** $(date)" >> "$MEMORY_FILE"

echo "✅ サマリー生成完了: $MEMORY_FILE"
