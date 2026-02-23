#!/bin/bash
# Summarize ラッパースクリプト - TLS証明書エラー対応版
# 使用方法: ./summarize-wrapper.sh <URL>

set -e

URL="$1"

if [ -z "$URL" ]; then
    echo "使い方: $0 <URL>"
    echo ""
    echo "例: $0 https://example.com"
    exit 1
fi

# TLS証明書検証をスキップして実行
# （Node.jsデフォルト設定を避ける）
NODE_TLS_REJECT_UNAUTHORIZED=0 summarize "$URL" 2>&1 || {
    # Fallback: curlでHTMLを取得してから処理
    echo "⚠️ summarizeコマンドが失敗、代替方法を使用中..." >&2
    
    HTML=$(curl -s -L --max-time 10 "$URL" 2>/dev/null || echo "")
    
    if [ -z "$HTML" ]; then
        echo "❌ URLからコンテンツをFetchできません: $URL"
        exit 1
    fi
    
    # HTMLからテキストを抽出
    PLAIN_TEXT=$(echo "$HTML" | \
        sed -e 's/<[^>]*>//g' \
        -e 's/&nbsp;/ /g' \
        -e 's/&amp;/\&/g' \
        -e 's/&lt;/</g' \
        -e 's/&gt;/>/g' \
        -e 's/\r//g' | \
        grep -v "^$" | \
        head -100)
    
    echo "📄 コンテンツサマリー (最初の1000文字):"
    echo ""
    echo "$PLAIN_TEXT" | head -c 1000
    echo ""
    echo ""
    echo "🔗 ソース: $URL"
}
