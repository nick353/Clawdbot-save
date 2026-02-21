#!/bin/bash
# SNS用動画最適化スクリプト（軽量化重視）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROCESSOR="$SCRIPT_DIR/../video-processor.sh"

if [ $# -lt 2 ]; then
    echo "使い方: $0 <input.mp4> <output.mp4>"
    exit 1
fi

INPUT="$1"
OUTPUT="$2"

echo "📱 SNS用に最適化します（Instagram, Threads, X等）..."
echo "入力: $INPUT"
echo "出力: $OUTPUT"

$PROCESSOR improve "$INPUT" "$OUTPUT" \
    --preset instagram \
    --denoise low \
    --sharpen low \
    --bitrate 3000k

echo "✅ 完了！SNSにアップロードできます。"
