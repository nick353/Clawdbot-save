#!/bin/bash
# Cookie ファイルの sameSite 属性を Playwright 互換に修正

COOKIE_DIR="/root/clawd/skills/sns-multi-poster/cookies"

echo "🔧 Cookie ファイルの sameSite 属性を修正中..."

for cookie_file in "$COOKIE_DIR"/*.json; do
    if [ ! -f "$cookie_file" ]; then
        continue
    fi
    
    filename=$(basename "$cookie_file")
    echo "📝 修正中: $filename"
    
    # sameSite 値を修正
    # "unspecified" → "Lax"
    # "no_restriction" → "None"
    sed -i 's/"sameSite": "unspecified"/"sameSite": "Lax"/g' "$cookie_file"
    sed -i 's/"sameSite": "no_restriction"/"sameSite": "None"/g' "$cookie_file"
    
    echo "✅ 修正完了: $filename"
done

echo ""
echo "==========================================="
echo "✅ 全ての Cookie ファイルを修正しました"
echo "==========================================="
