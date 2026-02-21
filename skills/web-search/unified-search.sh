#!/bin/bash
# 統合検索スクリプト - Brave Search API + X検索
# 自然に使えるWeb検索

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 環境変数を読み込み
. ~/.profile

# デフォルト設定
SEARCH_TYPE="auto"  # auto, brave, x
COUNT=10

# 引数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --brave|--google)
            SEARCH_TYPE="brave"
            shift
            ;;
        --x|--twitter)
            SEARCH_TYPE="x"
            shift
            ;;
        --count)
            COUNT="$2"
            shift 2
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
    echo "  --brave      Brave Search API（Google代替）"
    echo "  --x          X (Twitter) 検索"
    echo "  --count N    取得件数（デフォルト: 10）"
    echo "  --json       JSON形式で出力"
    echo ""
    echo "自動判定:"
    echo "  - クエリに「X」「Twitter」が含まれる → X検索"
    echo "  - それ以外 → Brave Search"
    echo ""
    echo "例:"
    echo "  $0 \"Sora watermark removal\""
    echo "  $0 --x \"AI video tools\""
    exit 1
fi

# 自動判定
if [ "$SEARCH_TYPE" = "auto" ]; then
    if echo "$QUERY" | grep -iq "twitter\|ツイート\|tweet"; then
        SEARCH_TYPE="x"
    else
        SEARCH_TYPE="brave"
    fi
fi

# 検索実行
if [ "$SEARCH_TYPE" = "x" ]; then
    echo "🐦 X (Twitter) 検索中..."
    echo ""
    
    # Puppeteerインストールチェック
    if [ ! -d "$SCRIPT_DIR/../x-search/node_modules" ]; then
        echo "📦 Puppeteerをインストール中..."
        cd "$SCRIPT_DIR/../x-search"
        npm install --silent
    fi
    
    cd "$SCRIPT_DIR/../x-search"
    node search-x.js "$QUERY" $JSON_FLAG
    
else
    # Brave Search API
    echo "🔍 Web検索中（Brave Search API）..."
    echo ""
    
    # Clawdbotのweb_searchツールを使用
    if command -v clawdbot &> /dev/null; then
        # ClawdbotのCLI経由
        # （ただし、Clawdbot CLIにはweb_search直接呼び出しがないため、curlで直接APIを叩く）
        
        ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY'))")
        
        RESPONSE=$(curl -s "https://api.search.brave.com/res/v1/web/search?q=${ENCODED_QUERY}&count=${COUNT}" \
            -H "Accept: application/json" \
            -H "X-Subscription-Token: $BRAVE_API_KEY")
        
        # 結果をパース
        echo "$RESPONSE" | python3 -c "
import sys, json

try:
    data = json.load(sys.stdin)
    results = data.get('web', {}).get('results', [])
    
    if not results:
        print('検索結果が見つかりませんでした')
        sys.exit(0)
    
    print(f'✅ {len(results)}件の検索結果を取得')
    print()
    
    for i, result in enumerate(results, 1):
        title = result.get('title', '')
        url = result.get('url', '')
        description = result.get('description', '')
        
        print(f'--- 検索結果 {i} ---')
        print(f'📌 {title}')
        print(f'🔗 {url}')
        if description:
            print(f'📝 {description[:200]}')
        print()
        
except Exception as e:
    print(f'エラー: {e}')
    print('APIレスポンス:', file=sys.stderr)
    print(sys.stdin.read(), file=sys.stderr)
"
    else
        echo "❌ Clawdbotが見つかりません"
        exit 1
    fi
fi

echo "✅ 検索完了"
