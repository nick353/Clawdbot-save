#!/bin/bash
# RAG検索システム - 過去の実装例・成功パターンを検索

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_VENV="/root/venv/bin/python3"
RAG_INDEX_PY="$SCRIPT_DIR/rag-index.py"

# 使い方
usage() {
  echo "使い方:"
  echo "  インデックス作成: bash rag-search.sh index"
  echo "  検索: bash rag-search.sh search 'クエリ'"
  echo "  検索（トップK指定）: bash rag-search.sh search 'クエリ' --top-k 5"
  exit 1
}

# インデックス作成
if [ "${1:-}" = "index" ]; then
  echo "📚 RAGインデックスを作成します..."
  $PYTHON_VENV "$RAG_INDEX_PY" index
  exit 0
fi

# 検索
if [ "${1:-}" = "search" ]; then
  if [ -z "${2:-}" ]; then
    echo "❌ クエリを指定してください"
    usage
  fi
  
  QUERY="$2"
  TOP_K="${3:-3}"
  
  echo "🔍 検索中: '$QUERY'"
  $PYTHON_VENV "$RAG_INDEX_PY" search "$QUERY"
  exit 0
fi

# 不明なコマンド
usage
