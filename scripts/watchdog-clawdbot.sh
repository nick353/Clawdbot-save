#!/bin/bash
# Clawdbot ウォッチドッグ - クラッシュ時に自動再起動
# cron: */3 * * * * (3分ごと)

LOG_FILE="/root/clawd/data/watchdog-clawdbot.log"
mkdir -p "$(dirname "$LOG_FILE")"

# clawdbot が動いているか確認
if pgrep -x "clawdbot" > /dev/null 2>&1; then
    exit 0
fi

# 停止していたら再起動
echo "[$(date '+%Y-%m-%d %H:%M:%S')] clawdbot が停止していたため再起動します" >> "$LOG_FILE"

# 設定検証
if ! clawdbot status > /dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 設定エラー: clawdbot doctor --fix を実行します" >> "$LOG_FILE"
    clawdbot doctor --fix >> "$LOG_FILE" 2>&1 || true
fi

# 再起動
nohup clawdbot >> "$LOG_FILE" 2>&1 &
sleep 5

if pgrep -x "clawdbot" > /dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ clawdbot 再起動成功 (PID: $(pgrep -x clawdbot | head -1))" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ clawdbot 再起動失敗" >> "$LOG_FILE"
fi
