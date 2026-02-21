#!/bin/bash
# トレンドセクションをフォーマットするヘルパースクリプト

TREND_FILE="$1"
OUTPUT_FILE="$2"
SECTION_TYPE="$3"  # "ai_general" or "claude"

if [ ! -f "$TREND_FILE" ] || [ ! -s "$TREND_FILE" ]; then
    echo "トレンドファイルが空っぴ"
    exit 0
fi

# トレンドファイルの内容を読み込み
TREND_COUNT=$(wc -l < "$TREND_FILE")

if [ "$TREND_COUNT" -eq 0 ]; then
    echo "トレンドが0件っぴ"
    exit 0
fi

# セクションタイトルに応じた絵文字とタイトル
if [ "$SECTION_TYPE" = "ai_general" ]; then
    SECTION_EMOJI="🌍"
    SECTION_TITLE="AI関連の一般トレンド"
    DESCRIPTION="Xで話題になっている最新AI情報っぴ！（Seedream 2.0, Sora, 動画生成など）🦜"
else
    SECTION_EMOJI="🎯"
    SECTION_TITLE="Clawdbot/Claude関連のトレンド"
    DESCRIPTION="Xで話題になっているClawdbot/Claude関連の最新情報っぴ！ 🦜"
fi

# フォーマット済みの出力を生成
cat > "$OUTPUT_FILE" << EOF
## $SECTION_EMOJI $SECTION_TITLE

$DESCRIPTION

---

EOF

# ツイートを読み込んでグループ化（簡易版：そのまま出力だが、見出しと絵文字を追加）
COUNTER=1
while IFS= read -r line; do
    # ツイート行から主要な情報を抽出
    USERNAME=$(echo "$line" | grep -oP '@\K\w+' | head -1)
    
    # 絵文字を追加（ランダムに選択）
    EMOJIS=("💡" "🔥" "🚀" "⭐" "📢")
    EMOJI=${EMOJIS[$((COUNTER % 5))]}
    
    # フォーマット済みの出力
    echo "$EMOJI **話題のツイート #$COUNTER**" >> "$OUTPUT_FILE"
    echo "$line" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    COUNTER=$((COUNTER + 1))
done < "$TREND_FILE"

# 参考URLを追加
if [ "$SECTION_TYPE" = "ai_general" ]; then
    cat >> "$OUTPUT_FILE" << 'EOF'

**🔗 参考URL:**
- Seedream 2.0: （最新情報を検索）
- Sora: https://openai.com/sora
- 動画生成AI: （Xで検索）
EOF
else
    cat >> "$OUTPUT_FILE" << 'EOF'

**🔗 参考URL:**
- Claude Code: https://github.com/anthropics/claude-code
- OpenClaw: https://github.com/openclaw
- Awesome Claude Skills: https://github.com/ComposioHQ/awesome-claude-skills
EOF
fi

echo "✅ トレンドフォーマット完了: $OUTPUT_FILE"
