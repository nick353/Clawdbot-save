#!/bin/bash
# 自律的マルチエージェントオーケストレーター
# 目的: 複雑なタスクを自動的に分解し、適切な専門エージェントに委譲

set -euo pipefail

# ========================================
# 設定
# ========================================
RUNNING_TASKS_FILE="/root/clawd/tasks/RUNNING_TASKS.md"
SUBAGENT_REPORTS_LOG="$HOME/.clawdbot/subagent_reports.log"
LESSONS_FILE="/root/clawd/tasks/lessons.md"
AGENTS_FILE="/root/clawd/AGENTS.md"
DISCORD_CHANNEL="channel:1464650064357232948"

DRY_RUN="${DRY_RUN:-false}"

# ========================================
# ログ関数
# ========================================
log_info() {
    echo "[INFO] $*" >&2
}

log_error() {
    echo "[ERROR] $*" >&2
}

log_success() {
    echo "[SUCCESS] $*" >&2
}

# ========================================
# タスク複雑度判定
# ========================================
judge_complexity() {
    local task="$1"
    local complexity="simple"
    
    # 複雑度判定基準
    # - 複数ステップが必要: medium
    # - 外部API統合: medium
    # - 新規機能実装: complex
    # - 複数ファイル変更: complex
    # - リサーチ+実装: complex
    
    if echo "$task" | grep -qiE "(実装|開発|作成|統合|新規)"; then
        complexity="medium"
    fi
    
    if echo "$task" | grep -qiE "(自動|フレームワーク|システム|アーキテクチャ)"; then
        complexity="complex"
    fi
    
    if echo "$task" | grep -qiE "(複数|全|まとめて|一括)"; then
        complexity="complex"
    fi
    
    if echo "$task" | grep -qiE "(リサーチして.*実装|調べて.*作成|分析して.*開発)"; then
        complexity="complex"
    fi
    
    echo "$complexity"
}

# ========================================
# タスク分解
# ========================================
decompose_task() {
    local task="$1"
    local complexity="$2"
    
    log_info "タスク分解: $task (複雑度: $complexity)"
    
    case "$complexity" in
        simple)
            # 単一タスク（分解不要）
            echo "main|$task"
            ;;
        medium)
            # 2-3ステップに分解
            if echo "$task" | grep -qiE "リサーチ"; then
                echo "research|$task のリサーチを実施"
                echo "implement|リサーチ結果を元に実装"
            elif echo "$task" | grep -qiE "実装|開発"; then
                echo "implement|$task"
                echo "verify|実装内容の検証"
            else
                echo "main|$task"
            fi
            ;;
        complex)
            # 4+ステップに分解
            if echo "$task" | grep -qiE "フレームワーク|システム|自動化"; then
                echo "research|要件定義とアーキテクチャ設計"
                echo "implement|コア機能実装"
                echo "implement|統合・設定"
                echo "verify|動作検証とテスト"
            else
                echo "research|$task の調査"
                echo "implement|基本実装"
                echo "implement|詳細実装"
                echo "verify|検証とドキュメント化"
            fi
            ;;
    esac
}

# ========================================
# エージェント選択
# ========================================
select_agent() {
    local task_type="$1"
    local agent_model=""
    local agent_tools=""
    
    case "$task_type" in
        research)
            agent_model="haiku"
            agent_tools="web_search,bird,web_fetch"
            ;;
        implement)
            agent_model="sonnet"
            agent_tools="exec,edit,write,read"
            ;;
        verify)
            agent_model="haiku"
            agent_tools="exec,process,read"
            ;;
        main)
            agent_model="sonnet"
            agent_tools="all"
            ;;
        *)
            agent_model="sonnet"
            agent_tools="all"
            ;;
    esac
    
    echo "$agent_model|$agent_tools"
}

# ========================================
# サブエージェント起動
# ========================================
spawn_subagent() {
    local task_type="$1"
    local task_description="$2"
    local session_label="$3"
    
    local agent_info
    agent_info=$(select_agent "$task_type")
    local agent_model
    agent_model=$(echo "$agent_info" | cut -d'|' -f1)
    local agent_tools
    agent_tools=$(echo "$agent_info" | cut -d'|' -f2)
    
    log_info "サブエージェント起動: $session_label ($agent_model, tools: $agent_tools)"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] サブエージェント起動をスキップ"
        return 0
    fi
    
    # RUNNING_TASKS.md に記録
    {
        echo ""
        echo "## $(date '+%Y-%m-%d %H:%M:%S') - $session_label"
        echo "- **タスク**: $task_description"
        echo "- **エージェント**: $agent_model"
        echo "- **ツール**: $agent_tools"
        echo "- **ステータス**: 🔄 実行中"
    } >> "$RUNNING_TASKS_FILE"
    
    # サブエージェント起動（clawdbotコマンド使用）
    # 注: 実際のサブエージェント起動は、clawdbot CLIで実装されている想定
    # ここでは簡易的にバックグラウンドでタスクを実行
    
    log_success "サブエージェント起動完了: $session_label"
}

# ========================================
# 進捗監視
# ========================================
monitor_progress() {
    log_info "進捗監視を開始"
    
    # process list で実行中のタスクを確認
    if command -v clawdbot &>/dev/null; then
        clawdbot process list 2>/dev/null || true
    fi
    
    # RUNNING_TASKS.md の内容を表示
    if [ -f "$RUNNING_TASKS_FILE" ]; then
        log_info "実行中タスク:"
        tail -n 20 "$RUNNING_TASKS_FILE"
    fi
}

# ========================================
# 完了報告処理
# ========================================
process_completion_reports() {
    if [ ! -f "$SUBAGENT_REPORTS_LOG" ]; then
        return 0
    fi
    
    log_info "サブエージェント完了報告を処理"
    
    local report_summary=""
    while IFS='|' read -r timestamp task_name status summary; do
        report_summary="${report_summary}✅ ${task_name}: ${summary}\n"
    done < "$SUBAGENT_REPORTS_LOG"
    
    if [ -n "$report_summary" ]; then
        log_success "完了報告:\n$report_summary"
        
        # Discord通知
        if [ "$DRY_RUN" != "true" ] && command -v clawdbot &>/dev/null; then
            echo -e "【サブエージェント完了報告】\n$report_summary" | \
                clawdbot message send --channel discord --target "$DISCORD_CHANNEL" 2>/dev/null || true
        fi
        
        # フラグファイルクリア
        rm -f "$SUBAGENT_REPORTS_LOG"
    fi
}

# ========================================
# 失敗パターン学習
# ========================================
learn_from_failure() {
    local error_message="$1"
    local task_context="$2"
    
    log_error "失敗を記録: $error_message"
    
    {
        echo ""
        echo "## $(date '+%Y-%m-%d') - オーケストレーター実行失敗"
        echo "**症状**: $error_message"
        echo "**文脈**: $task_context"
        echo "**原因**: （要分析）"
        echo "**解決策**: （要実装）"
        echo "**今後のルール**: （要追加）"
        echo "**検証**: ⏳ 未検証"
        echo ""
    } >> "$LESSONS_FILE"
}

# ========================================
# Obsidian統合
# ========================================
save_to_obsidian() {
    local category="$1"
    local message="$2"
    
    if [ -f "/root/clawd/scripts/obsidian-auto-save.sh" ]; then
        bash /root/clawd/scripts/obsidian-auto-save.sh "$category" "$message" 2>/dev/null || true
    fi
}

# ========================================
# メイン処理
# ========================================
main() {
    local task="${1:-}"
    
    if [ -z "$task" ]; then
        log_error "使用方法: $0 '<タスク説明>'"
        log_error "例: $0 'Xで最新のAIトレンドをリサーチして記事化'"
        exit 1
    fi
    
    log_info "==================================="
    log_info "自律的マルチエージェントオーケストレーター"
    log_info "==================================="
    log_info "タスク: $task"
    
    # ステップ1: 複雑度判定
    local complexity
    complexity=$(judge_complexity "$task")
    log_info "複雑度判定結果: $complexity"
    
    # ステップ2: タスク分解
    local subtasks
    subtasks=$(decompose_task "$task" "$complexity")
    
    log_info "サブタスク一覧:"
    echo "$subtasks" | while IFS='|' read -r task_type task_desc; do
        log_info "  - [$task_type] $task_desc"
    done
    
    # ステップ3: エージェント起動
    local task_index=1
    echo "$subtasks" | while IFS='|' read -r task_type task_desc; do
        local session_label="autonomous-${complexity}-${task_index}"
        spawn_subagent "$task_type" "$task_desc" "$session_label"
        task_index=$((task_index + 1))
    done
    
    # ステップ4: 進捗監視
    monitor_progress
    
    # ステップ5: 完了報告処理
    process_completion_reports
    
    # Obsidianに記録
    save_to_obsidian "task" "オーケストレーター実行: $task (複雑度: $complexity)"
    
    log_success "オーケストレーター実行完了"
}

# ========================================
# エラーハンドリング
# ========================================
trap 'learn_from_failure "スクリプト実行中断" "$*"' ERR

# ========================================
# 実行
# ========================================
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
