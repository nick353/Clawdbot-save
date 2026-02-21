#!/bin/bash
# X検索ラッパースクリプト（修正版）
# 使い方: ./x-search.sh "検索キーワード"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 環境変数を読み込み
if [ -f ~/.profile ]; then
    source ~/.profile
fi

# 引数チェック
if [ -z "$1" ]; then
    echo "使い方: $0 \"検索キーワード\" [オプション]"
    echo ""
    echo "オプション:"
    echo "  --json    JSON形式で出力"
    echo "  --debug   デバッグモード"
    echo ""
    echo "例:"
    echo "  $0 \"AI video tools\""
    echo "  $0 \"Sora watermark\" --debug"
    exit 1
fi

# Puppeteerインストールチェック
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 Puppeteerをインストール中..."
    cd "$SCRIPT_DIR"
    npm install --silent
    echo "✅ インストール完了"
fi

# デバッグモードチェック
if [[ "$*" == *"--debug"* ]]; then
    export DEBUG=1
fi

# 検索実行（環境変数を明示的に渡す）
cd "$SCRIPT_DIR"
AUTH_TOKEN="$AUTH_TOKEN" CT0="$CT0" node search-x-fixed.js "$@"
