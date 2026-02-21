#!/usr/bin/env bash
#
# Bitget自動トレーダー監視＋自動再起動スクリプト
# cronで5分ごとに実行推奨: */5 * * * * /root/clawd/scripts/watchdog-bitget-trader.sh
#

set -euo pipefail

SCRIPT_PATH="/root/clawd/scripts/bitget-trader-v2.py"
LOG_PATH="/root/clawd/data/trader-v2.log"
WATCHDOG_LOG="/root/clawd/data/watchdog.log"
DISCORD_CHANNEL="1471389526592327875"

# ログ出力ヘルパー
log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$WATCHDOG_LOG"
}

# Discord通知
notify() {
    local message="$1"
    clawdbot message send --target "$DISCORD_CHANNEL" --message "$message" &>/dev/null || true
}

# プロセス確認
if pgrep -f "python.*bitget-trader-v2.py" >/dev/null; then
    log "✅ プロセス実行中"
    
    # ログファイルの最終更新時刻確認（15分以上更新がなければ異常）
    if [ -f "$LOG_PATH" ]; then
        last_modified=$(stat -c %Y "$LOG_PATH")
        current_time=$(date +%s)
        elapsed=$((current_time - last_modified))
        
        if [ $elapsed -gt 900 ]; then
            log "⚠️  ログ更新停滞（${elapsed}秒前） - プロセス強制再起動"
            pkill -9 -f "python.*bitget-trader-v2.py" || true
            sleep 2
            
            cd /root/clawd
            # setsidで新しいセッションを作成（cgroupから切り離し）
            setsid nohup python3 -u "$SCRIPT_PATH" >> "$LOG_PATH" 2>&1 &
            
            log "🔄 プロセス再起動完了（setsid使用）"
            notify "🔄 **Bitget自動トレーダー再起動**

**理由:** ログ更新停滞（${elapsed}秒間）
**時刻:** $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
        fi
    fi
else
    log "❌ プロセス停止検知 - 自動再起動開始"
    
    cd /root/clawd
    # setsidで新しいセッションを作成（cgroupから切り離し）
    setsid nohup python3 -u "$SCRIPT_PATH" >> "$LOG_PATH" 2>&1 &
    
    log "✅ プロセス再起動完了（setsid使用）"
    notify "🚨 **Bitget自動トレーダー停止検知**

**対応:** 自動再起動完了
**時刻:** $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
fi
