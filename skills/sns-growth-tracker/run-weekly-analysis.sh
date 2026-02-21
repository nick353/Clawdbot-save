#!/bin/bash
# SNS週次分析スクリプト
# 毎週月曜08:00 UTCに自動実行

set -e

SKILL_DIR="/root/clawd/skills/sns-growth-tracker"
LOG_FILE="$SKILL_DIR/data/logs/weekly-analysis-$(date +%Y%m%d).log"

echo "=== SNS週次分析開始 ===" | tee -a "$LOG_FILE"
date | tee -a "$LOG_FILE"

# weekly-analysis.py を実行
python3 "$SKILL_DIR/scripts/weekly-analysis.py" 2>&1 | tee -a "$LOG_FILE"

# レポート取得
REPORT_FILE="$SKILL_DIR/data/reports/weekly-$(date +%Y%m%d).md"

if [ -f "$REPORT_FILE" ]; then
    echo "✅ レポート生成完了: $REPORT_FILE" | tee -a "$LOG_FILE"
    
    # Discordに投稿（ファイル添付）
    clawdbot message send \
        --target 1470060780111007950 \
        --message "📊 **週次SNS分析レポート完成しましたっぴ！**

過去1週間のデータを分析しました。
詳細はGoogle Sheetsで確認できますっぴ！📈" \
        2>&1 | tee -a "$LOG_FILE"
else
    echo "⚠️ レポートファイルが見つかりません" | tee -a "$LOG_FILE"
fi

echo "=== 週次分析完了 ===" | tee -a "$LOG_FILE"
