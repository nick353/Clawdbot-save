#!/bin/bash
# Adobe Podcast API自動音声改善スクリプト
# 完全自動化版

set -e

source ~/.profile

INPUT_VIDEO="$1"
OUTPUT_VIDEO="$2"

if [ -z "$INPUT_VIDEO" ] || [ -z "$OUTPUT_VIDEO" ]; then
    echo "使い方: $0 <input_video> <output_video>"
    exit 1
fi

WORKDIR="/tmp/adobe-api-enhance-$$"
mkdir -p "$WORKDIR"

echo "🎙️ Adobe Podcast API自動音声改善開始"
echo "入力: $INPUT_VIDEO"
echo "出力: $OUTPUT_VIDEO"
echo ""

# ステップ1: 音声抽出
echo "📤 [1/4] 音声抽出中..."
ffmpeg -i "$INPUT_VIDEO" -vn -acodec pcm_s16le -ar 44100 -ac 2 "$WORKDIR/audio.wav" -y -loglevel error
echo "✅ 音声抽出完了"

# ステップ2: Adobe Podcast APIで処理
echo "🎵 [2/4] Adobe Podcast API処理中..."

python3 - <<'PYEOF'
import requests
import json
import time
import sys
import os

token = os.environ.get('ADOBE_PODCAST_TOKEN')
audio_file = sys.argv[1]
output_file = sys.argv[2]

# アップロード
upload_url = "https://podcast.adobe.com/api/v1/upload"
headers = {"Authorization": f"Bearer {token}"}

with open(audio_file, 'rb') as f:
    files = {'audio': f}
    print("  → アップロード中...")
    response = requests.post(upload_url, headers=headers, files=files)

if response.status_code != 200:
    print(f"❌ アップロード失敗: {response.status_code}")
    print(response.text)
    sys.exit(1)

result = response.json()
job_id = result.get('jobId') or result.get('id')

if not job_id:
    print(f"❌ JobIDなし: {result}")
    sys.exit(1)

print(f"  → JobID: {job_id}")

# ポーリング
status_url = f"https://podcast.adobe.com/api/v1/jobs/{job_id}"
max_attempts = 60

for attempt in range(max_attempts):
    time.sleep(5)
    
    status_response = requests.get(status_url, headers=headers)
    status_data = status_response.json()
    
    status = status_data.get('status')
    print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
    
    if status == 'completed':
        download_url = status_data.get('downloadUrl') or status_data.get('output')
        
        if download_url:
            print("  → ダウンロード中...")
            download_response = requests.get(download_url)
            
            with open(output_file, 'wb') as f:
                f.write(download_response.content)
            
            print(f"✅ 完了: {output_file}")
            sys.exit(0)
        else:
            print("❌ ダウンロードURLなし")
            sys.exit(1)
    
    elif status == 'failed':
        error = status_data.get('error', 'Unknown error')
        print(f"❌ 失敗: {error}")
        sys.exit(1)

print("❌ タイムアウト")
sys.exit(1)
PYEOF "$WORKDIR/audio.wav" "$WORKDIR/enhanced_audio.wav"

if [ ! -f "$WORKDIR/enhanced_audio.wav" ]; then
    echo "❌ Adobe Podcast処理失敗"
    exit 1
fi

# ステップ3: 音声を動画に結合
echo "🎬 [3/4] 音声を動画に結合中..."
ffmpeg -i "$INPUT_VIDEO" -i "$WORKDIR/enhanced_audio.wav" \
    -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 \
    -shortest "$OUTPUT_VIDEO" -y -loglevel error
echo "✅ 結合完了"

# ステップ4: クリーンアップ
echo "🧹 [4/4] 一時ファイル削除中..."
rm -rf "$WORKDIR"

echo ""
echo "✅ Adobe Podcast API処理完了！"
echo "出力: $OUTPUT_VIDEO"
