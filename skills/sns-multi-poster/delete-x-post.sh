#!/bin/bash
# X (Twitter) 投稿削除スクリプト
# 使い方: bash delete-x-post.sh <tweet_id_or_url>

set -euo pipefail

TWEET_ID="$1"

# URLからIDを抽出
if [[ "$TWEET_ID" =~ status/([0-9]+) ]]; then
  TWEET_ID="${BASH_REMATCH[1]}"
fi

echo "🗑️ X投稿削除: $TWEET_ID"
echo ""
echo "⚠️ bird CLIには削除機能がありません"
echo "📍 手動削除URL: https://x.com/i/status/$TWEET_ID"
echo ""
echo "ブラウザでアクセスして削除してください"
echo "または Twitter API v2 の DELETE /tweets/:id を使用してください"
echo ""
