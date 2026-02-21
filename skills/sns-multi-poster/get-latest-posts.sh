#!/bin/bash
# get-latest-posts.sh
# 各SNSから最新N件の投稿URLを取得

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIMIT="${1:-3}"  # デフォルト3件

echo "=== Instagram ==="
source /root/camoufox-test/bin/activate
timeout 90 python3 "$SCRIPT_DIR/get-instagram-posts.py" "$LIMIT" || echo "⚠️ Instagram取得失敗"

echo ""
echo "=== Threads ==="
timeout 90 python3 "$SCRIPT_DIR/get-threads-posts.py" "$LIMIT" || echo "⚠️ Threads取得失敗"

echo ""
echo "=== X ==="
bird search "from:Nisenprints" | grep -E "^🔗" | head -n "$LIMIT" | sed 's/🔗 //' || echo "⚠️ X取得失敗"

echo ""
echo "=== Facebook ==="
timeout 90 python3 "$SCRIPT_DIR/get-facebook-posts.py" "$LIMIT" || echo "⚠️ Facebook取得失敗"

echo ""
echo "=== Pinterest ==="
timeout 90 python3 "$SCRIPT_DIR/get-pinterest-posts.py" "$LIMIT" || echo "⚠️ Pinterest取得失敗"
