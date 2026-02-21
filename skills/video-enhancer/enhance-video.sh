#!/bin/bash
# Sora動画の画質改善スクリプト
# Usage: ./enhance-video.sh input.mp4 output.mp4

set -e

INPUT="$1"
OUTPUT="$2"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
    echo "Usage: $0 <input.mp4> <output.mp4>"
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "❌ エラー: 入力ファイルが見つかりません: $INPUT"
    exit 1
fi

echo "🎬 動画処理開始..."
echo "📥 入力: $INPUT"
echo "📤 出力: $OUTPUT"

# ffmpegで画質改善
# - hqdn3d: ノイズ除去（4:3:6:4.5 = 軽めのノイズ除去）
# - unsharp: シャープ化（5:5:1.0 = 軽めのシャープ）
# - libx264: H.264エンコーダー
# - preset slow: 高品質（処理時間↑、品質↑）
# - crf 18: 高品質（18-23推奨、低いほど高品質）
# - aac: 音声コーデック、192k: 高音質

ffmpeg -i "$INPUT" \
    -vf "hqdn3d=4:3:6:4.5,unsharp=5:5:1.0:5:5:0.0" \
    -c:v libx264 -preset slow -crf 18 \
    -c:a aac -b:a 192k \
    -movflags +faststart \
    "$OUTPUT" \
    -y

if [ -f "$OUTPUT" ]; then
    echo "✅ 処理完了！"
    echo "📊 ファイルサイズ比較:"
    echo "  元動画: $(du -h "$INPUT" | cut -f1)"
    echo "  処理後: $(du -h "$OUTPUT" | cut -f1)"
else
    echo "❌ エラー: 処理に失敗しました"
    exit 1
fi
