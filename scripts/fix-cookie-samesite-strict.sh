#!/bin/bash
# Cookie ファイルの sameSite 属性を Playwright 互換に修正（厳格版）

COOKIE_DIR="/root/clawd/skills/sns-multi-poster/cookies"

echo "🔧 Cookie ファイルの sameSite 属性を修正中（厳格版）..."

for cookie_file in "$COOKIE_DIR"/*.json; do
    if [ ! -f "$cookie_file" ]; then
        continue
    fi
    
    filename=$(basename "$cookie_file")
    echo "📝 修正中: $filename"
    
    # 全ての不正な sameSite 値を修正
    # "unspecified" → "Lax"
    # "no_restriction" → "None"
    # "lax" (小文字) → "Lax" (大文字始まり)
    # "none" (小文字) → "None" (大文字始まり)
    # "strict" (小文字) → "Strict" (大文字始まり)
    sed -i 's/"sameSite": "unspecified"/"sameSite": "Lax"/g' "$cookie_file"
    sed -i 's/"sameSite": "no_restriction"/"sameSite": "None"/g' "$cookie_file"
    sed -i 's/"sameSite": "lax"/"sameSite": "Lax"/g' "$cookie_file"
    sed -i 's/"sameSite": "none"/"sameSite": "None"/g' "$cookie_file"
    sed -i 's/"sameSite": "strict"/"sameSite": "Strict"/g' "$cookie_file"
    
    # 修正後の sameSite 値を確認
    echo "  sameSite 値:"
    grep '"sameSite"' "$cookie_file" | sort | uniq -c
    
    echo "✅ 修正完了: $filename"
    echo ""
done

echo "==========================================="
echo "✅ 全ての Cookie ファイルを修正しました"
echo "==========================================="
