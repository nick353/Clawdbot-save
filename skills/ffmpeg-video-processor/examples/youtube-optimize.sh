#!/bin/bash
# YouTube用動画最適化スクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROCESSOR="$SCRIPT_DIR/../video-processor.sh"

if [ $# -lt 2 ]; then
    echo "使い方: $0 <input.mp4> <output.mp4>"
    exit 1
fi

INPUT="$1"
OUTPUT="$2"

echo "🎥 YouTube用に最適化します..."
echo "入力: $INPUT"
echo "出力: $OUTPUT"

$PROCESSOR improve "$INPUT" "$OUTPUT" \
    --preset youtube \
    --denoise medium \
    --sharpen medium

echo "✅ 完了！YouTubeにアップロードできます。"
