#!/bin/bash
# collect-instagram-performance-light.sh - Instagram軽量版（HTTP API使用、90秒制限）
set -e
TODAY=$(date +%Y%m%d)
PERF_DIR="/root/clawd/data/performance"
mkdir -p "$PERF_DIR"

OUTPUT="$PERF_DIR/instagram_${TODAY}.json"

# IG_API_TOKENがあれば使用、ない場合はスキップ
if [ -z "$IG_API_TOKEN" ]; then
    echo '{"totalPosts": 0, "error": "IG_API_TOKEN not set"}' > "$OUTPUT"
    echo "⚠️ Instagram: API トークンなし"
    exit 0
fi

# Graph API で insights 取得（タイムアウト付き）
timeout 60 curl -s "https://graph.instagram.com/me/insights?metric=impressions,reach,saves&access_token=$IG_API_TOKEN" \
    | python3 -c "import json, sys; d=json.load(sys.stdin); print(json.dumps({'totalPosts': len(d.get('data', [])), 'metrics': d.get('data', [])}))" > "$OUTPUT" 2>&1 || \
    echo '{"totalPosts": 0, "error": "API timeout or error"}' > "$OUTPUT"

COUNT=$(python3 -c "import json; print(json.load(open('$OUTPUT')).get('totalPosts', 0))" 2>/dev/null || echo "0")
echo "✅ Instagram: ${COUNT}件"
