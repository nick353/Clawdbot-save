#!/bin/bash
# Sora動画完全処理スクリプト（WaveSpeedAI + Adobe Podcast + Google Drive）
# 作成: リッキー 🐥

set -e

# 環境変数読み込み
if [ -f ~/.profile ]; then
    source ~/.profile
fi

# 引数チェック
if [ -z "$1" ]; then
    echo "使い方: $0 <input_video.mp4>"
    exit 1
fi

INPUT_VIDEO="$1"
BASENAME=$(basename "$INPUT_VIDEO" | sed 's/\.\(mp4\|mov\)$//')
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WORKDIR="/tmp/sora_process_${TIMESTAMP}"
OUTPUT_DIR="/root/.clawdbot/media/outbound"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$WORKDIR"
mkdir -p "$OUTPUT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎬 Sora動画完全処理開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 入力: $INPUT_VIDEO"
echo "⏰ 開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# APIキー確認
if [ -z "$WAVESPEED_API_KEY" ]; then
    echo "❌ エラー: WAVESPEED_API_KEY が設定されていません"
    exit 1
fi

# ========================================
# ステップ0: 元動画をGoogle Driveにアップロード
# ========================================
echo "☁️ [0/5] 元動画をGoogle Driveにアップロード中..."

ORIGINAL_NAME="${BASENAME}_original_${TIMESTAMP}.mp4"
cp "$INPUT_VIDEO" "$WORKDIR/$ORIGINAL_NAME"

rclone copy "$WORKDIR/$ORIGINAL_NAME" gdrive:OriginalVideos/ --progress 2>&1 | tail -3 || true

ORIGINAL_GDRIVE_URL=$(rclone link "gdrive:OriginalVideos/$ORIGINAL_NAME" 2>&1 || echo "https://drive.google.com/drive/folders/OriginalVideos")

echo "  ✅ 元動画アップロード完了"
echo "  📎 リンク: $ORIGINAL_GDRIVE_URL"
echo ""

# ========================================
# ステップ1: ウォーターマーク除去
# ========================================
echo "🧹 [1/5] ウォーターマーク除去中..."

STEP1_OUTPUT="$WORKDIR/step1_watermark_removed.mp4"

python3 - <<PYTHON_SCRIPT
import requests
import json
import time
import sys
import os

api_key = os.environ.get('WAVESPEED_API_KEY')
input_file = "$INPUT_VIDEO"

# ファイルをアップロード
url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-watermark-remover"
headers = {"Authorization": f"Bearer {api_key}"}

# 動画ファイルを送信
with open(input_file, 'rb') as f:
    files = {'video': f}
    response = requests.post(url, headers=headers, files=files)

if response.status_code != 200:
    print(f"Error: {response.status_code}", file=sys.stderr)
    print(response.text, file=sys.stderr)
    sys.exit(1)

result = response.json()
prediction_id = result.get('id') or result.get('prediction_id')

if not prediction_id:
    print(f"Error: No prediction ID in response", file=sys.stderr)
    print(json.dumps(result, indent=2), file=sys.stderr)
    sys.exit(1)

print(f"  → タスクID: {prediction_id}")

# ステータス確認（ポーリング）
status_url = f"{url}/{prediction_id}"
max_attempts = 60

for attempt in range(max_attempts):
    time.sleep(10)
    
    status_response = requests.get(status_url, headers=headers)
    status_data = status_response.json()
    
    status = status_data.get('status')
    print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
    
    if status == 'succeeded':
        output_url = status_data.get('output')
        if output_url:
            video_response = requests.get(output_url)
            output_path = "$STEP1_OUTPUT"
            
            with open(output_path, 'wb') as f:
                f.write(video_response.content)
            
            print(f"  ✅ 完了: {output_path}")
            sys.exit(0)
        else:
            print("Error: No output URL", file=sys.stderr)
            sys.exit(1)
    
    elif status == 'failed':
        print(f"Error: Task failed", file=sys.stderr)
        print(json.dumps(status_data, indent=2), file=sys.stderr)
        sys.exit(1)

print("Error: Timeout", file=sys.stderr)
sys.exit(1)
PYTHON_SCRIPT

if [ $? -ne 0 ] || [ ! -f "$STEP1_OUTPUT" ]; then
    echo "❌ ウォーターマーク除去失敗"
    exit 1
fi

echo ""

# ========================================
# ステップ2: 画質向上（Video Upscaler Pro）
# ========================================
echo "🎨 [2/5] 画質向上中（4K超解像）..."

STEP2_OUTPUT="$WORKDIR/step2_upscaled.mp4"

python3 - <<PYTHON_SCRIPT
import requests
import json
import time
import sys
import os

api_key = os.environ.get('WAVESPEED_API_KEY')
input_file = "$STEP1_OUTPUT"

url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-upscaler-pro"
headers = {"Authorization": f"Bearer {api_key}"}

with open(input_file, 'rb') as f:
    files = {'video': f}
    data = {'scale': 2, 'quality': 'high'}
    response = requests.post(url, headers=headers, files=files, data=data)

if response.status_code != 200:
    print(f"Error: {response.status_code}", file=sys.stderr)
    print(response.text, file=sys.stderr)
    sys.exit(1)

result = response.json()
prediction_id = result.get('id') or result.get('prediction_id')

if not prediction_id:
    print(f"Error: No prediction ID", file=sys.stderr)
    sys.exit(1)

print(f"  → タスクID: {prediction_id}")

status_url = f"{url}/{prediction_id}"
max_attempts = 60

for attempt in range(max_attempts):
    time.sleep(10)
    
    status_response = requests.get(status_url, headers=headers)
    status_data = status_response.json()
    
    status = status_data.get('status')
    print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
    
    if status == 'succeeded':
        output_url = status_data.get('output')
        if output_url:
            video_response = requests.get(output_url)
            output_path = "$STEP2_OUTPUT"
            
            with open(output_path, 'wb') as f:
                f.write(video_response.content)
            
            print(f"  ✅ 完了: {output_path}")
            sys.exit(0)
        else:
            print("Error: No output URL", file=sys.stderr)
            sys.exit(1)
    
    elif status == 'failed':
        print(f"Error: Task failed", file=sys.stderr)
        sys.exit(1)

print("Error: Timeout", file=sys.stderr)
sys.exit(1)
PYTHON_SCRIPT

if [ $? -ne 0 ] || [ ! -f "$STEP2_OUTPUT" ]; then
    echo "❌ 画質向上失敗"
    exit 1
fi

echo ""

# ========================================
# ステップ3: 音声抽出
# ========================================
echo "🎙️ [3/5] 音声抽出中..."

AUDIO_EXTRACTED="$WORKDIR/audio_extracted.wav"

ffmpeg -i "$STEP2_OUTPUT" -vn -acodec pcm_s16le -ar 44100 -ac 2 "$AUDIO_EXTRACTED" -y -loglevel error

if [ ! -f "$AUDIO_EXTRACTED" ]; then
    echo "❌ 音声抽出失敗"
    exit 1
fi

echo "  ✅ 音声抽出完了"
echo ""

# ========================================
# ステップ4: Adobe Podcast音声改善（Playwright）
# ========================================
echo "🎵 [4/5] Adobe Podcast音声改善中（Playwright自動化）..."

AUDIO_ENHANCED="$WORKDIR/audio_enhanced.wav"

cd "$SCRIPT_DIR"
source adobe-venv/bin/activate

python3 adobe-podcast-auto-v3.py "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED" adobe-cookies.json

if [ ! -f "$AUDIO_ENHANCED" ]; then
    echo "⚠️ Adobe Podcast処理失敗、元の音声を使用します"
    AUDIO_ENHANCED="$AUDIO_EXTRACTED"
else
    echo "  ✅ 音声改善完了"
fi

echo ""

# ========================================
# ステップ5: 音声を動画に結合
# ========================================
echo "🎬 [5/5] 音声を動画に結合中..."

FINAL_OUTPUT="$OUTPUT_DIR/${BASENAME}_final_${TIMESTAMP}.mp4"

ffmpeg -i "$STEP2_OUTPUT" -i "$AUDIO_ENHANCED" \
    -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 \
    -shortest "$FINAL_OUTPUT" -y -loglevel error

if [ ! -f "$FINAL_OUTPUT" ]; then
    echo "❌ 動画結合失敗"
    exit 1
fi

echo "  ✅ 結合完了"
echo ""

# ========================================
# ステップ6: 処理済み動画をGoogle Driveにアップロード
# ========================================
echo "☁️ 処理済み動画をGoogle Driveにアップロード中..."

rclone copy "$FINAL_OUTPUT" gdrive:ProcessedVideos/ --progress 2>&1 | tail -3 || true

PROCESSED_GDRIVE_URL=$(rclone link "gdrive:ProcessedVideos/$(basename $FINAL_OUTPUT)" 2>&1 || echo "https://drive.google.com/drive/folders/ProcessedVideos")

echo "  ✅ 処理済み動画アップロード完了"
echo "  📎 リンク: $PROCESSED_GDRIVE_URL"
echo ""

# ========================================
# クリーンアップ
# ========================================
echo "🧹 一時ファイル削除中..."
rm -rf "$WORKDIR"

# ========================================
# 完了報告
# ========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 完全処理完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 最終出力: $FINAL_OUTPUT"
echo ""
echo "☁️ Google Drive:"
echo "  📤 元動画: $ORIGINAL_GDRIVE_URL"
echo "  📥 処理済み: $PROCESSED_GDRIVE_URL"
echo ""
echo "⏰ 完了時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Discord通知用の情報を出力
cat > /tmp/sora_process_result.txt <<EOF
FINAL_OUTPUT=$FINAL_OUTPUT
ORIGINAL_GDRIVE_URL=$ORIGINAL_GDRIVE_URL
PROCESSED_GDRIVE_URL=$PROCESSED_GDRIVE_URL
EOF
