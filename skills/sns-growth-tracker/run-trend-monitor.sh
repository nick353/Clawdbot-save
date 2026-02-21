#!/bin/bash
# SNSトレンド監視スクリプト
# 毎日09:00 UTCに自動実行

set -e

SKILL_DIR="/root/clawd/skills/sns-growth-tracker"
LOG_FILE="$SKILL_DIR/data/logs/trend-monitor-$(date +%Y%m%d).log"

echo "=== SNSトレンド監視開始 ===" | tee -a "$LOG_FILE"
date | tee -a "$LOG_FILE"

# trend-monitor.py を実行
python3 "$SKILL_DIR/scripts/trend-monitor.py" 2>&1 | tee -a "$LOG_FILE"

# 完了通知
echo "=== トレンド監視完了 ===" | tee -a "$LOG_FILE"

# Discord通知
clawdbot message send \
    --target 1470060780111007950 \
    --message "📊 **今日のSNSトレンド監視が完了しましたっぴ！**

バズっている投稿を分析してGoogle Sheetsに記録しました。
次回投稿の参考にできますっぴ！🔥" \
    2>&1 | tee -a "$LOG_FILE"
