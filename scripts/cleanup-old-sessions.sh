#!/bin/bash
# Cleanup Old Sessions Script
# Removes sessions that are over 90% token usage

set -e

echo "🧹 古いセッションをクリーンアップします..."

# Get session directory
SESSION_DIR="$HOME/.clawdbot/agents/main/sessions"

if [ ! -d "$SESSION_DIR" ]; then
    echo "❌ セッションディレクトリが見つかりません: $SESSION_DIR"
    exit 1
fi

# Count sessions before cleanup
BEFORE_COUNT=$(ls -1 "$SESSION_DIR"/*.jsonl 2>/dev/null | wc -l)
echo "📊 削除前: $BEFORE_COUNT セッション"

# Find and remove sessions older than 7 days
DELETED=0
for session in "$SESSION_DIR"/*.jsonl; do
    if [ -f "$session" ]; then
        # Check file size (rough estimate of token usage)
        SIZE=$(stat -f%z "$session" 2>/dev/null || stat -c%s "$session" 2>/dev/null)
        
        # If size > 10MB, it's likely over 90% token usage
        if [ "$SIZE" -gt 10485760 ]; then
            echo "🗑️  削除: $(basename "$session") (${SIZE} bytes)"
            rm -f "$session"
            DELETED=$((DELETED + 1))
        fi
    fi
done

# Count sessions after cleanup
AFTER_COUNT=$(ls -1 "$SESSION_DIR"/*.jsonl 2>/dev/null | wc -l)

echo ""
echo "✅ クリーンアップ完了っぴ！"
echo "📊 削除前: $BEFORE_COUNT セッション"
echo "📊 削除後: $AFTER_COUNT セッション"
echo "🗑️  削除数: $DELETED セッション"
