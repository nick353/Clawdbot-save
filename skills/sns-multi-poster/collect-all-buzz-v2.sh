#!/bin/bash
# collect-all-buzz-v2.sh - camoufox版 全SNSバズ収集（順次実行・180秒タイムアウト）
# 注意: メモリ2GB制限のため並列実行はNG -> 順次実行
set -e
echo "=== SNSバズ収集開始 $(date) ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source /root/camoufox-test/bin/activate
source ~/.profile 2>/dev/null || true

TODAY=$(date +%Y%m%d)
BUZZ_DIR="/root/clawd/data/buzz"
mkdir -p "$BUZZ_DIR"

RESULTS=""

# Instagram
echo "📸 Instagram..."
if timeout 180 python3 /root/camoufox-test/collect_instagram_buzz.py "$BUZZ_DIR/instagram_${TODAY}.json" 2>&1 | tail -3; then
    COUNT=$(python3 -c "import json; d=json.load(open('$BUZZ_DIR/instagram_${TODAY}.json')); print(d.get('totalPosts', d.get('total', 0)))" 2>/dev/null || echo "0")
    echo "✅ Instagram: ${COUNT}件"
    RESULTS="${RESULTS}Instagram: ✅ ${COUNT}件\n"
else
    echo "❌ Instagram buzz: 失敗"
    RESULTS="${RESULTS}Instagram: ❌\n"
fi

# ブラウザ終了待ち（メモリ解放）
sleep 3

# Threads
echo ""
echo "🧵 Threads..."
if timeout 180 python3 /root/camoufox-test/collect_threads_buzz.py "$BUZZ_DIR/threads_${TODAY}.json" 2>&1 | tail -3; then
    COUNT=$(python3 -c "import json; d=json.load(open('$BUZZ_DIR/threads_${TODAY}.json')); print(d.get('totalPosts', d.get('total', 0)))" 2>/dev/null || echo "0")
    echo "✅ Threads: ${COUNT}件"
    RESULTS="${RESULTS}Threads: ✅ ${COUNT}件\n"
else
    echo "❌ Threads buzz: 失敗"
    RESULTS="${RESULTS}Threads: ❌\n"
fi

sleep 3

# Facebook（APIスキップ）
echo ""
echo "📘 Facebook..."
timeout 30 python3 /root/camoufox-test/collect_facebook_buzz.py "$BUZZ_DIR/facebook_${TODAY}.json" 2>&1 | tail -2
RESULTS="${RESULTS}Facebook: ⏭️ スキップ(API必要)\n"

# Pinterest
echo ""
echo "📌 Pinterest..."
if timeout 180 python3 /root/camoufox-test/collect_pinterest_buzz.py "$BUZZ_DIR/pinterest_${TODAY}.json" 2>&1 | tail -3; then
    COUNT=$(python3 -c "import json; d=json.load(open('$BUZZ_DIR/pinterest_${TODAY}.json')); print(d.get('totalPosts', d.get('total', 0)))" 2>/dev/null || echo "0")
    echo "✅ Pinterest: ${COUNT}件"
    RESULTS="${RESULTS}Pinterest: ✅ ${COUNT}件\n"
else
    echo "❌ Pinterest buzz: 失敗"
    RESULTS="${RESULTS}Pinterest: ❌\n"
fi

sleep 3

# X（bird CLI）
echo ""
echo "🐦 X..."
if bash "$SCRIPT_DIR/collect-x-buzz.sh" 2>&1 | tail -3; then
    X_FILE="$BUZZ_DIR/x_${TODAY}.json"
    if [ -f "$X_FILE" ]; then
        COUNT=$(python3 -c "import json; d=json.load(open('$X_FILE')); print(d.get('totalTweets', d.get('total', 0)))" 2>/dev/null || echo "?")
        RESULTS="${RESULTS}X: ✅ ${COUNT}件\n"
    else
        RESULTS="${RESULTS}X: ✅\n"
    fi
else
    RESULTS="${RESULTS}X: ❌\n"
fi

echo ""
echo "=== バズ収集完了 $(date) ==="
echo -e "結果サマリー:\n${RESULTS}"
