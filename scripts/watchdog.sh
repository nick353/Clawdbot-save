#!/bin/bash
# Clawdbot Watchdog - プロセス監視＋自動再起動
# systemdやsupervisordの代わりにDockerコンテナ内で動作

set -e

LOG_FILE="/root/clawd/.clawdbot-backup/logs/watchdog.log"
mkdir -p "$(dirname "$LOG_FILE")"

# ログ出力関数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Discord通知関数
notify_discord() {
  local MESSAGE="$1"
  local WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

  if [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"content\": \"🔄 **Watchdog Alert**\n$MESSAGE\"}" \
      > /dev/null 2>&1 || true
  fi
}

log "🐕 Watchdog started"

# 連続失敗カウンター
FAIL_COUNT=0
MAX_FAILS=3

while true; do
  # ヘルスチェック実行
  if bash /root/clawd/scripts/health-check.sh >> "$LOG_FILE" 2>&1; then
    FAIL_COUNT=0
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log "⚠️  Health check failed (attempt $FAIL_COUNT/$MAX_FAILS)"

    if [ $FAIL_COUNT -ge $MAX_FAILS ]; then
      log "❌ 連続失敗が閾値を超えました。プロセスを確認します..."

      # プロセスが完全に停止している場合
      if ! pgrep -f "clawdbot-gateway" > /dev/null; then
        log "🚨 プロセスが停止しています！再起動を試みます..."
        notify_discord "Gateway プロセスが停止しました。再起動を試行中..."

        # 再起動（Docker環境では通常コンテナが再起動される）
        # 手動で起動する場合のコマンド例：
        # cd /root/clawd && node dist/index.js gateway --bind lan --port 8080 &

        log "⚠️  Docker環境ではコンテナの再起動が必要です"
        notify_discord "コンテナの再起動が必要です。Zeaburダッシュボードで確認してください。"
      fi

      FAIL_COUNT=0
    fi
  fi

  # 30秒ごとにチェック
  sleep 30
done
