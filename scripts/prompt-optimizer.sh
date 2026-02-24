#!/bin/bash
# prompt-optimizer.sh - プロンプト最適化システム

set -euo pipefail

TEMPLATES_DIR="/root/clawd/config/prompt-templates"
STATS_FILE="/root/clawd/config/prompt-stats.json"

# 初期化
init() {
    mkdir -p "$TEMPLATES_DIR"
    
    # Research テンプレート
    cat > "$TEMPLATES_DIR/research.txt" <<'EOF'
【調査タスク】
1. 複数の検索エンジンを使用（web_search + bird）
2. 公式ドキュメントを優先的に参照
3. 最新情報と既存の知識を比較
4. 信頼できる情報源を選択
EOF

    # Implementation テンプレート
    cat > "$TEMPLATES_DIR/implementation.txt" <<'EOF'
【実装タスク】
1. 既存のスキル・スクリプトを検索
2. 段階的な実装計画を作成
3. DRY_RUNモードで検証
4. エラーケースを考慮
5. 再利用可能な設計
EOF

    # Verification テンプレート
    cat > "$TEMPLATES_DIR/verification.txt" <<'EOF'
【検証タスク】
1. エンドツーエンドテスト実施
2. 実データでの動作確認
3. エラーケースの検証
4. パフォーマンスチェック
5. ドキュメント更新
EOF

    # 統計ファイル初期化
    if [ ! -f "$STATS_FILE" ]; then
        cat > "$STATS_FILE" <<'EOF'
{
  "research": {"success": 0, "failure": 0},
  "implementation": {"success": 0, "failure": 0},
  "verification": {"success": 0, "failure": 0}
}
EOF
    fi
    
    echo "✅ プロンプトテンプレート初期化完了"
}

# テンプレート取得
get() {
    local category="$1"
    local task_desc="${2:-}"
    
    if [ ! -f "$TEMPLATES_DIR/$category.txt" ]; then
        echo "⚠️ テンプレート未作成: $category"
        return 1
    fi
    
    echo "【$category テンプレート】"
    cat "$TEMPLATES_DIR/$category.txt"
    if [ -n "$task_desc" ]; then
        echo ""
        echo "【タスク概要】"
        echo "$task_desc"
    fi
}

# 統計更新
update() {
    local category="$1"
    local result="$2"  # success or failure
    
    if [ ! -f "$STATS_FILE" ]; then
        init
    fi
    
    # jqで統計更新
    local current=$(jq -r ".$category.$result" "$STATS_FILE")
    local new_count=$((current + 1))
    jq ".$category.$result = $new_count" "$STATS_FILE" > "$STATS_FILE.tmp"
    mv "$STATS_FILE.tmp" "$STATS_FILE"
    
    echo "✅ 統計更新: $category - $result ($new_count)"
}

# ベストテンプレート選択（成功率が最も高いもの）
best() {
    if [ ! -f "$STATS_FILE" ]; then
        echo "⚠️ 統計データなし"
        return 1
    fi
    
    echo "📊 成功率ランキング:"
    for category in research implementation verification; do
        local success=$(jq -r ".$category.success" "$STATS_FILE")
        local failure=$(jq -r ".$category.failure" "$STATS_FILE")
        local total=$((success + failure))
        
        if [ $total -gt 0 ]; then
            local rate=$(echo "scale=2; $success / $total * 100" | bc)
            echo "  $category: ${rate}% ($success/$total)"
        else
            echo "  $category: データなし"
        fi
    done
}

case "${1:-}" in
    init)
        init
        ;;
    get)
        if [ $# -lt 2 ]; then
            echo "使い方: $0 get <category> [task_desc]"
            exit 1
        fi
        get "$2" "${3:-}"
        ;;
    update)
        if [ $# -lt 3 ]; then
            echo "使い方: $0 update <category> <success|failure>"
            exit 1
        fi
        update "$2" "$3"
        ;;
    best)
        best
        ;;
    *)
        echo "使い方: $0 {init|get|update|best}"
        exit 1
        ;;
esac
