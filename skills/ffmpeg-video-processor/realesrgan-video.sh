#!/bin/bash
# realesrgan-video.sh - Real-ESRGANで動画を処理
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
REALESRGAN="$SCRIPT_DIR/realesrgan-ncnn-vulkan"
MODELS_DIR="$SCRIPT_DIR/models"

# デフォルト設定
SCALE=2
MODEL="realesrgan-x4plus"  # Sora実写動画用
TILE_SIZE=0

# 使い方
if [ $# -lt 2 ]; then
    echo -e "${CYAN}使い方: $0 <input.mp4> <output.mp4> [options]${NC}"
    echo -e "オプション:"
    echo -e "  --scale <2|3|4>          アップスケール倍率（デフォルト: 2）"
    echo -e "  --model <name>           モデル名（デフォルト: realesrgan-x4plus）"
    echo -e "  --tile-size <size>       タイルサイズ（デフォルト: 0=auto）"
    echo -e ""
    echo -e "利用可能なモデル:"
    echo -e "  realesrgan-x4plus        実写動画向け（推奨）"
    echo -e "  realesrgan-x4plus-anime  アニメ向け"
    echo -e "  realesr-animevideov3     アニメ動画向け"
    exit 1
fi

INPUT_VIDEO="$1"
OUTPUT_VIDEO="$2"
shift 2

if [ ! -f "$INPUT_VIDEO" ]; then
    echo -e "${RED}❌ エラー: 入力ファイルが見つかりません: $INPUT_VIDEO${NC}"
    exit 1
fi

# オプション解析
while [ $# -gt 0 ]; do
    case "$1" in
        --scale)
            SCALE="$2"
            shift 2
            ;;
        --model)
            MODEL="$2"
            shift 2
            ;;
        --tile-size)
            TILE_SIZE="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}不明なオプション: $1${NC}"
            exit 1
            ;;
    esac
done

# 作業ディレクトリ
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

FRAMES_DIR="$WORK_DIR/frames"
OUTPUT_FRAMES_DIR="$WORK_DIR/output_frames"
mkdir -p "$FRAMES_DIR" "$OUTPUT_FRAMES_DIR"

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🎬 Real-ESRGAN 動画処理                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "入力: ${GREEN}$INPUT_VIDEO${NC}"
echo -e "出力: ${GREEN}$OUTPUT_VIDEO${NC}"
echo -e "スケール: ${YELLOW}${SCALE}x${NC}"
echo -e "モデル: ${YELLOW}${MODEL}${NC}\n"

# ステップ1: 動画をフレームに分解
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 1/4] 動画をフレームに分解${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# FPSを取得
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "$INPUT_VIDEO")

echo -e "${YELLOW}📸 フレーム抽出中...${NC}"
ffmpeg -i "$INPUT_VIDEO" -qscale:v 1 -qmin 1 -qmax 1 -vsync 0 "$FRAMES_DIR/frame_%08d.png" 2>&1 | grep -E "frame=|time=" | tail -5 || true

FRAME_COUNT=$(ls "$FRAMES_DIR"/*.png 2>/dev/null | wc -l)
echo -e "${GREEN}✅ ${FRAME_COUNT} フレーム抽出完了${NC}\n"

# ステップ2: Real-ESRGANで各フレームを処理
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 2/4] AI画質改善処理${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}🤖 Real-ESRGANで処理中...${NC}"
echo -e "${YELLOW}⚠️  ${FRAME_COUNT} フレームの処理には時間がかかります${NC}\n"

"$REALESRGAN" \
    -i "$FRAMES_DIR" \
    -o "$OUTPUT_FRAMES_DIR" \
    -s "$SCALE" \
    -n "$MODEL" \
    -t "$TILE_SIZE" \
    -m "$MODELS_DIR" \
    -f png \
    2>&1 | grep -E "done|processing" || true

echo -e "\n${GREEN}✅ AI画質改善完了${NC}\n"

# ステップ3: フレームを動画に再結合
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 3/4] フレームを動画に再結合${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}🎬 動画生成中...${NC}"
ffmpeg -framerate "$FPS" -i "$OUTPUT_FRAMES_DIR/frame_%08d.png" \
    -c:v libx264 -preset slow -crf 18 \
    -pix_fmt yuv420p \
    -y "$WORK_DIR/video_only.mp4" \
    2>&1 | grep -E "frame=|time=" | tail -5 || true

echo -e "${GREEN}✅ 動画生成完了${NC}\n"

# ステップ4: 音声を結合
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 4/4] 音声を結合${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}🎵 音声抽出＆結合中...${NC}"
ffmpeg -i "$WORK_DIR/video_only.mp4" -i "$INPUT_VIDEO" \
    -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 \
    -shortest \
    -y "$OUTPUT_VIDEO" \
    2>&1 | grep -E "time=" | tail -3 || true

if [ -f "$OUTPUT_VIDEO" ] && [ -s "$OUTPUT_VIDEO" ]; then
    echo -e "\n${GREEN}✅ 処理完了！${NC}"
    
    # ファイルサイズ比較
    INPUT_SIZE=$(du -h "$INPUT_VIDEO" | cut -f1)
    OUTPUT_SIZE=$(du -h "$OUTPUT_VIDEO" | cut -f1)
    echo -e "元のサイズ: $INPUT_SIZE → 処理後: $OUTPUT_SIZE"
    
    # 解像度比較
    INPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$INPUT_VIDEO")
    OUTPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$OUTPUT_VIDEO")
    echo -e "元の解像度: $INPUT_RES → 処理後: $OUTPUT_RES (${SCALE}x)"
    
    echo -e "\n${CYAN}🎉 処理完了！ Real-ESRGANによる画質改善が完了しました！${NC}"
else
    echo -e "\n${RED}❌ 処理失敗${NC}"
    exit 1
fi
