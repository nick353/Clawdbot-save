#!/bin/bash
# Clawdbot話題性リサーチ v11（エラーハンドリング強化版）
# AI関連の一般トレンド（Claude APIで自動要約・リトライ＋フォールバック付き）+ Clawdbot/Claude/MCP/Skills関連の最新情報を厳選5件（前日優先、なければ1週間以内）

set -e

TODAY=$(date +%Y-%m-%d)
RESEARCH_DIR="/root/clawd/research"
REPORT_FILE="$RESEARCH_DIR/$TODAY.md"
TEMP_DIR="/tmp/daily-research-$$"

mkdir -p "$RESEARCH_DIR"
mkdir -p "$TEMP_DIR"

echo "🔍 話題性リサーチ開始: $TODAY"

# ============================================
# 1. AI関連の一般トレンド（X検索）
# ============================================
echo "## 📰 AI関連の一般トレンド検索中..."

AI_GENERAL_TREND_FILE="$TEMP_DIR/ai_general_trends.txt"
> "$AI_GENERAL_TREND_FILE"

# X認証確認
if [ -z "$AUTH_TOKEN" ] || [ -z "$CT0" ]; then
    echo "⚠️ X認証未設定（トレンド検索スキップ）"
    X_ENABLED=false
else
    X_ENABLED=true
    
    # AI関連の一般トレンド検索（Seedream 2.0, Sora, 動画生成など）
    AI_GENERAL_KEYWORDS=(
        "Seedream"
        "Sora"
        "video generation"
        "image generation"
        "new AI tool"
        "AI release"
        "GPT"
        "Gemini"
        "動画生成"
        "画像生成"
    )
    
    for keyword in "${AI_GENERAL_KEYWORDS[@]}"; do
        echo "  検索中: $keyword"
        
        # 過去24時間の最新ツイート（フィルターなし）
        bird search "$keyword" -n 5 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:120])...\" (❤️\(.likeCount) 🔁\(.retweetCount))"' \
            >> "$AI_GENERAL_TREND_FILE" 2>/dev/null || true
    done
    
    # 重複を削除してトップ10に絞る（要約用に多めに取得）
    sort "$AI_GENERAL_TREND_FILE" | uniq | head -10 > "$TEMP_DIR/general_trends_unique.txt"
    mv "$TEMP_DIR/general_trends_unique.txt" "$AI_GENERAL_TREND_FILE"
    
    echo ""
    echo "AI一般トレンド収集完了（$(wc -l < "$AI_GENERAL_TREND_FILE") 件）"
    
    # トピック抽出＋要約（Claude API）
    if [ -s "$AI_GENERAL_TREND_FILE" ]; then
        echo "## 📝 AI一般トレンドのトピック抽出中..."
        
        AI_GENERAL_SUMMARY_FILE="$TEMP_DIR/ai_general_summary.md"
        AI_GENERAL_ERROR_FILE="$TEMP_DIR/ai_general_error.log"
        
        # Claude API でトピックごとにまとめる（リトライ機能付き）
        MAX_RETRIES=3
        RETRY_COUNT=0
        
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            echo "  要約試行 $((RETRY_COUNT + 1))/$MAX_RETRIES"
            
            clawdbot agent --agent main --message "以下のツイート群から、話題のトピックを3つ抽出して日本語でまとめてください。
個別のツイートを羅列するのではなく、みんなの話題の種になっているツールや機能について、トピックごとにまとめてください。

ツイート:
$(cat "$AI_GENERAL_TREND_FILE")

フォーマット:
### 🔥 [トピック名]

[まとめた内容（3-5文で簡潔に）]

**🔗 関連URL:**
- [関連するツールやサービスのURL]
- [参考になるURL]

---

（トピックごとに上記のフォーマットを繰り返す）

注意:
- 個別のツイートを引用しない
- 話題になっている内容を要約する
- URLは実在するものだけを記載（無ければ「（Xで検索）」）" --thinking low > "$AI_GENERAL_SUMMARY_FILE" 2> "$AI_GENERAL_ERROR_FILE"
            
            # 出力が空でないかチェック
            if [ -s "$AI_GENERAL_SUMMARY_FILE" ] && [ "$(wc -l < "$AI_GENERAL_SUMMARY_FILE")" -gt 3 ]; then
                echo "AI一般トレンド要約成功"
                break
            else
                echo "  要約失敗、リトライします..."
                RETRY_COUNT=$((RETRY_COUNT + 1))
                sleep 2
            fi
        done
        
        # 全てのリトライが失敗した場合、フォールバック処理
        if [ ! -s "$AI_GENERAL_SUMMARY_FILE" ] || [ "$(wc -l < "$AI_GENERAL_SUMMARY_FILE")" -le 3 ]; then
            echo "⚠️ 要約失敗、生のツイートを表示します"
            cat > "$AI_GENERAL_SUMMARY_FILE" << 'EOF'
### 🔥 AI関連の最新ツイート

以下、Xで話題になっている最新のAI関連ツイートです：

EOF
            # ツイートをそのまま表示
            COUNTER=1
            while IFS= read -r line; do
                echo "" >> "$AI_GENERAL_SUMMARY_FILE"
                echo "**ツイート #$COUNTER:**" >> "$AI_GENERAL_SUMMARY_FILE"
                echo "$line" >> "$AI_GENERAL_SUMMARY_FILE"
                COUNTER=$((COUNTER + 1))
            done < "$AI_GENERAL_TREND_FILE"
            
            echo "" >> "$AI_GENERAL_SUMMARY_FILE"
            echo "**🔗 参考URL:**" >> "$AI_GENERAL_SUMMARY_FILE"
            echo "- Xで #AI を検索" >> "$AI_GENERAL_SUMMARY_FILE"
        fi
    fi
fi

# ============================================
# 2. Clawdbot/Claude関連のトレンド（X検索）
# ============================================
echo "## 📰 Clawdbot/Claude関連のトレンド検索中..."

CLAUDE_TREND_FILE="$TEMP_DIR/claude_trends.txt"
> "$CLAUDE_TREND_FILE"

if [ "$X_ENABLED" = true ]; then
    # Clawdbot/Claude/MCP/Skills に特化したトレンド検索
    CLAUDE_KEYWORDS=(
        "Claude"
        "Clawdbot"
        "MCP"
        "Claude skill"
        "AI agent"
        "Claude automation"
        "agent skill"
        "Claude Code"
        "Anthropic"
        "MCP server"
    )
    
    for keyword in "${CLAUDE_KEYWORDS[@]}"; do
        echo "  検索中: $keyword"
        
        # 過去24時間の最新ツイート（フィルターなし）
        bird search "$keyword" -n 5 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:120])...\" (❤️\(.likeCount) 🔁\(.retweetCount))"' \
            >> "$CLAUDE_TREND_FILE" 2>/dev/null || true
    done
    
    # 重複を削除してトップ10に絞る（要約用に多めに取得）
    sort "$CLAUDE_TREND_FILE" | uniq | head -10 > "$TEMP_DIR/claude_trends_unique.txt"
    mv "$TEMP_DIR/claude_trends_unique.txt" "$CLAUDE_TREND_FILE"
    
    echo ""
    echo "Claude関連トレンド収集完了（$(wc -l < "$CLAUDE_TREND_FILE") 件）"
    
    # トピック抽出＋要約（Claude API）
    if [ -s "$CLAUDE_TREND_FILE" ]; then
        echo "## 📝 Claude関連トレンドのトピック抽出中..."
        
        CLAUDE_SUMMARY_FILE="$TEMP_DIR/claude_summary.md"
        CLAUDE_ERROR_FILE="$TEMP_DIR/claude_error.log"
        
        # Claude API でトピックごとにまとめる（リトライ機能付き）
        MAX_RETRIES=3
        RETRY_COUNT=0
        
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            echo "  要約試行 $((RETRY_COUNT + 1))/$MAX_RETRIES"
            
            clawdbot agent --agent main --message "以下のツイート群から、話題のトピックを3つ抽出して日本語でまとめてください。
個別のツイートを羅列するのではなく、みんなの話題の種になっているツールや機能について、トピックごとにまとめてください。

ツイート:
$(cat "$CLAUDE_TREND_FILE")

フォーマット:
### 🔥 [トピック名]

[まとめた内容（3-5文で簡潔に）]

**🔗 関連URL:**
- [関連するツールやサービスのURL]
- [参考になるURL]

---

（トピックごとに上記のフォーマットを繰り返す）

注意:
- 個別のツイートを引用しない
- 話題になっている内容を要約する
- URLは実在するもの（Claude Code, OpenClaw, Awesome Claude Skillsなど）を記載" --thinking low > "$CLAUDE_SUMMARY_FILE" 2> "$CLAUDE_ERROR_FILE"
            
            # 出力が空でないかチェック
            if [ -s "$CLAUDE_SUMMARY_FILE" ] && [ "$(wc -l < "$CLAUDE_SUMMARY_FILE")" -gt 3 ]; then
                echo "Claude関連トレンド要約成功"
                break
            else
                echo "  要約失敗、リトライします..."
                RETRY_COUNT=$((RETRY_COUNT + 1))
                sleep 2
            fi
        done
        
        # 全てのリトライが失敗した場合、フォールバック処理
        if [ ! -s "$CLAUDE_SUMMARY_FILE" ] || [ "$(wc -l < "$CLAUDE_SUMMARY_FILE")" -le 3 ]; then
            echo "⚠️ 要約失敗、生のツイートを表示します"
            cat > "$CLAUDE_SUMMARY_FILE" << 'EOF'
### 🔥 Clawdbot/Claude関連の最新ツイート

以下、Xで話題になっている最新のClawdbot/Claude関連ツイートです：

EOF
            # ツイートをそのまま表示
            COUNTER=1
            while IFS= read -r line; do
                echo "" >> "$CLAUDE_SUMMARY_FILE"
                echo "**ツイート #$COUNTER:**" >> "$CLAUDE_SUMMARY_FILE"
                echo "$line" >> "$CLAUDE_SUMMARY_FILE"
                COUNTER=$((COUNTER + 1))
            done < "$CLAUDE_TREND_FILE"
            
            echo "" >> "$CLAUDE_SUMMARY_FILE"
            echo "**🔗 関連URL:**" >> "$CLAUDE_SUMMARY_FILE"
            echo "- Claude Code: https://github.com/anthropics/claude-code" >> "$CLAUDE_SUMMARY_FILE"
            echo "- OpenClaw: https://github.com/VoltAgent/openclaw" >> "$CLAUDE_SUMMARY_FILE"
            echo "- Clawdbot: https://clawd.bot" >> "$CLAUDE_SUMMARY_FILE"
        fi
    fi
fi

# ============================================
# 2. GitHub検索（⭐500以上、Clawdbot/Claude特化）
# ============================================
echo "## 🐙 GitHub検索（⭐500以上、Clawdbot/Claude関連）..."

# Clawdbot/Claude/MCP/Skills に特化したキーワード
SEARCH_KEYWORDS=(
    "MCP server"
    "Claude skill"
    "Clawdbot skill"
    "agent skill"
    "Claude automation"
    "MCP tool"
    "Claude MCP"
    "AI agent skill"
    "Claude agent"
    "automation skill"
)

GITHUB_JSON="[]"

# まず過去24時間で検索（優先）
echo ""
echo "🔍 ステップ1: 過去24時間以内に更新されたものを検索..."
ONE_DAY_AGO=$(date -d '1 day ago' +%Y-%m-%d)

for keyword in "${SEARCH_KEYWORDS[@]}"; do
    echo "  検索中: $keyword (24時間以内)"
    
    QUERY=$(echo "$keyword stars:>=500 pushed:>=$ONE_DAY_AGO" | jq -sRr @uri)
    RESULT=$(curl -s "https://api.github.com/search/repositories?q=$QUERY&sort=updated&per_page=3" | \
        jq '[.items[] | {
            name: .name,
            owner: {login: .owner.login},
            description: .description,
            stargazersCount: .stargazers_count,
            url: .html_url,
            updatedAt: .updated_at
        }]' 2>/dev/null || echo "[]")
    
    GITHUB_JSON=$(echo "$GITHUB_JSON" "$RESULT" | jq -s '.[0] + .[1]')
    sleep 1
done

# 重複を削除
GITHUB_JSON=$(echo "$GITHUB_JSON" | jq 'unique_by(.name)')
RESULT_COUNT=$(echo "$GITHUB_JSON" | jq 'length')

echo "24時間以内の結果: $RESULT_COUNT 件"

# 結果が10件未満なら、過去7日間にフォールバック
if [ "$RESULT_COUNT" -lt 10 ]; then
    echo ""
    echo "⚠️ 結果が少ないため、過去7日間に範囲を拡大します..."
    SEVEN_DAYS_AGO=$(date -d '7 days ago' +%Y-%m-%d)
    
    for keyword in "${SEARCH_KEYWORDS[@]}"; do
        echo "  検索中: $keyword (7日間以内)"
        
        QUERY=$(echo "$keyword stars:>=500 pushed:>=$SEVEN_DAYS_AGO" | jq -sRr @uri)
        RESULT=$(curl -s "https://api.github.com/search/repositories?q=$QUERY&sort=updated&per_page=3" | \
            jq '[.items[] | {
                name: .name,
                owner: {login: .owner.login},
                description: .description,
                stargazersCount: .stargazers_count,
                url: .html_url,
                updatedAt: .updated_at
            }]' 2>/dev/null || echo "[]")
        
        GITHUB_JSON=$(echo "$GITHUB_JSON" "$RESULT" | jq -s '.[0] + .[1]')
        sleep 1
    done
    
    GITHUB_JSON=$(echo "$GITHUB_JSON" | jq 'unique_by(.name)')
    RESULT_COUNT=$(echo "$GITHUB_JSON" | jq 'length')
    echo "7日間以内の結果: $RESULT_COUNT 件"
fi

# スター数でソート（トップ15）
GITHUB_JSON=$(echo "$GITHUB_JSON" | jq 'sort_by(-.stargazersCount) | .[0:15]')

echo ""
echo "検索結果（重複削除後、トップ10）:"
echo "$GITHUB_JSON" | jq -r '.[] | "  ⭐\(.stargazersCount) \(.name)"' | head -10

# ============================================
# 2. X言及数カウント（各ツール名で検索）
# ============================================
echo "## 🐦 X言及数カウント..."

# X認証確認
if [ -z "$AUTH_TOKEN" ] || [ -z "$CT0" ]; then
    echo "⚠️ X認証未設定（GitHub⭐数のみで判定）"
    X_ENABLED=false
else
    X_ENABLED=true
fi

# トップ15のツール名を抽出（5件選出のため余裕を持たせる）
TOOL_NAMES=$(echo "$GITHUB_JSON" | jq -r '.[0:15] | .[].name' | tr '\n' ' ')

# 各ツールのX言及数をカウント（トレンド検索とは別）
declare -A MENTION_COUNT

if [ "$X_ENABLED" = true ]; then
    for tool in $TOOL_NAMES; do
        echo "  検索中: $tool"
        
        # ツール名で検索（過去24時間）
        COUNT=$(bird search "$tool" -n 50 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq 'length' 2>/dev/null || echo "0")
        
        MENTION_COUNT["$tool"]=$COUNT
        echo "    → $COUNT 件"
    done
fi

# ============================================
# 4. スコア計算＆トップ5選出
# ============================================
echo "## 🔥 スコア計算..."

# GitHub JSONにX言及数を追加してトップ5を選出
TOP5_JSON=$(echo "$GITHUB_JSON" | jq --argjson x_enabled "$X_ENABLED" '
    map(
        . + {
            x_mentions: 0,
            score: .stargazersCount
        }
    ) | 
    sort_by(-.score) | 
    .[0:5]
')

# X言及数を追加（bashの連想配列から）
if [ "$X_ENABLED" = true ]; then
    for tool in $TOOL_NAMES; do
        mentions=${MENTION_COUNT[$tool]:-0}
        if [ "$mentions" -gt 0 ]; then
            TOP5_JSON=$(echo "$TOP5_JSON" | jq --arg name "$tool" --argjson mentions "$mentions" '
                map(if .name == $name then .x_mentions = $mentions | .score = (.stargazersCount + ($mentions * 100)) else . end)
            ')
        fi
    done
    
    # 再ソート
    TOP5_JSON=$(echo "$TOP5_JSON" | jq 'sort_by(-.score) | .[0:5]')
fi

echo "トップ5:"
echo "$TOP5_JSON" | jq -r '.[] | "  🔥 \(.name) (⭐\(.stargazersCount), X言及:\(.x_mentions)件, スコア:\(.score))"'

# ============================================
# 5. レポート生成
# ============================================
echo "## 📝 レポート生成中..."

cat > "$REPORT_FILE" << 'HEADER'
# 🔥 今日の話題

HEADER

echo "**生成日:** $TODAY" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# AI関連の一般トレンドセクション
AI_GENERAL_SUMMARY_FILE="$TEMP_DIR/ai_general_summary.md"
if [ "$X_ENABLED" = true ] && [ -s "$AI_GENERAL_SUMMARY_FILE" ]; then
    echo "## 🌍 AI関連の一般トレンド" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "Xで話題になっている最新AI情報っぴ！🦜" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Claude APIで要約済みのトピックを挿入
    cat "$AI_GENERAL_SUMMARY_FILE" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# Clawdbot/Claude関連トレンドセクション
CLAUDE_SUMMARY_FILE="$TEMP_DIR/claude_summary.md"
if [ "$X_ENABLED" = true ] && [ -s "$CLAUDE_SUMMARY_FILE" ]; then
    echo "## 🎯 Clawdbot/Claude関連のトレンド" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "Xで話題になっているClawdbot/Claude関連の最新情報っぴ！ 🦜" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Claude APIで要約済みのトピックを挿入
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
    
    # 話題度判定
    if [ "$MENTIONS" -ge 3 ]; then
        TREND="🔥 話題度: 高（X言及 ${MENTIONS}件）"
    elif [ "$MENTIONS" -gt 0 ]; then
        TREND="📊 注目度: 中（X言及 ${MENTIONS}件）"
    else
        TREND="📊 注目度: 中（GitHub⭐のみ）"
    fi
    
    # このClawdbotに追加するとどうなるかを生成
    CLAWDBOT_IMPACT=""
    case "$NAME" in
        *"fastmcp"*|*"fast-mcp"*)
            CLAWDBOT_IMPACT="Pythonスクリプトを書くだけで、新しいMCPサーバーを簡単に追加できるようになる。現在手動でやっている作業が大幅に効率化される"
            ;;
        *"activepieces"*)
            CLAWDBOT_IMPACT="複数のツールを連携させた自動化が可能に。例: 毎朝のリサーチ結果をSlack/Discord/Notionに同時投稿、といった連携が簡単に設定できる"
            ;;
        *"genai-toolbox"*|*"mcp-toolbox"*)
            CLAWDBOT_IMPACT="データベースへの自然言語クエリが可能に。「昨日のリサーチ結果を検索して」といった指示でデータベースを直接操作できる"
            ;;
        *"playwright"*|*"browser"*)
            CLAWDBOT_IMPACT="ブラウザ操作がより高度に。JavaScript実行、スクリーンショット、PDF生成など、より複雑なWeb自動化が可能になる"
            ;;
        *"github"*|*"git"*)
            CLAWDBOT_IMPACT="GitHubの操作が自動化可能に。「このリポジトリの最新コミットを確認」「PRを作成」といった操作がチャットから直接できる"
            ;;
        *"slack"*|*"discord"*|*"telegram"*)
            CLAWDBOT_IMPACT="複数のメッセージングサービスを統合管理。1つのインターフェースから複数のチャットツールを操作できるようになる"
            ;;
        *"notion"*|*"obsidian"*)
            CLAWDBOT_IMPACT="ノート・ドキュメント管理が統合される。リサーチ結果やメモを自動でNotionに整理・保存できる"
            ;;
        *"calendar"*|*"schedule"*)
            CLAWDBOT_IMPACT="スケジュール管理を完全自動化。「明日の予定は？」「来週の会議を予約」といった操作がチャットから可能に"
            ;;
        *"weather"*)
            CLAWDBOT_IMPACT="天気情報を自動取得。「今日の天気は？」「明日傘いる？」といった質問にリアルタイムで回答できる"
            ;;
        *"mail"*|*"email"*)
            CLAWDBOT_IMPACT="メール操作を自動化。「未読メールを要約して」「重要なメールに返信」といった操作がAIから可能に"
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
    
    # X言及があれば抜粋表示
    if [ "$X_ENABLED" = true ] && [ "$MENTIONS" -gt 0 ]; then
        echo "**Xでの反応:**" >> "$REPORT_FILE"
        bird search "$NAME" -n 3 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[0:3] | .[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:100])...\"" ' \
            >> "$REPORT_FILE" 2>/dev/null || echo "- （データ取得失敗）" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
    
    # 参考URLを追加（公式ドキュメント・デモサイトなど）
    echo "**参考URL:**" >> "$REPORT_FILE"
    
    # よく知られたツールの公式リンクを追加
    case "$NAME" in
        *"fastmcp"*)
            echo "- 📖 ドキュメント: https://fastmcp.dev" >> "$REPORT_FILE"
            ;;
        *"activepieces"*)
            echo "- 📖 ドキュメント: https://www.activepieces.com/docs" >> "$REPORT_FILE"
            echo "- 🎮 デモ: https://cloud.activepieces.com" >> "$REPORT_FILE"
            ;;
        *"genai-toolbox"*)
            echo "- 📖 ドキュメント: https://googleapis.github.io/genai-toolbox/" >> "$REPORT_FILE"
            ;;
        *"playwright"*)
            echo "- 📖 ドキュメント: https://playwright.dev" >> "$REPORT_FILE"
            ;;
        *"github"*)
            echo "- 📖 GitHub MCP: https://github.com/modelcontextprotocol" >> "$REPORT_FILE"
            ;;
        *)
            # GitHubのREADMEリンク
            echo "- 📖 README: $URL#readme" >> "$REPORT_FILE"
            ;;
    esac
    
    cat >> "$REPORT_FILE" << FOOTER

**💬 やってみますか？**

---

FOOTER
    
    COUNTER=$((COUNTER + 1))
done

echo "" >> "$REPORT_FILE"
echo "📄 **詳細レポート:** \`$REPORT_FILE\`" >> "$REPORT_FILE"

echo "✅ レポート生成完了: $REPORT_FILE"

# ============================================
# 5. Discord投稿用の要約版を生成
# ============================================
DISCORD_FILE="$TEMP_DIR/discord_post.md"

cat > "$DISCORD_FILE" << 'HEADER'
# 🔥 Clawdbot/Claude関連の最新情報

前日（24時間以内）に更新されたClawdbot/Claude/MCP/Skills関連情報を厳選5件ピックアップっぴ！ 🦜  
（※ 見つからない場合は過去1週間以内に範囲を拡大）

---

HEADER

# トップ5をDiscord投稿用にフォーマット
COUNTER=1
echo "$TOP5_JSON" | jq -c '.[]' | while read -r item; do
    NAME=$(echo "$item" | jq -r '.name')
    OWNER=$(echo "$item" | jq -r '.owner.login')
    STARS=$(echo "$item" | jq -r '.stargazersCount')
    DESC=$(echo "$item" | jq -r '.description // "説明なし"')
    URL=$(echo "$item" | jq -r '.url')
    MENTIONS=$(echo "$item" | jq -r '.x_mentions')
    SCORE=$(echo "$item" | jq -r '.score')
    
    # 話題度判定
    if [ "$MENTIONS" -ge 3 ]; then
        TREND="🔥 話題度: 高（X言及 ${MENTIONS}件）"
    else
        TREND="📊 注目度: 中"
    fi
    
    # どうなる？を生成
    CLAWDBOT_IMPACT=""
    case "$NAME" in
        *"context7"*)
            CLAWDBOT_IMPACT="最新コードドキュメントをLLMとAIエディタに自動提供。コード補完・提案の精度が劇的に向上"
            ;;
        *"fastmcp"*|*"fast-mcp"*)
            CLAWDBOT_IMPACT="Pythonスクリプトを書くだけで新しいMCPサーバーを簡単に追加できる。手動作業が大幅効率化"
            ;;
        *"activepieces"*)
            CLAWDBOT_IMPACT="複数ツール連携自動化が可能に。例: リサーチ結果→Slack/Discord/Notionに同時投稿"
            ;;
        *"genai-toolbox"*|*"mcp-toolbox"*)
            CLAWDBOT_IMPACT="データベースへの自然言語クエリが可能に。「昨日のリサーチ結果を検索して」でDB直接操作"
            ;;
        *"kreuzberg"*)
            CLAWDBOT_IMPACT="PDF/Office/画像など75種類以上の文書から自動でテキスト・メタデータ抽出。議事録→要約、請求書OCR→DB化が可能に"
            ;;
        *"playwright"*|*"browser"*)
            CLAWDBOT_IMPACT="ブラウザ操作がより高度に。JavaScript実行、スクリーンショット、PDF生成など複雑なWeb自動化が可能"
            ;;
        *"github"*|*"git"*)
            CLAWDBOT_IMPACT="GitHubの操作が自動化可能に。「このリポジトリの最新コミットを確認」「PRを作成」がチャットから直接できる"
            ;;
        *)
            CLAWDBOT_IMPACT="$DESC"
            ;;
    esac
    
    cat >> "$DISCORD_FILE" << ITEM

## $COUNTER. **$NAME** by $OWNER

**⭐ $(printf "%'d" $STARS)** | $TREND

**どうなる？**  
$CLAWDBOT_IMPACT

ITEM
    
    # X言及があれば抜粋表示（2件のみ、短縮版）
    if [ "$X_ENABLED" = true ] && [ "$MENTIONS" -gt 0 ]; then
        echo "**Xでの声:**" >> "$DISCORD_FILE"
        bird search "$NAME" -n 2 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>/dev/null | \
            jq -r '.[0:2] | .[] | "- @\(.author.username): \"\(.text | gsub("\n"; " ") | .[0:80])...\"" ' \
            >> "$DISCORD_FILE" 2>/dev/null || echo "- （取得失敗）" >> "$DISCORD_FILE"
        echo "" >> "$DISCORD_FILE"
    fi
    
    # 参考URLを追加
    echo "**参考URL:** $URL" >> "$DISCORD_FILE"
    
    cat >> "$DISCORD_FILE" << FOOTER

**💬 やってみますか？**

---

FOOTER
    
    COUNTER=$((COUNTER + 1))
done

echo "" >> "$DISCORD_FILE"
echo "📄 詳細: \`$REPORT_FILE\`" >> "$DISCORD_FILE"

echo "📤 Discord投稿用ファイル生成完了: $DISCORD_FILE"

# ============================================
# 7. Discord投稿（Webhook経由）
# ============================================
echo ""
echo "📢 Discord投稿中..."

# 簡易通知メッセージ
NOTIFICATION="🔔 **毎朝リサーチ完了！**

**日付:** $TODAY

✅ 話題のAIツール5件を厳選しました！

📰 AIトレンドも含まれています

詳細レポートを投稿します..."

# Webhook経由で通知（環境変数が設定されている場合のみ）
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    /root/clawd/scripts/discord-webhook-post.sh "$NOTIFICATION"
    
    # レポート本文も投稿（長いので分割が必要な場合は後で対応）
    # 今は簡易通知のみ
    
    echo "✅ Discord投稿完了"
else
    echo "⚠️ DISCORD_WEBHOOK_URL が未設定"
    echo "📍 フラグファイルを作成します（手動投稿が必要）"
    
    # フラグファイル作成（Webhook未設定時のフォールバック）
    DISCORD_PENDING_FLAG="/root/clawd/.discord_post_pending"
    echo "$TODAY" > "$DISCORD_PENDING_FLAG"
    echo "$REPORT_FILE" >> "$DISCORD_PENDING_FLAG"
    echo "1470296869870506156" >> "$DISCORD_PENDING_FLAG"
fi

echo ""
echo "🐥 リサーチ完了！"
