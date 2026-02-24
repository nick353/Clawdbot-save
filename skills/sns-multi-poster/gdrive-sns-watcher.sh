#!/usr/bin/env bash
# Google Driveフォルダ監視 → 新規動画をSNS自動投稿

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GDRIVE_FOLDER_ID="1aUlsf7ax4CRWUVqlQuMNnYCEM8Pwumi2"  # Google DriveフォルダID
LOCAL_TEMP="/tmp/gdrive-sns-watch"
PROCESSED_LOG="$SCRIPT_DIR/.gdrive-processed.log"

# 初期化
mkdir -p "$LOCAL_TEMP"
touch "$PROCESSED_LOG"

# rclone設定確認
if ! rclone config show gdrive &>/dev/null; then
  echo "❌ rclone gdrive設定が見つかりません" >&2
  exit 1
fi

echo "👀 Google Driveフォルダを監視中（フォルダID: $GDRIVE_FOLDER_ID）"

# 新規動画を検出（フォルダIDを使用）
VIDEO_FILES=$(rclone lsf gdrive: --drive-root-folder-id "$GDRIVE_FOLDER_ID" --files-only --include "*.{mp4,mov,avi,mkv,webm,m4v}" 2>/dev/null || echo "")

if [ -z "$VIDEO_FILES" ]; then
  echo "📂 新規動画なし"
  exit 0
fi

# 各動画を処理
while IFS= read -r VIDEO_NAME; do
  [ -z "$VIDEO_NAME" ] && continue
  
  # 処理済みチェック
  if grep -q "^$VIDEO_NAME$" "$PROCESSED_LOG" 2>/dev/null; then
    echo "⏭️  スキップ: $VIDEO_NAME（処理済み）"
    continue
  fi
  
  echo "🔽 ダウンロード中: $VIDEO_NAME"
  
  LOCAL_PATH="$LOCAL_TEMP/$VIDEO_NAME"
  
  # Google Driveからダウンロード（フォルダIDを使用）
  if ! rclone copy "gdrive:$VIDEO_NAME" "$LOCAL_TEMP/" --drive-root-folder-id "$GDRIVE_FOLDER_ID" 2>/dev/null; then
    echo "❌ ダウンロード失敗: $VIDEO_NAME" >&2
    continue
  fi
  
  if [ ! -f "$LOCAL_PATH" ]; then
    echo "❌ ファイルが見つかりません: $LOCAL_PATH" >&2
    continue
  fi
  
  echo "✅ ダウンロード完了: $LOCAL_PATH"
  
  # Google DriveのURL生成（共有リンク）
  GDRIVE_URL=$(rclone link "gdrive:$VIDEO_NAME" --drive-root-folder-id "$GDRIVE_FOLDER_ID" 2>/dev/null || echo "https://drive.google.com/drive/folders/$GDRIVE_FOLDER_ID")
  
  # 自動SNS投稿
  echo "🚀 SNS自動投稿開始..."
  
  # DRY_RUNモード
  if [ "$DRY_RUN" = "true" ]; then
    echo "🔄 DRY_RUN MODE: 実際の投稿はスキップします"
    DRY_RUN=true bash "$SCRIPT_DIR/auto-sns-poster.sh" "$GDRIVE_URL" "$LOCAL_PATH" 2>&1 || echo "⚠️ エラー発生"
  else
    bash "$SCRIPT_DIR/auto-sns-poster.sh" "$GDRIVE_URL" "$LOCAL_PATH" 2>&1 || echo "⚠️ エラー発生"
  fi
  
  echo "✅ 処理完了: $VIDEO_NAME"
  
  # 処理済みリストに追加
  echo "$VIDEO_NAME" >> "$PROCESSED_LOG"
  
  # 一時ファイル削除
  rm -f "$LOCAL_PATH"
  
done <<< "$VIDEO_FILES"

echo "✅ 全ての動画を処理完了"
