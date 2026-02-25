#!/bin/bash
# Discord画像投稿自動化スクリプト（Gemini Vision + AIキャプション生成）
# 使い方: bash auto-post-from-discord-image.sh <画像パス> [DRY_RUN]

set -e

IMAGE_PATH="$1"
DRY_RUN="${2:-false}"

if [ -z "$IMAGE_PATH" ]; then
  echo "❌ エラー: 画像パスを指定してください"
  echo "使い方: bash auto-post-from-discord-image.sh <画像パス> [DRY_RUN]"
  exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
  echo "❌ エラー: 画像ファイルが見つかりません: $IMAGE_PATH"
  exit 1
fi

echo "🐥 Discord画像投稿自動化スタートですっぴ！"
echo "📸 画像: $IMAGE_PATH"
echo "🔍 DRY_RUN: $DRY_RUN"

# Gemini Vision APIでキャプション生成
echo "🤖 Gemini Visionでキャプション生成中..."
CAPTION_FILE="/tmp/gemini-caption-$$.txt"
python3 /root/clawd/skills/sns-multi-poster/generate-caption-with-gemini.py "$IMAGE_PATH" > "$CAPTION_FILE" 2>&1

if [ $? -ne 0 ]; then
  echo "❌ キャプション生成失敗"
  cat "$CAPTION_FILE"
  rm -f "$CAPTION_FILE"
  exit 1
fi

CAPTION=$(cat "$CAPTION_FILE")
rm -f "$CAPTION_FILE"

echo "✅ キャプション生成成功！"
echo "---"
echo "$CAPTION"
echo "---"

# 5つのSNSに投稿
echo ""
echo "📤 5つのSNSに投稿中..."

PLATFORMS=("instagram" "threads" "facebook" "pinterest" "x")
SUCCESS_COUNT=0
FAILED_PLATFORMS=()

for platform in "${PLATFORMS[@]}"; do
  echo ""
  echo "🔄 ${platform}に投稿中..."
  
  SCRIPT_PATH="/root/clawd/skills/sns-multi-poster/post-to-${platform}.cjs"
  
  if [ ! -f "$SCRIPT_PATH" ]; then
    echo "⚠️ ${platform}の投稿スクリプトが見つかりません: $SCRIPT_PATH"
    FAILED_PLATFORMS+=("$platform")
    continue
  fi
  
  # 投稿実行
  if [ "$DRY_RUN" = "true" ]; then
    DRY_RUN=true node "$SCRIPT_PATH" "$IMAGE_PATH" "$CAPTION" 2>&1 | tail -20
  else
    node "$SCRIPT_PATH" "$IMAGE_PATH" "$CAPTION" 2>&1 | tail -20
  fi
  
  if [ $? -eq 0 ]; then
    echo "✅ ${platform}投稿成功"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "❌ ${platform}投稿失敗"
    FAILED_PLATFORMS+=("$platform")
  fi
done

# 結果サマリー
echo ""
echo "===== 投稿結果サマリー ====="
echo "✅ 成功: ${SUCCESS_COUNT}/5"
if [ ${#FAILED_PLATFORMS[@]} -gt 0 ]; then
  echo "❌ 失敗: ${FAILED_PLATFORMS[*]}"
fi
echo "========================="

if [ ${#FAILED_PLATFORMS[@]} -gt 0 ]; then
  exit 1
else
  echo "🎉 全てのSNSに投稿成功ですっぴ！"
  exit 0
fi
