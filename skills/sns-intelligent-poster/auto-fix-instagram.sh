#!/bin/bash
set -e

# Instagram投稿エラー時の自動修正ヘルパー
# エラー情報を読み取り → Discordに通知 → Claude介入待ち

ERROR_FILE="/tmp/instagram-debug/error.json"

if [ ! -f "$ERROR_FILE" ]; then
    echo "エラー情報ファイルが見つかりません: $ERROR_FILE"
    exit 1
fi

# エラー情報を読み取り
SCREENSHOT=$(jq -r '.screenshot' "$ERROR_FILE")
ERROR_MSG=$(jq -r '.error' "$ERROR_FILE")
STEP=$(jq -r '.step' "$ERROR_FILE")
TIMESTAMP=$(jq -r '.timestamp' "$ERROR_FILE")

# Discord通知
echo "🚨 **Instagram投稿エラー検出**"
echo ""
echo "**ステップ:** $STEP"
echo "**エラー:** $ERROR_MSG"
echo "**タイムスタンプ:** $TIMESTAMP"
echo ""
echo "📸 **スクリーンショット:** $SCREENSHOT"
echo ""
echo "👀 Claudeがスクリーンショットを確認して修正します..."
