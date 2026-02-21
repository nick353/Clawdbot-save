#!/bin/bash
# Clawdbot自己成長型リサーチシステム
# 毎朝、最新のSkills・MCP・Tips・事例を収集して報告

set -e

TODAY=$(date +%Y-%m-%d)
RESEARCH_DIR="/root/clawd/research"
REPORT_FILE="$RESEARCH_DIR/$TODAY.md"

mkdir -p "$RESEARCH_DIR"

echo "🔍 Clawdbotリサーチ開始: $TODAY"

# ============================================
# 1. X（Twitter）検索 【メイン】
# ============================================
echo "## 🐦 X（Twitter）最新情報" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# X認証情報の確認（環境変数: AUTH_TOKEN, CT0）
if [ -n "$AUTH_TOKEN" ] && [ -n "$CT0" ]; then
    # より幅広いキーワードで検索（Skills、MCP、Tips、事例、自動化）
    KEYWORDS=("Clawdbot" "MCP server" "MCP" "automation tool" "AI automation" "workflow automation" "clawdbot skill" "#clawdbot")
    
    X_SEARCH_TOTAL=0
    X_SEARCH_FAILED=0

    for keyword in "${KEYWORDS[@]}"; do
        echo "### 🔍 $keyword" >> "$REPORT_FILE"
        
        # 検索数を20件に増やして最新情報をキャッチ
        SEARCH_RESULT=$(bird search "$keyword" -n 20 --json --auth-token "$AUTH_TOKEN" --ct0 "$CT0" 2>&1)
        SEARCH_EXIT=$?
        
        if [ $SEARCH_EXIT -eq 0 ] && [ -n "$SEARCH_RESULT" ]; then
            TWEETS=$(echo "$SEARCH_RESULT" | jq -r '.[] | "- **[@\(.author.username)](https://x.com/\(.author.username)/status/\(.id))** (\(.createdAt | split(" ")[1:4] | join(" ")))\n  > \(.text | gsub("\n"; " ") | if length > 200 then .[0:200] + "..." else . end)\n"' 2>/dev/null)
            if [ -n "$TWEETS" ]; then
                echo "$TWEETS" >> "$REPORT_FILE"
                X_SEARCH_TOTAL=$((X_SEARCH_TOTAL + 1))
            else
                echo "  - 検索結果なし" >> "$REPORT_FILE"
            fi
        else
            echo "  - ❌ 検索エラー（終了コード: $SEARCH_EXIT）" >> "$REPORT_FILE"
            X_SEARCH_FAILED=$((X_SEARCH_FAILED + 1))
        fi
        
        echo "" >> "$REPORT_FILE"
    done
    
    # X検索が全て失敗/空だった場合は警告を追加
    if [ $X_SEARCH_TOTAL -eq 0 ]; then
        echo "---" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "⚠️ **警告:** X検索が全て空またはエラーでした（成功: $X_SEARCH_TOTAL, 失敗: $X_SEARCH_FAILED）。" >> "$REPORT_FILE"
        echo "- 認証情報（AUTH_TOKEN, CT0）を確認してください" >> "$REPORT_FILE"
        echo "- または、Xのレート制限に達している可能性があります" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
else
    echo "- ⚠️ X認証情報が未設定（AUTH_TOKEN, CT0 環境変数が必要）" >> "$REPORT_FILE"
    echo "- GitHubのリサーチのみ実行中" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================
# 2. GitHub - 最新リポジトリ 【メイン】
# ============================================
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 🐙 GitHub - 最新MCPサーバー＆Clawdbot関連" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if command -v gh &> /dev/null; then
    # MCPサーバー（最新順、10件）
    echo "### 📦 MCPサーバー" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    gh search repos "MCP server" --sort updated --limit 10 --json name,owner,description,url,stargazersCount,updatedAt 2>/dev/null | \
        jq -r '.[] | "- **\(.name)** by \(.owner.login) ⭐\(.stargazersCount)\n  - \(.description // "説明なし")\n  - \(.url)\n  - 更新: \(.updatedAt | split("T")[0])\n"' \
        >> "$REPORT_FILE" || echo "- GitHub検索エラー\n" >> "$REPORT_FILE"
    
    echo "" >> "$REPORT_FILE"
    
    # Clawdbot関連（最新順、10件）
    echo "### 🐥 Clawdbot関連" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    gh search repos "clawdbot OR clawd" --sort updated --limit 10 --json name,owner,description,url,stargazersCount,updatedAt 2>/dev/null | \
        jq -r '.[] | "- **\(.name)** by \(.owner.login) ⭐\(.stargazersCount)\n  - \(.description // "説明なし")\n  - \(.url)\n  - 更新: \(.updatedAt | split("T")[0])\n"' \
        >> "$REPORT_FILE" || echo "- GitHub検索エラー\n" >> "$REPORT_FILE"
    
    echo "" >> "$REPORT_FILE"
    
    # AI Agent Skills（最新順、10件）
    echo "### 🤖 AI Agent Skills" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    gh search repos "AI agent skill OR claude skill" --sort updated --limit 10 --json name,owner,description,url,stargazersCount,updatedAt 2>/dev/null | \
        jq -r '.[] | "- **\(.name)** by \(.owner.login) ⭐\(.stargazersCount)\n  - \(.description // "説明なし")\n  - \(.url)\n  - 更新: \(.updatedAt | split("T")[0])\n"' \
        >> "$REPORT_FILE" || echo "- GitHub検索エラー\n" >> "$REPORT_FILE"
else
    echo "- gh CLI未インストール" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# ============================================
# 3. ClawdHub - 補足情報
# ============================================
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 🔧 ClawdHub（補足）" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 厳選キーワードのみ（軽量化）
SKILL_KEYWORDS=("memory" "MCP" "automation")

for skill_keyword in "${SKILL_KEYWORDS[@]}"; do
    echo "### $skill_keyword" >> "$REPORT_FILE"
    clawdhub search "$skill_keyword" --limit 2 2>/dev/null | \
        awk '/^[a-z]/ {print "- **"$1"**"}' \
        >> "$REPORT_FILE" || echo "  - 検索結果なし" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"

# ============================================
# 5. インストール候補リスト生成
# ============================================
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 🎯 インストール候補（番号で選択）" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# GitHub MCPサーバーから番号付きリスト生成（スタイル2: ボックス風）
echo '```' >> "$REPORT_FILE"
echo "📦 MCPサーバー（最新5件）" >> "$REPORT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━" >> "$REPORT_FILE"
if command -v gh &> /dev/null; then
    gh search repos "MCP server" --sort updated --limit 5 --json name,owner,description,stargazersCount 2>/dev/null | \
        jq -r 'to_entries | .[] | 
            (["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣"][.key]) + " \(.value.name) ⭐\(.value.stargazersCount)\n" +
            "   " + 
            (if (.value.description // "") | test("PDF|document|extract"; "i") then "文書から自動でデータ抽出"
             elif (.value.description // "") | test("Mattermost|chat|message"; "i") then "チャットをAI操作"
             elif (.value.description // "") | test("Android|mobile|accessibility"; "i") then "スマホアプリ自動操作"
             elif (.value.description // "") | test("icon|image|visual"; "i") then "アイコン素材アクセス"
             elif (.value.description // "") | test("manage|CLI|install"; "i") then "MCP管理を簡単に"
             elif (.value.description // "") | test("spatial|data|analyze"; "i") then "専門データ分析"
             elif (.value.description // "") | test("calendar|schedule"; "i") then "予定管理を自動化"
             elif (.value.description // "") | test("currency|exchange|rate"; "i") then "為替レート自動換算"
             elif (.value.description // "") | test("stock|market|NEPSE"; "i") then "株式市場データ分析"
             elif (.value.description // "") | test("business|company|CNPJ"; "i") then "企業データ検索"
             else "新しいツール連携" end) + "\n"' \
        >> "$REPORT_FILE" || echo "検索エラー\n" >> "$REPORT_FILE"
else
    echo "gh CLI未インストール\n" >> "$REPORT_FILE"
fi
echo '```' >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"

# ClawdHub Skillsから番号付きリスト生成（スタイル2: ボックス風）
echo '```' >> "$REPORT_FILE"
echo "🔧 ClawdHub Skills（推奨6件）" >> "$REPORT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━" >> "$REPORT_FILE"
echo "6️⃣ elite-longterm-memory ✅" >> "$REPORT_FILE"

SKILL_COUNT=7
clawdhub search "memory" --limit 1 2>/dev/null | \
    awk -v num=$SKILL_COUNT '/^[a-z]/ && !/elite-longterm/ {print "7️⃣ "$1}' \
    >> "$REPORT_FILE" 2>/dev/null || true

clawdhub search "MCP" --limit 2 2>/dev/null | \
    awk '/^[a-z]/ {if (NR==1) print "8️⃣ "$1; else if (NR==2) print "9️⃣ "$1}' \
    >> "$REPORT_FILE" 2>/dev/null || true

clawdhub search "automation" --limit 2 2>/dev/null | \
    awk '/^[a-z]/ {if (NR==1) print "🔟 "$1; else if (NR==2) print "1️⃣1️⃣ "$1}' \
    >> "$REPORT_FILE" 2>/dev/null || true

echo '```' >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**💬 欲しいものを番号で教えてください！**" >> "$REPORT_FILE"
echo "**📄 詳細レポート:** \`/root/clawd/research/$TODAY.md\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# ============================================
# 6. 完了報告＆Discord投稿
# ============================================
DISCORD_CHANNEL_ID="${RESEARCH_DISCORD_CHANNEL:-1470296869870506156}"

if [ -f "$REPORT_FILE" ]; then
    # 警告やエラーをチェック
    WARNINGS=$(grep -c "⚠️" "$REPORT_FILE" || echo "0")
    ERRORS=$(grep -c "❌" "$REPORT_FILE" || echo "0")
    
    echo "✅ リサーチ完了: $REPORT_FILE"
    
    # 警告/エラーがある場合は明示的に報告
    if [ "$WARNINGS" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
        echo "⚠️ 警告: $WARNINGS 件、エラー: $ERRORS 件が検出されました"
        echo "📄 レポートを確認してください: $REPORT_FILE"
    fi
    
    echo "📤 Discord (#自己強化の間) に投稿中..."
    
    # レポート内容をDiscordに投稿
    if clawdbot message send --target "$DISCORD_CHANNEL_ID" --message "$(cat "$REPORT_FILE")" 2>/dev/null; then
        echo "✅ Discord投稿完了"
        
        # 警告がある場合は追加メッセージを投稿
        if [ "$WARNINGS" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
            clawdbot message send --target "$DISCORD_CHANNEL_ID" --message "⚠️ **注意:** 警告 $WARNINGS 件、エラー $ERRORS 件が検出されました。上記レポートを確認してください。" 2>/dev/null
        fi
    else
        echo "❌ Discord投稿失敗"
        echo "⚠️ 手動で確認してください: $REPORT_FILE"
    fi
else
    echo "❌ レポートファイルが見つかりません: $REPORT_FILE"
    exit 1
fi

echo ""
echo "🐥 リサーチ完了！"
echo "📍 レポート: $REPORT_FILE"
echo "📍 Discord: #自己強化の間"
