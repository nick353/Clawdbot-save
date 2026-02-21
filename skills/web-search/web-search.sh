#!/bin/bash
# Web検索統合スクリプト（Google + X検索）
# 使い方: ./web-search.sh [--x|--google] "検索キーワード"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 環境変数を読み込み
. ~/.profile

# デフォルトはGoogle検索
SEARCH_TYPE="google"

# オプション解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --x|--twitter)
            SEARCH_TYPE="x"
            shift
            ;;
        --google)
            SEARCH_TYPE="google"
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
    echo "  --google     Google検索（デフォルト）"
    echo "  --x          X (Twitter) 検索"
    echo "  --json       JSON形式で出力"
    echo ""
    echo "例:"
    echo "  $0 \"Sora watermark removal\""
    echo "  $0 --x \"AI video tools\""
    echo "  $0 --google \"video enhancement\" --json"
    exit 1
fi

# Puppeteerインストールチェック
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 Puppeteerをインストール中..."
    cd "$SCRIPT_DIR"
    npm install --silent
    echo "✅ インストール完了"
fi

# 検索実行
cd "$SCRIPT_DIR"

if [ "$SEARCH_TYPE" = "x" ]; then
    echo "🐦 X (Twitter) 検索を実行中..."
    node ../x-search/search-x.js "$QUERY" $JSON_FLAG
else
    echo "🌐 Google検索を実行中..."
    node search-google.js "$QUERY" $JSON_FLAG
fi
