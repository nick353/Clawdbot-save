#!/bin/bash
# 自動動画処理スクリプト（完全版 - WaveSpeedAI + Adobe Podcast + Google Drive）
# HEARTBEATから呼び出される

set -e

INBOUND_DIR="/root/.clawdbot/media/inbound"
PROCESSOR_SCRIPT="/root/clawd/skills/ffmpeg-video-processor/process-with-deepfilternet.sh"
DISCORD_CHANNEL="1471428614917718036"  # #ai動画処理

# 最近5分以内の動画ファイルを検出
RECENT_VIDEOS=$(find "$INBOUND_DIR" -type f \( -name "*.mp4" -o -name "*.mov" \) -mmin -5 2>/dev/null)

if [ -z "$RECENT_VIDEOS" ]; then
    echo "⏭️ 新しい動画なし"
    exit 0
fi

echo "🎬 新しい動画を検出しました"

for VIDEO in $RECENT_VIDEOS; do
    BASENAME=$(basename "$VIDEO")
    echo "📤 処理開始: $BASENAME"
    
    # 拡張子チェック（拡張子なしの場合は.movを追加）
    if [[ ! "$VIDEO" =~ \.(mp4|mov)$ ]]; then
        NEW_NAME="${VIDEO}.mov"
        mv "$VIDEO" "$NEW_NAME"
        VIDEO="$NEW_NAME"
        echo "   ファイル名変更: $(basename "$NEW_NAME")"
    fi
    
    # 処理実行
    LOG_FILE="/tmp/video_process_$$.log"
    
    # 環境変数を読み込んでから実行
    source ~/.profile
    
    if bash "$PROCESSOR_SCRIPT" "$VIDEO" > "$LOG_FILE" 2>&1; then
        echo "✅ 処理成功"
        
        # 処理結果を読み込み
        RESULT_FILE="/tmp/sora_process_result.txt"
        
        if [ -f "$RESULT_FILE" ]; then
            FINAL_OUTPUT=$(grep "FINAL_OUTPUT=" "$RESULT_FILE" | cut -d= -f2)
            ORIGINAL_URL=$(grep "ORIGINAL_GDRIVE_URL=" "$RESULT_FILE" | cut -d= -f2-)
            PROCESSED_URL=$(grep "PROCESSED_GDRIVE_URL=" "$RESULT_FILE" | cut -d= -f2-)
            
            # ファイル情報を取得
            if [ -f "$FINAL_OUTPUT" ]; then
                FILE_SIZE=$(du -h "$FINAL_OUTPUT" | cut -f1)
                FILE_RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$FINAL_OUTPUT" 2>/dev/null || echo "不明")
            else
                FILE_SIZE="不明"
                FILE_RES="不明"
            fi
            
            # Discord通知
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
            
            echo "   Discord通知送信完了"
            rm -f "$RESULT_FILE"
        else
            echo "⚠️ Warning: 処理結果ファイルが見つかりませんでした"
            clawdbot message send --channel discord --target "$DISCORD_CHANNEL" \
                --message "⚠️ 動画処理は完了しましたが、結果の取得に失敗しましたっぴ...

ログを確認してくださいっぴ 🐥"
        fi
    else
        echo "❌ 処理失敗"
        
        # エラーログを読み込む
        ERROR_LOG=$(tail -30 "$LOG_FILE" 2>/dev/null || echo "ログなし")
        
        clawdbot message send --channel discord --target "$DISCORD_CHANNEL" \
            --message "⚠️ 動画処理中にエラーが発生しましたっぴ... 😢

\`\`\`
$ERROR_LOG
\`\`\`

確認してくださいっぴ 🐥"
    fi
    
    # ログクリーンアップ
    rm -f "$LOG_FILE"
done

echo "✅ 自動処理完了"
