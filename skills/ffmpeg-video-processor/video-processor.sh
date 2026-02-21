#!/bin/bash
# video-processor.sh - Sora動画の画質改善スクリプト
# 作成: リッキー 🐥

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# デフォルト設定
DENOISE="medium"
SHARPEN="medium"
BITRATE="5000k"
PRESET="youtube"
RESOLUTION=""  # 空の場合は元の解像度を保持
ENHANCE_AUDIO="false"  # 音声改善オプション

# スクリプトのディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ヘルプ表示
show_help() {
    cat << EOF
🎬 Sora動画処理スクリプト

使い方:
  $0 improve <input> <output> [options]
  $0 custom <input> <output> [options]
  $0 batch <directory>

コマンド:
  improve   画質改善処理（推奨設定）
  custom    カスタム設定で処理
  batch     複数動画を一括処理

オプション:
  --denoise <level>    ノイズ除去 (low/medium/high)
  --sharpen <level>    シャープ化 (low/medium/high)
  --bitrate <rate>     ビットレート (例: 5000k)
  --preset <preset>    プリセット (youtube/instagram/twitter)
  --resolution <WxH>   解像度指定 (例: 1920x1080) ※デフォルトは元のサイズ維持

例:
  # YouTube用に最適化
  $0 improve input.mp4 output.mp4 --preset youtube
  
  # カスタム設定
  $0 custom input.mp4 output.mp4 --denoise high --bitrate 8000k
  
  # バッチ処理
  $0 batch /path/to/videos/

EOF
    exit 0
}

# ノイズ除去設定
get_denoise_filter() {
    case "$1" in
        low)
            echo "hqdn3d=2:1.5:3:2"
            ;;
        medium)
            echo "hqdn3d=4:3:6:4.5"
            ;;
        high)
            echo "hqdn3d=8:6:12:9"
            ;;
        *)
            echo "hqdn3d=4:3:6:4.5"
            ;;
    esac
}

# シャープ化設定
get_sharpen_filter() {
    case "$1" in
        low)
            echo "unsharp=5:5:0.5:5:5:0.0"
            ;;
        medium)
            echo "unsharp=5:5:1.0:5:5:0.0"
            ;;
        high)
            echo "unsharp=5:5:1.5:5:5:0.0"
            ;;
        *)
            echo "unsharp=5:5:1.0:5:5:0.0"
            ;;
    esac
}

# プリセット設定
apply_preset() {
    case "$1" in
        youtube)
            BITRATE="5000k"
            # 解像度は元のまま保持（アスペクト比を維持）
            ;;
        instagram)
            BITRATE="3500k"
            # 解像度は元のまま保持（アスペクト比を維持）
            ;;
        twitter)
            BITRATE="2500k"
            # 解像度は元のまま保持（アスペクト比を維持）
            ;;
    esac
}

# 動画処理
process_video() {
    local input="$1"
    local output="$2"
    
    if [ ! -f "$input" ]; then
        echo -e "${RED}エラー: 入力ファイルが見つかりません: $input${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🎬 動画処理開始...${NC}"
    echo -e "入力: $input"
    echo -e "出力: $output"
    echo -e "設定: ノイズ除去=$DENOISE, シャープ化=$SHARPEN, ビットレート=$BITRATE"
    
    # フィルター作成
    local denoise_filter=$(get_denoise_filter "$DENOISE")
    local sharpen_filter=$(get_sharpen_filter "$SHARPEN")
    local filter_complex="${denoise_filter},${sharpen_filter}"
    
    if [ -n "$RESOLUTION" ]; then
        filter_complex="${filter_complex},scale=${RESOLUTION}"
    fi
    
    # ffmpeg実行
    ffmpeg -i "$input" \
        -vf "$filter_complex" \
        -c:v libx264 -preset slow -crf 18 \
        -b:v "$BITRATE" \
        -c:a aac -b:a 192k \
        -y "$output" \
        2>&1 | grep -E "frame=|Duration:|time="
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 処理完了: $output${NC}"
        
        # ファイルサイズ比較
        local input_size=$(du -h "$input" | cut -f1)
        local output_size=$(du -h "$output" | cut -f1)
        echo -e "元のサイズ: $input_size → 処理後: $output_size"
    else
        echo -e "${RED}❌ 処理失敗${NC}"
        exit 1
    fi
}

# バッチ処理
batch_process() {
    local dir="$1"
    
    if [ ! -d "$dir" ]; then
        echo -e "${RED}エラー: ディレクトリが見つかりません: $dir${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}📂 バッチ処理開始: $dir${NC}"
    
    local count=0
    for input in "$dir"/*.mp4; do
        [ -f "$input" ] || continue
        
        local filename=$(basename "$input" .mp4)
        local output="$dir/${filename}_processed.mp4"
        
        echo -e "\n${YELLOW}[$(($count + 1))] 処理中: $filename${NC}"
        process_video "$input" "$output"
        
        count=$((count + 1))
    done
    
    echo -e "\n${GREEN}✅ バッチ処理完了: $count 個の動画を処理しました${NC}"
}

# メイン処理
main() {
    if [ $# -lt 1 ]; then
        show_help
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        improve)
            if [ $# -lt 2 ]; then
                echo -e "${RED}エラー: 入力と出力ファイルを指定してください${NC}"
                exit 1
            fi
            
            local input="$1"
            local output="$2"
            shift 2
            
            # オプション解析
            while [ $# -gt 0 ]; do
                case "$1" in
                    --denoise)
                        DENOISE="$2"
                        shift 2
                        ;;
                    --sharpen)
                        SHARPEN="$2"
                        shift 2
                        ;;
                    --bitrate)
                        BITRATE="$2"
                        shift 2
                        ;;
                    --preset)
                        apply_preset "$2"
                        shift 2
                        ;;
                    --resolution)
                        RESOLUTION="${2/x/:}"  # 1920x1080 → 1920:1080
                        shift 2
                        ;;
                    *)
                        echo -e "${RED}不明なオプション: $1${NC}"
                        exit 1
                        ;;
                esac
            done
            
            process_video "$input" "$output"
            ;;
        custom)
            if [ $# -lt 2 ]; then
                echo -e "${RED}エラー: 入力と出力ファイルを指定してください${NC}"
                exit 1
            fi
            
            local input="$1"
            local output="$2"
            shift 2
            
            # オプション解析
            while [ $# -gt 0 ]; do
                case "$1" in
                    --denoise)
                        DENOISE="$2"
                        shift 2
                        ;;
                    --sharpen)
                        SHARPEN="$2"
                        shift 2
                        ;;
                    --bitrate)
                        BITRATE="$2"
                        shift 2
                        ;;
                    --resolution)
                        RESOLUTION="${2/x/:}"  # 1920x1080 → 1920:1080
                        shift 2
                        ;;
                    *)
                        echo -e "${RED}不明なオプション: $1${NC}"
                        exit 1
                        ;;
                esac
            done
            
            process_video "$input" "$output"
            ;;
        batch)
            if [ $# -lt 1 ]; then
                echo -e "${RED}エラー: ディレクトリを指定してください${NC}"
                exit 1
            fi
            
            batch_process "$1"
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
