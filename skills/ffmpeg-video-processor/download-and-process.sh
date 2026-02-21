#!/bin/bash
# download-and-process.sh - Discord動画を自動ダウンロード＆処理
# 作成: リッキー 🐥

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# スクリプトのディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROCESS_ALL="$SCRIPT_DIR/process-all.sh"

# 作業ディレクトリ
WORK_DIR="/root/clawd/video-processing"
mkdir -p "$WORK_DIR"

# ヘルプ表示
show_help() {
    cat << EOF
${CYAN}🎬 Discord動画自動処理スクリプト${NC}

${YELLOW}使い方:${NC}
  $0 <動画URL> [--preset <preset>] [--skip-audio] [--skip-video]

${YELLOW}例:${NC}
  # Discord動画URLから完全処理
  $0 https://cdn.discordapp.com/attachments/.../video.mp4

  # YouTube用プリセット
  $0 https://cdn.discordapp.com/attachments/.../video.mp4 --preset youtube

  # 画質改善のみ
  $0 https://cdn.discordapp.com/attachments/.../video.mp4 --skip-audio

${YELLOW}処理フロー:${NC}
  1. 動画をダウンロード
  2. 画質改善
  3. 音声改善（Adobe Podcast）
  4. 完成した動画を返却

EOF
    exit 0
}

# URLから動画をダウンロード
download_video() {
    local url="$1"
    local output="$2"
    
    echo -e "${YELLOW}📥 動画をダウンロード中...${NC}"
    echo -e "URL: $url"
    
    wget -q --show-progress -O "$output" "$url"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ダウンロード完了${NC}"
        local size=$(du -h "$output" | cut -f1)
        echo -e "ファイルサイズ: $size"
    else
        echo -e "${RED}❌ ダウンロード失敗${NC}"
        exit 1
    fi
}

# メイン処理
main() {
    if [ $# -lt 1 ]; then
        show_help
    fi
    
    local video_url="$1"
    shift
    
    # タイムスタンプ付きファイル名
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local input_file="$WORK_DIR/input_${timestamp}.mp4"
    local output_file="$WORK_DIR/output_${timestamp}.mp4"
    
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  🎬 Discord動画自動処理を開始します        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"
    
    # ステップ1: ダウンロード
    download_video "$video_url" "$input_file"
    
    # ステップ2: 処理
    echo -e "\n${YELLOW}🎨 動画を処理中...${NC}"
    $PROCESS_ALL "$input_file" "$output_file" "$@"
    
    # 完了
    echo -e "\n${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  ✅ 処理完了！                             ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"
    
    echo -e "${GREEN}出力ファイル: $output_file${NC}"
    echo -e "\nDiscordに返却しますっぴ！🐥✨"
    
    # 出力ファイルのパスを返す（Clawdbotが受け取る）
    echo "OUTPUT_FILE=$output_file"
    
    # 注意: 出力ファイルはDiscord送信後に削除されます
    # 入力ファイルと一時ファイルはこの後すぐに削除されます
}

# クリーンアップ関数
cleanup_files() {
    local input_pattern="$1"
    local keep_output="$2"
    
    echo -e "\n${YELLOW}🧹 一時ファイルをクリーンアップ中...${NC}"
    
    # 入力ファイルを削除
    if [ -f "$input_pattern" ]; then
        rm -f "$input_pattern"
        echo -e "  ✅ 入力ファイルを削除: $(basename $input_pattern)"
    fi
    
    # /tmp/video-process-all/ の一時ファイルを削除
    if [ -d "/tmp/video-process-all" ]; then
        rm -rf /tmp/video-process-all/*
        echo -e "  ✅ 処理用一時ファイルを削除"
    fi
    
    # /tmp/audio-enhance/ の一時ファイルを削除
    if [ -d "/tmp/audio-enhance" ]; then
        rm -rf /tmp/audio-enhance/*
        echo -e "  ✅ 音声処理用一時ファイルを削除"
    fi
    
    # 古い処理ファイルを削除（24時間以上前）
    find "$WORK_DIR" -type f -name "input_*.mp4" -mtime +1 -delete 2>/dev/null
    find "$WORK_DIR" -type f -name "output_*.mp4" -mtime +1 -delete 2>/dev/null
    
    echo -e "${GREEN}✅ クリーンアップ完了${NC}"
}

# トラップを設定（エラー時も必ずクリーンアップ）
trap 'cleanup_files "$input_file" "$output_file"' EXIT

main "$@"
