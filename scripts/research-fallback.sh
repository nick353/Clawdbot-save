#!/bin/bash
# research-fallback.sh - Braveレート制限時のDuckDuckGo フォールバック機構
# Usage: bash /root/clawd/scripts/research-fallback.sh "検索クエリ"

QUERY="$1"
TIMEOUT_SEC="${2:-10}"

if [ -z "$QUERY" ]; then
    echo "Usage: research-fallback.sh \"query\" [timeout]" >&2
    exit 1
fi

# ============================================
# 1. Braveで検索（制限ありだが高精度）
# ============================================
try_brave_search() {
    if [ -z "$BRAVE_API_KEY" ]; then
        return 1  # API Key未設定
    fi
    
    local response=$(curl -s --max-time 5 \
        -H "X-Subscription-Token: $BRAVE_API_KEY" \
        "https://api.search.brave.com/res/v1/web/search?q=$(echo "$1" | jq -sRr @uri)" \
        2>/dev/null)
    
    # エラーチェック
    if echo "$response" | grep -q "error\|429\|401\|403"; then
        return 1  # エラー発生
    fi
    
    # 結果を抽出
    echo "$response" | jq -r '.web[:5] | .[] | "- \(.title) (\(.url))"' 2>/dev/null || return 1
}

# ============================================
# 2. DuckDuckGoで検索（無料・無制限）
# ============================================
try_duckduckgo_search() {
    local response=$(curl -s --max-time 5 \
        "https://api.duckduckgo.com/?q=$(echo "$1" | jq -sRr @uri)&format=json" \
        2>/dev/null)
    
    # 要約がある場合は返す
    if echo "$response" | jq -e '.AbstractText != ""' > /dev/null 2>&1; then
        echo "📝 $(echo "$response" | jq -r '.AbstractText')"
        return 0
    fi
    
    # 関連トピックを返す
    if echo "$response" | jq -e '.RelatedTopics | length > 0' > /dev/null 2>&1; then
        echo "$response" | jq -r '.RelatedTopics[:5] | .[] | select(.Text) | "- \(.Text)"' 2>/dev/null
        return 0
    fi
    
    return 1  # 結果なし
}

# ============================================
# 3. X (bird) で検索（最新トレンド）
# ============================================
try_x_search() {
    if [ -z "$AUTH_TOKEN" ] || [ -z "$CT0" ]; then
        return 1  # 認証情報なし
    fi
    
    bird search "$1" -n 3 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
        jq -r '.[] | "🐦 @\(.author.username): \(.text | .[0:100])"' || return 1
}

# ============================================
# Main: Failover Strategy
# ============================================
echo "🔍 Searching for: $QUERY"
echo ""

# 1. Braveで試す
echo -n "├─ 🔎 Brave Search... "
if BRAVE_RESULT=$(try_brave_search "$QUERY" 2>/dev/null); then
    echo "✅"
    echo "$BRAVE_RESULT"
    exit 0
else
    echo "❌ (無制限またはレート制限)"
fi

# 2. DuckDuckGoにフォールバック
echo -n "├─ 🦆 DuckDuckGo Search... "
if DDG_RESULT=$(try_duckduckgo_search "$QUERY" 2>/dev/null); then
    echo "✅"
    echo "$DDG_RESULT"
    exit 0
else
    echo "❌ (検索結果なし)"
fi

# 3. Xで補完（オプション）
echo -n "└─ 🐦 X Search... "
if X_RESULT=$(try_x_search "$QUERY" 2>/dev/null); then
    echo "✅"
    echo "$X_RESULT"
    exit 0
else
    echo "❌ (認証なし)"
fi

echo ""
echo "⚠️ 全ての検索方法が失敗しました"
exit 1
