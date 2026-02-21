#!/bin/bash
# Adobe Podcast API自動音声改善（シンプル版）

set -e

source ~/.profile

INPUT_VIDEO="$1"
OUTPUT_VIDEO="$2"

if [ -z "$INPUT_VIDEO" ] || [ -z "$OUTPUT_VIDEO" ]; then
    echo "使い方: $0 <input_video> <output_video>"
    exit 1
fi

WORKDIR="/tmp/adobe-simple-$$"
mkdir -p "$WORKDIR"

echo "🎙️ Adobe Podcast API自動音声改善"
echo "入力: $INPUT_VIDEO"
echo "出力: $OUTPUT_VIDEO"
echo ""

# ステップ1: 音声抽出
echo "📤 [1/4] 音声抽出中..."
ffmpeg -i "$INPUT_VIDEO" -vn -acodec pcm_s16le -ar 44100 -ac 2 "$WORKDIR/audio.wav" -y -loglevel error
echo "✅ 音声抽出完了"

# ステップ2: Adobe Podcast API処理
echo "🎵 [2/4] Adobe Podcast API処理中..."
python3 /root/clawd/skills/ffmpeg-video-processor/adobe-api-v2.py "$WORKDIR/audio.wav" "$WORKDIR/enhanced.wav"

if [ ! -f "$WORKDIR/enhanced.wav" ]; then
    echo "❌ Adobe Podcast処理失敗"
    rm -rf "$WORKDIR"
    exit 1
fi

# ステップ3: 音声を動画に結合
echo "🎬 [3/4] 音声を動画に結合中..."
ffmpeg -i "$INPUT_VIDEO" -i "$WORKDIR/enhanced.wav" \
    -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 \
    -shortest "$OUTPUT_VIDEO" -y -loglevel error
echo "✅ 結合完了"

# ステップ4: クリーンアップ
echo "🧹 [4/4] 一時ファイル削除中..."
rm -rf "$WORKDIR"

echo ""
echo "✅ 処理完了！"
echo "出力: $OUTPUT_VIDEO"
