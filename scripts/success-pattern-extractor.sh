#!/bin/bash
# success-pattern-extractor.sh - 成功パターン記録システム

set -euo pipefail

SUCCESSES_FILE="/root/clawd/tasks/successes.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 初期化
init() {
    if [ ! -f "$SUCCESSES_FILE" ]; then
        cat > "$SUCCESSES_FILE" <<'EOF'
# 成功パターン記録

このファイルは自動学習システムによって管理されています。
成功した実装・調査・修正のパターンを記録し、今後の参考にします。

---

EOF
        echo "✅ successes.md 作成完了"
    else
        echo "✅ successes.md 既存"
    fi
}

# 成功パターン記録
record() {
    local task_name="$1"
    local implementation="$2"
    local approach="$3"
    local success_factors="$4"
    local related_skills="${5:-}"

    cat >> "$SUCCESSES_FILE" <<EOF

## ✅ $task_name
**日時**: $TIMESTAMP

**実装内容**:
$implementation

**アプローチ**:
$approach

**成功要因**:
$success_factors

**関連スキル**: $related_skills

**タグ**: #success #$(echo "$task_name" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

---

EOF
    echo "✅ 成功パターン記録: $task_name"
}

# 検索
search() {
    local query="$1"
    grep -A 15 "$query" "$SUCCESSES_FILE" 2>/dev/null || echo "⚠️ 該当する成功パターンなし"
}

# 統計
stats() {
    echo "📊 成功パターン統計:"
    echo "  総記録数: $(grep -c "^## ✅" "$SUCCESSES_FILE" 2>/dev/null || echo 0)"
    echo "  最終記録: $(grep "^**日時**:" "$SUCCESSES_FILE" | tail -1 | sed 's/**日時**: //')"
}

case "${1:-}" in
    init)
        init
        ;;
    record)
        if [ $# -lt 5 ]; then
            echo "使い方: $0 record <task_name> <implementation> <approach> <success_factors> [related_skills]"
            exit 1
        fi
        record "$2" "$3" "$4" "$5" "${6:-}"
        ;;
    search)
        if [ $# -lt 2 ]; then
            echo "使い方: $0 search <query>"
            exit 1
        fi
        search "$2"
        ;;
    stats)
        stats
        ;;
    *)
        echo "使い方: $0 {init|record|search|stats}"
        exit 1
        ;;
esac
