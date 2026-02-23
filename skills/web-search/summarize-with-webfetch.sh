#!/bin/bash
# URL要約スクリプト - web_fetchとClawdbotツール活用版
# 使用方法: ./summarize-with-webfetch.sh <URL>

set -e

URL="$1"

if [ -z "$URL" ]; then
    echo "使い方: $0 <URL>"
    echo ""
    echo "例: $0 https://example.com"
    echo "    $0 https://en.wikipedia.org/wiki/Artificial_intelligence"
    exit 1
fi

echo "📄 URL要約を取得中: $URL"
echo ""

# まずはweb_fetchでコンテンツを取得
if command -v clawdbot &> /dev/null; then
    # Clawdbotが利用可能な場合
    CONTENT=$(clawdbot web fetch "$URL" --extractMode markdown 2>/dev/null || echo "")
else
    # Clawdbotがない場合はcurlで取得
    CONTENT=$(curl -s -L --max-time 10 "$URL" 2>/dev/null | \
        sed -e 's/<script[^>]*>.*<\/script>//g' \
        -e 's/<style[^>]*>.*<\/style>//g' \
        -e 's/<[^>]*>//g' \
        -e 's/&nbsp;/ /g' \
        -e 's/&amp;/\&/g' \
        -e 's/&lt;/</g' \
        -e 's/&gt;/>/g' || echo "")
fi

if [ -z "$CONTENT" ]; then
    echo "❌ URLからコンテンツをFetchできません: $URL"
    exit 1
fi

# コンテンツのサマリーを生成（最初の1500文字を要約として表示）
echo "📝 コンテンツ要約（最初の部分）:"
echo ""
echo "$CONTENT" | head -c 1500 | sed 's/^/  /'
echo ""
echo ""
echo "🔗 ソース: $URL"
echo "📊 取得文字数: $(echo "$CONTENT" | wc -c)"
