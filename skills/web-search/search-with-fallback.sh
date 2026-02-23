#!/bin/bash
# 統合検索スクリプト - Brave Search API（メイン）→ DuckDuckGo（フォールバック）→ X検索
# 自動フォールバック機能付き

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 環境変数を読み込み
[ -f ~/.profile ] && source ~/.profile

# デフォルト設定
SEARCH_TYPE="auto"
COUNT=10
VERBOSE=false

# 引数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --brave)
            SEARCH_TYPE="brave"
            shift
            ;;
        --x|--twitter)
            SEARCH_TYPE="x"
            shift
            ;;
        --duckduckgo)
            SEARCH_TYPE="duckduckgo"
            shift
            ;;
        --count)
            COUNT="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_FLAG="--json"
            shift
            ;;
        *)
            QUERY="$1"
            shift
            ;;
    esac
done

# 引数チェック
if [ -z "$QUERY" ]; then
    echo "使い方: $0 [オプション] \"検索キーワード\""
    echo ""
    echo "オプション:"
    echo "  --brave          Brave Search API（推奨）"
    echo "  --duckduckgo     DuckDuckGo検索"
    echo "  --x              X (Twitter) 検索"
    echo "  --count N        取得件数（デフォルト: 10）"
    echo "  --verbose, -v    詳細ログ出力"
    echo "  --json           JSON形式で出力"
    echo ""
    echo "例:"
    echo "  $0 \"AI video tools\""
    echo "  $0 --x \"最新AI\" --verbose"
    exit 1
fi

# ログ関数
log() {
    if [ "$VERBOSE" = true ]; then
        echo "📝 $*" >&2
    fi
}

# 自動判定（自動フォールバック優先）
if [ "$SEARCH_TYPE" = "auto" ]; then
    if echo "$QUERY" | grep -iq "twitter\|ツイート\|tweet\|X上\|Xで"; then
        SEARCH_TYPE="x"
    else
        SEARCH_TYPE="brave"  # デフォルトはBrave（DuckDuckGoにフォールバック）
    fi
fi

# Brave Search API（メイン）
search_brave() {
    log "🔍 Brave Search API実行中..."
    
    ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY'))" 2>/dev/null || echo "$QUERY")
    
    RESPONSE=$(curl -s "https://api.search.brave.com/res/v1/web/search?q=${ENCODED_QUERY}&count=${COUNT}" \
        -H "Accept: application/json" \
        -H "X-Subscription-Token: ${BRAVE_API_KEY}" \
        --max-time 10 2>/dev/null || echo "")
    
    # エラー確認
    if [ -z "$RESPONSE" ] || echo "$RESPONSE" | grep -q "error\|401\|429"; then
        log "⚠️ Brave APIが失敗、DuckDuckGoにフォールバック中..."
        return 1
    fi
    
    # 結果が空の場合もフォールバック
    RESULT_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('web', {}).get('results', [])))" 2>/dev/null || echo "0")
    
    if [ "$RESULT_COUNT" -eq 0 ]; then
        log "⚠️ Brave APIで検索結果なし、DuckDuckGoにフォールバック中..."
        return 1
    fi
    
    # 結果表示
    echo "$RESPONSE" | python3 -c "
import sys, json

try:
    data = json.load(sys.stdin)
    results = data.get('web', {}).get('results', [])
    
    print(f'✅ Brave検索: {len(results)}件の結果')
    print()
    
    for i, result in enumerate(results[:10], 1):
        title = result.get('title', '')
        url = result.get('url', '')
        description = result.get('description', '')
        
        print(f'[{i}] {title}')
        print(f'    URL: {url}')
        if description:
            print(f'    説明: {description[:150]}...')
        print()
        
except Exception as e:
    print(f'❌ エラー: {e}', file=sys.stderr)
    sys.exit(1)
"
    return 0
}

# DuckDuckGo検索（フォールバック）
search_duckduckgo() {
    log "🦆 DuckDuckGo検索実行中..."
    
    ENCODED_QUERY=$(echo "$QUERY" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip()))" 2>/dev/null || echo "$QUERY")
    
    RESULTS=$(curl -s "https://api.duckduckgo.com/?q=${ENCODED_QUERY}&format=json" --max-time 10 2>/dev/null || echo "")
    
    if [ -z "$RESULTS" ]; then
        log "⚠️ DuckDuckGoも失敗"
        return 1
    fi
    
    echo "$RESULTS" | python3 -c "
import sys, json

try:
    data = json.load(sys.stdin)
    
    print('✅ DuckDuckGo検索結果')
    print()
    
    # Abstract
    if data.get('AbstractText'):
        print(f'📝 {data[\"AbstractText\"][:300]}')
        print()
    
    # Related Topics
    topics = data.get('RelatedTopics', [])
    if topics:
        print('🔗 関連トピック:')
        for i, topic in enumerate(topics[:5], 1):
            if topic.get('Text'):
                print(f'  [{i}] {topic[\"Text\"]}')
                if topic.get('FirstURL'):
                    print(f'      {topic[\"FirstURL\"]}')
    else:
        print('❌ 検索結果が見つかりませんでした')
        
except Exception as e:
    print(f'❌ エラー: {e}', file=sys.stderr)
    sys.exit(1)
"
    return 0
}

# X検索
search_x() {
    log "🐦 X (Twitter) 検索実行中..."
    
    # Puppeteerインストールチェック
    if [ ! -d "$SCRIPT_DIR/../x-search/node_modules" ]; then
        log "📦 Puppeteerをインストール中..."
        cd "$SCRIPT_DIR/../x-search"
        npm install --silent 2>/dev/null || true
    fi
    
    cd "$SCRIPT_DIR/../x-search"
    node search-x.js "$QUERY" $JSON_FLAG 2>/dev/null || {
        log "⚠️ X検索に失敗"
        return 1
    }
}

# 検索実行（フォールバック付き）
if [ "$SEARCH_TYPE" = "x" ]; then
    search_x
else
    # Brave → DuckDuckGo フォールバック
    search_brave || search_duckduckgo || {
        echo "❌ 全ての検索方法が失敗しました"
        exit 1
    }
fi

log "✅ 検索完了"
