#!/bin/bash
# process-all.sh - 画質改善 + 音声改善の統合スクリプト
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
VIDEO_PROCESSOR="$SCRIPT_DIR/video-processor.sh"
AUDIO_ENHANCER="$SCRIPT_DIR/audio-enhance.sh"

# 一時ディレクトリ
TEMP_DIR="/tmp/video-process-all"
mkdir -p "$TEMP_DIR"

# デフォルト設定
PRESET="youtube"
SKIP_VIDEO="false"
SKIP_AUDIO="false"

# ヘルプ表示
show_help() {
    cat << EOF
${CYAN}🎬 Sora動画完全処理スクリプト${NC}

画質改善 + 音声改善を1つのコマンドで実行します。

${YELLOW}使い方:${NC}
  $0 <input> <output> [options]

${YELLOW}オプション:${NC}
  --preset <preset>     プリセット (youtube/instagram/twitter)
  --skip-video          画質改善をスキップ
  --skip-audio          音声改善をスキップ
  --denoise <level>     ノイズ除去 (low/medium/high)
  --sharpen <level>     シャープ化 (low/medium/high)
  --bitrate <rate>      ビットレート (例: 5000k)

${YELLOW}例:${NC}
  # 完全処理（画質 + 音声）
  $0 input.mp4 output.mp4

  # YouTube用最適化
  $0 input.mp4 output.mp4 --preset youtube

  # 画質改善のみ
  $0 input.mp4 output.mp4 --skip-audio

  # 音声改善のみ
  $0 input.mp4 output.mp4 --skip-video

${YELLOW}処理フロー:${NC}
  1. 画質改善（ノイズ除去 + シャープ化）
  2. 音声抽出
  3. Adobe Podcast Enhanceで音声処理
  4. 音声を動画に結合
  5. 完成！

${YELLOW}所要時間:${NC}
  - 画質改善: 動画の長さによる（数分〜）
  - 音声改善: 数分（Adobe Podcast処理時間含む）

EOF
    exit 0
}

# 処理ステップの表示
show_progress() {
    local step="$1"
    local total="$2"
    local message="$3"
    
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}[ステップ $step/$total] $message${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# メイン処理
main() {
    if [ $# -lt 2 ]; then
        show_help
    fi
    
    local input="$1"
    local output="$2"
    shift 2
    
    if [ ! -f "$input" ]; then
        echo -e "${RED}エラー: 入力ファイルが見つかりません: $input${NC}"
        exit 1
    fi
    
    # オプション解析
    local video_options=""
    while [ $# -gt 0 ]; do
        case "$1" in
            --preset)
                PRESET="$2"
                video_options="$video_options --preset $2"
                shift 2
                ;;
            --skip-video)
                SKIP_VIDEO="true"
                shift
                ;;
            --skip-audio)
                SKIP_AUDIO="true"
                shift
                ;;
            --denoise)
                video_options="$video_options --denoise $2"
                shift 2
                ;;
            --sharpen)
                video_options="$video_options --sharpen $2"
                shift 2
                ;;
            --bitrate)
                video_options="$video_options --bitrate $2"
                shift 2
                ;;
            --help|-h)
                show_help
                ;;
            *)
                echo -e "${RED}不明なオプション: $1${NC}"
                exit 1
                ;;
        esac
    done
    
    # 処理開始
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  🎬 Sora動画完全処理を開始します          ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
    echo -e "\n入力: ${GREEN}$input${NC}"
    echo -e "出力: ${GREEN}$output${NC}"
    echo -e "プリセット: ${YELLOW}$PRESET${NC}"
    
    if [ "$SKIP_VIDEO" = "true" ] && [ "$SKIP_AUDIO" = "true" ]; then
        echo -e "${RED}エラー: 画質改善も音声改善もスキップされています${NC}"
        exit 1
    fi
    
    # ステップ数の計算
    local total_steps=0
    [ "$SKIP_VIDEO" = "false" ] && total_steps=$((total_steps + 1))
    [ "$SKIP_AUDIO" = "false" ] && total_steps=$((total_steps + 3))
    
    local current_step=0
    local temp_video=""
    
    # ステップ1: 画質改善
    if [ "$SKIP_VIDEO" = "false" ]; then
        current_step=$((current_step + 1))
        show_progress "$current_step" "$total_steps" "画質改善（ノイズ除去 + シャープ化）"
        
        if [ "$SKIP_AUDIO" = "true" ]; then
            # 音声改善しない場合は直接出力
            $VIDEO_PROCESSOR improve "$input" "$output" $video_options
            temp_video="$output"
        else
            # 音声改善する場合は一時ファイルに出力
            temp_video="$TEMP_DIR/video_enhanced.mp4"
            $VIDEO_PROCESSOR improve "$input" "$temp_video" $video_options
        fi
    else
        temp_video="$input"
    fi
    
    # ステップ2-4: 音声改善
    if [ "$SKIP_AUDIO" = "false" ]; then
        # ステップ2: 音声抽出
        current_step=$((current_step + 1))
        show_progress "$current_step" "$total_steps" "音声抽出"
        
        local extracted_audio="$TEMP_DIR/extracted_audio.wav"
        $AUDIO_ENHANCER extract "$temp_video" "$extracted_audio"
        
        # ステップ3: Adobe Podcast処理
        current_step=$((current_step + 1))
        show_progress "$current_step" "$total_steps" "Adobe Podcast Enhanceで音声処理"
        
        echo -e "${YELLOW}📋 手動ステップ:${NC}"
        echo -e "  1. https://podcast.adobe.com にアクセス"
        echo -e "  2. 'Enhance' をクリック"
        echo -e "  3. 以下のファイルをアップロード:"
        echo -e "     ${GREEN}$extracted_audio${NC}"
        echo -e "  4. 処理完了後、ファイルをダウンロード"
        echo -e "  5. ダウンロードしたファイルのパスを入力してください:\n"
        
        read -p "処理済み音声ファイルのパス: " enhanced_audio
        
        if [ ! -f "$enhanced_audio" ]; then
            echo -e "${RED}エラー: ファイルが見つかりません: $enhanced_audio${NC}"
            exit 1
        fi
        
        # ステップ4: 音声を動画に結合
        current_step=$((current_step + 1))
        show_progress "$current_step" "$total_steps" "音声を動画に結合"
        
        $AUDIO_ENHANCER replace "$temp_video" "$enhanced_audio" "$output"
    fi
    
    # 完了メッセージ
    echo -e "\n${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  ✅ すべての処理が完了しました！           ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${GREEN}出力ファイル: $output${NC}"
    
    local input_size=$(du -h "$input" | cut -f1)
    local output_size=$(du -h "$output" | cut -f1)
    echo -e "ファイルサイズ: ${YELLOW}$input_size${NC} → ${GREEN}$output_size${NC}"
    
    # クリーンアップ
    echo -e "\n🧹 一時ファイルをクリーンアップ中..."
    rm -rf "$TEMP_DIR"
    echo -e "${GREEN}✅ クリーンアップ完了${NC}"
    
    echo -e "\n${CYAN}次のステップ:${NC}"
    echo -e "  1. 動画を確認"
    echo -e "  2. 字幕を追加（手動）"
    echo -e "  3. SNS投稿（sns-multi-poster）"
}

main "$@"
