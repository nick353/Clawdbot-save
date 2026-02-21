#!/bin/bash
# watch-and-process.sh - 動画ファイルの自動検出＆処理
# /root/.clawdbot/media/inbound/ を監視して、新しい動画を自動処理
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

# 監視ディレクトリ
WATCH_DIR="/root/.clawdbot/media/inbound"
WORK_DIR="/root/clawd/video-processing"
mkdir -p "$WORK_DIR"

# 処理済みファイルのリスト
PROCESSED_LIST="$WORK_DIR/.processed_files"
touch "$PROCESSED_LIST"

# ログファイル
LOG_FILE="$WORK_DIR/auto-process.log"

# ログ関数
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 動画ファイルかチェック
is_video_file() {
    local file="$1"
    local mime_type=$(file --mime-type -b "$file" 2>/dev/null)
    
    case "$mime_type" in
        video/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# 新しい動画ファイルを検索
find_new_videos() {
    find "$WATCH_DIR" -type f -mmin -5 2>/dev/null | while read file; do
        # 既に処理済みかチェック
        if grep -q "^$file$" "$PROCESSED_LIST" 2>/dev/null; then
            continue
        fi
        
        # 動画ファイルかチェック
        if is_video_file "$file"; then
            echo "$file"
        fi
    done
}

# 動画を処理
process_video() {
    local input="$1"
    local filename=$(basename "$input")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local output="$WORK_DIR/output_${timestamp}.mp4"
    
    log "🎬 新しい動画を検出: $filename"
    log "処理を開始します..."
    
    # 処理済みリストに追加
    echo "$input" >> "$PROCESSED_LIST"
    
    # 処理実行
    if $PROCESS_ALL "$input" "$output" --preset youtube 2>&1 | tee -a "$LOG_FILE"; then
        log "✅ 処理完了: $output"
        echo "PROCESSED_VIDEO=$output"
        
        # 入力ファイルを削除（元のメディアファイル）
        rm -f "$input"
        log "🧹 元ファイルを削除: $input"
    else
        log "❌ 処理失敗: $filename"
        return 1
    fi
}

# メイン処理
main() {
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "🔍 動画ファイル自動処理を開始"
    log "監視ディレクトリ: $WATCH_DIR"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 新しい動画を検索
    local videos=$(find_new_videos)
    
    if [ -z "$videos" ]; then
        log "📭 新しい動画はありません"
        return 0
    fi
    
    # 各動画を処理
    echo "$videos" | while read video; do
        if [ -n "$video" ]; then
            process_video "$video"
        fi
    done
    
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "✅ すべての処理が完了しました"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

main "$@"
