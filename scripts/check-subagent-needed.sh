#!/bin/bash
# サブエージェント使用判定スクリプト

TASK_DESC="$1"

echo "=== サブエージェント使用判定 ==="
echo "タスク: $TASK_DESC"
echo ""

# キーワードチェック
KEYWORDS="分析|実装|バックテスト|生成|作成|スキル|長時間|大量"

if echo "$TASK_DESC" | grep -iE "$KEYWORDS" > /dev/null; then
    echo "🔴 キーワード検出: サブエージェント推奨"
    echo "   該当: $(echo "$TASK_DESC" | grep -oiE "$KEYWORDS" | head -1)"
    echo ""
fi

# 予想ツール呼び出し数
read -p "予想ツール呼び出し数: " TOOL_CALLS

if [ "$TOOL_CALLS" -ge 5 ]; then
    echo "🔴 5回以上のツール呼び出し: サブエージェント必須"
    echo ""
fi

# 予想時間
read -p "予想所要時間（分）: " DURATION

if [ "$DURATION" -ge 5 ]; then
    echo "🔴 5分以上かかる: サブエージェント必須"
    echo ""
fi

# 結論
if echo "$TASK_DESC" | grep -iE "$KEYWORDS" > /dev/null || [ "$TOOL_CALLS" -ge 5 ] || [ "$DURATION" -ge 5 ]; then
    echo "======================================"
    echo "✅ 結論: サブエージェント使用"
    echo "======================================"
    exit 0
else
    echo "======================================"
    echo "⚪ 結論: メインセッションで実行可"
    echo "======================================"
    exit 1
fi
