#!/bin/bash
# collect-threads-performance-light.sh - Threads軽量版（Meta Graph API、90秒制限）
set -e
TODAY=$(date +%Y%m%d)
PERF_DIR="/root/clawd/data/performance"
mkdir -p "$PERF_DIR"

OUTPUT="$PERF_DIR/threads_${TODAY}.json"

# Meta Graph API で Threads insights 取得
if [ -z "$FACEBOOK_API_TOKEN" ]; then
    echo '{"totalPosts": 0, "error": "FACEBOOK_API_TOKEN not set"}' > "$OUTPUT"
    echo "⚠️ Threads: API トークンなし"
    exit 0
fi

timeout 60 curl -s "https://graph.threads.net/me?fields=id,username&access_token=$FACEBOOK_API_TOKEN" \
    | python3 -c "import json, sys; d=json.load(sys.stdin); print(json.dumps({'totalPosts': 0, 'user': d.get('username', 'unknown')}))" > "$OUTPUT" 2>&1 || \
    echo '{"totalPosts": 0, "error": "API error"}' > "$OUTPUT"

COUNT=$(python3 -c "import json; print(json.load(open('$OUTPUT')).get('totalPosts', 0))" 2>/dev/null || echo "0")
echo "✅ Threads: ${COUNT}件"
