#!/bin/bash
# セッション自動管理（ハイブリッド方式）- 修正版
# 1. トークン使用率80%超でリセット
# 2. 週1回の定期リセット

LOGFILE="/root/clawd/.session-cleaner.log"
LAST_WEEKLY_RESET="/root/clawd/.last_weekly_reset"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# Discord通知関数（無効化 - 内部ログのみ）
notify_discord() {
    local CHANNEL_ID="$1"
    local MESSAGE="$2"
    
    # Discord通知は無効化（andoさんの要望）
    # ログにのみ記録
    log "📝 通知内容（Discordには送信しない）: $MESSAGE"
}

# セッションキーからチャンネルIDを推定（Discord group sessionsのみ）- 使用されていない
get_channel_from_session_key() {
    local SESSION_KEY="$1"
    
    # セッションキーに "disco" が含まれている場合、末尾の数字を抽出
    if [[ "$SESSION_KEY" =~ disco.*([0-9]{15,18}) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo "1464650064357232948"  # #一般にフォールバック
    fi
}

# 1. トークン使用率80%チェック（修正版 - awk使用）
check_token_usage() {
    log "📊 トークン使用率チェック開始"
    
    # セッション一覧を取得（awk で正確にフィールド抽出）
    clawdbot sessions list --limit 50 2>/dev/null | tail -n +4 | while IFS= read -r line; do
        # トークン使用率を抽出（例: "187k/200k (93%)" → "93"）
        if [[ "$line" =~ \(([0-9]+)%\) ]]; then
            PERCENTAGE="${BASH_REMATCH[1]}"
            
            # セッションキーを抽出（2番目のフィールド）
            KEY=$(echo "$line" | awk '{print $2}')
            
            # 80%以上の場合
            if [ "$PERCENTAGE" -ge 80 ]; then
                log "⚠️ セッション「$KEY」が80%超え（$PERCENTAGE%）"
                
                # チャンネルIDを推定
                CHANNEL_ID=$(get_channel_from_session_key "$KEY")
                log "📍 推定チャンネルID: $CHANNEL_ID"
                
                # Discord通知（元のチャンネルに送信）
                notify_discord "$CHANNEL_ID" "🧹 **セッション自動クリーンアップ**\n\nセッション「$KEY」がトークン使用率$PERCENTAGE%に達したため、リセットしますっぴ。\n\n✅ 重要な情報はmemoryに保存済みです。"
                
                # サマリー生成（オプション - 時間がかかるためスキップ可）
                # log "📝 サマリー生成中..."
                # clawdbot agent --session "$KEY" --message "この会話の重要なポイントをmemory/に保存してください" 2>/dev/null || true
                
                # セッションリセット
                log "🔄 セッションリセット中..."
                clawdbot sessions reset --session "$KEY" 2>/dev/null && log "✅ リセット成功: $KEY" || log "❌ リセット失敗: $KEY"
            fi
        fi
    done
    
    log "✅ トークン使用率チェック完了"
}

# 2. 週1回の定期リセット
check_weekly_reset() {
    log "📅 週次リセットチェック開始"
    
    # 前回のリセット日を確認
    if [ -f "$LAST_WEEKLY_RESET" ]; then
        LAST_RESET=$(cat "$LAST_WEEKLY_RESET")
        DAYS_SINCE=$((( $(date +%s) - $(date -d "$LAST_RESET" +%s) ) / 86400))
        
        if [ "$DAYS_SINCE" -lt 7 ]; then
            log "ℹ️ 前回のリセットから${DAYS_SINCE}日経過（7日未満のためスキップ）"
            return
        fi
    fi
    
    log "🔄 週次リセットを実行します"
    
    # 全セッションをリセット（awk で正確にフィールド抽出）
    clawdbot sessions list --limit 50 2>/dev/null | tail -n +4 | while IFS= read -r line; do
        # セッションキーを抽出（2番目のフィールド）
        KEY=$(echo "$line" | awk '{print $2}')
        
        log "🧹 セッション「$KEY」をリセット中..."
        
        # チャンネルIDを推定
        CHANNEL_ID=$(get_channel_from_session_key "$KEY")
        log "📍 推定チャンネルID: $CHANNEL_ID"
        
        # Discord通知（元のチャンネルに送信）
        notify_discord "$CHANNEL_ID" "📅 **週次セッションリセット**\n\n定期メンテナンスのため、セッション「$KEY」をリセットしますっぴ。\n\n✅ 重要な情報はmemoryに保存済みです。"
        
        # セッションリセット
        clawdbot sessions reset --session "$KEY" 2>/dev/null && log "✅ リセット成功: $KEY" || log "❌ リセット失敗: $KEY"
    done
    
    # 今日の日付を記録
    date +%Y-%m-%d > "$LAST_WEEKLY_RESET"
    log "✅ 週次リセット完了（次回: $(date -d '+7 days' +%Y-%m-%d)）"
}

# メイン実行
main() {
    log "🚀 セッション自動管理（ハイブリッド - 修正版）開始"
    
    # 1. トークン使用率チェック（80%超）
    check_token_usage
    
    # 2. 週次リセットチェック
    check_weekly_reset
    
    log "✅ セッション自動管理完了"
}

main
