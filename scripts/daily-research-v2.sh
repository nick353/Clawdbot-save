#!/bin/bash
# Clawdbot話題性リサーチ v2
# 前日の話題になったツール・MCPを厳選3件

set -e

TODAY=$(date +%Y-%m-%d)
RESEARCH_DIR="/root/clawd/research"
REPORT_FILE="$RESEARCH_DIR/$TODAY.md"
TEMP_DIR="/tmp/clawdbot-research-$$"

mkdir -p "$RESEARCH_DIR" "$TEMP_DIR"

echo "🔍 話題性リサーチ開始: $TODAY"

# ============================================
# 1. X検索で言及数をカウント
# ============================================
echo "## 🐦 X（Twitter）言及数カウント中..."

# 検索キーワード（MCP/ツール名）
KEYWORDS=("MCP server" "claude MCP" "clawdbot" "automation" "AI agent")

# X認証確認
if [ -z "$AUTH_TOKEN" ] || [ -z "$CT0" ]; then
    echo "⚠️ X認証未設定（AUTH_TOKEN, CT0 必要）"
    echo "前日の話題: GitHub⭐数のみで判定します"
    X_AVAILABLE=false
else
    X_AVAILABLE=true
fi

# 言及数カウント用の一時ファイル
MENTION_COUNT_FILE="$TEMP_DIR/mention_count.txt"
> "$MENTION_COUNT_FILE"

if [ "$X_AVAILABLE" = true ]; then
    for keyword in "${KEYWORDS[@]}"; do
        echo "  検索中: $keyword"
        
        # 過去24時間で検索
        TWEETS=$(bird search "$keyword" -n 50 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null || echo "[]")
        
        # ツール名を抽出してカウント
        echo "$TWEETS" | jq -r '.[].text' 2>/dev/null | \
            grep -oiE '(kreuzberg|mcp-server-[a-z0-9-]+|[a-z0-9-]+-mcp|clawdbot|automation-[a-z0-9-]+|smithery|replicant)' | \
            tr '[:upper:]' '[:lower:]' | \
            sort | uniq -c | \
            awk '{print $2":"$1}' >> "$MENTION_COUNT_FILE" || true
    done
    
    # 言及数を集計
    echo "## X言及数トップ10:" > "$TEMP_DIR/x_mentions.txt"
    sort "$MENTION_COUNT_FILE" | \
        awk -F: '{mentions[$1]+=$2} END {for (tool in mentions) print mentions[tool]":"tool}' | \
        sort -rn | head -10 >> "$TEMP_DIR/x_mentions.txt"
    
    cat "$TEMP_DIR/x_mentions.txt"
fi

# ============================================
# 2. GitHub検索（⭐500以上）
# ============================================
echo "## 🐙 GitHub検索（⭐500以上）..."

GITHUB_RESULTS="$TEMP_DIR/github_results.json"

if command -v gh &> /dev/null; then
    # MCP関連で⭐500以上
    gh search repos "MCP server stars:>=500" --sort stars --limit 10 \
        --json name,owner,description,stargazersCount,url,updatedAt \
        2>/dev/null > "$GITHUB_RESULTS" || echo "[]" > "$GITHUB_RESULTS"
    
    echo "GitHub検索結果:"
    jq -r '.[] | "  ⭐\(.stargazersCount) \(.name) by \(.owner.login)"' "$GITHUB_RESULTS" 2>/dev/null || echo "  検索エラー"
else
    echo "[]" > "$GITHUB_RESULTS"
    echo "  gh CLI未インストール"
fi

# ============================================
# 3. 話題度スコア計算＆トップ3選出
# ============================================
echo "## 🔥 話題度スコア計算中..."

TOP3_FILE="$TEMP_DIR/top3.json"

# GitHubデータにX言及数を追加してスコア計算
jq -r --slurpfile mentions "$TEMP_DIR/x_mentions.txt" '
    def get_mentions(name):
        ($mentions[0] // "" | split("\n") | 
         map(select(length > 0) | split(":") | {tool: .[1], count: (.[0] | tonumber)}) | 
         map(select(.tool | ascii_downcase | contains(name | ascii_downcase))) | 
         map(.count) | add) // 0;
    
    map(
        . + {
            x_mentions: get_mentions(.name),
            score: (.stargazersCount + (get_mentions(.name) * 100))
        }
    ) | 
    sort_by(-.score) | 
    .[0:3]
' "$GITHUB_RESULTS" > "$TOP3_FILE" 2>/dev/null || echo "[]" > "$TOP3_FILE"

echo "トップ3:"
jq -r '.[] | "  🔥 \(.name) (⭐\(.stargazersCount), X言及:\(.x_mentions)件, スコア:\(.score))"' "$TOP3_FILE" 2>/dev/null

# ============================================
# 4. レポート生成
# ============================================
echo "## 📝 レポート生成中..."

cat > "$REPORT_FILE" << 'HEADER'
# 🔥 今日の話題（前日の注目ツール）

HEADER

echo "**生成日:** $TODAY" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "前日に話題になったツール・MCPサーバーを厳選3件ピックアップっぴ！ 🦜" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# トップ3を詳細表示
COUNTER=1
jq -c '.[]' "$TOP3_FILE" 2>/dev/null | while read -r item; do
    NAME=$(echo "$item" | jq -r '.name')
    OWNER=$(echo "$item" | jq -r '.owner.login')
    STARS=$(echo "$item" | jq -r '.stargazersCount')
    DESC=$(echo "$item" | jq -r '.description // "説明なし"')
    URL=$(echo "$item" | jq -r '.url')
    MENTIONS=$(echo "$item" | jq -r '.x_mentions')
    
    # 話題度判定
    if [ "$MENTIONS" -ge 3 ]; then
        TREND="🔥 話題度: 高"
    else
        TREND="📊 注目度: 中"
    fi
    
    cat >> "$REPORT_FILE" << ITEM

## $COUNTER. **$NAME** by $OWNER

**⭐ $STARS** | $TREND

**何ができる:**  
$DESC

**Xでの反応:**  
ITEM
    
    # X言及を検索して抜粋
    if [ "$X_AVAILABLE" = true ] && [ "$MENTIONS" -gt 0 ]; then
        bird search "$NAME" -n "$MENTIONS" --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[0:3] | .[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:100])...\"" ' \
            >> "$REPORT_FILE" 2>/dev/null || echo "- （言及データ取得失敗）" >> "$REPORT_FILE"
    else
        echo "- （X認証未設定またはX言及なし）" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << FOOTER

**GitHub:** $URL

**💬 やってみますか？**

---

FOOTER
    
    COUNTER=$((COUNTER + 1))
done

echo "" >> "$REPORT_FILE"
echo "📄 **詳細レポート:** \`$REPORT_FILE\`" >> "$REPORT_FILE"

# クリーンアップ
rm -rf "$TEMP_DIR"

echo "✅ レポート生成完了: $REPORT_FILE"
echo "📍 Discord投稿は手動で行ってください"
