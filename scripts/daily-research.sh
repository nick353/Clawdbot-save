#!/bin/bash
# Clawdbot話題性リサーチ v12（Brave検索 + X統合版）
# AI関連の一般トレンド（Brave + X + Claude要約）+ Clawdbot/Claude/MCP/Skills関連の最新情報を厳選5件

set -e

TODAY=$(date +%Y-%m-%d)
RESEARCH_DIR="/root/clawd/research"
REPORT_FILE="$RESEARCH_DIR/$TODAY.md"
TEMP_DIR="/tmp/daily-research-$$"

mkdir -p "$RESEARCH_DIR" "$TEMP_DIR"

# AI関連の一般トレンド（Brave + X統合検索）
AI_GENERAL_TREND_FILE="$TEMP_DIR/ai_general_trends.txt"
> "$AI_GENERAL_TREND_FILE"

AI_GENERAL_KEYWORDS=(
    "AI video generation new tool"
    "Sora alternatives 2024"
    "new AI image generator"
    "GPT-5 release"
    "Gemini 2.0"
    "Claude 3.5"
    "AI automation tool"
    "free AI tool"
)

for keyword in "${AI_GENERAL_KEYWORDS[@]}"; do
    clawdbot agent --agent main --message "web_search で '$keyword' を検索して、結果のタイトル・URL・概要をJSON形式で返してください。最大5件。" \
        --thinking low 2>/dev/null | \
        jq -r '.results[]? | "- **\(.title)**: \(.description) (\(.url))"' \
        >> "$AI_GENERAL_TREND_FILE" 2>/dev/null || true
    sleep 1
done

if [ -z "$AUTH_TOKEN" ] || [ -z "$CT0" ]; then
    X_ENABLED=false
else
    X_ENABLED=true
    AI_X_KEYWORDS=("Seedream" "Sora" "video generation" "image generation" "new AI tool" "AI release" "GPT" "Gemini")
    for keyword in "${AI_X_KEYWORDS[@]}"; do
        bird search "$keyword" -n 5 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:120])...\" (❤️\(.likeCount) 🔁\(.retweetCount))"' \
            >> "$AI_GENERAL_TREND_FILE" 2>/dev/null || true
    done
fi

sort "$AI_GENERAL_TREND_FILE" | uniq | head -15 > "$TEMP_DIR/general_trends_unique.txt"
mv "$TEMP_DIR/general_trends_unique.txt" "$AI_GENERAL_TREND_FILE"

if [ -s "$AI_GENERAL_TREND_FILE" ]; then
    AI_GENERAL_SUMMARY_FILE="$TEMP_DIR/ai_general_summary.md"
    clawdbot agent --agent main --message "以下のBrave検索結果とXツイートから、話題のAIツールやサービスを3つ抽出して日本語でまとめてください。
個別のツイートや記事を羅列するのではなく、みんなの話題の種になっているツール・機能について、トピックごとにまとめてください。

データ:
$(cat "$AI_GENERAL_TREND_FILE")

フォーマット:
### 🔥 [トピック名]

[まとめた内容（3-5文で簡潔に）]

**🔗 関連URL:**
- [関連するツールやサービスのURL]
- [参考になるURL]

---

注意:
- 個別のツイートや記事を引用しない
- 話題になっている内容を要約する
- URLは実在するものだけを記載" --thinking low > "$AI_GENERAL_SUMMARY_FILE" 2>/dev/null || true
fi

# Clawdbot/Claude関連のトレンド（Brave + X統合検索）
CLAUDE_TREND_FILE="$TEMP_DIR/claude_trends.txt"
> "$CLAUDE_TREND_FILE"

CLAUDE_BRAVE_KEYWORDS=(
    "Claude MCP server new"
    "Claude Code automation"
    "Anthropic Claude skills"
    "Claude AI agent tutorial"
    "MCP server GitHub"
    "Claude Desktop automation"
    "best Claude extensions"
)

for keyword in "${CLAUDE_BRAVE_KEYWORDS[@]}"; do
    clawdbot agent --agent main --message "web_search で '$keyword' を検索して、結果のタイトル・URL・概要をJSON形式で返してください。最大5件。" \
        --thinking low 2>/dev/null | \
        jq -r '.results[]? | "- **\(.title)**: \(.description) (\(.url))"' \
        >> "$CLAUDE_TREND_FILE" 2>/dev/null || true
    sleep 1
done

if [ "$X_ENABLED" = true ]; then
    CLAUDE_X_KEYWORDS=("Claude" "Clawdbot" "MCP" "Claude skill" "AI agent" "Claude automation" "agent skill" "Claude Code" "Anthropic")
    for keyword in "${CLAUDE_X_KEYWORDS[@]}"; do
        bird search "$keyword" -n 5 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:120])...\" (❤️\(.likeCount) 🔁\(.retweetCount))"' \
            >> "$CLAUDE_TREND_FILE" 2>/dev/null || true
    done
fi

sort "$CLAUDE_TREND_FILE" | uniq | head -15 > "$TEMP_DIR/claude_trends_unique.txt"
mv "$TEMP_DIR/claude_trends_unique.txt" "$CLAUDE_TREND_FILE"

if [ -s "$CLAUDE_TREND_FILE" ]; then
    CLAUDE_SUMMARY_FILE="$TEMP_DIR/claude_summary.md"
    clawdbot agent --agent main --message "以下のBrave検索結果とXツイートから、話題のClawdbot/Claude関連ツールやサービスを3つ抽出して日本語でまとめてください。
個別のツイートや記事を羅列するのではなく、みんなの話題の種になっているツール・機能について、トピックごとにまとめてください。

データ:
$(cat "$CLAUDE_TREND_FILE")

フォーマット:
### 🔥 [トピック名]

[まとめた内容（3-5文で簡潔に）]

**🔗 関連URL:**
- [関連するツールやサービスのURL]
- [参考になるURL]

---

注意:
- 個別のツイートや記事を引用しない
- 話題になっている内容を要約する
- URLは実在するもの（Claude Code, OpenClaw, Awesome Claude Skillsなど）を記載" --thinking low > "$CLAUDE_SUMMARY_FILE" 2>/dev/null || true
fi

# GitHub検索（⭐500以上、Clawdbot/Claude特化）
SEARCH_KEYWORDS=("MCP server" "Claude skill" "Clawdbot skill" "agent skill" "Claude automation" "MCP tool" "Claude MCP" "AI agent skill" "Claude agent" "automation skill")

GITHUB_JSON="[]"
ONE_DAY_AGO=$(date -d '1 day ago' +%Y-%m-%d)

for keyword in "${SEARCH_KEYWORDS[@]}"; do
    QUERY=$(echo "$keyword stars:>=500 pushed:>=$ONE_DAY_AGO" | jq -sRr @uri)
    RESULT=$(curl -s "https://api.github.com/search/repositories?q=$QUERY&sort=updated&per_page=3" | \
        jq '[.items[] | {name: .name, owner: {login: .owner.login}, description: .description, stargazersCount: .stargazers_count, url: .html_url, updatedAt: .updated_at}]' 2>/dev/null || echo "[]")
    GITHUB_JSON=$(echo "$GITHUB_JSON" "$RESULT" | jq -s '.[0] + .[1]')
    sleep 1
done

GITHUB_JSON=$(echo "$GITHUB_JSON" | jq 'unique_by(.name)')
RESULT_COUNT=$(echo "$GITHUB_JSON" | jq 'length')

if [ "$RESULT_COUNT" -lt 10 ]; then
    SEVEN_DAYS_AGO=$(date -d '7 days ago' +%Y-%m-%d)
    for keyword in "${SEARCH_KEYWORDS[@]}"; do
        QUERY=$(echo "$keyword stars:>=500 pushed:>=$SEVEN_DAYS_AGO" | jq -sRr @uri)
        RESULT=$(curl -s "https://api.github.com/search/repositories?q=$QUERY&sort=updated&per_page=3" | \
            jq '[.items[] | {name: .name, owner: {login: .owner.login}, description: .description, stargazersCount: .stargazers_count, url: .html_url, updatedAt: .updated_at}]' 2>/dev/null || echo "[]")
        GITHUB_JSON=$(echo "$GITHUB_JSON" "$RESULT" | jq -s '.[0] + .[1]')
        sleep 1
    done
    GITHUB_JSON=$(echo "$GITHUB_JSON" | jq 'unique_by(.name)')
fi

GITHUB_JSON=$(echo "$GITHUB_JSON" | jq 'sort_by(-.stargazersCount) | .[0:15]')

# X言及数カウント（各ツール名で検索）
TOOL_NAMES=$(echo "$GITHUB_JSON" | jq -r '.[0:15] | .[].name' | tr '\n' ' ')
declare -A MENTION_COUNT

if [ "$X_ENABLED" = true ]; then
    for tool in $TOOL_NAMES; do
        COUNT=$(bird search "$tool" -n 50 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
        MENTION_COUNT["$tool"]=$COUNT
    done
fi

# スコア計算＆トップ5選出
TOP5_JSON=$(echo "$GITHUB_JSON" | jq --argjson x_enabled "$X_ENABLED" 'map(. + {x_mentions: 0, score: .stargazersCount}) | sort_by(-.score) | .[0:5]')

if [ "$X_ENABLED" = true ]; then
    for tool in $TOOL_NAMES; do
        mentions=${MENTION_COUNT[$tool]:-0}
        if [ "$mentions" -gt 0 ]; then
            TOP5_JSON=$(echo "$TOP5_JSON" | jq --arg name "$tool" --argjson mentions "$mentions" 'map(if .name == $name then .x_mentions = $mentions | .score = (.stargazersCount + ($mentions * 100)) else . end)')
        fi
    done
    TOP5_JSON=$(echo "$TOP5_JSON" | jq 'sort_by(-.score) | .[0:5]')
fi

# レポート生成
cat > "$REPORT_FILE" << 'HEADER'
# 🔥 今日の話題（Brave + X統合版）

HEADER

echo "**生成日:** $TODAY" >> "$REPORT_FILE"
echo "**検索エンジン:** Brave Search + X (Twitter)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# AI関連の一般トレンドセクション
AI_GENERAL_SUMMARY_FILE="$TEMP_DIR/ai_general_summary.md"
if [ -s "$AI_GENERAL_SUMMARY_FILE" ]; then
    echo "## 🌍 AI関連の一般トレンド" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "BraveとXで検索した最新AI情報っぴ！🦜" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    cat "$AI_GENERAL_SUMMARY_FILE" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# Clawdbot/Claude関連トレンドセクション
CLAUDE_SUMMARY_FILE="$TEMP_DIR/claude_summary.md"
if [ -s "$CLAUDE_SUMMARY_FILE" ]; then
    echo "## 🎯 Clawdbot/Claude関連のトレンド" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "BraveとXで検索したClawdbot/Claude関連の最新情報っぴ！ 🦜" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    cat "$CLAUDE_SUMMARY_FILE" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 🎯 Clawdbot/Claude関連の注目情報（トップ5）" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "前日（24時間以内）に更新されたClawdbot/Claude/MCP/Skills関連情報を厳選5件ピックアップっぴ！ 🦜" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "（※ 見つからない場合は過去1週間以内に範囲を拡大）" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# トップ5を詳細表示
COUNTER=1
echo "$TOP5_JSON" | jq -c '.[]' | while read -r item; do
    NAME=$(echo "$item" | jq -r '.name')
    OWNER=$(echo "$item" | jq -r '.owner.login')
    STARS=$(echo "$item" | jq -r '.stargazersCount')
    DESC=$(echo "$item" | jq -r '.description // "説明なし"')
    URL=$(echo "$item" | jq -r '.url')
    MENTIONS=$(echo "$item" | jq -r '.x_mentions')
    SCORE=$(echo "$item" | jq -r '.score')
    
    if [ "$MENTIONS" -ge 3 ]; then
        TREND="🔥 話題度: 高（X言及 ${MENTIONS}件）"
    elif [ "$MENTIONS" -gt 0 ]; then
        TREND="📊 注目度: 中（X言及 ${MENTIONS}件）"
    else
        TREND="📊 注目度: 中（GitHub⭐のみ）"
    fi
    
    CLAWDBOT_IMPACT=""
    case "$NAME" in
        *"fastmcp"*|*"fast-mcp"*)
            CLAWDBOT_IMPACT="Pythonスクリプトを書くだけで、新しいMCPサーバーを簡単に追加できるようになる。現在手動でやっている作業が大幅に効率化される"
            ;;
        *"activepieces"*)
            CLAWDBOT_IMPACT="複数のツールを連携させた自動化が可能に。例: 毎朝のリサーチ結果をSlack/Discord/Notionに同時投稿、といった連携が簡単に設定できる"
            ;;
        *)
            CLAWDBOT_IMPACT="$DESC"
            ;;
    esac
    
    cat >> "$REPORT_FILE" << ITEM

## $COUNTER. **$NAME** by $OWNER

**⭐ $STARS** | $TREND | スコア: $SCORE

**どうなる？**  
$CLAWDBOT_IMPACT

**GitHub:** $URL

ITEM
    
    if [ "$X_ENABLED" = true ] && [ "$MENTIONS" -gt 0 ]; then
        echo "**Xでの反応:**" >> "$REPORT_FILE"
        bird search "$NAME" -n 3 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[0:3] | .[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:100])...\"" ' \
            >> "$REPORT_FILE" 2>/dev/null || echo "- （データ取得失敗）" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << FOOTER

**💬 やってみますか？**

---

FOOTER
    
    COUNTER=$((COUNTER + 1))
done

echo "" >> "$REPORT_FILE"
echo "📄 **詳細レポート:** \`$REPORT_FILE\`" >> "$REPORT_FILE"

# Discord即時通知（notify.sh使用）
REPORT_PREVIEW=$(head -c 1500 "$REPORT_FILE" 2>/dev/null || echo "レポート読み込みエラー")
bash /root/clawd/scripts/notify.sh "📊 毎朝リサーチ完了 ($TODAY)" "$REPORT_PREVIEW" "1470296869870506156" "success"
echo "✅ リサーチ完了: $REPORT_FILE"
rm -rf "$TEMP_DIR"
