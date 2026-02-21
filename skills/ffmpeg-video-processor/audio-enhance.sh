#!/bin/bash
# audio-enhance.sh - Adobe Podcast Enhance統合スクリプト
# 作成: リッキー 🐥

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 一時ディレクトリ
TEMP_DIR="/tmp/audio-enhance"
mkdir -p "$TEMP_DIR"

# ヘルプ表示
show_help() {
    cat << EOF
🎵 Adobe Podcast Enhance 音声処理スクリプト

使い方:
  $0 enhance <input_video> <output_video>
  $0 extract <input_video> <output_audio>
  $0 replace <video> <audio> <output>

コマンド:
  enhance   動画から音声を抽出 → Adobe Podcast処理 → 動画に戻す
  extract   動画から音声のみを抽出
  replace   動画の音声を別の音声ファイルに置き換え

例:
  # 動画の音声を改善（全自動）
  $0 enhance input.mp4 output.mp4
  
  # 音声のみ抽出
  $0 extract input.mp4 audio.wav
  
  # 処理済み音声を動画に結合
  $0 replace input.mp4 enhanced_audio.wav output.mp4

注意:
  Adobe Podcast Enhanceは手動アップロードが必要です。
  完全自動化するには、ブラウザ自動化が必要です。

EOF
    exit 0
}

# 動画から音声を抽出
extract_audio() {
    local input="$1"
    local output="$2"
    
    if [ ! -f "$input" ]; then
        echo -e "${RED}エラー: 入力ファイルが見つかりません: $input${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🎵 音声を抽出中...${NC}"
    
    ffmpeg -i "$input" -vn -acodec pcm_s16le -ar 44100 -ac 2 "$output" -y
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 音声抽出完了: $output${NC}"
        local size=$(du -h "$output" | cut -f1)
        echo -e "ファイルサイズ: $size"
    else
        echo -e "${RED}❌ 音声抽出失敗${NC}"
        exit 1
    fi
}

# 音声を動画に置き換え
replace_audio() {
    local video="$1"
    local audio="$2"
    local output="$3"
    
    if [ ! -f "$video" ]; then
        echo -e "${RED}エラー: 動画ファイルが見つかりません: $video${NC}"
        exit 1
    fi
    
    if [ ! -f "$audio" ]; then
        echo -e "${RED}エラー: 音声ファイルが見つかりません: $audio${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🎬 音声を動画に結合中...${NC}"
    
    ffmpeg -i "$video" -i "$audio" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 "$output" -y
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 結合完了: $output${NC}"
        local size=$(du -h "$output" | cut -f1)
        echo -e "ファイルサイズ: $size"
    else
        echo -e "${RED}❌ 結合失敗${NC}"
        exit 1
    fi
}

# Adobe Podcast Enhanceワークフロー（手動ステップあり）
enhance_workflow() {
    local input="$1"
    local output="$2"
    
    if [ ! -f "$input" ]; then
        echo -e "${RED}エラー: 入力ファイルが見つかりません: $input${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🎵 Adobe Podcast Enhance ワークフロー${NC}"
    echo -e "\n📋 ステップ:"
    echo -e "  1. 動画から音声を抽出"
    echo -e "  2. Adobe Podcastで音声を処理（手動）"
    echo -e "  3. 処理済み音声を動画に結合"
    
    # ステップ1: 音声抽出
    local extracted_audio="$TEMP_DIR/extracted_audio.wav"
    echo -e "\n${YELLOW}[ステップ1] 音声を抽出中...${NC}"
    extract_audio "$input" "$extracted_audio"
    
    # ステップ2: Adobe Podcast（手動）
    echo -e "\n${YELLOW}[ステップ2] Adobe Podcastで処理してください${NC}"
    echo -e "  1. https://podcast.adobe.com にアクセス"
    echo -e "  2. 'Enhance' をクリック"
    echo -e "  3. 以下のファイルをアップロード:"
    echo -e "     ${GREEN}$extracted_audio${NC}"
    echo -e "  4. 処理完了後、ファイルをダウンロード"
    echo -e "  5. ダウンロードしたファイルのパスを入力してください:"
    
    read -p "処理済み音声ファイルのパス: " enhanced_audio
    
    if [ ! -f "$enhanced_audio" ]; then
        echo -e "${RED}エラー: ファイルが見つかりません: $enhanced_audio${NC}"
        exit 1
    fi
    
    # ステップ3: 音声を動画に結合
    echo -e "\n${YELLOW}[ステップ3] 音声を動画に結合中...${NC}"
    replace_audio "$input" "$enhanced_audio" "$output"
    
    echo -e "\n${GREEN}✅ すべてのステップが完了しました！${NC}"
    echo -e "出力: $output"
}

# メイン処理
main() {
    if [ $# -lt 1 ]; then
        show_help
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        enhance)
            if [ $# -lt 2 ]; then
                echo -e "${RED}エラー: 入力と出力ファイルを指定してください${NC}"
                exit 1
            fi
            enhance_workflow "$1" "$2"
            ;;
        extract)
            if [ $# -lt 2 ]; then
                echo -e "${RED}エラー: 入力と出力ファイルを指定してください${NC}"
                exit 1
            fi
            extract_audio "$1" "$2"
            ;;
        replace)
            if [ $# -lt 3 ]; then
                echo -e "${RED}エラー: 動画、音声、出力ファイルを指定してください${NC}"
                exit 1
            fi
            replace_audio "$1" "$2" "$3"
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}不明なコマンド: $command${NC}"
            show_help
            ;;
    esac
}

main "$@"
