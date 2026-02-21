#!/bin/bash
# process-and-upload.sh - 動画処理＋Google Drive自動アップロード
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
PROCESS_ALL="$SCRIPT_DIR/process-all.sh"
AUPHONIC_ENHANCE="$SCRIPT_DIR/auphonic-enhance.sh"
UPLOAD_GDRIVE="$SCRIPT_DIR/upload-to-gdrive.sh"
AUDIO_ENHANCE="$SCRIPT_DIR/audio-enhance.sh"

# 作業ディレクトリ
WORK_DIR="/root/clawd/video-processing"
mkdir -p "$WORK_DIR"

# 使い方
if [ $# -lt 1 ]; then
    echo -e "${CYAN}使い方: $0 <input_video> [--skip-audio] [--gdrive-folder <folder>]${NC}"
    echo -e "例: $0 input.mp4"
    echo -e "例: $0 input.mp4 --skip-audio"
    echo -e "例: $0 input.mp4 --gdrive-folder ProcessedVideos"
    exit 1
fi

INPUT_VIDEO="$1"
shift

if [ ! -f "$INPUT_VIDEO" ]; then
    echo -e "${RED}❌ エラー: 入力ファイルが見つかりません: $INPUT_VIDEO${NC}"
    exit 1
fi

# オプション解析
SKIP_AUDIO=false
GDRIVE_FOLDER="ProcessedVideos"

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-audio)
            SKIP_AUDIO=true
            shift
            ;;
        --gdrive-folder)
            GDRIVE_FOLDER="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# タイムスタンプ付きファイル名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VIDEO_ENHANCED="$WORK_DIR/video_enhanced_${TIMESTAMP}.mp4"
AUDIO_EXTRACTED="$WORK_DIR/audio_extracted_${TIMESTAMP}.wav"
AUDIO_ENHANCED="$WORK_DIR/audio_enhanced_${TIMESTAMP}.wav"
FINAL_OUTPUT="$WORK_DIR/final_${TIMESTAMP}.mp4"

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🎬 動画処理＋Google Drive自動アップロード  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "入力: ${GREEN}$INPUT_VIDEO${NC}"
echo -e "出力: ${GREEN}$FINAL_OUTPUT${NC}"
echo -e "Google Drive: ${YELLOW}$GDRIVE_FOLDER${NC}"
echo -e "音声処理: ${YELLOW}$([ "$SKIP_AUDIO" = true ] && echo "スキップ" || echo "実行")${NC}\n"

# ステップ1: 画質改善
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 1/$([ "$SKIP_AUDIO" = true ] && echo "2" || echo "4")] 画質改善（ノイズ除去 + シャープ化）${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

cd "$SCRIPT_DIR"
./video-processor.sh improve "$INPUT_VIDEO" "$VIDEO_ENHANCED" --preset youtube

if [ "$SKIP_AUDIO" = false ]; then
    # ステップ2: 音声抽出
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}[ステップ 2/4] 音声抽出${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    ./audio-enhance.sh extract "$VIDEO_ENHANCED" "$AUDIO_EXTRACTED"
    
    # ステップ3: 音声改善（Auphonic）
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}[ステップ 3/4] 音声改善（Auphonic API）${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # auphonic-enhance.shを実行（WAV形式で直接ダウンロード）
    ./auphonic-enhance.sh "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"
    
    # ファイルが正常にダウンロードされたか確認
    if [ ! -f "$AUDIO_ENHANCED" ] || [ ! -s "$AUDIO_ENHANCED" ]; then
        echo -e "${RED}❌ Auphonic処理失敗（ファイルが空または存在しません）${NC}"
        exit 1
    fi
    
    # ステップ4: 音声を動画に結合
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}[ステップ 4/4] 音声を動画に結合${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    ./audio-enhance.sh replace "$VIDEO_ENHANCED" "$AUDIO_ENHANCED" "$FINAL_OUTPUT"
else
    # 音声処理をスキップする場合は、画質改善済み動画を最終出力とする
    cp "$VIDEO_ENHANCED" "$FINAL_OUTPUT"
fi

# ステップ5: Google Driveにアップロード
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ $([ "$SKIP_AUDIO" = true ] && echo "2/2" || echo "5/5")] Google Driveにアップロード${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

./upload-to-gdrive.sh "$FINAL_OUTPUT" "$GDRIVE_FOLDER"

# クリーンアップ
echo -e "\n${YELLOW}🧹 一時ファイルをクリーンアップ中...${NC}"
rm -f "$VIDEO_ENHANCED" "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"
echo -e "${GREEN}✅ クリーンアップ完了${NC}"

# 完了
echo -e "\n${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ✅ すべての処理が完了しました！           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}最終出力: $FINAL_OUTPUT${NC}"
echo -e "${GREEN}Google Drive: $GDRIVE_FOLDER/$(basename $FINAL_OUTPUT)${NC}\n"

echo -e "${CYAN}🎉 処理完了！Google Driveにアップロードしました！${NC}"
