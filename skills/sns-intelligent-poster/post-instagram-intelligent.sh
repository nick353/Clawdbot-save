#!/bin/bash
set -e

# sns-intelligent-poster - Instagram投稿（Claude駆動）
# 使い方: bash post-instagram-intelligent.sh <画像パス> "キャプション"

IMAGE_PATH="$1"
CAPTION="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$IMAGE_PATH" ] || [ -z "$CAPTION" ]; then
    echo "❌ 使い方: bash post-instagram-intelligent.sh <画像パス> \"キャプション\"" >&2
    exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo "❌ 画像ファイルが見つかりません: $IMAGE_PATH" >&2
    exit 1
fi

# Node.jsスクリプトを実行
exec node "$SCRIPT_DIR/post-instagram-intelligent.mjs" "$IMAGE_PATH" "$CAPTION"
