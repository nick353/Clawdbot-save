#!/bin/bash
# collect-all-performance-v2.sh - camoufox版 全SNSパフォーマンス収集（順次実行・180秒タイムアウト）
# 注意: メモリ2GB制限のため並列実行はNG -> 順次実行
set -e
echo "=== SNSパフォーマンス収集開始 $(date) ==="
source /root/camoufox-test/bin/activate
source ~/.profile 2>/dev/null || true

TODAY=$(date +%Y%m%d)
PERF_DIR="/root/clawd/data/performance"
mkdir -p "$PERF_DIR"

RESULTS=""

# Instagram
echo "📸 Instagram..."
if timeout 180 python3 /root/camoufox-test/collect_instagram_performance.py "$PERF_DIR/instagram_${TODAY}.json" 2>&1 | tail -3; then
    COUNT=$(python3 -c "import json; d=json.load(open('$PERF_DIR/instagram_${TODAY}.json')); print(d.get('totalPosts', 0))" 2>/dev/null || echo "0")
    echo "✅ Instagram performance: ${COUNT}件"
    RESULTS="${RESULTS}Instagram: ✅ ${COUNT}投稿\n"
else
    echo "❌ Instagram performance: 失敗"
    RESULTS="${RESULTS}Instagram: ❌\n"
fi

sleep 3

# Threads
echo ""
echo "🧵 Threads..."
if timeout 180 python3 /root/camoufox-test/collect_threads_performance.py "$PERF_DIR/threads_${TODAY}.json" 2>&1 | tail -3; then
    COUNT=$(python3 -c "import json; d=json.load(open('$PERF_DIR/threads_${TODAY}.json')); print(d.get('totalPosts', 0))" 2>/dev/null || echo "0")
    echo "✅ Threads performance: ${COUNT}件"
    RESULTS="${RESULTS}Threads: ✅ ${COUNT}投稿\n"
else
    echo "❌ Threads performance: 失敗"
    RESULTS="${RESULTS}Threads: ❌\n"
fi

sleep 3

# Facebook
echo ""
echo "📘 Facebook..."
if timeout 180 python3 /root/camoufox-test/collect_facebook_performance.py "$PERF_DIR/facebook_${TODAY}.json" 2>&1 | tail -3; then
    COUNT=$(python3 -c "import json; d=json.load(open('$PERF_DIR/facebook_${TODAY}.json')); print(d.get('totalPosts', 0))" 2>/dev/null || echo "0")
    echo "✅ Facebook performance: ${COUNT}件"
    RESULTS="${RESULTS}Facebook: ✅ ${COUNT}投稿\n"
else
    echo "❌ Facebook performance: 失敗"
    RESULTS="${RESULTS}Facebook: ❌\n"
fi

sleep 3

# Pinterest
echo ""
echo "📌 Pinterest..."
if timeout 180 python3 /root/camoufox-test/collect_pinterest_performance.py "$PERF_DIR/pinterest_${TODAY}.json" 2>&1 | tail -3; then
    COUNT=$(python3 -c "import json; d=json.load(open('$PERF_DIR/pinterest_${TODAY}.json')); print(d.get('totalPosts', 0))" 2>/dev/null || echo "0")
    echo "✅ Pinterest performance: ${COUNT}件"
    RESULTS="${RESULTS}Pinterest: ✅ ${COUNT}ピン\n"
else
    echo "❌ Pinterest performance: 失敗"
    RESULTS="${RESULTS}Pinterest: ❌\n"
fi

echo ""
echo "=== パフォーマンス収集完了 $(date) ==="
echo -e "結果サマリー:\n${RESULTS}"
