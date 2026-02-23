#!/bin/bash
# Obsidian自動保存スクリプト
# Usage: obsidian-auto-save.sh <category> <message>
# Categories: task, decision, cron, note

VAULT_DIR="/root/obsidian-vault"
DAILY_DIR="$VAULT_DIR/daily"
PROJECTS_DIR="$VAULT_DIR/projects"

CATEGORY="$1"
MESSAGE="$2"

if [ -z "$CATEGORY" ] || [ -z "$MESSAGE" ]; then
    echo "Usage: $0 <category> <message>" >&2
    echo "Categories: task, decision, cron, note" >&2
    exit 1
fi

# 現在時刻（日本時間）
TIMESTAMP=$(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M:%S')
TODAY=$(TZ=Asia/Tokyo date '+%Y-%m-%d')
DAILY_NOTE="$DAILY_DIR/$TODAY.md"

# デイリーノートが存在しない場合は作成
if [ ! -f "$DAILY_NOTE" ]; then
    cat > "$DAILY_NOTE" <<EOF
# $TODAY

## Tasks

## Decisions

## Cron Jobs

## Notes

EOF
fi

# カテゴリ別に追記
case "$CATEGORY" in
    task)
        # Tasksセクションに追記
        sed -i "/^## Tasks$/a - [$TIMESTAMP] $MESSAGE" "$DAILY_NOTE"
        ;;
    decision)
        # Decisionsセクションに追記
        sed -i "/^## Decisions$/a - [$TIMESTAMP] $MESSAGE" "$DAILY_NOTE"
        # 重要な決定事項はprojects/にも保存
        DECISION_FILE="$PROJECTS_DIR/decisions.md"
        if [ ! -f "$DECISION_FILE" ]; then
            echo "# Important Decisions" > "$DECISION_FILE"
            echo "" >> "$DECISION_FILE"
        fi
        echo "## $TIMESTAMP" >> "$DECISION_FILE"
        echo "$MESSAGE" >> "$DECISION_FILE"
        echo "" >> "$DECISION_FILE"
        ;;
    cron)
        # Cron Jobsセクションに追記
        sed -i "/^## Cron Jobs$/a - [$TIMESTAMP] $MESSAGE" "$DAILY_NOTE"
        ;;
    note)
        # Notesセクションに追記
        sed -i "/^## Notes$/a - [$TIMESTAMP] $MESSAGE" "$DAILY_NOTE"
        ;;
    *)
        echo "Unknown category: $CATEGORY" >&2
        exit 1
        ;;
esac

echo "✅ Saved to Obsidian: $CATEGORY - $MESSAGE"

# Git自動commit （重要な情報は自動で履歴に）
if [ -f "/root/clawd/scripts/git-auto-commit.sh" ]; then
    bash /root/clawd/scripts/git-auto-commit.sh auto 2>/dev/null || true
fi
