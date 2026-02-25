#!/bin/bash
# Googleドライブから動画ファイルを取得してInstagramに投稿
set -euo pipefail

GDRIVE_FOLDER="ProcessedVideos"
TEMP_DIR="/tmp/gdrive-instagram"
INSTAGRAM_SCRIPT="/root/clawd/skills/sns-multi-poster/post-to-instagram-vision.cjs"

# 一時ディレクトリ作成
mkdir -p "$TEMP_DIR"

# Googleドライブから最新の動画ファイルを取得
echo "📥 Googleドライブから最新動画を取得中..."
LATEST_VIDEO=$(rclone lsf "gdrive:$GDRIVE_FOLDER" --max-depth 1 --files-only 2>/dev/null | grep -E '\.(mp4|mov|avi|mkv)$' | tail -1)

if [ -z "$LATEST_VIDEO" ]; then
  echo "❌ Googleドライブに動画ファイルが見つかりません"
  exit 1
fi

echo "✅ 最新動画: $LATEST_VIDEO"

# ファイルをダウンロード
LOCAL_FILE="$TEMP_DIR/$(basename "$LATEST_VIDEO")"
rclone copy "gdrive:$GDRIVE_FOLDER/$LATEST_VIDEO" "$TEMP_DIR/" 2>/dev/null

if [ ! -f "$LOCAL_FILE" ]; then
  echo "❌ ファイルのダウンロードに失敗しました"
  exit 1
fi

echo "✅ ダウンロード完了: $LOCAL_FILE"

# キャプション生成
CAPTION="🎬 AI処理された動画をお届け 🎬

✨ Googleドライブから自動投稿
#AI #Video #AutoPost #Reels"

# Instagram投稿（Reels形式）
echo "📤 Instagramに投稿中..."
if [ "${DRY_RUN:-false}" = "true" ]; then
  echo "🔍 DRY_RUN モード: 実際には投稿しません"
  DRY_RUN=true node "$INSTAGRAM_SCRIPT" "$LOCAL_FILE" "$CAPTION"
else
  node "$INSTAGRAM_SCRIPT" "$LOCAL_FILE" "$CAPTION"
fi

# クリーンアップ
rm -f "$LOCAL_FILE"

echo "✅ 完了！"
