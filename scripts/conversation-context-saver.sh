#!/bin/bash
# conversation-context-saver.sh
# 会話の要点を Obsidian に自動保存するスクリプト

VAULT_PATH="/root/obsidian-vault/daily"
CURRENT_DATE=$(date '+%Y-%m-%d')
CURRENT_TIME=$(date '+%H:%M:%S')
VAULT_DAILY="$VAULT_PATH/${CURRENT_DATE}.md"

# 引数: $1 = カテゴリ（task/decision/note/conversation）
# 引数: $2 = 会話内容
CATEGORY="${1:-note}"
CONTENT="${2:-No content provided}"

mkdir -p "$VAULT_PATH"

if [ ! -f "$VAULT_DAILY" ]; then
    cat > "$VAULT_DAILY" << EOF
# $CURRENT_DATE

## 会話ログ

EOF
fi

case "$CATEGORY" in
    task)
        echo "### 🎯 タスク - $CURRENT_TIME UTC" >> "$VAULT_DAILY"
        ;;
    decision)
        echo "### 🔴 決定事項 - $CURRENT_TIME UTC" >> "$VAULT_DAILY"
        ;;
    conversation)
        echo "### 💬 会話 - $CURRENT_TIME UTC" >> "$VAULT_DAILY"
        ;;
    *)
        echo "### 📝 メモ - $CURRENT_TIME UTC" >> "$VAULT_DAILY"
        ;;
esac

echo "$CONTENT" >> "$VAULT_DAILY"
echo "" >> "$VAULT_DAILY"

# Git 自動コミット
cd /root/clawd
git add -A 2>/dev/null
git commit -m "conversation: $CATEGORY @$CURRENT_TIME" 2>/dev/null || true

echo "✅ 会話を保存しました: $CATEGORY"
