#!/bin/bash
# delete-all-sns-posts.sh
# 使い方: bash delete-all-sns-posts.sh <post_id>
# post_idからJSONファイルを読み込んで各SNSから削除

set -euo pipefail

POST_ID="$1"
DATA_DIR="/root/clawd/data/sns-posts"
JSON_FILE="$DATA_DIR/${POST_ID}.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$JSON_FILE" ]; then
  echo "❌ 投稿記録が見つかりません: $JSON_FILE"
  exit 1
fi

echo "📄 投稿記録: $JSON_FILE"
echo ""

# JSONから各SNSのURLを取得
IG_URL=$(cat "$JSON_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('platforms',{}).get('instagram',{}).get('url',''))" 2>/dev/null || echo "")
TH_URL=$(cat "$JSON_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('platforms',{}).get('threads',{}).get('url',''))" 2>/dev/null || echo "")
X_ID=$(cat "$JSON_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('platforms',{}).get('x',{}).get('post_id',''))" 2>/dev/null || echo "")
FB_URL=$(cat "$JSON_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('platforms',{}).get('facebook',{}).get('url',''))" 2>/dev/null || echo "")
PIN_URL=$(cat "$JSON_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('platforms',{}).get('pinterest',{}).get('url',''))" 2>/dev/null || echo "")

echo "=== 削除開始 ==="
echo ""

# Instagram
if [ -n "$IG_URL" ]; then
  echo "📸 Instagram削除中..."
  timeout 120 node "$SCRIPT_DIR/delete-instagram-post.cjs" "$IG_URL" || echo "⚠️ Instagram削除失敗"
  sleep 3
else
  echo "⏭️ Instagram: URLなし（スキップ）"
fi

# Threads
if [ -n "$TH_URL" ]; then
  echo "🧵 Threads削除中..."
  timeout 120 node "$SCRIPT_DIR/delete-threads-post.cjs" "$TH_URL" || echo "⚠️ Threads削除失敗"
  sleep 3
else
  echo "⏭️ Threads: URLなし（スキップ）"
fi

# X
if [ -n "$X_ID" ]; then
  echo "🐦 X削除..."
  bash "$SCRIPT_DIR/delete-x-post.sh" "$X_ID"
else
  echo "⏭️ X: IDなし（スキップ）"
fi

# Facebook
if [ -n "$FB_URL" ]; then
  echo "📘 Facebook削除中..."
  timeout 120 node "$SCRIPT_DIR/delete-facebook-post.cjs" "$FB_URL" || echo "⚠️ Facebook削除失敗"
  sleep 3
else
  echo "⏭️ Facebook: URLなし（スキップ）"
fi

# Pinterest
if [ -n "$PIN_URL" ]; then
  echo "📌 Pinterest削除中..."
  timeout 120 node "$SCRIPT_DIR/delete-pinterest-pin.cjs" "$PIN_URL" || echo "⚠️ Pinterest削除失敗"
else
  echo "⏭️ Pinterest: URLなし（スキップ）"
fi

echo ""
echo "✅ 削除処理完了"
