#!/bin/bash
# バックグラウンドタスク開始時の自動記録

TASK_NAME="$1"
CHANNEL="$2"
COMMAND="$3"

if [ -z "$TASK_NAME" ] || [ -z "$CHANNEL" ] || [ -z "$COMMAND" ]; then
    echo "Usage: start-task.sh <task_name> <channel> <command>"
    exit 1
fi

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
RUNNING_TASKS="/root/clawd/RUNNING_TASKS.md"

# タスクを記録
cat >> "$RUNNING_TASKS" <<EOF

### $TASK_NAME
- **開始時刻:** $TIMESTAMP
- **報告先:** $CHANNEL
- **コマンド:** $COMMAND
- **状態:** 🔄 実行中

EOF

echo "📝 タスクを記録しました: $TASK_NAME"
echo "📍 報告先: $CHANNEL"

# コマンド実行
eval "$COMMAND"
