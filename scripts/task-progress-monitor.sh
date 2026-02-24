#!/bin/bash
# タスク進捗監視システム
# 目的: サブエージェントの進捗を監視し、完了時にDiscord通知

set -euo pipefail

# ========================================
# 設定
# ========================================
RUNNING_TASKS_FILE="/root/clawd/tasks/RUNNING_TASKS.md"
SUBAGENT_REPORTS_LOG="$HOME/.clawdbot/subagent_reports.log"
DISCORD_CHANNEL="channel:1464650064357232948"

DRY_RUN="${DRY_RUN:-false}"

# ========================================
# ログ関数
# ========================================
log_info() {
    if [ "${VERBOSE:-false}" = "true" ]; then
        echo "[INFO] $*" >&2
    fi
}

log_error() {
    echo "[ERROR] $*" >&2
}

# ========================================
# RUNNING_TASKS.md 更新
# ========================================
update_running_tasks() {
    local task_label="$1"
    local status="$2"
    local message="${3:-}"
    
    log_info "RUNNING_TASKS.md更新: $task_label -> $status"
    
    if [ ! -f "$RUNNING_TASKS_FILE" ]; then
        cat > "$RUNNING_TASKS_FILE" <<'EOF'
# 実行中タスク一覧

このファイルは自律的マルチエージェントフレームワークによって自動管理されています。

---

EOF
    fi
    
    # タスクのステータスを更新（該当行を検索して置換）
    if grep -q "## .* - $task_label" "$RUNNING_TASKS_FILE" 2>/dev/null; then
        # 既存タスクのステータス更新
        local temp_file
        temp_file=$(mktemp)
        awk -v label="$task_label" -v status="$status" -v msg="$message" '
            /^## .* - / {
                if (index($0, label) > 0) {
                    in_section=1
                    print
                    next
                }
                in_section=0
            }
            in_section && /^- \*\*ステータス\*\*:/ {
                print "- **ステータス**: " status
                if (msg != "") {
                    print "- **メッセージ**: " msg
                }
                next
            }
            { print }
        ' "$RUNNING_TASKS_FILE" > "$temp_file"
        mv "$temp_file" "$RUNNING_TASKS_FILE"
    fi
}

# ========================================
# サブエージェント完了報告フラグ追加
# ========================================
add_completion_flag() {
    local task_name="$1"
    local status="$2"
    local summary="$3"
    
    local timestamp
    timestamp=$(date +%s)
    
    echo "${timestamp}|${task_name}|${status}|${summary}" >> "$SUBAGENT_REPORTS_LOG"
    log_info "完了フラグ追加: $task_name"
}

# ========================================
# 完了報告を一括送信
# ========================================
send_batch_completion_report() {
    if [ ! -f "$SUBAGENT_REPORTS_LOG" ]; then
        return 0
    fi
    
    log_info "完了報告を一括送信"
    
    local report_summary="【サブエージェント完了報告】\n\n"
    local report_count=0
    
    while IFS='|' read -r timestamp task_name status summary; do
        report_summary="${report_summary}✅ **${task_name}**: ${summary}\n"
        report_count=$((report_count + 1))
    done < "$SUBAGENT_REPORTS_LOG"
    
    if [ "$report_count" -gt 0 ]; then
        if [ "$DRY_RUN" != "true" ] && command -v clawdbot &>/dev/null; then
            echo -e "$report_summary" | \
                clawdbot message send --channel discord --target "$DISCORD_CHANNEL" 2>/dev/null || {
                log_error "Discord通知送信失敗"
            }
        else
            log_info "[DRY RUN] Discord通知をスキップ:\n$report_summary"
        fi
        
        # フラグファイルクリア
        rm -f "$SUBAGENT_REPORTS_LOG"
    fi
}

# ========================================
# エラー時の即座通知
# ========================================
send_error_notification() {
    local task_name="$1"
    local error_message="$2"
    
    local notification="⚠️ **タスク実行エラー**\n\n"
    notification="${notification}タスク: ${task_name}\n"
    notification="${notification}エラー: ${error_message}\n"
    
    if [ "$DRY_RUN" != "true" ] && command -v clawdbot &>/dev/null; then
        echo -e "$notification" | \
            clawdbot message send --channel discord --target "$DISCORD_CHANNEL" 2>/dev/null || {
            log_error "エラー通知送信失敗"
        }
    else
        log_info "[DRY RUN] エラー通知をスキップ:\n$notification"
    fi
}

# ========================================
# 進捗確認（process list）
# ========================================
check_progress() {
    log_info "進捗確認中..."
    
    if command -v clawdbot &>/dev/null; then
        local process_list
        process_list=$(clawdbot process list 2>/dev/null || echo "")
        
        if [ -n "$process_list" ]; then
            echo "$process_list"
        else
            log_info "実行中のプロセスなし"
        fi
    else
        log_error "clawdbotコマンドが見つかりません"
    fi
}

# ========================================
# メイン処理
# ========================================
main() {
    local action="${1:-monitor}"
    
    case "$action" in
        monitor)
            # 進捗確認
            check_progress
            ;;
        update)
            # RUNNING_TASKS.md更新
            local task_label="${2:-}"
            local status="${3:-}"
            local message="${4:-}"
            
            if [ -z "$task_label" ] || [ -z "$status" ]; then
                log_error "使用方法: $0 update <task_label> <status> [message]"
                exit 1
            fi
            
            update_running_tasks "$task_label" "$status" "$message"
            ;;
        complete)
            # 完了フラグ追加
            local task_name="${2:-}"
            local summary="${3:-}"
            
            if [ -z "$task_name" ] || [ -z "$summary" ]; then
                log_error "使用方法: $0 complete <task_name> <summary>"
                exit 1
            fi
            
            add_completion_flag "$task_name" "completed" "$summary"
            ;;
        report)
            # 完了報告一括送信
            send_batch_completion_report
            ;;
        error)
            # エラー通知
            local task_name="${2:-}"
            local error_message="${3:-}"
            
            if [ -z "$task_name" ] || [ -z "$error_message" ]; then
                log_error "使用方法: $0 error <task_name> <error_message>"
                exit 1
            fi
            
            send_error_notification "$task_name" "$error_message"
            ;;
        *)
            echo "使用方法: $0 {monitor|update|complete|report|error} [args...]"
            echo ""
            echo "コマンド:"
            echo "  monitor              - 進捗確認"
            echo "  update <label> <status> [msg] - RUNNING_TASKS.md更新"
            echo "  complete <name> <summary>     - 完了フラグ追加"
            echo "  report               - 完了報告一括送信"
            echo "  error <name> <message>        - エラー通知送信"
            exit 1
            ;;
    esac
}

# ========================================
# 実行
# ========================================
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
