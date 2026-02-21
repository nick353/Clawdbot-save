#!/bin/bash
# 簡易テストスクリプト - WaveSpeedAI Watermark Remover のみ

set -e

source ~/.profile

INPUT_VIDEO="$1"
OUTPUT_VIDEO="${2:-/tmp/output.mp4}"

if [ -z "$INPUT_VIDEO" ]; then
    echo "使い方: $0 <input_video>"
    exit 1
fi

echo "🧹 ウォーターマーク除去テスト開始..."
echo "入力: $INPUT_VIDEO"
echo "出力: $OUTPUT_VIDEO"
echo ""

# Pythonスクリプトを別ファイルとして実行
cat > /tmp/wavespeed_test.py <<'PYEOF'
import requests
import json
import time
import sys
import os

api_key = os.environ.get('WAVESPEED_API_KEY')
input_file = sys.argv[1]
output_file = sys.argv[2]

print(f"API Key: {api_key[:10]}...")
print(f"Input: {input_file}")
print(f"Output: {output_file}")

# ファイルを multipart/form-data で送信
url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-watermark-remover"
headers = {
    "Authorization": f"Bearer {api_key}"
}

with open(input_file, 'rb') as f:
    files = {'input': f}
    
    print("→ APIリクエスト送信中...")
    response = requests.post(url, headers=headers, files=files)
    
print(f"→ ステータスコード: {response.status_code}")
print(f"→ レスポンス: {response.text[:500]}")

if response.status_code != 200 and response.status_code != 201:
    print(f"❌ エラー: {response.status_code}")
    print(response.text)
    sys.exit(1)

result = response.json()
print(json.dumps(result, indent=2))
PYEOF

python3 /tmp/wavespeed_test.py "$INPUT_VIDEO" "$OUTPUT_VIDEO"

echo ""
echo "✅ テスト完了"
