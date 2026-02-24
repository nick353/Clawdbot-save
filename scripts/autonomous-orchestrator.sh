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
    local current_channel="${DISCORD_CHANNEL:-channel:1464650064357232948}"
    
    local agents_yaml="/root/clawd/config/agents.yaml"
    
    if [ ! -f "$agents_yaml" ]; then
        log_error "agents.yaml が見つかりません: $agents_yaml"
        return 1
    fi
    
    # agents.yamlから設定を読み込む
    local agent_model
    agent_model=$(yq e ".agents.${task_type}.model // \"sonnet\"" "$agents_yaml")
    
    local system_prompt
    system_prompt=$(yq e ".agents.${task_type}.systemPrompt // \"\"" "$agents_yaml")
    
    local task_template=""
    case "$task_type" in
        research)
            task_template=$(yq e '.templates.research_task' "$agents_yaml")
            task_template="${task_template/\{objective\}/$task_description}"
            ;;
        implement)
            task_template=$(yq e '.templates.implement_task' "$agents_yaml")
            task_template="${task_template/\{objective\}/$task_description}"
            ;;
        verify)
            task_template=$(yq e '.templates.verify_task' "$agents_yaml")
            task_template="${task_template/\{target\}/$task_description}"
            ;;
        main)
            task_template="$task_description"
            ;;
        *)
            task_template="$task_description"
            ;;
    esac
    
    log_info "サブエージェント起動: $session_label ($agent_model)"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] サブエージェント起動をスキップ"
        log_info "[DRY RUN] タスク内容:\n$task_template"
        return 0
    fi
    
    # RUNNING_TASKS.md に記録
    {
        echo ""
        echo "## $(date '+%Y-%m-%d %H:%M:%S') - $session_label"
        echo "- **タスク**: $task_description"
        echo "- **エージェント**: $agent_model ($task_type)"
        echo "- **ステータス**: 🔄 実行中"
    } >> "$RUNNING_TASKS_FILE"
    
    # サブエージェント起動
    local full_task="$task_template

【必須】
完了後、以下を実行してください:
1. task-progress-monitor.sh で完了報告:
   bash /root/clawd/scripts/task-progress-monitor.sh complete \"$session_label\" \"<完了内容の要約>\"
2. RUNNING_TASKS.md のステータスを更新（🔄 → ✅）
3. message tool でDiscord通知:
   - channel: discord
   - target: $current_channel
   - message: \"✅ $session_label 完了: <要約>\"

【システムプロンプト】
$system_prompt"
    
    if command -v clawdbot &>/dev/null; then
        clawdbot sessions spawn \
            --label "$session_label" \
            --model "$agent_model" \
            --cleanup delete \
            --task "$full_task" 2>&1 | tee -a /var/log/autonomous-spawn.log || {
                log_error "サブエージェント起動失敗: $session_label"
                bash /root/clawd/scripts/task-progress-monitor.sh error "$session_label" "起動失敗"
                return 1
            }
        
        log_success "サブエージェント起動完了: $session_label"
    else
        log_error "clawdbot コマンドが見つかりません"
        return 1
    fi
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
    
    # auto-learning-system.shを使って記録
    if [ -f "/root/clawd/scripts/auto-learning-system.sh" ]; then
        bash /root/clawd/scripts/auto-learning-system.sh record \
            "オーケストレーター実行失敗" \
            "$error_message" \
            "（要分析）" \
            "（要実装）" \
            "（要追加）" 2>/dev/null || {
                # フォールバック: 直接lessons.mdに記録
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
    fi
    
    # Obsidianにも記録
    save_to_obsidian "error" "オーケストレーター失敗: $error_message (文脈: $task_context)"
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
    
    # ステップ3: エージェント起動（並列実行制御付き）
    local task_index=1
    local max_concurrent=3  # デフォルト並列実行数
    local running_agents=0
    
    # agents.yamlからglobal maxConcurrentを読み込む
    if [ -f "/root/clawd/config/agents.yaml" ]; then
        local global_max
        global_max=$(yq e '.config.maxConcurrent // 3' /root/clawd/config/agents.yaml 2>/dev/null || echo "3")
        max_concurrent="$global_max"
    fi
    
    log_info "並列実行制御: 最大同時実行数 = $max_concurrent"
    
    echo "$subtasks" | while IFS='|' read -r task_type task_desc; do
        # 実行中のエージェント数をチェック（DRY_RUNではスキップ）
        if [ "$DRY_RUN" != "true" ]; then
            while true; do
                running_agents=$(clawdbot sessions list --kinds main 2>/dev/null | grep -c "autonomous-" || echo "0")
                
                if [ "$running_agents" -lt "$max_concurrent" ]; then
                    break
                fi
                
                log_info "並列実行制御: 待機中（実行中: $running_agents/$max_concurrent）"
                sleep 5
            done
        fi
        
        local session_label="autonomous-${complexity}-${task_index}"
        spawn_subagent "$task_type" "$task_desc" "$session_label"
        task_index=$((task_index + 1))
        
        # 起動後の短い待機（起動処理完了を待つ）
        if [ "$DRY_RUN" != "true" ]; then
            sleep 2
        fi
    done
    
    # ステップ4: 進捗監視
    monitor_progress
    
    # ステップ5: 完了待機（全サブエージェント完了まで）
    if [ "$DRY_RUN" != "true" ]; then
        log_info "全サブエージェント完了を待機中..."
        local wait_count=0
        local max_wait=720  # 最大1時間待機（5秒 × 720 = 3600秒）
        
        while true; do
            local running_count
            running_count=$(clawdbot sessions list --kinds main 2>/dev/null | grep -c "autonomous-" || echo "0")
            
            if [ "$running_count" -eq 0 ]; then
                log_success "全サブエージェント完了"
                break
            fi
            
            wait_count=$((wait_count + 1))
            if [ "$wait_count" -ge "$max_wait" ]; then
                log_error "タイムアウト: サブエージェントが時間内に完了しませんでした"
                
                # 実行中のサブエージェントをリストアップ
                log_error "実行中のサブエージェント:"
                clawdbot sessions list --kinds main 2>/dev/null | grep "autonomous-" || true
                
                # Discord通知
                if command -v clawdbot &>/dev/null; then
                    echo "⚠️ オーケストレーター タイムアウト

タスク: $task
複雑度: $complexity
経過時間: 1時間

実行中のサブエージェント:
$(clawdbot sessions list --kinds main 2>/dev/null | grep "autonomous-" || echo "（取得失敗）")

手動で進捗を確認してください:
\`\`\`bash
clawdbot sessions list --kinds main
cat /root/clawd/tasks/RUNNING_TASKS.md
\`\`\`" | clawdbot message send --channel discord --target "$DISCORD_CHANNEL" 2>/dev/null || true
                fi
                
                # 失敗を記録
                learn_from_failure "タイムアウト: 1時間以内に完了せず" "$task"
                break
            fi
            
            log_info "待機中... (実行中: $running_count, 経過時間: $((wait_count * 5))秒)"
            sleep 5
            
            # 定期的に完了報告をチェック
            if [ $((wait_count % 12)) -eq 0 ]; then  # 1分ごと
                process_completion_reports
            fi
        done
    fi
    
    # ステップ6: 最終完了報告処理
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
