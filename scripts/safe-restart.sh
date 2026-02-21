#!/bin/bash
# Safe Clawdbot Restart Script
# Always checks status before and after restart

set -e

echo "🔍 再起動前の状態確認..."
clawdbot status > /tmp/clawdbot-status-before.txt 2>&1 || true
cat /tmp/clawdbot-status-before.txt

echo ""
echo "🔄 Clawdbotを再起動します..."
clawdbot gateway restart > /tmp/clawdbot-restart.txt 2>&1 || {
    echo "⚠️ 再起動コマンドでメッセージが出ました"
    cat /tmp/clawdbot-restart.txt
}

echo ""
echo "⏳ 5秒待機中..."
sleep 5

echo ""
echo "✅ 再起動後の状態確認..."
clawdbot status > /tmp/clawdbot-status-after.txt 2>&1 || {
    echo "❌ 再起動後のステータス確認に失敗しました"
    exit 1
}
cat /tmp/clawdbot-status-after.txt

echo ""
echo "🎉 再起動完了っぴ！"
