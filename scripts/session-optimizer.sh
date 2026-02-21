#!/bin/bash
# セッションオプティマイザー - リセット閾値を60%に変更

LOGFILE="/root/clawd/.session-optimizer.log"
LAST_WEEKLY_RESET="/root/clawd/.last_weekly_reset"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# セッションキーからチャンネルIDを推定
get_channel_from_session_key() {
    local SESSION_KEY="$1"
    
    if [[ "$SESSION_KEY" =~ disco.*([0-9]{15,18}) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo "1464650064357232948"  # #一般にフォールバック
    fi
}

# 1. トークン使用率60%チェック（改善版）
check_token_usage() {
    log "📊 トークン使用率チェック開始（60%閾値）"
    
    clawdbot sessions list --limit 50 2>/dev/null | tail -n +4 | while IFS= read -r line; do
        if [[ "$line" =~ \(([0-9]+)%\) ]]; then
            PERCENTAGE="${BASH_REMATCH[1]}"
            KEY=$(echo "$line" | awk '{print $2}')
            
            # 60%以上でリセット（改善）
            if [ "$PERCENTAGE" -ge 60 ]; then
                log "⚠️ セッション「$KEY」が60%超え（$PERCENTAGE%）- リセット実行"
                
                # memory保存（重要な会話を自動保存）
                log "💾 重要な情報をmemoryに保存中..."
                bash /root/clawd/scripts/aggressive-memory-saver.sh 2>/dev/null || true
                
                # セッションリセット
                log "🔄 セッションリセット中..."
                clawdbot sessions reset --session "$KEY" 2>/dev/null && log "✅ リセット成功: $KEY" || log "❌ リセット失敗: $KEY"
            fi
        fi
    done
    
    log "✅ トークン使用率チェック完了"
}

# 2. 週2回の定期リセット（改善）
check_weekly_reset() {
    log "📅 週次リセットチェック開始（週2回）"
    
    if [ -f "$LAST_WEEKLY_RESET" ]; then
        LAST_RESET=$(cat "$LAST_WEEKLY_RESET")
        DAYS_SINCE=$((( $(date +%s) - $(date -d "$LAST_RESET" +%s) ) / 86400))
        
        # 3日以上経過していれば実行（週2回）
        if [ "$DAYS_SINCE" -lt 3 ]; then
            log "ℹ️ 前回のリセットから${DAYS_SINCE}日経過（3日未満のためスキップ）"
            return
        fi
    fi
    
    log "🔄 定期リセットを実行します（週2回体制）"
    
    # 全セッションをリセット
    clawdbot sessions list --limit 50 2>/dev/null | tail -n +4 | while IFS= read -r line; do
        KEY=$(echo "$line" | awk '{print $2}')
        
        log "🧹 セッション「$KEY」をリセット中..."
        
        # memory保存
        bash /root/clawd/scripts/aggressive-memory-saver.sh 2>/dev/null || true
        
        # セッションリセット
        clawdbot sessions reset --session "$KEY" 2>/dev/null && log "✅ リセット成功: $KEY" || log "❌ リセット失敗: $KEY"
    done
    
    date +%Y-%m-%d > "$LAST_WEEKLY_RESET"
    log "✅ 定期リセット完了（次回: $(date -d '+3 days' +%Y-%m-%d)）"
}

# メイン実行
main() {
    log "🚀 セッションオプティマイザー開始（60%閾値 + 週2回）"
    
    # 1. トークン使用率チェック（60%超）
    check_token_usage
    
    # 2. 週次リセットチェック（週2回）
    check_weekly_reset
    
    log "✅ セッションオプティマイザー完了"
}

main
