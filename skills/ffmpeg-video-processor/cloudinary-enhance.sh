#!/bin/bash
# cloudinary-enhance.sh - Cloudinary Video APIで動画を最適化
# 作成: リッキー 🐥

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Cloudinary設定（環境変数から読み込み）
CLOUD_NAME="${CLOUDINARY_CLOUD_NAME}"
API_KEY="${CLOUDINARY_API_KEY}"
API_SECRET="${CLOUDINARY_API_SECRET}"

# 使い方
if [ $# -lt 2 ]; then
    echo -e "${CYAN}使い方: $0 <input.mp4> <output.mp4> [options]${NC}"
    echo -e "オプション:"
    echo -e "  --quality <auto|best|good|eco>  品質設定（デフォルト: auto:best）"
    echo -e "  --format <auto|mp4|webm>        出力フォーマット（デフォルト: auto）"
    echo -e ""
    echo -e "環境変数:"
    echo -e "  CLOUDINARY_CLOUD_NAME   Cloudinary Cloud Name"
    echo -e "  CLOUDINARY_API_KEY      Cloudinary API Key"
    echo -e "  CLOUDINARY_API_SECRET   Cloudinary API Secret"
    exit 1
fi

INPUT_VIDEO="$1"
OUTPUT_VIDEO="$2"
shift 2

if [ ! -f "$INPUT_VIDEO" ]; then
    echo -e "${RED}❌ エラー: 入力ファイルが見つかりません: $INPUT_VIDEO${NC}"
    exit 1
fi

# 環境変数チェック
if [ -z "$CLOUD_NAME" ] || [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    echo -e "${RED}❌ エラー: Cloudinary認証情報が設定されていません${NC}"
    echo -e "${YELLOW}以下の環境変数を設定してください:${NC}"
    echo -e "  export CLOUDINARY_CLOUD_NAME='your_cloud_name'"
    echo -e "  export CLOUDINARY_API_KEY='your_api_key'"
    echo -e "  export CLOUDINARY_API_SECRET='your_api_secret'"
    exit 1
fi

# デフォルト設定
QUALITY="auto:best"
FORMAT="auto"

# オプション解析
while [ $# -gt 0 ]; do
    case "$1" in
        --quality)
            QUALITY="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}不明なオプション: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ☁️  Cloudinary Video 最適化               ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "入力: ${GREEN}$INPUT_VIDEO${NC}"
echo -e "出力: ${GREEN}$OUTPUT_VIDEO${NC}"
echo -e "品質: ${YELLOW}$QUALITY${NC}"
echo -e "フォーマット: ${YELLOW}$FORMAT${NC}\n"

# 一時ファイル名生成（ユニーク）
PUBLIC_ID="video_$(date +%s)_$$"

# ステップ1: アップロード
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 1/3] Cloudinaryにアップロード${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📤 アップロード中...${NC}"

UPLOAD_RESPONSE=$(curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload" \
  -u "${API_KEY}:${API_SECRET}" \
  -F "file=@${INPUT_VIDEO}" \
  -F "public_id=${PUBLIC_ID}" \
  -F "resource_type=video" \
  -F "overwrite=true")

UPLOAD_URL=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('secure_url', ''))" 2>/dev/null)

if [ -z "$UPLOAD_URL" ]; then
    echo -e "${RED}❌ アップロード失敗${NC}"
    echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ アップロード完了${NC}"
echo -e "URL: ${CYAN}$UPLOAD_URL${NC}\n"

# ステップ2: 最適化処理
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 2/3] AI画質最適化${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}🤖 Cloudinary AIで最適化中...${NC}"

# 最適化されたURLを生成
# q_auto:best = 最高品質自動最適化
# f_auto = 最適フォーマット自動選択
# vc_auto = ビデオコーデック自動選択
OPTIMIZED_URL="https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_${QUALITY}/f_${FORMAT}/vc_auto/${PUBLIC_ID}.mp4"

echo -e "${GREEN}✅ 最適化URL生成完了${NC}"
echo -e "URL: ${CYAN}$OPTIMIZED_URL${NC}\n"

# 少し待機（Cloudinaryの処理完了を待つ）
echo -e "${YELLOW}⏳ 処理完了を待機中（10秒）...${NC}"
sleep 10

# ステップ3: ダウンロード
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[ステップ 3/3] 最適化済み動画をダウンロード${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📥 ダウンロード中...${NC}"

curl -s -L "$OPTIMIZED_URL" -o "$OUTPUT_VIDEO"

if [ -f "$OUTPUT_VIDEO" ] && [ -s "$OUTPUT_VIDEO" ]; then
    echo -e "\n${GREEN}✅ ダウンロード完了${NC}"
    
    # ファイルサイズ比較
    INPUT_SIZE=$(du -h "$INPUT_VIDEO" | cut -f1)
    OUTPUT_SIZE=$(du -h "$OUTPUT_VIDEO" | cut -f1)
    echo -e "元のサイズ: $INPUT_SIZE → 最適化後: $OUTPUT_SIZE"
    
    # 解像度確認
    INPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$INPUT_VIDEO")
    OUTPUT_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$OUTPUT_VIDEO")
    echo -e "元の解像度: $INPUT_RES → 最適化後: $OUTPUT_RES"
    
    echo -e "\n${CYAN}🎉 処理完了！ Cloudinary AIによる最適化が完了しました！${NC}"
else
    echo -e "\n${RED}❌ ダウンロード失敗${NC}"
    exit 1
fi

# クリーンアップ（オプション: Cloudinaryから削除）
echo -e "\n${YELLOW}🧹 Cloudinaryから一時ファイルを削除中...${NC}"
curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/video/upload" \
  -u "${API_KEY}:${API_SECRET}" \
  -F "public_ids[]=${PUBLIC_ID}" \
  -F "type=upload" \
  -F "resource_type=video" >/dev/null 2>&1

echo -e "${GREEN}✅ クリーンアップ完了${NC}"
