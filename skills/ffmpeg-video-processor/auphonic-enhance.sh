#!/bin/bash
# auphonic-enhance.sh - Auphonic APIで音声を処理
# 作成: リッキー 🐥

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# APIキー
API_KEY="${AUPHONIC_API_KEY:-Xts4bVCgrOD77A3J9C8PSBX7prVOch3b}"

# 使い方
if [ $# -lt 2 ]; then
    echo -e "${CYAN}使い方: $0 <input.wav> <output.wav>${NC}"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ エラー: 入力ファイルが見つかりません: $INPUT_FILE${NC}"
    exit 1
fi

echo -e "${CYAN}🎵 Auphonicで音声を処理中...${NC}"
echo -e "入力: ${GREEN}$INPUT_FILE${NC}"
echo -e "出力: ${GREEN}$OUTPUT_FILE${NC}"

# ステップ1: プロダクションを作成して処理開始
echo -e "\n${YELLOW}📤 ファイルをアップロード中...${NC}"

RESPONSE=$(curl -s -X POST https://auphonic.com/api/simple/productions.json \
  -H "Authorization: Bearer $API_KEY" \
  -F "title=Video Audio Enhancement" \
  -F "input_file=@$INPUT_FILE" \
  -F "filtering=true" \
  -F "normloudness=true" \
  -F "denoise=true" \
  -F "denoiseamount=12" \
  -F "action=start")

# プロダクションUUIDを取得（jqを使用）
PRODUCTION_UUID=$(echo "$RESPONSE" | jq -r '.data.uuid')

if [ -z "$PRODUCTION_UUID" ] || [ "$PRODUCTION_UUID" = "null" ]; then
    echo -e "${RED}❌ エラー: プロダクション作成失敗${NC}"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✅ アップロード完了${NC}"
echo -e "プロダクションUUID: ${CYAN}$PRODUCTION_UUID${NC}"

# ステップ2: 処理完了を待機
echo -e "\n${YELLOW}⏳ 処理完了を待機中...${NC}"

MAX_WAIT=300  # 最大5分待機
WAIT_TIME=0
STATUS=""

while [ "$STATUS" != "Done" ] && [ $WAIT_TIME -lt $MAX_WAIT ]; do
    sleep 10
    WAIT_TIME=$((WAIT_TIME + 10))
    
    # ステータスをチェック
    STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" \
      "https://auphonic.com/api/production/$PRODUCTION_UUID.json")
    
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status_string')
    
    echo -e "  [${WAIT_TIME}s] ステータス: ${YELLOW}$STATUS${NC}"
    
    if [ "$STATUS" = "Error" ]; then
        echo -e "${RED}❌ 処理エラーが発生しました${NC}"
        echo "$STATUS_RESPONSE" | jq -r '.data.error_message'
        exit 1
    fi
done

if [ "$STATUS" != "Done" ]; then
    echo -e "${RED}❌ タイムアウト: 処理に時間がかかりすぎています${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 処理完了！${NC}"

# ステップ3: 結果ファイルをダウンロード
echo -e "\n${YELLOW}📥 ダウンロード中...${NC}"

# output_filesから最初のファイルを取得（通常はMP3）
DOWNLOAD_URL=$(echo "$STATUS_RESPONSE" | jq -r '.data.output_files[0].download_url')

if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
    echo -e "${RED}❌ エラー: ダウンロードURLが見つかりません${NC}"
    echo "$STATUS_RESPONSE" | jq '.data.output_files'
    exit 1
fi

echo -e "ダウンロードURL: ${CYAN}$DOWNLOAD_URL${NC}"

# 一時ファイルにダウンロード（拡張子は気にしない）
TEMP_AUDIO="${OUTPUT_FILE}.temp"
curl -s -L -H "Authorization: Bearer $API_KEY" -o "$TEMP_AUDIO" "$DOWNLOAD_URL"

if [ ! -f "$TEMP_AUDIO" ] || [ ! -s "$TEMP_AUDIO" ]; then
    echo -e "${RED}❌ ダウンロード失敗（ファイルが空またはダウンロードエラー）${NC}"
    echo -e "${YELLOW}デバッグ情報:${NC}"
    ls -lh "$TEMP_AUDIO" 2>&1 || echo "ファイルが存在しません"
    exit 1
fi

TEMP_SIZE=$(du -h "$TEMP_AUDIO" | cut -f1)
FILE_TYPE=$(file -b "$TEMP_AUDIO" | head -c 50)
echo -e "${GREEN}✅ ダウンロード完了: ${TEMP_SIZE}${NC}"
echo -e "${CYAN}ファイル形式: $FILE_TYPE${NC}"

# ffmpegでWAVに変換（どんな形式でも対応）
echo -e "\n${YELLOW}🔄 WAV形式に変換中...${NC}"
ffmpeg -i "$TEMP_AUDIO" -acodec pcm_s16le -ar 44100 -ac 2 "$OUTPUT_FILE" -y 2>&1 | grep -E "Duration:|time=|size=" | tail -5 || true

if [ ! -f "$OUTPUT_FILE" ] || [ ! -s "$OUTPUT_FILE" ]; then
    echo -e "${RED}❌ WAV変換失敗${NC}"
    rm -f "$TEMP_AUDIO"
    exit 1
fi

# 一時ファイル削除
rm -f "$TEMP_AUDIO"

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo -e "${GREEN}✅ WAV変換完了: $OUTPUT_FILE (${FILE_SIZE})${NC}"

echo -e "\n${CYAN}🎉 音声処理が完了しました！${NC}"
