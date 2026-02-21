#!/bin/bash
# B-1 Workflow: ProPainter + Real-ESRGAN + Adobe Podcast
# 完全自動処理スクリプト

set -e

# 設定読み込み
. ~/.profile

# 引数チェック
if [ -z "$1" ]; then
    echo "使用方法: $0 <input_video.mp4>"
    exit 1
fi

INPUT_VIDEO="$1"
BASENAME=$(basename "$INPUT_VIDEO" .mp4)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WORKDIR="/tmp/b1_workflow_${TIMESTAMP}"
OUTPUT_DIR="/root/.clawdbot/media/outbound"

mkdir -p "$WORKDIR"
mkdir -p "$OUTPUT_DIR"

echo "🎬 B-1ワークフロー開始"
echo "📁 入力: $INPUT_VIDEO"
echo "⏰ 開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"

# ========================================
# ステップ1: ProPainter（ウォーターマーク除去）
# ========================================
echo ""
echo "🔧 [1/3] ProPainter - ウォーターマーク除去中..."

python3 - <<PYTHON_SCRIPT
import replicate
import os
import sys

input_video = "$INPUT_VIDEO"
output_path = "$WORKDIR/step1_propainter.mp4"

try:
    print("  → ProPainter API呼び出し...")
    output = replicate.run(
        "sczhou/propainter:4e5e67ff5d0dbf4a7e9ff8b61c4ba4d09acdcbe2be0f48c0cc57b63f8e32f9e9",
        input={
            "video": open(input_video, "rb"),
            "mask_type": "auto",
            "dilate_radius": 15
        }
    )
    
    # 結果をダウンロード
    import urllib.request
    urllib.request.urlretrieve(output, output_path)
    print(f"  ✅ 完了: {output_path}")
    
except Exception as e:
    print(f"  ❌ エラー: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT

if [ ! -f "$WORKDIR/step1_propainter.mp4" ]; then
    echo "❌ ProPainter処理失敗"
    exit 1
fi

# ========================================
# ステップ2: Real-ESRGAN（画質改善）
# ========================================
echo ""
echo "🎨 [2/3] Real-ESRGAN - 画質改善中（2倍超解像）..."

python3 - <<PYTHON_SCRIPT
import replicate
import os
import sys

input_video = "$WORKDIR/step1_propainter.mp4"
output_path = "$WORKDIR/step2_esrgan.mp4"

try:
    print("  → Real-ESRGAN API呼び出し...")
    output = replicate.run(
        "xinntao/realesrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        input={
            "video": open(input_video, "rb"),
            "scale": 2,
            "face_enhance": False
        }
    )
    
    # 結果をダウンロード
    import urllib.request
    urllib.request.urlretrieve(output, output_path)
    print(f"  ✅ 完了: {output_path}")
    
except Exception as e:
    print(f"  ❌ エラー: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT

if [ ! -f "$WORKDIR/step2_esrgan.mp4" ]; then
    echo "❌ Real-ESRGAN処理失敗"
    exit 1
fi

# ========================================
# ステップ3: Adobe Podcast（音声改善）
# ========================================
echo ""
echo "🎵 [3/3] Adobe Podcast - 音声改善中..."

FINAL_OUTPUT="$OUTPUT_DIR/${BASENAME}_b1_enhanced_${TIMESTAMP}.mp4"

bash /root/clawd/skills/ffmpeg-video-processor/adobe-enhance-audio.sh \
    "$WORKDIR/step2_esrgan.mp4" \
    "$FINAL_OUTPUT"

if [ ! -f "$FINAL_OUTPUT" ]; then
    echo "❌ Adobe Podcast処理失敗"
    exit 1
fi

# ========================================
# Google Driveアップロード
# ========================================
echo ""
echo "☁️ Google Driveにアップロード中..."

rclone copy "$FINAL_OUTPUT" gdrive:ProcessedVideos/ --progress

GDRIVE_URL="https://drive.google.com/drive/folders/ProcessedVideos"

# ========================================
# クリーンアップ
# ========================================
echo ""
echo "🧹 一時ファイル削除中..."
rm -rf "$WORKDIR"

# ========================================
# 完了報告
# ========================================
echo ""
echo "✅ B-1ワークフロー完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 出力ファイル: $FINAL_OUTPUT"
echo "☁️ Google Drive: $GDRIVE_URL"
echo "⏰ 完了時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Discord通知用の情報を出力
echo "FINAL_OUTPUT=$FINAL_OUTPUT" > /tmp/b1_workflow_result.txt
echo "GDRIVE_URL=$GDRIVE_URL" >> /tmp/b1_workflow_result.txt
