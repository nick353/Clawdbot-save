#!/bin/bash
# context-recovery.sh - compaction後の会話文脈自動復元
# Usage: bash /root/clawd/scripts/context-recovery.sh [lines=50]
# 直近の会話要点を自動で冒頭に再注入

LINES="${1:-50}"
CONTEXT_CACHE="/root/clawd/.context_summary_cache"
OBSIDIAN_DAILY="/root/obsidian-vault/daily"

# ============================================
# 直近会話の要点を生成
# ============================================
generate_context_summary() {
    local last_lines="$1"
    
    # Obsidian デイリーノートから直近情報を抽出
    if [ -d "$OBSIDIAN_DAILY" ]; then
        local latest_file=$(ls -t "$OBSIDIAN_DAILY"/*.md 2>/dev/null | head -1)
        if [ -n "$latest_file" ]; then
            echo "【直前の会話・タスク要点】"
            tail -100 "$latest_file" | grep -E "^##|^- \[|^✅|^❌" | tail -20
            echo ""
        fi
    fi
    
    # RUNNING_TASKS.md から進行中タスク
    if [ -f "/root/clawd/RUNNING_TASKS.md" ]; then
        echo "【進行中のタスク】"
        grep -E "^##|^- \[" "/root/clawd/RUNNING_TASKS.md" | head -15
        echo ""
    fi
    
    # 最新のGit commit履歴
    if [ -d "/root/clawd/.git" ]; then
        echo "【最新の実施内容】"
        cd /root/clawd
        git log --oneline -5 | sed 's/^/  /'
        echo ""
    fi
}

# ============================================
# キャッシュに要点を保存
# ============================================
cache_context() {
    local summary="$1"
    echo "$summary" > "$CONTEXT_CACHE"
    chmod 600 "$CONTEXT_CACHE"
}

# ============================================
# キャッシュを読み出す
# ============================================
get_cached_context() {
    if [ -f "$CONTEXT_CACHE" ]; then
        cat "$CONTEXT_CACHE"
    else
        echo ""
    fi
}

# ============================================
# Main
# ============================================
case "${1:-generate}" in
    generate)
        summary=$(generate_context_summary "$LINES")
        cache_context "$summary"
        echo "$summary"
        ;;
    
    get)
        get_cached_context
        ;;
    
    clear)
        rm -f "$CONTEXT_CACHE"
        echo "Context cache cleared"
        ;;
    
    *)
        echo "Usage: context-recovery.sh [generate|get|clear]"
        exit 1
        ;;
esac
