#!/bin/bash
# Adobe Podcast統合版 動画処理スクリプト
# 画質改善（Cloudinary） + 音声改善（Adobe Podcast） + Google Driveアップロード

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="/root/clawd/video-processing"
mkdir -p "$WORK_DIR"

# 引数チェック
if [ $# -lt 1 ]; then
    echo "❌ Usage: $0 <input_video> [--gdrive-original-folder FOLDER] [--gdrive-processed-folder FOLDER]"
    exit 1
fi

INPUT_VIDEO="$1"
shift

# デフォルトのGoogleドライブフォルダ
GDRIVE_ORIGINAL_FOLDER="OriginalVideos"
GDRIVE_PROCESSED_FOLDER="ProcessedVideos"

# オプション解析
while [[ $# -gt 0 ]]; do
    case $1 in
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

echo "🎬 Adobe Podcast統合版 動画処理開始"
echo "   入力: $INPUT_VIDEO"
echo "   作業ディレクトリ: $WORK_DIR"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BASENAME=$(basename "$INPUT_VIDEO" | sed 's/\.[^.]*$//')

# 出力ファイル名
VIDEO_OPTIMIZED="$WORK_DIR/video_optimized_${TIMESTAMP}.mp4"
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
else
    echo "✅ 元動画アップロード完了"
    echo "   Google Drive ID: $ORIGINAL_GDRIVE_ID"
    echo "   URL: https://drive.google.com/open?id=$ORIGINAL_GDRIVE_ID"
fi
echo ""

# ========================================
# ステップ2: 画質改善（Cloudinary）
# ========================================
echo "🎨 ステップ2: 画質改善（Cloudinary AI）..."
bash "$SCRIPT_DIR/cloudinary-enhance.sh" "$INPUT_VIDEO" "$VIDEO_OPTIMIZED"

if [ ! -f "$VIDEO_OPTIMIZED" ]; then
    echo "❌ 画質改善失敗"
    exit 1
fi
echo "✅ 画質改善完了: $VIDEO_OPTIMIZED"
echo ""

# ========================================
# ステップ3: 音声抽出
# ========================================
echo "🎵 ステップ3: 音声抽出..."
ffmpeg -i "$VIDEO_OPTIMIZED" -vn -acodec pcm_s16le -ar 44100 -ac 2 "$AUDIO_EXTRACTED" -y 2>&1 | grep -E "(Duration|Stream|Output)" || true

if [ ! -f "$AUDIO_EXTRACTED" ]; then
    echo "❌ 音声抽出失敗"
    exit 1
fi
echo "✅ 音声抽出完了: $AUDIO_EXTRACTED"
echo ""

# ========================================
# ステップ4: 音声改善（Adobe Podcast API）
# ========================================
echo "🎙️ ステップ4: 音声改善（Adobe Podcast AI）..."

# Adobe Podcast APIで音声改善
python3 "$SCRIPT_DIR/adobe-podcast-api.py" "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"

if [ ! -f "$AUDIO_ENHANCED" ]; then
    echo "⚠️ Warning: Adobe Podcast音声改善失敗（元音声を使用）"
    cp "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"
else
    echo "✅ Adobe Podcast音声改善完了: $AUDIO_ENHANCED"
fi
echo ""

# ========================================
# ステップ5: 音声＋映像を結合
# ========================================
echo "🎬 ステップ5: 音声＋映像を結合..."
ffmpeg -i "$VIDEO_OPTIMIZED" -i "$AUDIO_ENHANCED" \
    -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 \
    "$FINAL_OUTPUT" -y 2>&1 | grep -E "(Duration|Stream|Output)" || true

if [ ! -f "$FINAL_OUTPUT" ]; then
    echo "❌ 最終結合失敗"
    exit 1
fi
echo "✅ 最終結合完了: $FINAL_OUTPUT"
echo ""

# ========================================
# ステップ6: 処理済み動画をGoogle Driveにアップロード
# ========================================
echo "📤 ステップ6: 処理済み動画をGoogle Driveにアップロード..."
PROCESSED_GDRIVE_ID=$(bash "$SCRIPT_DIR/gdrive-upload.sh" "$FINAL_OUTPUT" "$GDRIVE_PROCESSED_FOLDER" 2>&1 | grep "File ID:" | awk '{print $3}')

if [ -z "$PROCESSED_GDRIVE_ID" ]; then
    echo "❌ 処理済み動画のアップロード失敗"
    exit 1
fi
echo "✅ 処理済み動画アップロード完了"
echo "   Google Drive ID: $PROCESSED_GDRIVE_ID"
echo "   URL: https://drive.google.com/open?id=$PROCESSED_GDRIVE_ID"
echo ""

# ========================================
# 完了
# ========================================
echo "🎉 全ステップ完了！"
echo ""
echo "📊 結果サマリー:"
echo "   元動画: https://drive.google.com/open?id=$ORIGINAL_GDRIVE_ID"
echo "   処理済み: https://drive.google.com/open?id=$PROCESSED_GDRIVE_ID"
echo ""
echo "🗑️ 一時ファイルをクリーンアップ..."
rm -f "$VIDEO_OPTIMIZED" "$AUDIO_EXTRACTED" "$AUDIO_ENHANCED"
echo "✅ クリーンアップ完了"
echo ""
echo "📤 Google Driveリンク（Discord投稿用）:"
echo "元動画: https://drive.google.com/open?id=$ORIGINAL_GDRIVE_ID"
echo "処理済み: https://drive.google.com/open?id=$PROCESSED_GDRIVE_ID"
