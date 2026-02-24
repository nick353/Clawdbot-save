#!/bin/bash
# 成功パターン自動記録スクリプト

set -euo pipefail

SUCCESSES_FILE="/root/clawd/tasks/successes.md"
DATE=$(date +%Y-%m-%d)

# 使い方
usage() {
  echo "使い方: bash success-pattern-extractor.sh record <タスク名> <実装内容> <アプローチ> <成功要因> [関連スキル]"
  echo ""
  echo "例:"
  echo "  bash success-pattern-extractor.sh record \\"
  echo "    'Discord BOT実装' \\"
  echo "    'メッセージ送信・リアクション機能' \\"
  echo "    'Discord.js + Webhooks' \\"
  echo "    'API仕様を最初に確認・段階的実装' \\"
  echo "    'discord, nodejs'"
  exit 1
}

# 成功パターン記録
record_success() {
  local task_name="$1"
  local implementation="$2"
  local approach="$3"
  local success_factors="$4"
  local related_skills="${5:-なし}"
  
  # 再利用可能なパターンを抽出（簡易版 - 今後LLMで自動生成）
  local reusable_patterns="<未記入 - 後で手動追記>"
  
  # successes.mdに追記
  cat >> "$SUCCESSES_FILE" <<EOF

## $DATE - $task_name

**実装内容**: $implementation
**アプローチ**: $approach
**成功要因**: $success_factors
**再利用可能なパターン**: $reusable_patterns
**関連スキル**: $related_skills

---
EOF
  
  echo "✅ 成功パターンを記録しました: $task_name"
  echo "   ファイル: $SUCCESSES_FILE"
  
  # RAGインデックス再構築フラグ
  touch /root/clawd/.rag_reindex_needed
}

# コマンド処理
case "${1:-}" in
  record)
    if [ "$#" -lt 5 ]; then
      echo "❌ 引数が不足しています"
      usage
    fi
    record_success "$2" "$3" "$4" "$5" "${6:-なし}"
    ;;
  *)
    usage
    ;;
esac
