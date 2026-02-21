#!/bin/bash
# auto-cleanup.sh - Discord送信後の自動クリーンアップ
# 作成: リッキー 🐥

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

WORK_DIR="/root/clawd/video-processing"

# 指定されたファイルを削除
if [ $# -ge 1 ]; then
    FILE="$1"
    if [ -f "$FILE" ]; then
        rm -f "$FILE"
        echo -e "${GREEN}✅ 出力ファイルを削除: $(basename $FILE)${NC}"
    fi
fi

# 古いファイルを自動削除（1日以上前）
echo -e "${YELLOW}🧹 古いファイルをクリーンアップ中...${NC}"

DELETED_COUNT=0

# 入力ファイル
for file in "$WORK_DIR"/input_*.mp4; do
    [ -f "$file" ] || continue
    if [ $(find "$file" -mtime +1 2>/dev/null | wc -l) -gt 0 ]; then
        rm -f "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done

# 出力ファイル
for file in "$WORK_DIR"/output_*.mp4; do
    [ -f "$file" ] || continue
    if [ $(find "$file" -mtime +1 2>/dev/null | wc -l) -gt 0 ]; then
        rm -f "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done

if [ $DELETED_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ $DELETED_COUNT 個の古いファイルを削除しました${NC}"
else
    echo -e "${GREEN}✅ 削除すべき古いファイルはありません${NC}"
fi

# ディスク使用量を確認
DISK_USAGE=$(du -sh "$WORK_DIR" 2>/dev/null | cut -f1)
echo -e "\n現在のディスク使用量: ${YELLOW}$DISK_USAGE${NC}"
