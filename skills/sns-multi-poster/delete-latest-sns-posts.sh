#!/bin/bash
# delete-latest-sns-posts.sh
# 各SNSから最新の投稿を1件取得して削除する

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source /root/camoufox-test/bin/activate

echo "🗑️ 各SNSから最新投稿を削除します"
echo ""

RESULTS=()

# Instagram
echo "=== Instagram ==="
IG_URL=$(timeout 120 python3 get-instagram-posts.py 1 2>/dev/null | head -1 || echo "")
if [ -n "$IG_URL" ]; then
  echo "削除中: $IG_URL"
  if timeout 180 node delete-instagram-post.cjs "$IG_URL" 2>&1 | grep -q "削除しました"; then
    RESULTS+=("Instagram: ✅")
  else
    RESULTS+=("Instagram: ❌")
  fi
else
  echo "投稿が見つかりません"
  RESULTS+=("Instagram: ⏭️ 投稿なし")
fi
echo ""

# Threads
echo "=== Threads ==="
TH_URL=$(timeout 120 python3 get-threads-posts.py 1 2>/dev/null | head -1 || echo "")
if [ -n "$TH_URL" ]; then
  echo "削除中: $TH_URL"
  if timeout 180 node delete-threads-post.cjs "$TH_URL" 2>&1 | grep -q "削除しました"; then
    RESULTS+=("Threads: ✅")
  else
    RESULTS+=("Threads: ❌")
  fi
else
  echo "投稿が見つかりません"
  RESULTS+=("Threads: ⏭️ 投稿なし")
fi
echo ""

# Facebook
echo "=== Facebook ==="
FB_URL=$(timeout 120 python3 get-facebook-posts.py 1 2>/dev/null | head -1 || echo "")
if [ -n "$FB_URL" ]; then
  echo "削除中: $FB_URL"
  if timeout 180 node delete-facebook-post.cjs "$FB_URL" 2>&1 | grep -q "削除しました"; then
    RESULTS+=("Facebook: ✅")
  else
    RESULTS+=("Facebook: ❌")
  fi
else
  echo "投稿が見つかりません"
  RESULTS+=("Facebook: ⏭️ 投稿なし")
fi
echo ""

# Pinterest
echo "=== Pinterest ==="
PIN_URL=$(timeout 120 python3 get-pinterest-posts.py 1 2>/dev/null | head -1 || echo "")
if [ -n "$PIN_URL" ]; then
  echo "削除中: $PIN_URL"
  if timeout 180 node delete-pinterest-pin.cjs "$PIN_URL" 2>&1 | grep -q "削除しました"; then
    RESULTS+=("Pinterest: ✅")
  else
    RESULTS+=("Pinterest: ❌")
  fi
else
  echo "投稿が見つかりません"
  RESULTS+=("Pinterest: ⏭️ 投稿なし")
fi
echo ""

# X (Twitter)
echo "=== X (Twitter) ==="
X_URL=$(bird search "from:Nisenprints" 2>/dev/null | grep "^🔗" | head -1 | sed 's/🔗 //' || echo "")
if [ -n "$X_URL" ]; then
  echo "⚠️ X削除は手動が必要です"
  echo "削除URL: $X_URL"
  RESULTS+=("X: 🔄 手動削除が必要")
else
  echo "投稿が見つかりません"
  RESULTS+=("X: ⏭️ 投稿なし")
fi
echo ""

# 結果サマリー
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 削除結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for result in "${RESULTS[@]}"; do
  echo "• $result"
done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
