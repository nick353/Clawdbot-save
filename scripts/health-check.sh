#!/bin/bash
# Clawdbot Gateway ヘルスチェックスクリプト
# 定期的に実行してプロセスの生存確認

set -e

LOG_FILE="/root/clawd/.clawdbot-backup/logs/health-check.log"
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
      -d "{\"content\": \"🚨 **Health Check Alert**\n$MESSAGE\"}" \
      > /dev/null 2>&1 || true
  fi
}

# 1. プロセス確認
if ! pgrep -f "clawdbot-gateway" > /dev/null; then
  log "❌ ERROR: clawdbot-gateway プロセスが見つかりません"
  notify_discord "Gateway プロセスが停止しています！"
  exit 1
fi

# 2. HTTP応答確認（ポート確認を兼ねる）
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:8080/ 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
  log "❌ ERROR: Gateway が応答しません（ポート8080）"
  notify_discord "Gateway ポート8080が応答しません"
  exit 1
elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "302" ]; then
  log "✅ Gateway が応答しています (HTTP $HTTP_CODE)"
else
  log "⚠️  WARNING: 予期しないHTTPコード: $HTTP_CODE"
fi

log "✅ Health check passed"
exit 0
