#!/bin/bash
# Replicate統合版 完全自動動画処理
# ウォーターマーク除去（LaMA） + 画質改善（Real-ESRGAN） + 音声改善（Adobe Podcast）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="/root/clawd/video-processing"
VENV_DIR="$SCRIPT_DIR/venv"
mkdir -p "$WORK_DIR"

# 引数チェック
if [ $# -lt 1 ]; then
    echo "❌ Usage: $0 <input_video> [--watermark-positions 'x,y,w,h;...'] [--gdrive-original-folder FOLDER] [--gdrive-processed-folder FOLDER]"
    exit 1
fi

INPUT_VIDEO="$1"
shift

# デフォルト設定
WATERMARK_POSITIONS="35,585,141,53;30,68,149,50;1112,321,154,46"  # Sora2デフォルト（横向き）
GDRIVE_ORIGINAL_FOLDER="OriginalVideos"
GDRIVE_PROCESSED_FOLDER="ProcessedVideos"

# オプション解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --watermark-positions)
            WATERMARK_POSITIONS="$2"
            shift 2
            ;;
        --gdrive-original-folder)
            GDRIVE_ORIGINAL_FOLDER="$2"
            shift 2
            ;;
        --gdrive-processed-folder)
            GDRIVE_PROCESSED_FOLDER="$2"
            shift 2
            ;;
        *)
            echo "❌ Unknown option: $1"
            exit 1
            ;;
    esac
done

# 入力ファイル確認
if [ ! -f "$INPUT_VIDEO" ]; then
    echo "❌ Input video not found: $INPUT_VIDEO"
    exit 1
fi

# Replicate APIキー確認
if [ -z "$REPLICATE_API_TOKEN" ]; then
    echo "❌ Error: REPLICATE_API_TOKEN環境変数が設定されていません"
    echo "以下のコマンドで設定してください:"
    echo "export REPLICATE_API_TOKEN='your_token_here'"
    exit 1
fi

echo "🎬 Replicate統合版 動画処理開始"
echo "   入力: $INPUT_VIDEO"
echo "   作業ディレクトリ: $WORK_DIR"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 出力ファイル名
WATERMARK_REMOVED="$WORK_DIR/watermark_removed_${TIMESTAMP}.mp4"
UPSCALED_VIDEO="$WORK_DIR/upscaled_${TIMESTAMP}.mp4"
AUDIO_EXTRACTED="$WORK_DIR/audio_extracted_${TIMESTAMP}.wav"
AUDIO_ENHANCED="$WORK_DIR/audio_enhanced_${TIMESTAMP}.wav"
FINAL_OUTPUT="$WORK_DIR/final_${TIMESTAMP}.mp4"

# ========================================
# ステップ1: 元動画をGoogle Driveにアップロード
# ========================================
echo "📤 ステップ1: 元動画をGoogle Driveにアップロード..."
ORIGINAL_GDRIVE_ID=$(bash "$SCRIPT_DIR/gdrive-upload.sh" "$INPUT_VIDEO" "$GDRIVE_ORIGINAL_FOLDER" 2>&1 | grep "File ID:" | awk '{print $3}')

if [ -z "$ORIGINAL_GDRIVE_ID" ]; then
    echo "⚠️ Warning: 元動画のアップロードに失敗しました"
    ORIGINAL_GDRIVE_URL="(アップロード失敗)"
else
    echo "✅ 元動画アップロード完了"
    ORIGINAL_GDRIVE_URL="https://drive.google.com/open?id=$ORIGINAL_GDRIVE_ID"
    echo "   URL: $ORIGINAL_GDRIVE_URL"
fi
echo ""

# ========================================
# ステップ2: ウォーターマーク除去（Replicate LaMA）
# ========================================
echo "🎭 ステップ2: ウォーターマーク除去（Replicate LaMA）..."

# ウォーターマーク位置をPython形式に変換
PYTHON_POSITIONS=$(echo "$WATERMARK_POSITIONS" | sed 's/;/),(/g' | sed 's/,/, /g')
PYTHON_POSITIONS="[($PYTHON_POSITIONS)]"

source "$VENV_DIR/bin/activate"
python3 "$SCRIPT_DIR/replicate-watermark-remover.py" "$INPUT_VIDEO" "$WATERMARK_REMOVED" "$PYTHON_POSITIONS"

if [ ! -f "$WATERMARK_REMOVED" ]; then
    echo "❌ ウォーターマーク除去失敗"
    exit 1
fi
echo "✅ ウォーターマーク除去完了: $WATERMARK_REMOVED"
echo ""

# ========================================
# ステップ3: 画質改善（Replicate Real-ESRGAN）
# ========================================
echo "🎨 ステップ3: 画質改善（Real-ESRGAN 4倍アップスケール）..."
python3 "$SCRIPT_DIR/replicate-upscaler.py" "$WATERMARK_REMOVED" "$UPSCALED_VIDEO" 4

if [ ! -f "$UPSCALED_VIDEO" ]; then
    echo "⚠️ Warning: Real-ESRGAN失敗（元動画を使用）"
    cp "$WATERMARK_REMOVED" "$UPSCALED_VIDEO"
else
    echo "✅ 画質改善完了: $UPSCALED_VIDEO"
fi
echo ""

# ========================================
# ステップ4: 音声抽出
# ========================================
echo "🎵 ステップ4: 音声抽出..."
ffmpeg -i "$UPSCALED_VIDEO" -vn -acodec pcm_s16le -ar 44100 -ac 2 "$AUDIO_EXTRACTED" -y 2>&1 | grep -E "(Duration|Stream|Output)" || true

if [ ! -f "$AUDIO_EXTRACTED" ]; then
    echo "❌ 音声抽出失敗"
    exit 1
fi
echo "✅ 音声抽出完了: $AUDIO_EXTRACTED"
echo ""

# ========================================
# ステップ5: 音声改善（Adobe Podcast API）
# ========================================
echo "🎙️ ステップ5: 音声改善（Adobe Podcast AI）..."
source ~/.profile
python3 "$SCRIPT_DIR/adobe-podcast-api.py" "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"

if [ ! -f "$AUDIO_ENHANCED" ]; then
    echo "⚠️ Warning: Adobe Podcast音声改善失敗（元音声を使用）"
    cp "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"
else
    echo "✅ Adobe Podcast音声改善完了: $AUDIO_ENHANCED"
fi
echo ""

# ========================================
# ステップ6: 音声＋映像を結合
# ========================================
echo "🎬 ステップ6: 音声＋映像を結合..."
ffmpeg -i "$UPSCALED_VIDEO" -i "$AUDIO_ENHANCED" \
    -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 \
    "$FINAL_OUTPUT" -y 2>&1 | grep -E "(Duration|Stream|Output)" || true

if [ ! -f "$FINAL_OUTPUT" ]; then
    echo "❌ 最終結合失敗"
    exit 1
fi
echo "✅ 最終結合完了: $FINAL_OUTPUT"
echo ""

# ========================================
# ステップ7: 処理済み動画をGoogle Driveにアップロード
# ========================================
echo "📤 ステップ7: 処理済み動画をGoogle Driveにアップロード..."
PROCESSED_GDRIVE_ID=$(bash "$SCRIPT_DIR/gdrive-upload.sh" "$FINAL_OUTPUT" "$GDRIVE_PROCESSED_FOLDER" 2>&1 | grep "File ID:" | awk '{print $3}')

if [ -z "$PROCESSED_GDRIVE_ID" ]; then
    echo "❌ 処理済み動画のアップロード失敗"
    exit 1
fi
echo "✅ 処理済み動画アップロード完了"
PROCESSED_GDRIVE_URL="https://drive.google.com/open?id=$PROCESSED_GDRIVE_ID"
echo "   URL: $PROCESSED_GDRIVE_URL"
echo ""

# ========================================
# 完了
# ========================================
echo "🎉 全ステップ完了！"
echo ""
echo "📊 結果サマリー:"
echo "   元動画: $ORIGINAL_GDRIVE_URL"
echo "   処理済み: $PROCESSED_GDRIVE_URL"
echo ""
echo "🗑️ 一時ファイルをクリーンアップ..."
rm -f "$WATERMARK_REMOVED" "$UPSCALED_VIDEO" "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"
echo "✅ クリーンアップ完了"
echo ""
echo "📤 Google Driveリンク（Discord投稿用）:"
echo "元動画: $ORIGINAL_GDRIVE_URL"
echo "処理済み: $PROCESSED_GDRIVE_URL"
