#!/bin/bash
# git-auto-commit.sh - 重要ファイル変更時の自動commit機構
# Used by: Obsidian auto-save, RUNNING_TASKS updates, memory commits

set -e

REPO_DIR="/root/clawd"
COMMIT_FILE="${REPO_DIR}/.git_pending_commit"

# ============================================
# Function: ファイル変更を検出してcommit
# ============================================
auto_commit_if_changed() {
    local file_path="$1"
    local commit_msg="$2"
    
    cd "$REPO_DIR"
    
    if [ ! -f "$file_path" ]; then
        return 1
    fi
    
    # 変更があるかチェック
    if git diff --quiet "$file_path" 2>/dev/null; then
        return 0  # 変更なし
    fi
    
    # ステージ & commit
    git add "$file_path" 2>/dev/null || return 1
    git commit -m "$commit_msg" 2>/dev/null || {
        git reset HEAD "$file_path" 2>/dev/null
        return 1
    }
    
    return 0
}

# ============================================
# Function: 複数ファイルの一括commit
# ============================================
batch_auto_commit() {
    local commit_msg="$1"
    shift
    local files=("$@")
    
    cd "$REPO_DIR"
    
    # 変更ファイルを検出
    local changed_files=()
    for file in "${files[@]}"; do
        if [ -f "$file" ] && ! git diff --quiet "$file" 2>/dev/null; then
            changed_files+=("$file")
        fi
    done
    
    # 変更がなければ終了
    if [ ${#changed_files[@]} -eq 0 ]; then
        return 0
    fi
    
    # 全ファイルをステージ & commit
    git add "${changed_files[@]}" 2>/dev/null || return 1
    git commit -m "$commit_msg" 2>/dev/null || {
        git reset HEAD "${changed_files[@]}" 2>/dev/null
        return 1
    }
    
    return 0
}

# ============================================
# Main: 定期的に実行（heartbeat等から呼び出し）
# ============================================
main() {
    local action="${1:-auto}"  # auto | force
    
    cd "$REPO_DIR"
    
    case "$action" in
        auto)
            # RUNNING_TASKS.md の変更を検出 & commit
            auto_commit_if_changed \
                "RUNNING_TASKS.md" \
                "chore: update running tasks status (auto-commit)"
            
            # Obsidian ノート変更を検出 & commit
            if [ -d "/root/obsidian-vault/daily" ]; then
                batch_auto_commit \
                    "docs: update daily notes (auto-commit)" \
                    /root/obsidian-vault/daily/* \
                    2>/dev/null || true
            fi
            
            # data/ ディレクトリの重要ファイル
            batch_auto_commit \
                "data: update positions & diagnosis (auto-commit)" \
                "data/positions.json" \
                "data/diagnosis-report.json" \
                2>/dev/null || true
            ;;
        
        force)
            # 全変更をcommit（強制版）
            git add -A
            if ! git diff --cached --quiet; then
                git commit -m "chore: forced commit at $(date +'%Y-%m-%d %H:%M:%S')" || true
            fi
            ;;
        
        *)
            echo "Usage: git-auto-commit.sh [auto|force]"
            return 1
            ;;
    esac
}

main "$@"
