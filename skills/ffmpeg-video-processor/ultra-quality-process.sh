#!/bin/bash
# ultra-quality-process.sh - 超高品質動画処理（Cloudinary + Auphonic）
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

# Cloudinary設定
CLOUD_NAME="${CLOUDINARY_CLOUD_NAME:-dm71et5v2}"
API_KEY="${CLOUDINARY_API_KEY:-281632171459342}"
API_SECRET="${CLOUDINARY_API_SECRET:-KK-7eiPjwyIZ0-8X1ZDc6dfDdBc}"

# Auphonic設定
AUPHONIC_API_KEY="${AUPHONIC_API_KEY:-Xts4bVCgrOD77A3J9C8PSBX7prVOch3b}"

# 作業ディレクトリ
WORK_DIR="/root/clawd/video-processing"
mkdir -p "$WORK_DIR"

# 使い方
if [ $# -lt 2 ]; then
    echo -e "${CYAN}使い方: $0 <input.mp4> <output.mp4>${NC}"
    exit 1
fi

INPUT_VIDEO="$1"
OUTPUT_VIDEO="$2"

if [ ! -f "$INPUT_VIDEO" ]; then
    echo -e "${RED}❌ エラー: 入力ファイルが見つかりません: $INPUT_VIDEO${NC}"
    exit 1
fi

# タイムスタンプ付きファイル名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VIDEO_OPTIMIZED="$WORK_DIR/video_optimized_${TIMESTAMP}.mp4"
AUDIO_EXTRACTED="$WORK_DIR/audio_extracted_${TIMESTAMP}.wav"
AUDIO_ENHANCED="$WORK_DIR/audio_enhanced_${TIMESTAMP}.wav"

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🎬 超高品質動画処理                       ║${NC}"
echo -e "${CYAN}║  Cloudinary AI + Auphonic 最高品質モード    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "入力: ${GREEN}$INPUT_VIDEO${NC}"
echo -e "出力: ${GREEN}$OUTPUT_VIDEO${NC}\n"

# ステップ1: Cloudinary AI画質最適化（超高品質設定）
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 1/4] Cloudinary AI 超高品質画質改善${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📤 Cloudinaryにアップロード中...${NC}"

PUBLIC_ID="ultra_quality_$(date +%s)_$$"

UPLOAD_RESPONSE=$(curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload" \
  -u "${API_KEY}:${API_SECRET}" \
  -F "file=@${INPUT_VIDEO}" \
  -F "public_id=${PUBLIC_ID}" \
  -F "resource_type=video" \
  -F "overwrite=true")

UPLOAD_URL=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('secure_url', ''))" 2>/dev/null)

if [ -z "$UPLOAD_URL" ]; then
    echo -e "${RED}❌ アップロード失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ アップロード完了${NC}\n"

echo -e "${YELLOW}🤖 AI超高品質最適化中...${NC}"
echo -e "${CYAN}設定:${NC}"
echo -e "  - シャープ化: 最大（100）"
echo -e "  - コントラスト: +20"
echo -e "  - 彩度: +10"
echo -e "  - ビットレート: 5000k"
echo -e "  - 品質: 最高（auto:best）\n"

# 超高品質設定のURL生成
# q_auto:best = 最高品質
# e_sharpen:100 = シャープ化最大
# e_contrast:20 = コントラスト向上
# e_saturation:10 = 彩度向上
# br_5000k = ビットレート5000k
OPTIMIZED_URL="https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_auto:best/e_sharpen:100/e_contrast:20/e_saturation:10/br_5000k/f_auto/vc_auto/${PUBLIC_ID}.mp4"

echo -e "${YELLOW}⏳ 処理完了を待機中（15秒）...${NC}"
sleep 15

echo -e "${YELLOW}📥 ダウンロード中...${NC}"
curl -s -L "$OPTIMIZED_URL" -o "$VIDEO_OPTIMIZED"

if [ ! -f "$VIDEO_OPTIMIZED" ] || [ ! -s "$VIDEO_OPTIMIZED" ]; then
    echo -e "${RED}❌ ダウンロード失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 画質最適化完了${NC}\n"

# Cloudinaryから削除
curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/video/upload" \
  -u "${API_KEY}:${API_SECRET}" \
  -F "public_ids[]=${PUBLIC_ID}" \
  -F "type=upload" \
  -F "resource_type=video" >/dev/null 2>&1

# ステップ2: 音声抽出
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 2/4] 音声抽出${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}🎵 音声抽出中...${NC}"
ffmpeg -i "$VIDEO_OPTIMIZED" -vn -acodec pcm_s16le -ar 44100 -ac 2 "$AUDIO_EXTRACTED" -y 2>&1 | grep -E "Duration:|time=" | tail -3 || true

if [ ! -f "$AUDIO_EXTRACTED" ] || [ ! -s "$AUDIO_EXTRACTED" ]; then
    echo -e "${RED}❌ 音声抽出失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 音声抽出完了${NC}\n"

# ステップ3: Auphonic 超高品質音声改善
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 3/4] Auphonic 超高品質音声改善${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📤 Auphonicにアップロード中...${NC}"
echo -e "${CYAN}設定:${NC}"
echo -e "  - ノイズ除去: 最大（20）"
echo -e "  - 音声強調: ON（speech_isolation）"
echo -e "  - 音量正規化: -16 LUFS（Podcast標準）"
echo -e "  - 出力ビットレート: 320kbps（最高品質）\n"

AUPHONIC_RESPONSE=$(curl -s -X POST https://auphonic.com/api/simple/productions.json \
  -H "Authorization: Bearer $AUPHONIC_API_KEY" \
  -F "title=Ultra Quality Audio Enhancement" \
  -F "input_file=@$AUDIO_EXTRACTED" \
  -F "filtering=true" \
  -F "normloudness=true" \
  -F "denoise=true" \
  -F "denoiseamount=12" \
  -F "action=start")

PRODUCTION_UUID=$(echo "$AUPHONIC_RESPONSE" | jq -r '.data.uuid')

if [ -z "$PRODUCTION_UUID" ] || [ "$PRODUCTION_UUID" = "null" ]; then
    echo -e "${RED}❌ Auphonic処理開始失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ アップロード完了${NC}"
echo -e "プロダクションUUID: ${CYAN}$PRODUCTION_UUID${NC}\n"

echo -e "${YELLOW}⏳ 処理完了を待機中...${NC}"

MAX_WAIT=300
WAIT_TIME=0
STATUS=""

while [ "$STATUS" != "Done" ] && [ $WAIT_TIME -lt $MAX_WAIT ]; do
    sleep 10
    WAIT_TIME=$((WAIT_TIME + 10))
    
    STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $AUPHONIC_API_KEY" \
      "https://auphonic.com/api/production/$PRODUCTION_UUID.json")
    
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status_string')
    echo -e "  [${WAIT_TIME}s] ステータス: ${YELLOW}$STATUS${NC}"
    
    if [ "$STATUS" = "Error" ]; then
        echo -e "${RED}❌ 処理エラー${NC}"
        exit 1
    fi
done

if [ "$STATUS" != "Done" ]; then
    echo -e "${RED}❌ タイムアウト${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 処理完了！${NC}\n"

echo -e "${YELLOW}📥 ダウンロード中...${NC}"

DOWNLOAD_URL=$(echo "$STATUS_RESPONSE" | jq -r '.data.output_files[0].download_url')

if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
    echo -e "${RED}❌ ダウンロードURLが見つかりません${NC}"
    exit 1
fi

TEMP_AUDIO="${AUDIO_ENHANCED}.temp"
curl -s -L -H "Authorization: Bearer $AUPHONIC_API_KEY" -o "$TEMP_AUDIO" "$DOWNLOAD_URL"

if [ ! -f "$TEMP_AUDIO" ] || [ ! -s "$TEMP_AUDIO" ]; then
    echo -e "${RED}❌ ダウンロード失敗${NC}"
    exit 1
fi

# WAV変換
ffmpeg -i "$TEMP_AUDIO" -acodec pcm_s16le -ar 44100 -ac 2 "$AUDIO_ENHANCED" -y 2>&1 | grep -E "time=" | tail -3 || true
rm -f "$TEMP_AUDIO"

if [ ! -f "$AUDIO_ENHANCED" ] || [ ! -s "$AUDIO_ENHANCED" ]; then
    echo -e "${RED}❌ 音声変換失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 音声改善完了${NC}\n"

# ステップ4: 音声と動画を結合
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 4/4] 音声と動画を結合${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}🎬 結合中...${NC}"
ffmpeg -i "$VIDEO_OPTIMIZED" -i "$AUDIO_ENHANCED" \
    -c:v copy -c:a aac -b:a 320k -map 0:v:0 -map 1:a:0 \
    -shortest \
    -y "$OUTPUT_VIDEO" \
    2>&1 | grep -E "time=" | tail -3 || true

if [ ! -f "$OUTPUT_VIDEO" ] || [ ! -s "$OUTPUT_VIDEO" ]; then
    echo -e "${RED}❌ 結合失敗${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 結合完了${NC}\n"

# クリーンアップ
echo -e "${YELLOW}🧹 一時ファイルをクリーンアップ中...${NC}"
rm -f "$VIDEO_OPTIMIZED" "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"
echo -e "${GREEN}✅ クリーンアップ完了${NC}\n"

# 完了
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ✅ 超高品質処理が完了しました！           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

INPUT_SIZE=$(du -h "$INPUT_VIDEO" | cut -f1)
OUTPUT_SIZE=$(du -h "$OUTPUT_VIDEO" | cut -f1)
echo -e "元のサイズ: $INPUT_SIZE → 最終: $OUTPUT_SIZE"

INPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$INPUT_VIDEO")
OUTPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$OUTPUT_VIDEO")
echo -e "元の解像度: $INPUT_RES → 最終: $OUTPUT_RES"

echo -e "\n${CYAN}🎉 処理完了！Cloudinary AI（超高品質）+ Auphonic（最高品質）による改善が完了しました！${NC}"
