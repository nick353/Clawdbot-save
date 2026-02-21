#!/bin/bash
# 積極的なメモリ保存 - 重要な会話を自動的にmemoryに保存

LOGFILE="/root/clawd/.memory-saver.log"
MEMORY_DIR="/root/clawd/memory"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# セッション履歴から重要な会話を抽出してmemoryに保存
save_important_conversations() {
    log "💾 重要な会話の保存を開始"
    
    # memoryディレクトリが存在しない場合は作成
    mkdir -p "$MEMORY_DIR"
    
    # 今日の日付
    TODAY=$(date +%Y-%m-%d)
    MEMORY_FILE="$MEMORY_DIR/$TODAY-auto.md"
    
    # セッション一覧を取得
    clawdbot sessions list --limit 10 2>/dev/null | tail -n +4 | while IFS= read -r line; do
        # セッションキーを抽出（2番目のフィールド）
        KEY=$(echo "$line" | awk '{print $2}')
        
        log "📖 セッション「$KEY」の履歴を確認中..."
        
        # セッション履歴を取得（最新20件）
        HISTORY=$(clawdbot sessions history --session "$KEY" --limit 20 2>/dev/null)
        
        # 重要なキーワードが含まれているか確認
        if echo "$HISTORY" | grep -qE "(実装|作成|完了|エラー|修正|設定|追加|削除|変更)"; then
            log "✅ 重要な会話を検出: セッション「$KEY」"
            
            # memoryファイルに追記
            {
                echo "## セッション: $KEY ($(date +'%Y-%m-%d %H:%M:%S'))"
                echo ""
                echo "$HISTORY" | head -50
                echo ""
                echo "---"
                echo ""
            } >> "$MEMORY_FILE"
            
            log "💾 memoryに保存: $MEMORY_FILE"
        else
            log "ℹ️ 重要な会話なし: セッション「$KEY」"
        fi
    done
    
    log "✅ メモリ保存完了"
}

# メイン実行
main() {
    log "🚀 積極的なメモリ保存を開始"
    save_important_conversations
    log "✅ 完了"
}

main
