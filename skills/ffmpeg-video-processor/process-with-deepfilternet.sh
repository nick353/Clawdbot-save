#!/bin/bash
# Sora動画完全処理スクリプト（WaveSpeedAI + DeepFilterNet3 + Google Drive）
# 更新: 2026-02-17 WaveSpeedAI専用アップロードAPI対応
# 作成: リッキー 🐥

set -e

# 環境変数読み込み
if [ -f ~/.profile ]; then
    source ~/.profile
fi
source "$HOME/.cargo/env" 2>/dev/null || true

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
DEEPFILTER_ENV="/root/clawd/envs/deepfilternet"

mkdir -p "$WORKDIR"
mkdir -p "$OUTPUT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎬 Sora動画完全処理開始（DeepFilterNet3版）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 入力: $INPUT_VIDEO"
echo "⏰ 開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# APIキー確認
if [ -z "$WAVESPEED_API_KEY" ]; then
    echo "❌ エラー: WAVESPEED_API_KEY が設定されていません"
    exit 1
fi

# DeepFilterNet環境確認
if [ ! -d "$DEEPFILTER_ENV" ]; then
    echo "❌ エラー: DeepFilterNet環境が見つかりません"
    exit 1
fi

# MOV→MP4変換（必要に応じて）
INPUT_MP4="$WORKDIR/input.mp4"
if [[ "$INPUT_VIDEO" == *.mov ]] || [[ "$INPUT_VIDEO" == *.MOV ]]; then
    echo "🔄 MOV→MP4変換中..."
    ffmpeg -i "$INPUT_VIDEO" -c:v copy -c:a copy "$INPUT_MP4" -y -loglevel error
    echo "  ✅ 変換完了"
else
    cp "$INPUT_VIDEO" "$INPUT_MP4"
fi

# ========================================
# Python処理ヘルパー関数
# ========================================
wavespeed_process() {
    local video_url="$1"
    local model="$2"
    local output_file="$3"

    python3 - <<PYTHON_SCRIPT
import requests
import json
import time
import sys
import os

api_key = os.environ.get('WAVESPEED_API_KEY')
video_url = "$video_url"
model = "$model"

url = f"https://api.wavespeed.ai/api/v3/{model}"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {"video": video_url}
response = requests.post(url, headers=headers, json=payload)

if response.status_code != 200:
    print(f"Error: {response.status_code}: {response.text}", file=sys.stderr)
    sys.exit(1)

result = response.json()
data = result.get('data', result)
task_id = data.get('id')

if not task_id:
    print(f"Error: No task ID", file=sys.stderr)
    sys.exit(1)

print(f"  → タスクID: {task_id}")

# ポーリング
status_url = f"https://api.wavespeed.ai/api/v3/predictions/{task_id}/result"
for attempt in range(60):
    time.sleep(15)
    
    r = requests.get(status_url, headers={"Authorization": f"Bearer {api_key}"})
    d = r.json().get('data', r.json())
    
    status = d.get('status')
    elapsed = d.get('executionTime', 0)
    print(f"  → [{attempt+1}/60] {status} ({elapsed}ms)")
    
    if status in ('succeeded', 'completed'):
        outputs = d.get('outputs', [])
        output_url = outputs[0] if outputs else d.get('output')
        if output_url:
            vid = requests.get(output_url)
            with open("$output_file", 'wb') as f:
                f.write(vid.content)
            print(f"  ✅ 完了: $output_file ({len(vid.content)/1024/1024:.1f}MB)")
            sys.exit(0)
        else:
            print("Error: No output URL", file=sys.stderr)
            sys.exit(1)
    elif status == 'failed':
        print(f"Error: {d.get('error', 'unknown')}", file=sys.stderr)
        sys.exit(1)

print("Error: Timeout", file=sys.stderr)
sys.exit(1)
PYTHON_SCRIPT
}

# ========================================
# ステップ0: WaveSpeedAIにファイルをアップロード
# ========================================
echo "📤 [0/6] WaveSpeedAIにファイルをアップロード中..."

UPLOAD_RESULT=$(python3 - <<PYTHON_SCRIPT
import requests
import os
import sys

api_key = os.environ.get('WAVESPEED_API_KEY')

with open("$INPUT_MP4", 'rb') as f:
    response = requests.post(
        "https://api.wavespeed.ai/api/v3/media/upload/binary",
        headers={"Authorization": f"Bearer {api_key}"},
        files={"file": f}
    )

result = response.json()
if result.get('code') == 200:
    print(result['data']['download_url'])
else:
    print(f"Error: {result}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT
)

if [ -z "$UPLOAD_RESULT" ]; then
    echo "❌ アップロード失敗"
    exit 1
fi

WAVESPEED_VIDEO_URL="$UPLOAD_RESULT"
echo "  ✅ アップロード完了"
echo "  🔗 URL: $WAVESPEED_VIDEO_URL"
echo ""

# ========================================
# ステップ0.5: 元動画をGoogle Driveにバックアップ
# ========================================
echo "☁️ [0.5/6] 元動画をGoogle Driveにバックアップ中..."

ORIGINAL_NAME="${BASENAME}_original_${TIMESTAMP}.mp4"
rclone copy "$INPUT_MP4" gdrive:OriginalVideos/ --transfers=1 2>&1 | tail -2 || true
ORIGINAL_GDRIVE_URL=$(rclone link "gdrive:OriginalVideos/$(basename $INPUT_MP4)" 2>&1 || echo "gdrive:OriginalVideos")

echo "  ✅ バックアップ完了"
echo "  📎 $ORIGINAL_GDRIVE_URL"
echo ""

# ========================================
# ステップ1: ウォーターマーク除去
# ========================================
echo "🧹 [1/6] ウォーターマーク除去中..."

STEP1_OUTPUT="$WORKDIR/step1_watermark_removed.mp4"
CURRENT_URL="$WAVESPEED_VIDEO_URL"

if wavespeed_process "$CURRENT_URL" "wavespeed-ai/video-watermark-remover" "$STEP1_OUTPUT"; then
    # ステップ2用にWaveSpeedAIに再アップロード
    echo "  📤 ステップ2用にアップロード中..."
    CURRENT_URL=$(python3 - <<PYTHON_SCRIPT
import requests, os, sys
api_key = os.environ.get('WAVESPEED_API_KEY')
with open("$STEP1_OUTPUT", 'rb') as f:
    r = requests.post("https://api.wavespeed.ai/api/v3/media/upload/binary",
                      headers={"Authorization": f"Bearer {api_key}"},
                      files={"file": f})
result = r.json()
if result.get('code') == 200:
    print(result['data']['download_url'])
else:
    print(f"Error: {result}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT
)
    echo "  ✅ ウォーターマーク除去完了"
else
    echo "❌ ウォーターマーク除去失敗"
    exit 1
fi
echo ""

# ========================================
# ステップ2: 画質向上（Video Upscaler Pro）
# ========================================
echo "🎨 [2/6] 画質向上中（4K超解像）..."

STEP2_OUTPUT="$WORKDIR/step2_upscaled.mp4"

if wavespeed_process "$CURRENT_URL" "wavespeed-ai/video-upscaler-pro" "$STEP2_OUTPUT"; then
    echo "  ✅ 画質向上完了"
else
    echo "❌ 画質向上失敗"
    exit 1
fi
echo ""

# ========================================
# ステップ3: 音声抽出
# ========================================
echo "🎙️ [3/6] 音声抽出中..."

AUDIO_EXTRACTED="$WORKDIR/audio_extracted.wav"
ffmpeg -i "$STEP2_OUTPUT" -vn -acodec pcm_s16le -ar 48000 -ac 2 "$AUDIO_EXTRACTED" -y -loglevel error

if [ ! -f "$AUDIO_EXTRACTED" ]; then
    echo "❌ 音声抽出失敗"
    exit 1
fi
echo "  ✅ 音声抽出完了"
echo ""

# ========================================
# ステップ4: DeepFilterNet3 音声改善
# ========================================
echo "🎵 [4/6] DeepFilterNet3 音声改善中..."

AUDIO_ENHANCED_DIR="$WORKDIR/audio_enhanced_output"
mkdir -p "$AUDIO_ENHANCED_DIR"

DEEPFILTER_CMD="$DEEPFILTER_ENV/bin/deepFilter"
DEEPFILTER_PYTHON="$DEEPFILTER_ENV/bin/python3"
START_TIME=$(date +%s.%N)
# Pythonを明示実行（shebangが古いパスを指しているため）
"$DEEPFILTER_PYTHON" "$DEEPFILTER_CMD" "$AUDIO_EXTRACTED" -o "$AUDIO_ENHANCED_DIR" 2>&1 | grep -E "INFO|Enhanced" || true
END_TIME=$(date +%s.%N)
ELAPSED=$(echo "$END_TIME - $START_TIME" | bc)

AUDIO_BASENAME=$(basename "$AUDIO_EXTRACTED" .wav)
AUDIO_ENHANCED="$AUDIO_ENHANCED_DIR/${AUDIO_BASENAME}_DeepFilterNet3.wav"

if [ ! -f "$AUDIO_ENHANCED" ]; then
    echo "⚠️ DeepFilterNet3処理失敗、元の音声を使用します"
    AUDIO_ENHANCED="$AUDIO_EXTRACTED"
else
    echo "  ✅ 音声改善完了（処理時間: ${ELAPSED}秒）"
fi
echo ""

# ========================================
# ステップ5: 音声を動画に結合
# ========================================
echo "🎬 [5/6] 音声を動画に結合中..."

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
echo "☁️ [6/6] 処理済み動画をGoogle Driveにアップロード中..."

rclone copy "$FINAL_OUTPUT" gdrive:ProcessedVideos/ --progress 2>&1 | tail -3 || true
PROCESSED_GDRIVE_URL=$(rclone link "gdrive:ProcessedVideos/$(basename $FINAL_OUTPUT)" 2>&1 || echo "gdrive:ProcessedVideos")

echo "  ✅ アップロード完了"
echo "  📎 $PROCESSED_GDRIVE_URL"
echo ""

# ========================================
# クリーンアップ
# ========================================
echo "🧹 一時ファイル削除中..."
rm -rf "$WORKDIR"

# ========================================
# 完了報告
# ========================================
FILE_SIZE=$(du -h "$FINAL_OUTPUT" 2>/dev/null | cut -f1 || echo "不明")
FILE_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$FINAL_OUTPUT" 2>/dev/null || echo "不明")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 完全処理完了！（DeepFilterNet3版）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 最終出力: $FINAL_OUTPUT"
echo "📊 サイズ: $FILE_SIZE / 解像度: $FILE_RES"
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
FILE_SIZE=$FILE_SIZE
FILE_RES=$FILE_RES
EOF
