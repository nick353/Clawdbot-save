#!/bin/bash
# ログ出力最適化スクリプト

# ログディレクトリ作成
mkdir -p /root/clawd/logs

# ログファイルに出力（Discordには送信しない）
export CLAWDBOT_LOG_FILE="/root/clawd/logs/background-tasks.log"

# ログレベル設定（INFO → WARNING）
export CLAWDBOT_LOG_LEVEL="WARNING"

echo "✅ ログ設定完了"
echo "📁 ログファイル: $CLAWDBOT_LOG_FILE"
echo "📊 ログレベル: $CLAWDBOT_LOG_LEVEL"
