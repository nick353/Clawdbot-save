#!/bin/bash
# upload-to-gdrive.sh - Google Driveに動画をアップロード
# 作成: リッキー 🐥

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# 使い方
if [ $# -lt 1 ]; then
    echo -e "${CYAN}使い方: $0 <video_file> [gdrive_folder]${NC}"
    echo -e "例: $0 output.mp4 Videos"
    exit 1
fi

VIDEO_FILE="$1"
GDRIVE_FOLDER="${2:-Videos}"  # デフォルト: Videos

if [ ! -f "$VIDEO_FILE" ]; then
    echo -e "${RED}❌ エラー: ファイルが見つかりません: $VIDEO_FILE${NC}"
    exit 1
fi

echo -e "${CYAN}📤 Google Driveにアップロード中...${NC}"
echo -e "ファイル: ${GREEN}$VIDEO_FILE${NC}"
echo -e "フォルダ: ${YELLOW}$GDRIVE_FOLDER${NC}"

FILE_SIZE=$(du -h "$VIDEO_FILE" | cut -f1)
echo -e "サイズ: ${YELLOW}$FILE_SIZE${NC}"

# rcloneでアップロード
echo -e "\n${YELLOW}⏳ アップロード中...${NC}"

rclone copy "$VIDEO_FILE" "gdrive:$GDRIVE_FOLDER" --progress 2>&1 | tail -20

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ アップロード完了！${NC}"
    
    # アップロードされたファイルを確認
    FILENAME=$(basename "$VIDEO_FILE")
    echo -e "\n${CYAN}📁 Google Driveの場所:${NC}"
    echo -e "フォルダ: ${YELLOW}$GDRIVE_FOLDER${NC}"
    echo -e "ファイル名: ${GREEN}$FILENAME${NC}"
    
    # 共有リンクを作成（オプション）
    # rclone link "gdrive:$GDRIVE_FOLDER/$FILENAME"
else
    echo -e "\n${RED}❌ アップロード失敗${NC}"
    exit 1
fi

echo -e "\n${CYAN}🎉 Google Driveにアップロードしました！${NC}"
