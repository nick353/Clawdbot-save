#!/bin/bash
# 自動動画処理スクリプト - ログ出力最適化版

set -e

INBOUND_DIR="/root/.clawdbot/media/inbound"
PROCESSOR_SCRIPT="/root/clawd/skills/ffmpeg-video-processor/process-with-deepfilternet.sh"
DISCORD_CHANNEL="1471428614917718036"

RECENT_VIDEOS=$(find "$INBOUND_DIR" -type f \( -name "*.mp4" -o -name "*.mov" \) -mmin -5 2>/dev/null)

[ -z "$RECENT_VIDEOS" ] && exit 0

for VIDEO in $RECENT_VIDEOS; do
    if [[ ! "$VIDEO" =~ \.(mp4|mov)$ ]]; then
        NEW_NAME="${VIDEO}.mov"
        mv "$VIDEO" "$NEW_NAME"
        VIDEO="$NEW_NAME"
    fi
    
    LOG_FILE="/tmp/video_process_$$.log"
    source ~/.profile
    
    if bash "$PROCESSOR_SCRIPT" "$VIDEO" > "$LOG_FILE" 2>&1; then
        RESULT_FILE="/tmp/sora_process_result.txt"
        
        if [ -f "$RESULT_FILE" ]; then
            FINAL_OUTPUT=$(grep "FINAL_OUTPUT=" "$RESULT_FILE" | cut -d= -f2)
            ORIGINAL_URL=$(grep "ORIGINAL_GDRIVE_URL=" "$RESULT_FILE" | cut -d= -f2-)
            PROCESSED_URL=$(grep "PROCESSED_GDRIVE_URL=" "$RESULT_FILE" | cut -d= -f2-)
            
            if [ -f "$FINAL_OUTPUT" ]; then
                FILE_SIZE=$(du -h "$FINAL_OUTPUT" | cut -f1)
                FILE_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$FINAL_OUTPUT" 2>/dev/null || echo "不明")
            else
                FILE_SIZE="不明"
                FILE_RES="不明"
            fi
            
            clawdbot message send --channel discord --target "$DISCORD_CHANNEL" \
                --message "✅ **Sora動画処理完了っぴ！** 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📁 **Google Drive（完成品）:**
$PROCESSED_URL

## 📦 **元動画（バックアップ）:**
$ORIGINAL_URL

━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔧 **実行した処理:**
1. 🧹 **WaveSpeedAI Watermark Remover** - Soraウォーターマーク自動除去
2. 🎨 **WaveSpeedAI Video Upscaler Pro** - 4K超解像（2倍）
3. 🎙️ **DeepFilterNet3** - AI音声改善（RNNノイズ除去・高品質）

━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📊 **ファイル情報:**
- **サイズ:** $FILE_SIZE
- **解像度:** $FILE_RES

## ⏱️ **処理時間:** 約5-8分
## 💰 **コスト:** \$0.13-0.14（15秒動画）

━━━━━━━━━━━━━━━━━━━━━━━━━━

**完全自動処理完了っぴ！** 🚀
Google Driveにアップロード済みですっぴ 🐥"
            
            rm -f "$RESULT_FILE"
        else
            clawdbot message send --channel discord --target "$DISCORD_CHANNEL" \
                --message "⚠️ 動画処理は完了しましたが、結果の取得に失敗しましたっぴ... ログを確認してくださいっぴ 🐥"
        fi
    else
        ERROR_LOG=$(tail -30 "$LOG_FILE" 2>/dev/null || echo "ログなし")
        clawdbot message send --channel discord --target "$DISCORD_CHANNEL" \
            --message "⚠️ 動画処理中にエラーが発生しましたっぴ... 😢

\`\`\`
$ERROR_LOG
\`\`\`

確認してくださいっぴ 🐥"
        echo "❌ 処理失敗: $(basename "$VIDEO")" >&2
    fi
    
    rm -f "$LOG_FILE"
done
