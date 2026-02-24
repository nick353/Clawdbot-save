#!/bin/bash
#
# Google Driveから動画をダウンロード → Instagram投稿
# スクリーンショットで各ステップ確認
#
# Usage: bash gdrive-to-instagram.sh <gdrive_path> <caption>
# Example: bash gdrive-to-instagram.sh "動画/test.mp4" "テスト投稿 #AI"

set -e

GDRIVE_PATH="$1"
CAPTION="$2"

if [ -z "$GDRIVE_PATH" ] || [ -z "$CAPTION" ]; then
    echo "❌ 使い方: bash gdrive-to-instagram.sh <gdrive_path> <caption>"
    echo "例: bash gdrive-to-instagram.sh '動画/test.mp4' 'テスト投稿 #AI'"
    exit 1
fi

# スクリーンショットディレクトリ
DEBUG_DIR="/tmp/gdrive-instagram-debug"
mkdir -p "$DEBUG_DIR"

echo "📥 Step 1: Google Driveから動画をダウンロード"
echo "パス: $GDRIVE_PATH"

# ダウンロード先
LOCAL_FILE="/tmp/$(basename "$GDRIVE_PATH")"

# rcloneでダウンロード
echo "⏳ ダウンロード中..."
rclone copy "gdrive:$GDRIVE_PATH" /tmp/ -v

if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ ダウンロード失敗: $LOCAL_FILE が見つかりません"
    exit 1
fi

echo "✅ ダウンロード完了: $LOCAL_FILE"
ls -lh "$LOCAL_FILE"

# 動画情報を確認
echo ""
echo "🎥 Step 2: 動画情報確認"
ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height -of default=noprint_wrappers=1 "$LOCAL_FILE"

# Instagram投稿
echo ""
echo "📱 Step 3: Instagram投稿開始"
echo "キャプション: $CAPTION"
echo ""

cd /root/clawd/skills/sns-multi-poster
node post-to-instagram-reels-v2-wait-completion.cjs "$LOCAL_FILE" "$CAPTION"

# スクリーンショットを確認
echo ""
echo "📸 Step 4: スクリーンショット確認"
echo "保存先: /tmp/ig-reels-*.png"
ls -lht /tmp/ig-reels-*.png | head -10

echo ""
echo "✅ 完了！"
echo ""
echo "📋 スクリーンショット確認コマンド:"
echo "   ls -lht /tmp/ig-reels-*.png | head -20"
