#!/bin/bash
# プロンプト最適化システム - テンプレート管理 + A/Bテスト

set -euo pipefail

TEMPLATES_DIR="/root/clawd/config/prompt-templates"
STATS_FILE="/root/clawd/config/prompt-stats.json"

# ディレクトリ作成
mkdir -p "$TEMPLATES_DIR"

# 初期テンプレート作成
init_templates() {
  # Research テンプレート
  cat > "$TEMPLATES_DIR/research.txt" <<'EOF'
<タスク>
{query} について徹底的に調査してください。

**調査手順:**
1. Brave検索で王道・確実な方法を確認
2. X検索で最新情報・実際の使用例を確認
3. 複数のアプローチを比較
4. 最適な方法を選択・提示

**出力形式:**
- 調査結果の要約
- 推奨アプローチ（理由を含む）
- 代替案（あれば）
EOF

  # Implementation テンプレート
  cat > "$TEMPLATES_DIR/implementation.txt" <<'EOF'
<タスク>
{description} を実装してください。

**実装手順:**
1. 既存のlessons.md/successes.mdを確認（類似タスク検索）
2. 段階的に実装（まず動くものを作る）
3. DRY_RUNモードでテスト
4. エラーハンドリング追加
5. ドキュメント更新

**品質チェック:**
- [ ] 動作確認完了
- [ ] エラーハンドリング実装
- [ ] ドキュメント更新
- [ ] 成功パターンを記録
EOF

  # Verification テンプレート
  cat > "$TEMPLATES_DIR/verification.txt" <<'EOF'
<タスク>
{target} の動作確認を実施してください。

**確認項目:**
1. 正常系テスト
2. エッジケーステスト（空文字列、null、巨大ファイル等）
3. エラーハンドリング確認
4. 既存機能への影響確認

**結果レポート:**
- テスト結果（成功/失敗）
- 問題点（あれば）
- 改善提案（あれば）
EOF

  echo "✅ 初期テンプレート作成完了"
}

# 統計初期化
init_stats() {
  if [ ! -f "$STATS_FILE" ]; then
    cat > "$STATS_FILE" <<'EOF'
{
  "research": {
    "total": 0,
    "success": 0,
    "failure": 0,
    "success_rate": 0.0
  },
  "implementation": {
    "total": 0,
    "success": 0,
    "failure": 0,
    "success_rate": 0.0
  },
  "verification": {
    "total": 0,
    "success": 0,
    "failure": 0,
    "success_rate": 0.0
  }
}
EOF
  fi
}

# テンプレート取得
get_template() {
  local category="$1"
  local query="${2:-}"
  
  local template_file="$TEMPLATES_DIR/${category}.txt"
  
  if [ ! -f "$template_file" ]; then
    echo "❌ テンプレートが見つかりません: $category"
    return 1
  fi
  
  # プレースホルダー置換（簡易版）
  if [ -n "$query" ]; then
    sed "s/{query}/$query/g; s/{description}/$query/g; s/{target}/$query/g" "$template_file"
  else
    cat "$template_file"
  fi
}

# 統計更新
update_stats() {
  local category="$1"
  local result="$2"  # success/failure
  
  init_stats
  
  # Python JSONパーサーで更新（jqがなくてもOK）
  python3 <<EOF
import json

with open("$STATS_FILE") as f:
    stats = json.load(f)

if "$category" not in stats:
    stats["$category"] = {"total": 0, "success": 0, "failure": 0, "success_rate": 0.0}

stats["$category"]["total"] += 1
stats["$category"]["$result"] += 1
stats["$category"]["success_rate"] = stats["$category"]["success"] / stats["$category"]["total"]

with open("$STATS_FILE", "w") as f:
    json.dump(stats, f, indent=2)

print(f"✅ 統計更新: {category} - {result}")
EOF
}

# ベストテンプレート選択
best_template() {
  init_stats
  
  python3 <<'EOF'
import json

with open("/root/clawd/config/prompt-stats.json") as f:
    stats = json.load(f)

best = max(stats.items(), key=lambda x: x[1].get("success_rate", 0))
print(f"🏆 最高成功率: {best[0]} ({best[1]['success_rate']:.2%})")
EOF
}

# 使い方
usage() {
  echo "使い方:"
  echo "  初期化: bash prompt-optimizer.sh init"
  echo "  テンプレート取得: bash prompt-optimizer.sh get <category> [query]"
  echo "  統計更新: bash prompt-optimizer.sh update <category> <success|failure>"
  echo "  ベスト選択: bash prompt-optimizer.sh best"
  echo ""
  echo "カテゴリ: research, implementation, verification"
  exit 1
}

# コマンド処理
case "${1:-}" in
  init)
    init_templates
    init_stats
    ;;
  get)
    if [ "$#" -lt 2 ]; then
      echo "❌ カテゴリを指定してください"
      usage
    fi
    get_template "$2" "${3:-}"
    ;;
  update)
    if [ "$#" -lt 3 ]; then
      echo "❌ カテゴリと結果を指定してください"
      usage
    fi
    update_stats "$2" "$3"
    ;;
  best)
    best_template
    ;;
  *)
    usage
    ;;
esac
