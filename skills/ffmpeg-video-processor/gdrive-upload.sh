#!/bin/bash
# Google Drive アップロードスクリプト（rclone使用）

set -e

# 引数チェック
if [ $# -lt 2 ]; then
    echo "Usage: $0 <file_path> <gdrive_folder>" >&2
    echo "Example: $0 video.mp4 ProcessedVideos" >&2
    exit 1
fi

FILE_PATH="$1"
GDRIVE_FOLDER="$2"

# ファイル存在確認
if [ ! -f "$FILE_PATH" ]; then
    echo "❌ File not found: $FILE_PATH" >&2
    exit 1
fi

FILENAME=$(basename "$FILE_PATH")
REMOTE_PATH="gdrive:${GDRIVE_FOLDER}/${FILENAME}"

echo "📤 Uploading to Google Drive..."
echo "   File: $FILENAME"
echo "   Folder: $GDRIVE_FOLDER"
echo ""

# rcloneでアップロード（進捗表示あり）
rclone copy "$FILE_PATH" "gdrive:${GDRIVE_FOLDER}/" \
    --progress \
    --drive-acknowledge-abuse \
    --drive-chunk-size 32M 2>&1 | grep -E "(Transferred|ETA|100%)" || true

# アップロード成功確認
if rclone ls "gdrive:${GDRIVE_FOLDER}/" | grep -q "$FILENAME"; then
    echo ""
    echo "✅ Upload successful"
    
    # ファイルIDを取得（共有リンク用）
    FILE_ID=$(rclone lsjson "gdrive:${GDRIVE_FOLDER}/" | jq -r ".[] | select(.Name == \"$FILENAME\") | .ID" 2>/dev/null || echo "")
    
    if [ -n "$FILE_ID" ]; then
        echo "File ID: $FILE_ID"
        echo "URL: https://drive.google.com/open?id=$FILE_ID"
        
        # 共有設定（誰でもリンクで閲覧可能）
        rclone link "gdrive:${GDRIVE_FOLDER}/${FILENAME}" 2>/dev/null || echo "Note: Sharing link generation skipped"
    else
        echo "Note: Could not retrieve file ID"
    fi
else
    echo "❌ Upload failed" >&2
    exit 1
fi
