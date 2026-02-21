#!/bin/bash
# 完了タスクの自動チェック＆報告
# 毎回の返信前に実行すべきスクリプト

set -e

RUNNING_TASKS="/root/clawd/RUNNING_TASKS.md"
DISCORD_CHANNEL="1464650064357232948"  # #一般

echo "🔍 完了タスクをチェック中..."

# process listから完了タスクを取得
COMPLETED_TASKS=$(clawdbot process list 2>/dev/null | grep "completed" || echo "")

if [ -z "$COMPLETED_TASKS" ]; then
    echo "✅ 完了タスクなし"
    exit 0
fi

# 完了タスク数をカウント
TASK_COUNT=$(echo "$COMPLETED_TASKS" | wc -l)

echo "⚠️ 完了タスクが $TASK_COUNT 件見つかりました！"
echo ""
echo "$COMPLETED_TASKS"
echo ""

# RUNNING_TASKS.mdと照合
echo "📋 RUNNING_TASKS.mdと照合中..."

# 実行中タスクセクションをチェック
RUNNING_SECTION=$(sed -n '/## 🔄 実行中/,/## ✅ 完了済み/p' "$RUNNING_TASKS" | grep -v "^##" | grep -v "^*" | grep -v "^$" | grep -v "最終確認" | grep -v "確認方法" | grep -v "結果" || echo "")

if [ -n "$RUNNING_SECTION" ]; then
    echo "⚠️ 警告: RUNNING_TASKS.mdに未報告の実行中タスクがあります！"
    echo "$RUNNING_SECTION"
    echo ""
    echo "📢 すぐに報告が必要です！"
fi

echo ""
echo "🎯 アクション: 完了タスクを確認して報告してください"

exit 1  # 報告が必要な場合はエラー終了
