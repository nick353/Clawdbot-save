#!/bin/bash
# 自動学習システム
# 目的: 失敗パターンを自動的にlessons.mdに記録し、AGENTS.mdにルール追加

set -euo pipefail

# ========================================
# 設定
# ========================================
LESSONS_FILE="/root/clawd/tasks/lessons.md"
AGENTS_FILE="/root/clawd/AGENTS.md"
OBSIDIAN_HELPER="/root/clawd/scripts/obsidian-helper.sh"

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
# 失敗パターン記録（lessons.md）
# ========================================
record_failure() {
    local title="$1"
    local symptom="$2"
    local cause="$3"
    local solution="$4"
    local rule="${5:-（要追加）}"
    
    log_info "失敗パターン記録: $title"
    
    local date
    date=$(date +%Y-%m-%d)
    
    local entry
    entry=$(cat <<EOF

## $date - $title
**症状**: $symptom
**原因**: $cause
**解決策**: $solution
**今後のルール**: $rule
**検証**: ⏳ 未検証

EOF
)
    
    if [ "$DRY_RUN" != "true" ]; then
        echo "$entry" >> "$LESSONS_FILE"
        log_success "lessons.mdに記録完了"
    else
        log_info "[DRY RUN] lessons.md記録をスキップ"
    fi
    
    # Obsidianに保存
    save_to_obsidian "note" "失敗パターン記録: $title - $symptom"
}

# ========================================
# ルール追加（AGENTS.md）
# ========================================
add_rule_to_agents() {
    local section="$1"
    local rule="$2"
    
    log_info "AGENTS.mdにルール追加: $section"
    
    if [ ! -f "$AGENTS_FILE" ]; then
        log_error "AGENTS.mdが見つかりません: $AGENTS_FILE"
        return 1
    fi
    
    # セクションの最後に追加
    local temp_file
    temp_file=$(mktemp)
    
    awk -v section="$section" -v rule="- $rule" '
        BEGIN { added=0 }
        /^## / {
            if (added == 1) {
                print rule
                print ""
                added=2
            }
            if ($0 ~ section) {
                in_section=1
            } else {
                if (in_section == 1 && added == 0) {
                    added=1
                }
                in_section=0
            }
        }
        { print }
        END {
            if (added == 1) {
                print rule
                print ""
            }
        }
    ' "$AGENTS_FILE" > "$temp_file"
    
    if [ "$DRY_RUN" != "true" ]; then
        mv "$temp_file" "$AGENTS_FILE"
        log_success "AGENTS.mdにルール追加完了"
    else
        log_info "[DRY RUN] AGENTS.md更新をスキップ"
        rm -f "$temp_file"
    fi
}

# ========================================
# 検証完了マーク
# ========================================
mark_verified() {
    local failure_title="$1"
    
    log_info "検証完了マーク: $failure_title"
    
    local date
    date=$(date +%Y-%m-%d)
    
    local temp_file
    temp_file=$(mktemp)
    
    awk -v title="$failure_title" -v date="$date" '
        /^## .* - / {
            if (index($0, title) > 0) {
                in_section=1
            } else {
                in_section=0
            }
        }
        in_section && /^\*\*検証\*\*:/ {
            print "**検証**: ✅ " date " 再現しないことを確認"
            next
        }
        { print }
    ' "$LESSONS_FILE" > "$temp_file"
    
    if [ "$DRY_RUN" != "true" ]; then
        mv "$temp_file" "$LESSONS_FILE"
        log_success "検証完了マーク追加"
    else
        log_info "[DRY RUN] 検証マーク追加をスキップ"
        rm -f "$temp_file"
    fi
}

# ========================================
# Obsidian統合
# ========================================
save_to_obsidian() {
    local category="$1"
    local message="$2"
    
    if [ -f "$OBSIDIAN_HELPER" ]; then
        bash "$OBSIDIAN_HELPER" "$category" "$message" 2>/dev/null || true
    fi
}

# ========================================
# 失敗パターン検索
# ========================================
search_lessons() {
    local keyword="$1"
    
    log_info "失敗パターン検索: $keyword"
    
    if [ ! -f "$LESSONS_FILE" ]; then
        log_error "lessons.mdが見つかりません"
        return 1
    fi
    
    grep -i "$keyword" "$LESSONS_FILE" -A 6 || {
        log_info "該当する失敗パターンなし"
    }
}

# ========================================
# 今月の失敗統計
# ========================================
monthly_statistics() {
    local current_month
    current_month=$(date +%Y-%m)
    
    log_info "今月の失敗統計: $current_month"
    
    if [ ! -f "$LESSONS_FILE" ]; then
        log_error "lessons.mdが見つかりません"
        echo ""
        echo "==================================="
        echo "今月の失敗統計 ($current_month)"
        echo "==================================="
        echo "lessons.mdファイルが見つかりません"
        echo "==================================="
        echo ""
        return 0
    fi
    
    # 総失敗数をカウント（シンプル版）
    local total_failures
    total_failures=$(grep "^## $current_month" "$LESSONS_FILE" 2>/dev/null | wc -l | tr -d ' \n' || echo "0")
    [ -z "$total_failures" ] && total_failures=0
    
    # 検証済みをカウント（シンプル版）
    local verified_count
    verified_count=$(grep "^## $current_month" "$LESSONS_FILE" -A 6 2>/dev/null | grep "✅" | wc -l | tr -d ' \n' || echo "0")
    [ -z "$verified_count" ] && verified_count=0
    
    # 未検証数を計算
    local unverified_count=$((total_failures - verified_count))
    
    echo ""
    echo "==================================="
    echo "今月の失敗統計 ($current_month)"
    echo "==================================="
    echo "総失敗数: ${total_failures:-0}"
    echo "検証済み: ${verified_count:-0}"
    echo "未検証: ${unverified_count:-0}"
    echo "==================================="
    echo ""
}

# ========================================
# メイン処理
# ========================================
main() {
    local action="${1:-}"
    
    case "$action" in
        record)
            # 失敗パターン記録
            local title="${2:-}"
            local symptom="${3:-}"
            local cause="${4:-}"
            local solution="${5:-}"
            local rule="${6:-（要追加）}"
            
            if [ -z "$title" ] || [ -z "$symptom" ] || [ -z "$cause" ] || [ -z "$solution" ]; then
                log_error "使用方法: $0 record <title> <symptom> <cause> <solution> [rule]"
                exit 1
            fi
            
            record_failure "$title" "$symptom" "$cause" "$solution" "$rule"
            ;;
        rule)
            # AGENTS.mdにルール追加
            local section="${2:-}"
            local rule="${3:-}"
            
            if [ -z "$section" ] || [ -z "$rule" ]; then
                log_error "使用方法: $0 rule <section> <rule>"
                exit 1
            fi
            
            add_rule_to_agents "$section" "$rule"
            ;;
        verify)
            # 検証完了マーク
            local title="${2:-}"
            
            if [ -z "$title" ]; then
                log_error "使用方法: $0 verify <failure_title>"
                exit 1
            fi
            
            mark_verified "$title"
            ;;
        search)
            # 失敗パターン検索
            local keyword="${2:-}"
            
            if [ -z "$keyword" ]; then
                log_error "使用方法: $0 search <keyword>"
                exit 1
            fi
            
            search_lessons "$keyword"
            ;;
        stats)
            # 今月の統計
            monthly_statistics
            ;;
        *)
            echo "使用方法: $0 {record|rule|verify|search|stats} [args...]"
            echo ""
            echo "コマンド:"
            echo "  record <title> <symptom> <cause> <solution> [rule]"
            echo "    - 失敗パターンをlessons.mdに記録"
            echo ""
            echo "  rule <section> <rule>"
            echo "    - AGENTS.mdにルール追加"
            echo ""
            echo "  verify <title>"
            echo "    - 検証完了マーク追加"
            echo ""
            echo "  search <keyword>"
            echo "    - 失敗パターン検索"
            echo ""
            echo "  stats"
            echo "    - 今月の失敗統計"
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
