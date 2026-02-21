#!/bin/bash
# Sora動画処理スクリプト（WaveSpeedAI統合版）
# ウォーターマーク除去 + 画質向上

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
WORKDIR="/tmp/wavespeed_${TIMESTAMP}"
OUTPUT_DIR="/root/.clawdbot/media/outbound"

mkdir -p "$WORKDIR"
mkdir -p "$OUTPUT_DIR"

echo "🎬 WaveSpeedAI処理開始"
echo "📁 入力: $INPUT_VIDEO"
echo "⏰ 開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# APIキー確認
if [ -z "$WAVESPEED_API_KEY" ]; then
    echo "❌ エラー: WAVESPEED_API_KEY が設定されていません"
    exit 1
fi

# ========================================
# ステップ1: ウォーターマーク除去
# ========================================
echo "🧹 [1/2] ウォーターマーク除去中..."

STEP1_RESULT=$(python3 - <<PYTHON_SCRIPT
import requests
import json
import time
import sys
import os

api_key = os.environ.get('WAVESPEED_API_KEY')
input_file = "$INPUT_VIDEO"

# ファイルをアップロード
url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-watermark-remover"
headers = {
    "Authorization": f"Bearer {api_key}"
}

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
max_attempts = 60  # 最大10分待機

for attempt in range(max_attempts):
    time.sleep(10)  # 10秒ごとにチェック
    
    status_response = requests.get(status_url, headers=headers)
    status_data = status_response.json()
    
    status = status_data.get('status')
    print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
    
    if status == 'succeeded':
        output_url = status_data.get('output')
        if output_url:
            # 結果をダウンロード
            video_response = requests.get(output_url)
            output_path = "$WORKDIR/step1_watermark_removed.mp4"
            
            with open(output_path, 'wb') as f:
                f.write(video_response.content)
            
            print(f"  ✅ 完了: {output_path}")
            print(output_path)
            sys.exit(0)
        else:
            print("Error: No output URL", file=sys.stderr)
            sys.exit(1)
    
    elif status == 'failed':
        print(f"Error: Task failed", file=sys.stderr)
        print(json.dumps(status_data, indent=2), file=sys.stderr)
        sys.exit(1)

print("Error: Timeout waiting for completion", file=sys.stderr)
sys.exit(1)
PYTHON_SCRIPT
)

if [ $? -ne 0 ]; then
    echo "❌ ウォーターマーク除去失敗"
    exit 1
fi

STEP1_OUTPUT=$(echo "$STEP1_RESULT" | tail -1)

if [ ! -f "$STEP1_OUTPUT" ]; then
    echo "❌ 出力ファイルが見つかりません: $STEP1_OUTPUT"
    exit 1
fi

# ========================================
# ステップ2: 画質向上（Video Upscaler Pro）
# ========================================
echo ""
echo "🎨 [2/2] 画質向上中（4K超解像）..."

FINAL_OUTPUT="$OUTPUT_DIR/${BASENAME}_enhanced_${TIMESTAMP}.mp4"

STEP2_RESULT=$(python3 - <<PYTHON_SCRIPT
import requests
import json
import time
import sys
import os

api_key = os.environ.get('WAVESPEED_API_KEY')
input_file = "$STEP1_OUTPUT"

# ファイルをアップロード
url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-upscaler-pro"
headers = {
    "Authorization": f"Bearer {api_key}"
}

# 動画ファイルを送信
with open(input_file, 'rb') as f:
    files = {'video': f}
    data = {
        'scale': 2,  # 2倍超解像
        'quality': 'high'
    }
    response = requests.post(url, headers=headers, files=files, data=data)

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
max_attempts = 60  # 最大10分待機

for attempt in range(max_attempts):
    time.sleep(10)  # 10秒ごとにチェック
    
    status_response = requests.get(status_url, headers=headers)
    status_data = status_response.json()
    
    status = status_data.get('status')
    print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
    
    if status == 'succeeded':
        output_url = status_data.get('output')
        if output_url:
            # 結果をダウンロード
            video_response = requests.get(output_url)
            output_path = "$FINAL_OUTPUT"
            
            with open(output_path, 'wb') as f:
                f.write(video_response.content)
            
            print(f"  ✅ 完了: {output_path}")
            print(output_path)
            sys.exit(0)
        else:
            print("Error: No output URL", file=sys.stderr)
            sys.exit(1)
    
    elif status == 'failed':
        print(f"Error: Task failed", file=sys.stderr)
        print(json.dumps(status_data, indent=2), file=sys.stderr)
        sys.exit(1)

print("Error: Timeout waiting for completion", file=sys.stderr)
sys.exit(1)
PYTHON_SCRIPT
)

if [ $? -ne 0 ]; then
    echo "❌ 画質向上失敗"
    exit 1
fi

# ========================================
# ステップ3: Adobe Podcast音声改善
# ========================================
echo ""
echo "🎙️ [3/3] Adobe Podcast音声改善中..."

FINAL_WITH_AUDIO="$OUTPUT_DIR/${BASENAME}_final_${TIMESTAMP}.mp4"

bash /root/clawd/skills/ffmpeg-video-processor/adobe-enhance-audio.sh \
    "$FINAL_OUTPUT" \
    "$FINAL_WITH_AUDIO"

if [ ! -f "$FINAL_WITH_AUDIO" ]; then
    echo "⚠️ Adobe Podcast処理失敗、元のファイルを使用します"
    FINAL_WITH_AUDIO="$FINAL_OUTPUT"
else
    echo "  ✅ 音声改善完了"
fi

# ========================================
# Google Driveアップロード
# ========================================
echo ""
echo "☁️ Google Driveにアップロード中..."

rclone copy "$FINAL_WITH_AUDIO" gdrive:ProcessedVideos/ --progress

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
echo "✅ 完全処理完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 出力ファイル: $FINAL_WITH_AUDIO"
echo "☁️ Google Drive: $GDRIVE_URL"
echo "⏰ 完了時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Discord通知用の情報を出力
echo "FINAL_OUTPUT=$FINAL_WITH_AUDIO" > /tmp/wavespeed_result.txt
echo "GDRIVE_URL=$GDRIVE_URL" >> /tmp/wavespeed_result.txt
