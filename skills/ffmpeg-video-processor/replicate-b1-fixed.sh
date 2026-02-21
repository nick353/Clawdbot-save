#!/bin/bash
# B-1 Fixed Workflow: ffmpeg delogo + Real-ESRGAN + Adobe Podcast
# ProPainterの代わりにffmpeg delogoを使用

set -e

# 設定読み込み
. ~/.profile

# 引数チェック
if [ -z "$1" ]; then
    echo "使用方法: $0 <input_video.mp4> [x] [y] [w] [h]"
    echo "  x,y,w,h: ウォーターマーク位置（省略時は右下を推測）"
    exit 1
fi

INPUT_VIDEO="$1"
BASENAME=$(basename "$INPUT_VIDEO" | sed 's/\.\(mp4\|mov\)$//')
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WORKDIR="/tmp/b1_workflow_${TIMESTAMP}"
OUTPUT_DIR="/root/.clawdbot/media/outbound"

# ウォーターマーク位置（デフォルト: 右下）
WM_X="${2:-1800}"
WM_Y="${3:-980}"
WM_W="${4:-120}"
WM_H="${5:-100}"

mkdir -p "$WORKDIR"
mkdir -p "$OUTPUT_DIR"

echo "🎬 B-1 Fixed ワークフロー開始"
echo "📁 入力: $INPUT_VIDEO"
echo "⏰ 開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"

# 動画情報取得
VIDEO_WIDTH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$INPUT_VIDEO")
VIDEO_HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$INPUT_VIDEO")
echo "📐 解像度: ${VIDEO_WIDTH}x${VIDEO_HEIGHT}"

# Soraのウォーターマークは右下に小さく配置されることが多いので自動推測
# 縦長・横長両方に対応
WM_X=$((VIDEO_WIDTH - 150))
WM_Y=$((VIDEO_HEIGHT - 80))
WM_W=140
WM_H=70

# 位置が動画外にはみ出る場合は調整
if [ $WM_X -lt 0 ]; then WM_X=10; fi
if [ $WM_Y -lt 0 ]; then WM_Y=10; fi
if [ $((WM_X + WM_W)) -gt $VIDEO_WIDTH ]; then WM_W=$((VIDEO_WIDTH - WM_X - 10)); fi
if [ $((WM_Y + WM_H)) -gt $VIDEO_HEIGHT ]; then WM_H=$((VIDEO_HEIGHT - WM_Y - 10)); fi

echo "🎯 ウォーターマーク位置: x=$WM_X, y=$WM_Y, w=$WM_W, h=$WM_H"

# ========================================
# ステップ1: ffmpeg delogo（ウォーターマーク除去）
# ========================================
echo ""
echo "🧹 [1/3] ffmpeg delogo - ウォーターマーク除去中..."

ffmpeg -i "$INPUT_VIDEO" \
    -vf "delogo=x=$WM_X:y=$WM_Y:w=$WM_W:h=$WM_H:show=0" \
    -c:v libx264 -crf 18 -preset fast \
    -c:a copy \
    "$WORKDIR/step1_delogo.mp4" \
    -y -loglevel error

if [ ! -f "$WORKDIR/step1_delogo.mp4" ]; then
    echo "❌ delogo処理失敗"
    exit 1
fi
echo "  ✅ 完了: $WORKDIR/step1_delogo.mp4"

# ========================================
# ステップ2: Real-ESRGAN（画質改善）
# ========================================
echo ""
echo "🎨 [2/3] Real-ESRGAN - 画質改善中（2倍超解像）..."

python3 - <<PYTHON_SCRIPT
import replicate
import os
import sys
import urllib.request

input_video = "$WORKDIR/step1_delogo.mp4"
output_path = "$WORKDIR/step2_esrgan.mp4"

try:
    print("  → Real-ESRGAN API呼び出し...")
    output = replicate.run(
        "xinntao/realesrgan:1b976a4d456ed9e4d1a846597b7614e79eadad3032e9124fa63859db0fd59b56",
        input={
            "video": open(input_video, "rb"),
            "scale": 2,
            "face_enhance": False
        }
    )
    
    # 結果をダウンロード
    if isinstance(output, str):
        urllib.request.urlretrieve(output, output_path)
    else:
        # outputがファイルオブジェクトの場合
        with open(output_path, 'wb') as f:
            f.write(output.read())
    
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
echo "🎙️ [3/3] Adobe Podcast - 音声改善中..."

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

GDRIVE_FILE="ProcessedVideos/$(basename "$FINAL_OUTPUT")"
rclone copy "$FINAL_OUTPUT" gdrive:ProcessedVideos/ --progress

GDRIVE_URL="https://drive.google.com/file/d/$(rclone lsjson gdrive:ProcessedVideos/ | python3 -c "import sys,json; items=json.load(sys.stdin); print([i['ID'] for i in items if i['Name']=='$(basename "$FINAL_OUTPUT")'][0])")/view"

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
echo "✅ B-1 Fixed ワークフロー完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 出力ファイル: $FINAL_OUTPUT"
echo "☁️ Google Drive: $GDRIVE_URL"
echo "⏰ 完了時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Discord通知用の情報を出力
echo "FINAL_OUTPUT=$FINAL_OUTPUT" > /tmp/b1_workflow_result.txt
echo "GDRIVE_URL=$GDRIVE_URL" >> /tmp/b1_workflow_result.txt
