#!/bin/bash
# Sora動画処理スクリプト（WaveSpeedAI統合版 v2）
# ウォーターマーク除去 + 画質向上 + 音声改善

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
echo "🧹 [1/3] ウォーターマーク除去中..."

python3 - <<'PYTHON_SCRIPT'
import requests
import json
import time
import sys
import os
import base64

api_key = os.environ.get('WAVESPEED_API_KEY')
input_file = sys.argv[1]
output_file = sys.argv[2]

# 動画をBase64エンコード
with open(input_file, 'rb') as f:
    video_data = base64.b64encode(f.read()).decode('utf-8')

url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-watermark-remover"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "input": {
        "video": f"data:video/quicktime;base64,{video_data}"
    }
}

print(f"  → APIリクエスト送信中...")
response = requests.post(url, headers=headers, json=payload)

if response.status_code != 200 and response.status_code != 201:
    print(f"❌ エラー: {response.status_code}", file=sys.stderr)
    print(response.text, file=sys.stderr)
    sys.exit(1)

result = response.json()
prediction_id = result.get('id')

if not prediction_id:
    print(f"❌ エラー: prediction IDなし", file=sys.stderr)
    print(json.dumps(result, indent=2), file=sys.stderr)
    sys.exit(1)

print(f"  → タスクID: {prediction_id}")

# ステータス確認（ポーリング）
get_url = f"https://api.wavespeed.ai/api/v3/predictions/{prediction_id}"
max_attempts = 60

for attempt in range(max_attempts):
    time.sleep(10)
    
    status_response = requests.get(get_url, headers=headers)
    status_data = status_response.json()
    
    status = status_data.get('status')
    print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
    
    if status == 'succeeded':
        output_url = status_data.get('output')
        if isinstance(output_url, list):
            output_url = output_url[0]
        
        if output_url:
            # Base64データの場合
            if output_url.startswith('data:'):
                import re
                match = re.match(r'data:.*?;base64,(.*)', output_url)
                if match:
                    video_bytes = base64.b64decode(match.group(1))
                    with open(output_file, 'wb') as f:
                        f.write(video_bytes)
            else:
                # URLの場合
                video_response = requests.get(output_url)
                with open(output_file, 'wb') as f:
                    f.write(video_response.content)
            
            print(f"  ✅ 完了: {output_file}")
            sys.exit(0)
        else:
            print("❌ エラー: output URLなし", file=sys.stderr)
            sys.exit(1)
    
    elif status == 'failed':
        error = status_data.get('error', 'Unknown error')
        print(f"❌ エラー: {error}", file=sys.stderr)
        sys.exit(1)

print("❌ エラー: タイムアウト", file=sys.stderr)
sys.exit(1)
PYTHON_SCRIPT "$INPUT_VIDEO" "$WORKDIR/step1_watermark_removed.mp4"

if [ $? -ne 0 ]; then
    echo "❌ ウォーターマーク除去失敗"
    exit 1
fi

STEP1_OUTPUT="$WORKDIR/step1_watermark_removed.mp4"

if [ ! -f "$STEP1_OUTPUT" ]; then
    echo "❌ 出力ファイルが見つかりません"
    exit 1
fi

# ========================================
# ステップ2: 画質向上（Video Upscaler Pro）
# ========================================
echo ""
echo "🎨 [2/3] 画質向上中（4K超解像）..."

python3 - <<'PYTHON_SCRIPT'
import requests
import json
import time
import sys
import os
import base64
import re

api_key = os.environ.get('WAVESPEED_API_KEY')
input_file = sys.argv[1]
output_file = sys.argv[2]

# 動画をBase64エンコード
with open(input_file, 'rb') as f:
    video_data = base64.b64encode(f.read()).decode('utf-8')

url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-upscaler-pro"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "input": {
        "video": f"data:video/mp4;base64,{video_data}",
        "scale": 2
    }
}

print(f"  → APIリクエスト送信中...")
response = requests.post(url, headers=headers, json=payload)

if response.status_code != 200 and response.status_code != 201:
    print(f"❌ エラー: {response.status_code}", file=sys.stderr)
    print(response.text, file=sys.stderr)
    sys.exit(1)

result = response.json()
prediction_id = result.get('id')

if not prediction_id:
    print(f"❌ エラー: prediction IDなし", file=sys.stderr)
    print(json.dumps(result, indent=2), file=sys.stderr)
    sys.exit(1)

print(f"  → タスクID: {prediction_id}")

# ステータス確認（ポーリング）
get_url = f"https://api.wavespeed.ai/api/v3/predictions/{prediction_id}"
max_attempts = 60

for attempt in range(max_attempts):
    time.sleep(10)
    
    status_response = requests.get(get_url, headers=headers)
    status_data = status_response.json()
    
    status = status_data.get('status')
    print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
    
    if status == 'succeeded':
        output_url = status_data.get('output')
        if isinstance(output_url, list):
            output_url = output_url[0]
        
        if output_url:
            # Base64データの場合
            if output_url.startswith('data:'):
                match = re.match(r'data:.*?;base64,(.*)', output_url)
                if match:
                    video_bytes = base64.b64decode(match.group(1))
                    with open(output_file, 'wb') as f:
                        f.write(video_bytes)
            else:
                # URLの場合
                video_response = requests.get(output_url)
                with open(output_file, 'wb') as f:
                    f.write(video_response.content)
            
            print(f"  ✅ 完了: {output_file}")
            sys.exit(0)
        else:
            print("❌ エラー: output URLなし", file=sys.stderr)
            sys.exit(1)
    
    elif status == 'failed':
        error = status_data.get('error', 'Unknown error')
        print(f"❌ エラー: {error}", file=sys.stderr)
        sys.exit(1)

print("❌ エラー: タイムアウト", file=sys.stderr)
sys.exit(1)
PYTHON_SCRIPT "$STEP1_OUTPUT" "$WORKDIR/step2_upscaled.mp4"

if [ $? -ne 0 ]; then
    echo "❌ 画質向上失敗"
    exit 1
fi

STEP2_OUTPUT="$WORKDIR/step2_upscaled.mp4"

if [ ! -f "$STEP2_OUTPUT" ]; then
    echo "❌ 出力ファイルが見つかりません"
    exit 1
fi

# ========================================
# ステップ3: Adobe Podcast音声改善
# ========================================
echo ""
echo "🎙️ [3/3] Adobe Podcast音声改善中..."

FINAL_OUTPUT="$OUTPUT_DIR/${BASENAME}_final_${TIMESTAMP}.mp4"

bash /root/clawd/skills/ffmpeg-video-processor/adobe-enhance-audio.sh \
    "$STEP2_OUTPUT" \
    "$FINAL_OUTPUT"

if [ ! -f "$FINAL_OUTPUT" ]; then
    echo "⚠️ Adobe Podcast処理失敗、元のファイルを使用します"
    FINAL_OUTPUT="$STEP2_OUTPUT"
    cp "$STEP2_OUTPUT" "$OUTPUT_DIR/${BASENAME}_final_${TIMESTAMP}.mp4"
    FINAL_OUTPUT="$OUTPUT_DIR/${BASENAME}_final_${TIMESTAMP}.mp4"
else
    echo "  ✅ 音声改善完了"
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
echo "✅ 完全処理完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 出力ファイル: $FINAL_OUTPUT"
echo "☁️ Google Drive: $GDRIVE_URL"
echo "⏰ 完了時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Discord通知用の情報を出力
echo "FINAL_OUTPUT=$FINAL_OUTPUT" > /tmp/wavespeed_result.txt
echo "GDRIVE_URL=$GDRIVE_URL" >> /tmp/wavespeed_result.txt
