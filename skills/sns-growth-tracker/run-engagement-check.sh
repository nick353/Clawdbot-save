#!/bin/bash
# エンゲージメント自動チェックスクリプト（定期実行用）

SKILL_DIR="/root/clawd/skills/sns-growth-tracker"
VENV_PYTHON="$SKILL_DIR/venv/bin/python3"
SCHEDULER_SCRIPT="$SKILL_DIR/scripts/schedule-engagement-tracking.py"

cd "$SKILL_DIR"

echo "🔍 エンゲージメント追跡スケジュールをチェック中..."
echo "実行時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# スケジュールチェック & 実行
"$VENV_PYTHON" "$SCHEDULER_SCRIPT" check

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ エンゲージメントチェック完了"
else
    echo ""
    echo "❌ エンゲージメントチェックでエラーが発生しました (終了コード: $exit_code)"
fi

exit $exit_code
