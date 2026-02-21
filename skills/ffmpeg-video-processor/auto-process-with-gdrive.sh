#!/bin/bash
# auto-process-with-gdrive.sh - 完全自動動画処理＋Google Drive
# 作成: リッキー 🐥

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# スクリプトのディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 設定
WORK_DIR="/root/clawd/video-processing"
mkdir -p "$WORK_DIR"

# 使い方
if [ $# -lt 1 ]; then
    echo -e "${CYAN}使い方: $0 <input_video> [discord_channel_id]${NC}"
    exit 1
fi

INPUT_VIDEO="$1"
DISCORD_CHANNEL="${2:-1471428614917718036}"

if [ ! -f "$INPUT_VIDEO" ]; then
    echo -e "${RED}❌ エラー: 入力ファイルが見つかりません: $INPUT_VIDEO${NC}"
    exit 1
fi

# タイムスタンプ付きファイル名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME_BASE="sora_video_${TIMESTAMP}"
OUTPUT_VIDEO="$WORK_DIR/${FILENAME_BASE}_processed.mp4"

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🎬 完全自動処理 + Google Drive           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "入力: ${GREEN}$INPUT_VIDEO${NC}"
echo -e "出力: ${GREEN}$OUTPUT_VIDEO${NC}\n"

# ステップ1: 元動画をGoogle Driveにアップロード
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 1/5] 元動画をGoogle Driveにアップロード${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📤 OriginalVideos/ にアップロード中...${NC}"

# 元ファイル名を保持してアップロード
ORIGINAL_NAME="${FILENAME_BASE}_original.mp4"
cp "$INPUT_VIDEO" "$WORK_DIR/$ORIGINAL_NAME"

rclone copy "$WORK_DIR/$ORIGINAL_NAME" gdrive:OriginalVideos/ --progress 2>&1 | tail -5 || true

ORIGINAL_LINK=$(rclone link "gdrive:OriginalVideos/$ORIGINAL_NAME" 2>&1)

rm -f "$WORK_DIR/$ORIGINAL_NAME"

echo -e "${GREEN}✅ 元動画アップロード完了${NC}"
echo -e "リンク: ${CYAN}$ORIGINAL_LINK${NC}\n"

# ステップ2: 超高品質処理（FFmpeg + Auphonic）
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 2/5] 超高品質処理${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}🎬 FFmpeg高品質処理 + Auphonic音質改善を実行中...${NC}"

# 超高品質処理スクリプトを実行
cd "$SCRIPT_DIR"
CLOUDINARY_CLOUD_NAME='dm71et5v2' \
CLOUDINARY_API_KEY='281632171459342' \
CLOUDINARY_API_SECRET='KK-7eiPjwyIZ0-8X1ZDc6dfDdBc' \
bash ultra-quality-process.sh "$INPUT_VIDEO" "$OUTPUT_VIDEO"

# 処理済みファイルを確認
if [ ! -f "$OUTPUT_VIDEO" ]; then
    echo -e "${RED}❌ 処理失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 超高品質処理完了${NC}\n"

# ステップ3: 処理済み動画をGoogle Driveにアップロード
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 3/5] 処理済み動画をGoogle Driveにアップロード${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📤 ProcessedVideos/ にアップロード中...${NC}"

rclone copy "$OUTPUT_VIDEO" gdrive:ProcessedVideos/ --progress 2>&1 | tail -5 || true

PROCESSED_LINK=$(rclone link "gdrive:ProcessedVideos/$(basename $OUTPUT_VIDEO)" 2>&1)

echo -e "${GREEN}✅ 処理済み動画アップロード完了${NC}"
echo -e "リンク: ${CYAN}$PROCESSED_LINK${NC}\n"

# ステップ4: ファイル情報取得
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 4/5] ファイル情報取得${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

INPUT_SIZE=$(du -h "$INPUT_VIDEO" | cut -f1)
OUTPUT_SIZE=$(du -h "$OUTPUT_VIDEO" | cut -f1)
INPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$INPUT_VIDEO")
OUTPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$OUTPUT_VIDEO")

echo -e "元のサイズ: ${GREEN}$INPUT_SIZE${NC} → 処理後: ${GREEN}$OUTPUT_SIZE${NC}"
echo -e "元の解像度: ${GREEN}$INPUT_RES${NC} → 処理後: ${GREEN}$OUTPUT_RES${NC}\n"

# ステップ5: Discordに通知
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 5/5] Discord通知${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

MESSAGE="🎉 **完全自動処理完了っぴ！**

📁 **元動画（Google Drive）:**
$ORIGINAL_LINK

📁 **処理済み動画（Google Drive）:**
$PROCESSED_LINK

📊 **処理結果:**
- サイズ: $INPUT_SIZE → $OUTPUT_SIZE
- 解像度: $INPUT_RES → $OUTPUT_RES

🎬 **処理内容:**
- 画質改善: ノイズ除去、シャープ化
- 音質改善: Auphonic（ノイズ除去、音量正規化）
- アスペクト比: 完璧保持"

# clawdbot message send を使用してDiscord通知
clawdbot message send --channel "$DISCORD_CHANNEL" --message "$MESSAGE" 2>&1 | tail -3 || true

echo -e "${GREEN}✅ Discord通知完了${NC}\n"

# クリーンアップ
echo -e "${YELLOW}🧹 一時ファイルをクリーンアップ中...${NC}"
# 処理済みファイルはGoogle Driveにあるので削除
rm -f "$OUTPUT_VIDEO"
echo -e "${GREEN}✅ クリーンアップ完了${NC}\n"

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ✅ 完全自動処理が完了しました！           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}📁 元動画: $ORIGINAL_LINK${NC}"
echo -e "${GREEN}📁 処理済み: $PROCESSED_LINK${NC}\n"
