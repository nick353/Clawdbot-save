#!/bin/bash
# 強制サブエージェントラッパー - 長時間タスクを自動的にサブエージェント化

LOGFILE="/root/clawd/.subagent-wrapper.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# タスクがサブエージェント必要か判定
needs_subagent() {
    local TASK="$1"
    
    # サブエージェント必須キーワード
    local SUBAGENT_KEYWORDS=("バックテスト" "監視" "定期" "長時間" "大量" "スキル作成" "実装" "分析" "生成" "daily-research" "video-processor")
    
    TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')
    
    for keyword in "${SUBAGENT_KEYWORDS[@]}"; do
        if [[ "$TASK_LOWER" =~ $keyword ]]; then
            log "🚀 サブエージェント必須: タスク「$TASK」に「$keyword」を検出"
            return 0
        fi
    done
    
    return 1
}

# メイン実行
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <task_description>"
        echo "Example: $0 'daily-research を実行'"
        echo ""
        echo "サブエージェントが必要な場合: exit 0"
        echo "メインセッションで実行可能: exit 1"
        exit 1
    fi
    
    TASK="$*"
    
    if needs_subagent "$TASK"; then
        echo "subagent"
        log "✅ サブエージェント推奨: タスク「$TASK」"
        exit 0
    else
        echo "main"
        log "💡 メインセッション推奨: タスク「$TASK」"
        exit 1
    fi
}

main "$@"
