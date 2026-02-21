#!/bin/bash
# discord-auto-processor.sh - Discord動画の完全自動処理
# 動画URLを検出したら自動的にダウンロード→処理→返却
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
DOWNLOAD_AND_PROCESS="$SCRIPT_DIR/download-and-process.sh"

# 引数からメッセージテキストとチャンネルIDを取得
MESSAGE_TEXT="$1"
CHANNEL_ID="$2"
PRESET="${3:-youtube}"  # デフォルト: youtube

# Discord CDN URLパターン
DISCORD_CDN_PATTERN="https://cdn.discordapp.com/attachments/[0-9]+/[0-9]+/[^[:space:]]+\.(mp4|mov|avi|mkv|webm)"

# メッセージから動画URLを抽出
extract_video_url() {
    echo "$MESSAGE_TEXT" | grep -oE "$DISCORD_CDN_PATTERN" | head -1
}

# メイン処理
main() {
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  🎬 Discord動画自動処理を開始します        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"
    
    # 動画URLを抽出
    VIDEO_URL=$(extract_video_url)
    
    if [ -z "$VIDEO_URL" ]; then
        echo -e "${RED}❌ 動画URLが見つかりませんでした${NC}"
        echo -e "メッセージ: $MESSAGE_TEXT"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 動画URLを検出しました${NC}"
    echo -e "URL: $VIDEO_URL"
    echo -e "プリセット: $PRESET\n"
    
    # 動画をダウンロード→処理
    OUTPUT_FILE=$($DOWNLOAD_AND_PROCESS "$VIDEO_URL" --preset "$PRESET" | grep "OUTPUT_FILE=" | cut -d= -f2)
    
    if [ -f "$OUTPUT_FILE" ]; then
        echo -e "\n${GREEN}✅ 処理完了！出力ファイル: $OUTPUT_FILE${NC}"
        
        # ファイルパスを出力（Clawdbotが受け取る）
        echo "PROCESSED_VIDEO=$OUTPUT_FILE"
        echo "CHANNEL_ID=$CHANNEL_ID"
    else
        echo -e "${RED}❌ 処理に失敗しました${NC}"
        exit 1
    fi
}

main "$@"
