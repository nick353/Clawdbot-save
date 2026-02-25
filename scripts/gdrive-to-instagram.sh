#!/bin/bash
# Googleドライブから最新ファイルを取得してInstagramに投稿
set -euo pipefail

GDRIVE_FOLDER="投稿用の動画"
TEMP_DIR="/tmp/gdrive-instagram"
INSTAGRAM_SCRIPT="/root/clawd/skills/sns-multi-poster/post-to-instagram-vision.cjs"

# 一時ディレクトリ作成
mkdir -p "$TEMP_DIR"

# Googleドライブから最新ファイルを取得
echo "📥 Googleドライブから最新ファイルを取得中..."
LATEST_FILE=$(rclone lsf "gdrive:$GDRIVE_FOLDER" --max-depth 1 --files-only 2>/dev/null | grep -E '\.(png|jpg|jpeg|mp4|mov)$' | tail -1)

if [ -z "$LATEST_FILE" ]; then
  echo "❌ Googleドライブに投稿可能なファイルが見つかりません"
  exit 1
fi

echo "✅ 最新ファイル: $LATEST_FILE"

# ファイルをダウンロード
LOCAL_FILE="$TEMP_DIR/$(basename "$LATEST_FILE")"
rclone copy "gdrive:$GDRIVE_FOLDER/$LATEST_FILE" "$TEMP_DIR/" 2>/dev/null

if [ ! -f "$LOCAL_FILE" ]; then
  echo "❌ ファイルのダウンロードに失敗しました"
  exit 1
fi

echo "✅ ダウンロード完了: $LOCAL_FILE"

# キャプション生成（ファイル名ベース + 絵文字）
CAPTION="✨ Googleドライブから自動投稿 ✨

#AI #CreativeContent #AutoPost"

# Instagram投稿
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
