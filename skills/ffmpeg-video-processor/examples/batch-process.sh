#!/bin/bash
# 複数動画の一括処理スクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROCESSOR="$SCRIPT_DIR/../video-processor.sh"

if [ $# -lt 1 ]; then
    echo "使い方: $0 <動画ディレクトリ>"
    exit 1
fi

VIDEO_DIR="$1"

if [ ! -d "$VIDEO_DIR" ]; then
    echo "❌ エラー: ディレクトリが見つかりません: $VIDEO_DIR"
    exit 1
fi

echo "📂 バッチ処理を開始します..."
echo "ディレクトリ: $VIDEO_DIR"

$PROCESSOR batch "$VIDEO_DIR"

echo "✅ すべての動画の処理が完了しました！"
