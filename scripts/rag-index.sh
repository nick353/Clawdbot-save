#!/bin/bash
# RAGインデックス作成スクリプト
# 用途: Clawdbot作業ログをベクトル化してLanceDBに保存

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LANCEDB_DIR="${LANCEDB_DIR:-/root/clawd/.lancedb}"
INDEX_SCRIPT="$SCRIPT_DIR/rag-indexer.py"

# ヘルプ表示
usage() {
  cat <<EOF
使い方: $0 [オプション]

オプション:
  --source <dir>    ソースディレクトリ（デフォルト: /root/clawd）
  --collection <name> コレクション名（デフォルト: clawd_tasks）
  --force           既存インデックスを削除して再作成
  --help            このヘルプを表示

例:
  $0                          # デフォルト設定でインデックス作成
  $0 --force                  # 既存インデックスを削除して再作成
  $0 --source /path/to/logs   # カスタムログディレクトリを指定
EOF
  exit 0
}

# デフォルト値
SOURCE_DIR="/root/clawd"
COLLECTION="clawd_tasks"
FORCE_REBUILD=false

# 引数解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --source)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --collection)
      COLLECTION="$2"
      shift 2
      ;;
    --force)
      FORCE_REBUILD=true
      shift
      ;;
    --help)
      usage
      ;;
    *)
      echo "❌ 不明なオプション: $1" >&2
      usage
      ;;
  esac
done

# Pythonスクリプトが存在しない場合は作成
if [ ! -f "$INDEX_SCRIPT" ]; then
  echo "⚠️ $INDEX_SCRIPT が見つかりません。作成してから再実行してください。" >&2
  exit 1
fi

# インデックス作成
echo "📊 RAGインデックス作成開始..."
echo "  ソース: $SOURCE_DIR"
echo "  コレクション: $COLLECTION"
echo "  データベース: $LANCEDB_DIR"

if [ "$FORCE_REBUILD" = true ]; then
  echo "  モード: 強制再構築"
  python3 "$INDEX_SCRIPT" \
    --source "$SOURCE_DIR" \
    --db "$LANCEDB_DIR" \
    --collection "$COLLECTION" \
    --force
else
  echo "  モード: 増分更新"
  python3 "$INDEX_SCRIPT" \
    --source "$SOURCE_DIR" \
    --db "$LANCEDB_DIR" \
    --collection "$COLLECTION"
fi

echo "✅ RAGインデックス作成完了"
