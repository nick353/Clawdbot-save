#!/bin/bash
# スマートモデル切り替え - タスク内容からHaiku/Sonnetを自動判定

LOGFILE="/root/clawd/.model-switcher.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# タスク内容からモデルを判定する関数
suggest_model() {
    local TASK="$1"
    
    # Haiku推奨キーワード（軽量・低コスト）
    local HAIKU_KEYWORDS=("確認" "チェック" "見て" "表示" "リスト" "状況" "取得" "読み" "検索" "監視" "ヘルスチェック" "heartbeat")
    
    # Sonnet推奨キーワード（高性能・推論）
    local SONNET_KEYWORDS=("実装" "作成" "コード" "デバッグ" "エラー" "分析" "バックテスト" "設計" "戦略" "ドキュメント" "最適化" "生成")
    
    # タスクを小文字に変換
    TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')
    
    # Sonnetキーワードチェック（優先）
    for keyword in "${SONNET_KEYWORDS[@]}"; do
        if [[ "$TASK_LOWER" =~ $keyword ]]; then
            echo "sonnet"
            log "🎯 Sonnet推奨: タスク「$TASK」に「$keyword」を検出"
            return
        fi
    done
    
    # Haikuキーワードチェック
    for keyword in "${HAIKU_KEYWORDS[@]}"; do
        if [[ "$TASK_LOWER" =~ $keyword ]]; then
            echo "haiku"
            log "💡 Haiku推奨: タスク「$TASK」に「$keyword」を検出"
            return
        fi
    done
    
    # デフォルト: Haiku（コスト効率優先）
    echo "haiku"
    log "💡 Haiku推奨（デフォルト）: タスク「$TASK」"
}

# メイン実行
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <task_description>"
        echo "Example: $0 '現在のセッション状況を確認'"
        echo ""
        echo "推奨モデルを返します: haiku または sonnet"
        exit 1
    fi
    
    TASK="$*"
    MODEL=$(suggest_model "$TASK")
    
    echo "$MODEL"
}

main "$@"
