#!/usr/bin/env bash
# Discord #sns-投稿チャンネルからの自動SNS投稿（Geminiキャプション生成付き）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="/tmp/sns-auto-poster"
mkdir -p "$TEMP_DIR"

MEDIA_URL="$1"
MEDIA_PATH="$2"
DISCORD_CHANNEL_ID="1470060780111007950" # #sns-投稿

if [ -z "$MEDIA_URL" ] || [ -z "$MEDIA_PATH" ]; then
  echo "❌ Usage: auto-sns-poster.sh <media-url> <media-path>" >&2
  exit 1
fi

# メディアタイプ判定
MEDIA_TYPE="image"
IS_VIDEO=false
if [[ "$MEDIA_PATH" =~ \.(mp4|mov|avi|mkv)$ ]]; then
  MEDIA_TYPE="video"
  IS_VIDEO=true
fi

# DRY_RUNモード
if [ "$DRY_RUN" = "true" ]; then
  echo "🔄 DRY_RUN MODE: 実際の投稿はスキップします"
fi

echo "🚀 自動SNS投稿開始（${MEDIA_TYPE}）"
echo "📎 メディア: $MEDIA_PATH"

# 投稿結果を記録
RESULTS_FILE="$TEMP_DIR/results-$(date +%s).txt"
> "$RESULTS_FILE"

# 各SNSのキャプション生成（並列）
echo "🤖 Geminiでキャプション生成中..."

declare -A CAPTIONS

# Instagram
CAPTIONS[instagram]=$(bash "$SCRIPT_DIR/generate-ai-caption.sh" "$MEDIA_PATH" "instagram" 2>&1 || echo "")
if [ -z "${CAPTIONS[instagram]}" ]; then
  echo "⚠️ Instagram: キャプション生成失敗" >&2
fi
sleep 2 # レート制限対策

# Facebook
CAPTIONS[facebook]=$(bash "$SCRIPT_DIR/generate-ai-caption.sh" "$MEDIA_PATH" "facebook" 2>&1 || echo "")
if [ -z "${CAPTIONS[facebook]}" ]; then
  echo "⚠️ Facebook: キャプション生成失敗" >&2
fi
sleep 2

# Threads
CAPTIONS[threads]=$(bash "$SCRIPT_DIR/generate-ai-caption.sh" "$MEDIA_PATH" "threads" 2>&1 || echo "")
if [ -z "${CAPTIONS[threads]}" ]; then
  echo "⚠️ Threads: キャプション生成失敗" >&2
fi
sleep 2

# X
CAPTIONS[x]=$(bash "$SCRIPT_DIR/generate-ai-caption.sh" "$MEDIA_PATH" "x" 2>&1 || echo "")
if [ -z "${CAPTIONS[x]}" ]; then
  echo "⚠️ X: キャプション生成失敗" >&2
fi
sleep 2

# Pinterest（動画の場合はスキップ）
if [ "$IS_VIDEO" = false ]; then
  CAPTIONS[pinterest]=$(bash "$SCRIPT_DIR/generate-ai-caption.sh" "$MEDIA_PATH" "pinterest" 2>&1 || echo "")
  if [ -z "${CAPTIONS[pinterest]}" ]; then
    echo "⚠️ Pinterest: キャプション生成失敗" >&2
  fi
else
  echo "⏭️  Pinterest: 動画はスキップ"
fi

echo "✅ キャプション生成完了"

# 並列投稿（バックグラウンドジョブ）
echo "📤 5つのSNSに並列投稿中..."

# Instagram
(
  if [ -n "${CAPTIONS[instagram]}" ]; then
    if [ "$DRY_RUN" = "true" ]; then
      echo "🔄 DRY_RUN: Instagram投稿スキップ" >> "$RESULTS_FILE"
      echo "📝 キャプション: ${CAPTIONS[instagram]}" >> "$RESULTS_FILE"
      echo "✅ Instagram: DRY_RUN完了" >> "$RESULTS_FILE"
    elif [ "$IS_VIDEO" = true ]; then
      node "$SCRIPT_DIR/post-to-instagram-reels.cjs" "$MEDIA_PATH" "${CAPTIONS[instagram]}" >> "$RESULTS_FILE" 2>&1 \
        && echo "✅ Instagram: 投稿成功" >> "$RESULTS_FILE" \
        || echo "❌ Instagram: 投稿失敗" >> "$RESULTS_FILE"
    else
      node "$SCRIPT_DIR/post-to-instagram-v13-screenshot.cjs" "$MEDIA_PATH" "${CAPTIONS[instagram]}" >> "$RESULTS_FILE" 2>&1 \
        && echo "✅ Instagram: 投稿成功" >> "$RESULTS_FILE" \
        || echo "❌ Instagram: 投稿失敗" >> "$RESULTS_FILE"
    fi
  else
    echo "⚠️  Instagram: キャプション生成失敗" >> "$RESULTS_FILE"
  fi
) &

# Facebook
(
  if [ -n "${CAPTIONS[facebook]}" ]; then
    if [ "$DRY_RUN" = "true" ]; then
      echo "🔄 DRY_RUN: Facebook投稿スキップ" >> "$RESULTS_FILE"
      echo "📝 キャプション: ${CAPTIONS[facebook]}" >> "$RESULTS_FILE"
      echo "✅ Facebook: DRY_RUN完了" >> "$RESULTS_FILE"
    elif [ "$IS_VIDEO" = true ]; then
      node "$SCRIPT_DIR/post-to-facebook-video.cjs" "$MEDIA_PATH" "${CAPTIONS[facebook]}" >> "$RESULTS_FILE" 2>&1 \
        && echo "✅ Facebook: 投稿成功" >> "$RESULTS_FILE" \
        || echo "❌ Facebook: 投稿失敗" >> "$RESULTS_FILE"
    else
      node "$SCRIPT_DIR/post-to-facebook-v2-anti-ban.cjs" "$MEDIA_PATH" "${CAPTIONS[facebook]}" >> "$RESULTS_FILE" 2>&1 \
        && echo "✅ Facebook: 投稿成功" >> "$RESULTS_FILE" \
        || echo "❌ Facebook: 投稿失敗" >> "$RESULTS_FILE"
    fi
  else
    echo "⚠️  Facebook: キャプション生成失敗" >> "$RESULTS_FILE"
  fi
) &

# Threads
(
  if [ -n "${CAPTIONS[threads]}" ]; then
    if [ "$DRY_RUN" = "true" ]; then
      echo "🔄 DRY_RUN: Threads投稿スキップ" >> "$RESULTS_FILE"
      echo "📝 キャプション: ${CAPTIONS[threads]}" >> "$RESULTS_FILE"
      echo "✅ Threads: DRY_RUN完了" >> "$RESULTS_FILE"
    else
      node "$SCRIPT_DIR/post-to-threads-v3-with-screenshots.cjs" "$MEDIA_PATH" "${CAPTIONS[threads]}" >> "$RESULTS_FILE" 2>&1 \
        && echo "✅ Threads: 投稿成功" >> "$RESULTS_FILE" \
        || echo "❌ Threads: 投稿失敗" >> "$RESULTS_FILE"
    fi
  else
    echo "⚠️  Threads: キャプション生成失敗" >> "$RESULTS_FILE"
  fi
) &

# X
(
  if [ -n "${CAPTIONS[x]}" ]; then
    if [ "$DRY_RUN" = "true" ]; then
      echo "🔄 DRY_RUN: X投稿スキップ" >> "$RESULTS_FILE"
      echo "📝 キャプション: ${CAPTIONS[x]}" >> "$RESULTS_FILE"
      echo "✅ X: DRY_RUN完了" >> "$RESULTS_FILE"
    else
      node "$SCRIPT_DIR/post-to-x-v3-with-screenshots.cjs" "$MEDIA_PATH" "${CAPTIONS[x]}" >> "$RESULTS_FILE" 2>&1 \
        && echo "✅ X: 投稿成功" >> "$RESULTS_FILE" \
        || echo "❌ X: 投稿失敗" >> "$RESULTS_FILE"
    fi
  else
    echo "⚠️  X: キャプション生成失敗" >> "$RESULTS_FILE"
  fi
) &

# Pinterest（動画はスキップ）
if [ "$IS_VIDEO" = false ]; then
  (
    if [ -n "${CAPTIONS[pinterest]}" ]; then
      if [ "$DRY_RUN" = "true" ]; then
        echo "🔄 DRY_RUN: Pinterest投稿スキップ" >> "$RESULTS_FILE"
        echo "📝 キャプション: ${CAPTIONS[pinterest]}" >> "$RESULTS_FILE"
        echo "✅ Pinterest: DRY_RUN完了" >> "$RESULTS_FILE"
      else
        node "$SCRIPT_DIR/post-to-pinterest-v2-anti-ban.cjs" "$MEDIA_PATH" "${CAPTIONS[pinterest]}" >> "$RESULTS_FILE" 2>&1 \
          && echo "✅ Pinterest: 投稿成功" >> "$RESULTS_FILE" \
          || echo "❌ Pinterest: 投稿失敗" >> "$RESULTS_FILE"
      fi
    else
      echo "⚠️  Pinterest: キャプション生成失敗" >> "$RESULTS_FILE"
    fi
  ) &
fi

# 全てのバックグラウンドジョブ完了を待機
wait

echo "✅ 全SNS投稿完了"

# 結果を集計
RESULTS=$(cat "$RESULTS_FILE")
SUCCESS_COUNT=$(echo "$RESULTS" | grep -c "✅.*投稿成功" || true)
FAIL_COUNT=$(echo "$RESULTS" | grep -c "❌.*投稿失敗" || true)
SKIP_COUNT=$(echo "$RESULTS" | grep -c "⚠️" || true)

# Discord通知（#sns-投稿チャンネルに結果投稿）
REPORT="📊 **自動SNS投稿結果**

📎 メディア: \`$(basename "$MEDIA_PATH")\`
📈 成功: **${SUCCESS_COUNT}件** | 失敗: ${FAIL_COUNT}件 | スキップ: ${SKIP_COUNT}件

$RESULTS"

# Discordに投稿（message tool経由）
echo "$REPORT" > "$TEMP_DIR/discord-report.txt"
clawdbot message send \
  --channel discord \
  --target "channel:$DISCORD_CHANNEL_ID" \
  --message "$(cat "$TEMP_DIR/discord-report.txt")" \
  2>/dev/null || echo "⚠️  Discord通知失敗"

echo "✅ 完了"
