#!/bin/bash
# delete-all-sns-posts.sh v2（安定版）
# 使い方: bash delete-all-sns-posts-v2.sh <post_id>
# または: bash delete-all-sns-posts-v2.sh --latest (最新投稿を削除)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --latestオプション: 最新投稿を削除
if [ "${1:-}" = "--latest" ]; then
  echo "🔍 最新投稿を検索して削除..."
  bash "$SCRIPT_DIR/get-latest-posts.sh" 1 > /tmp/latest-posts.txt
  
  echo ""
  echo "📋 最新投稿一覧:"
  cat /tmp/latest-posts.txt
  echo ""
  
  # Instagram
  IG_URL=$(grep "instagram.com/p/" /tmp/latest-posts.txt | head -1 || echo "")
  if [ -n "$IG_URL" ]; then
    echo "🗑️ Instagram: $IG_URL"
    timeout 120 node "$SCRIPT_DIR/delete-instagram-post-v2.cjs" "$IG_URL" || echo "⚠️ Instagram削除失敗"
  fi
  
  # Threads
  TH_URL=$(grep "threads.net" /tmp/latest-posts.txt | head -1 || echo "")
  if [ -n "$TH_URL" ]; then
    echo "🗑️ Threads: $TH_URL"
    timeout 120 node "$SCRIPT_DIR/delete-threads-post-v2.cjs" "$TH_URL" || echo "⚠️ Threads削除失敗"
  fi
  
  # X
  X_URL=$(grep "x.com.*status" /tmp/latest-posts.txt | head -1 || echo "")
  if [ -n "$X_URL" ]; then
    echo "📍 X手動削除URL: $X_URL"
    echo "   bird delete コマンドまたはWeb UIで削除してください"
  fi
  
  # Facebook
  FB_URL=$(grep "facebook.com" /tmp/latest-posts.txt | head -1 || echo "")
  if [ -n "$FB_URL" ]; then
    echo "🗑️ Facebook: $FB_URL"
    timeout 120 node "$SCRIPT_DIR/delete-facebook-post-v2.cjs" "$FB_URL" || echo "⚠️ Facebook削除失敗"
  fi
  
  # Pinterest
  PIN_URL=$(grep "pinterest.com/pin/" /tmp/latest-posts.txt | head -1 || echo "")
  if [ -n "$PIN_URL" ]; then
    echo "🗑️ Pinterest: $PIN_URL"
    timeout 120 node "$SCRIPT_DIR/delete-pinterest-pin-v2.cjs" "$PIN_URL" || echo "⚠️ Pinterest削除失敗"
  fi
  
  echo ""
  echo "✅ 最新投稿削除処理が完了しました"
  exit 0
fi

# 通常モード: post_idから削除
POST_ID="$1"
DATA_DIR="/root/clawd/data/sns-posts"
JSON_FILE="$DATA_DIR/${POST_ID}.json"

if [ ! -f "$JSON_FILE" ]; then
  echo "❌ エラー: 投稿データが見つかりません: $JSON_FILE"
  echo "💡 ヒント: bash delete-all-sns-posts-v2.sh --latest を使うと最新投稿を削除できます"
  exit 1
fi

echo "📂 投稿データ読み込み: $JSON_FILE"

# JSONから各SNSのURLを取得
IG_URL=$(jq -r '.instagram_url // empty' "$JSON_FILE")
TH_URL=$(jq -r '.threads_url // empty' "$JSON_FILE")
X_URL=$(jq -r '.x_url // empty' "$JSON_FILE")
FB_URL=$(jq -r '.facebook_url // empty' "$JSON_FILE")
PIN_URL=$(jq -r '.pinterest_url // empty' "$JSON_FILE")

# 削除実行
if [ -n "$IG_URL" ] && [ "$IG_URL" != "null" ]; then
  echo "🗑️ Instagram: $IG_URL"
  timeout 120 node "$SCRIPT_DIR/delete-instagram-post-v2.cjs" "$IG_URL" || echo "⚠️ Instagram削除失敗"
fi

if [ -n "$TH_URL" ] && [ "$TH_URL" != "null" ]; then
  echo "🗑️ Threads: $TH_URL"
  timeout 120 node "$SCRIPT_DIR/delete-threads-post-v2.cjs" "$TH_URL" || echo "⚠️ Threads削除失敗"
fi

if [ -n "$X_URL" ] && [ "$X_URL" != "null" ]; then
  echo "📍 X: $X_URL"
  echo "   手動削除してください（bird delete または Web UI）"
fi

if [ -n "$FB_URL" ] && [ "$FB_URL" != "null" ]; then
  echo "🗑️ Facebook: $FB_URL"
  timeout 120 node "$SCRIPT_DIR/delete-facebook-post-v2.cjs" "$FB_URL" || echo "⚠️ Facebook削除失敗"
fi

if [ -n "$PIN_URL" ] && [ "$PIN_URL" != "null" ]; then
  echo "🗑️ Pinterest: $PIN_URL"
  timeout 120 node "$SCRIPT_DIR/delete-pinterest-pin-v2.cjs" "$PIN_URL" || echo "⚠️ Pinterest削除失敗"
fi

echo ""
echo "✅ 削除処理が完了しました"
echo "📸 スクリーンショット: /tmp/sns-delete-screenshots/"
