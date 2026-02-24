#!/bin/bash
# rag-search.sh - RAG検索システム

set -euo pipefail

KNOWLEDGE_DIR="/root/clawd/knowledge"
INDEX_FILE="$KNOWLEDGE_DIR/embeddings.index"
METADATA_FILE="$KNOWLEDGE_DIR/metadata.json"
PYTHON_SCRIPT="/root/clawd/scripts/rag-index.py"
VENV_DIR="/root/venv"

# 初期化
init() {
    mkdir -p "$KNOWLEDGE_DIR"
    echo "✅ knowledge/ ディレクトリ作成完了"
}

# インデックス作成
index() {
    echo "🔄 インデックス作成開始..."
    
    # 対象ファイル収集
    local files=(
        "/root/clawd/tasks/lessons.md"
        "/root/clawd/tasks/successes.md"
    )
    
    # スキルファイル追加
    for skill_file in /root/clawd/skills/*/SKILL.md; do
        if [ -f "$skill_file" ]; then
            files+=("$skill_file")
        fi
    done
    
    echo "📄 対象ファイル: ${#files[@]}個"
    
    # Pythonスクリプト実行
    source "$VENV_DIR/bin/activate"
    python3 "$PYTHON_SCRIPT" index "${files[@]}"
    
    echo "✅ インデックス作成完了"
}

# 検索
search() {
    local query="$1"
    local top_k="${2:-3}"
    
    if [ ! -f "$INDEX_FILE" ]; then
        echo "⚠️ インデックスが作成されていません。まず 'bash $0 index' を実行してください。"
        return 1
    fi
    
    echo "🔍 検索中: \"$query\""
    
    # Pythonスクリプト実行
    source "$VENV_DIR/bin/activate"
    python3 "$PYTHON_SCRIPT" search "$query" "$top_k"
}

case "${1:-}" in
    init)
        init
        ;;
    index)
        index
        ;;
    search)
        if [ $# -lt 2 ]; then
            echo "使い方: $0 search <query> [top_k]"
            exit 1
        fi
        search "$2" "${3:-3}"
        ;;
    *)
        echo "使い方: $0 {init|index|search}"
        exit 1
        ;;
esac
