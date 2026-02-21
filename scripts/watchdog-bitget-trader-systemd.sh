#!/usr/bin/env bash
#
# Bitget自動トレーダー監視（systemdサービス版・改良版）
# cronで5分ごとに実行推奨: */5 * * * * /root/clawd/scripts/watchdog-bitget-trader-systemd.sh
#
# 変更点：
# - ログ更新停滞チェックを削除（systemdが管理）
# - サービスが完全停止した場合のみ起動

set -euo pipefail

SERVICE_NAME="bitget-trader.service"
WATCHDOG_LOG="/root/clawd/data/watchdog.log"
DISCORD_CHANNEL="1471389526592327875"

# ログ出力ヘルパー
log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] $*" >> "$WATCHDOG_LOG"
}

# Discord通知
notify() {
    local message="$1"
    clawdbot message send --target "$DISCORD_CHANNEL" --message "$message" &>/dev/null || true
}

# サービスステータス確認（完全停止のみチェック）
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "✅ サービス正常稼働中"
else
    log "❌ サービス完全停止検知 - 自動起動"
    
    systemctl start "$SERVICE_NAME"
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "✅ サービス起動成功"
        notify "🚨 **Bitget自動トレーダー停止検知**

**対応:** systemdサービス自動起動成功
**時刻:** $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
    else
        log "❌ サービス起動失敗"
        notify "🚨 **Bitget自動トレーダー起動失敗**

**状態:** systemdサービスが起動できません
**時刻:** $(date -u '+%Y-%m-%d %H:%M:%S') UTC
**対応:** 手動確認が必要です"
    fi
fi
