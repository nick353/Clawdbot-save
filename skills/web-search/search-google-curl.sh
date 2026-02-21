#!/bin/bash
# Google検索（curl + grep版）
# 軽量でシンプル

set -e

QUERY="$1"

if [ -z "$QUERY" ]; then
    echo "使い方: $0 \"検索キーワード\""
    exit 1
fi

echo "🔍 Google検索: \"$QUERY\""
echo ""

# Google検索実行
ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY'))")
URL="https://www.google.com/search?q=${ENCODED_QUERY}&hl=en"

# 結果取得
RESULTS=$(curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "$URL" | \
    python3 -c "
import sys, re, html

html_content = sys.stdin.read()

# タイトルとURLを抽出（正規表現）
pattern = r'<h3[^>]*>(.*?)</h3>.*?<a[^>]*href=\"(/url\?q=|)(https?://[^\"&]+)'
matches = re.findall(pattern, html_content, re.DOTALL)

results = []
for i, match in enumerate(matches[:10]):
    title = html.unescape(re.sub(r'<[^>]+>', '', match[0])).strip()
    url = match[2] if match[2] else match[1]
    
    # URLクリーンアップ
    url = url.split('&')[0]
    
    if title and url.startswith('http'):
        results.append({'title': title, 'url': url})

# 出力
for i, result in enumerate(results, 1):
    print(f\"--- 検索結果 {i} ---\")
    print(f\"📌 {result['title']}\")
    print(f\"🔗 {result['url']}\")
    print()

if not results:
    print('検索結果が取得できませんでした')
    print('（Googleの仕様変更、またはレート制限の可能性）')
")

echo "✅ 検索完了"
