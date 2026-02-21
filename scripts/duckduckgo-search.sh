#!/bin/bash
# DuckDuckGo検索スクリプト（無料・レート制限なし）
# Usage: bash duckduckgo-search.sh "クエリ"

set -e

QUERY="$1"
if [ -z "$QUERY" ]; then
    echo "❌ クエリを指定してください: bash duckduckgo-search.sh \"クエリ\"" >&2
    exit 1
fi

# DuckDuckGo Instant Answer API（無料・無制限）
ENCODED_QUERY=$(echo "$QUERY" | jq -sRr @uri)
RESULTS=$(curl -s "https://api.duckduckgo.com/?q=${ENCODED_QUERY}&format=json")

# JSONパース（jqでフォーマット）
echo "$RESULTS" | jq -r '
if .AbstractText != "" then
    "📝 要約: \(.AbstractText)\n"
else
    ""
end +
if .RelatedTopics | length > 0 then
    "🔗 関連トピック:\n" + (.RelatedTopics[:5] | map(
        if .Text then
            "  - " + .Text + " (" + (.FirstURL // "") + ")"
        else
            ""
        end
    ) | join("\n"))
else
    "❌ 関連トピックが見つかりませんでした"
end
'

# HTMLスクレイピング（フォールバック）
if echo "$RESULTS" | jq -e '.AbstractText == "" and (.RelatedTopics | length == 0)' > /dev/null; then
    echo -e "\n⚠️ Instant Answer APIで結果が少ないため、HTMLスクレイピングでリトライしますっぴ..."
    HTML_RESULTS=$(curl -s "https://html.duckduckgo.com/html/?q=${ENCODED_QUERY}")
    echo "$HTML_RESULTS" | grep -oP '(?<=class="result__title">).*?(?=</a>)' | head -5 | sed 's/<[^>]*>//g' | while read -r title; do
        echo "  - $title"
    done
fi
