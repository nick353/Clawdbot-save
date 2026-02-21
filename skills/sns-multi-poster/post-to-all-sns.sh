#!/bin/bash
# post-to-all-sns.sh (v4.0 - 動画対応版)
# 使い方: bash post-to-all-sns.sh <image_or_video_path> <caption> [pinterest_board]
# 📷 画像 → 5つのSNS（Instagram, Threads, X, Facebook, Pinterest）
# 🎥 動画 → 4つのSNS（Instagram Reels, Threads, X, Facebook）※Pinterest除外
#
# DRY_RUN=true で実際には投稿せずテスト実行
# 例: DRY_RUN=true bash post-to-all-sns.sh /tmp/test.mp4 "テスト動画" Animal

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATA_DIR="/root/clawd/data/sns-posts"
RETRY_WAIT=1800  # 30分（秒）
PLATFORM_TIMEOUT=180  # 各プラットフォーム最大180秒（動画対応で延長）

# DRY_RUN環境変数
export DRY_RUN="${DRY_RUN:-false}"

# ディレクトリ確認・作成
mkdir -p "$DATA_DIR"

# 引数チェック
if [ $# -lt 2 ]; then
  echo "使い方: bash post-to-all-sns.sh <image_or_video_path> <caption> [pinterest_board]"
  echo "例: bash post-to-all-sns.sh /root/Pictures/ukiyoe.jpg 'キャプション' Animal"
  echo "例: bash post-to-all-sns.sh /root/Videos/demo.mp4 '動画テスト 🎥' Animal"
  echo ""
  echo "対応形式:"
  echo "  📷 画像: .jpg, .png, .jpeg, .gif, .webp, .bmp"
  echo "  🎥 動画: .mp4, .mov, .avi, .mkv, .webm, .m4v"
  echo ""
  echo "環境変数:"
  echo "  DRY_RUN=true  - 実際には投稿しないテストモード"
  exit 1
fi

MEDIA_FILE="$1"
CAPTION="$2"
BOARD="${3:-Animal}"

if [ ! -f "$MEDIA_FILE" ]; then
  echo "❌ ファイルが見つかりません: $MEDIA_FILE"
  exit 1
fi

# ─── ファイルタイプ判定 ───
FILE_EXT="${MEDIA_FILE##*.}"
FILE_EXT_LOWER=$(echo "$FILE_EXT" | tr '[:upper:]' '[:lower:]')

IS_VIDEO=false
MEDIA_TYPE="image"
MEDIA_EMOJI="📷"

case "$FILE_EXT_LOWER" in
  mp4|mov|avi|mkv|webm|m4v)
    IS_VIDEO=true
    MEDIA_TYPE="video"
    MEDIA_EMOJI="🎥"
    echo "🎥 動画ファイル検出: $MEDIA_FILE"
    ;;
  jpg|jpeg|png|gif|webp|bmp)
    echo "📷 画像ファイル検出: $MEDIA_FILE"
    ;;
  *)
    echo "❌ 未対応のファイル形式: .$FILE_EXT"
    echo "対応形式: .jpg, .png, .gif, .webp, .bmp (画像), .mp4, .mov, .avi, .mkv, .webm (動画)"
    exit 1
    ;;
esac

# 動画の場合はPinterest除外
if [ "$IS_VIDEO" = true ]; then
  echo "📌 Pinterest: 動画非対応のためスキップ"
  PLATFORMS="instagram threads x facebook"
  TOTAL_PLATFORMS=4
else
  PLATFORMS="instagram threads x facebook pinterest"
  TOTAL_PLATFORMS=5
fi

# 投稿ID生成
DATE_STR=$(date '+%Y-%m-%d')
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
POST_COUNT=$(ls "$DATA_DIR"/${DATE_STR}_*.json 2>/dev/null | wc -l | tr -d ' \n' || echo "0")
POST_NUM=$(printf "%03d" $(( 10#${POST_COUNT:-0} + 1 )))
POST_ID="${DATE_STR}_${POST_NUM}"
RECORD_FILE="$DATA_DIR/${POST_ID}.json"

DRY_RUN_LABEL=""
[ "$DRY_RUN" = "true" ] && DRY_RUN_LABEL=" [DRY RUN]"

echo "========================================="
echo "🚀 SNS一括投稿開始${DRY_RUN_LABEL}: $POST_ID"
echo "$MEDIA_EMOJI メディア: $MEDIA_FILE (type: $MEDIA_TYPE)"
echo "📝 キャプション: ${CAPTION:0:80}..."
if [ "$IS_VIDEO" = false ]; then
  echo "📌 Pinterestボード: $BOARD"
fi
echo "🎯 投稿先: $TOTAL_PLATFORMS プラットフォーム ($PLATFORMS)"
[ "$DRY_RUN" = "true" ] && echo "🔄 DRY RUN モード: 実際には投稿しません"
echo "========================================="

# ハッシュタグ抽出
HASHTAGS=$(echo "$CAPTION" | grep -o '#[a-zA-Z0-9_ぁ-んァ-ン一-龥]*' | tr '\n' ',' | sed 's/,$//' || echo "")

# 結果追跡変数
IG_STATUS="pending"
IG_POST_ID=""
IG_URL=""
TH_STATUS="pending"
X_STATUS="pending"
FB_STATUS="pending"
PIN_STATUS="pending"

# Discord開始通知
timeout 15 clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "🚀 **SNS一括投稿開始**${DRY_RUN_LABEL} | \`$POST_ID\`
$MEDIA_EMOJI \`$(basename "$MEDIA_FILE")\` (\`$MEDIA_TYPE\`)
📝 ${CAPTION:0:100}
🎯 投稿先: $TOTAL_PLATFORMS プラットフォーム" 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📸 [1/$TOTAL_PLATFORMS] Instagram 投稿中..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Instagram投稿（画像 or 動画）
cd "$SCRIPT_DIR"
IG_FAIL=false

if [ "$IS_VIDEO" = true ]; then
  echo "🎥 Instagram Reels 投稿モード"
  IG_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-instagram-reels.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || IG_FAIL=true
else
  echo "📷 Instagram 画像投稿モード"
  IG_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-instagram-v5.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || IG_FAIL=true
fi

if [ "$IG_FAIL" = "true" ]; then
  echo "❌ Instagram投稿失敗"
  IG_STATUS="failed"
  IG_ERROR=$(echo "$IG_OUTPUT" | tail -5)
  echo "$IG_OUTPUT" | tail -10
else
  IG_STATUS="success"
  if [ "$DRY_RUN" = "true" ]; then
    IG_STATUS="dry_run"
    echo "✅ Instagram: DRY RUN完了"
  else
    echo "✅ Instagram投稿成功"
  fi
  echo "$IG_OUTPUT" | tail -5
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧵 [2/$TOTAL_PLATFORMS] Threads 投稿中..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
TH_FAIL=false

if [ "$IS_VIDEO" = true ]; then
  echo "🎥 Threads 動画投稿モード"
  TH_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-threads-video.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || TH_FAIL=true
else
  echo "📷 Threads 画像投稿モード"
  TH_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-threads.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || TH_FAIL=true
fi

if [ "$TH_FAIL" = "true" ]; then
  echo "❌ Threads投稿失敗"
  TH_STATUS="failed"
  TH_ERROR=$(echo "$TH_OUTPUT" | tail -5)
  echo "$TH_OUTPUT" | tail -10
else
  TH_STATUS="success"
  if [ "$DRY_RUN" = "true" ]; then
    TH_STATUS="dry_run"
    echo "✅ Threads: DRY RUN完了"
  else
    echo "✅ Threads投稿成功"
  fi
  echo "$TH_OUTPUT" | tail -5
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐦 [3/$TOTAL_PLATFORMS] X (Twitter) 投稿中..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
X_FAIL=false

# bird CLIは画像・動画どちらも対応（優先使用）
if command -v bird >/dev/null 2>&1 && [ -n "${AUTH_TOKEN:-}" ]; then
  if [ "$DRY_RUN" = "true" ]; then
    echo "🔄 DRY RUN: X投稿スキップ (bird CLI利用可能)"
    X_STATUS="dry_run"
    X_OUTPUT="DRY RUN skip"
  else
    echo "$MEDIA_EMOJI X投稿 (bird CLI)"
    X_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" bird tweet "$CAPTION" --media "$MEDIA_FILE" 2>&1) || X_FAIL=true
  fi
else
  echo "$MEDIA_EMOJI X投稿 (post-to-x.cjs)"
  X_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-x.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || X_FAIL=true
fi

if [ "$X_FAIL" = "true" ]; then
  echo "❌ X投稿失敗"
  X_STATUS="failed"
  X_ERROR=$(echo "$X_OUTPUT" | tail -5)
  echo "$X_OUTPUT" | tail -10
elif [ "$X_STATUS" != "dry_run" ]; then
  X_STATUS="success"
  if [ "$DRY_RUN" = "true" ]; then
    X_STATUS="dry_run"
    echo "✅ X: DRY RUN完了"
  else
    echo "✅ X投稿成功"
  fi
  echo "$X_OUTPUT" | tail -5
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📘 [4/$TOTAL_PLATFORMS] Facebook 投稿中..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
FB_FAIL=false

if [ "$IS_VIDEO" = true ]; then
  echo "🎥 Facebook 動画投稿モード"
  FB_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-facebook-video.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || FB_FAIL=true
else
  echo "📷 Facebook 画像投稿モード"
  FB_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-facebook.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || FB_FAIL=true
fi

if [ "$FB_FAIL" = "true" ]; then
  echo "❌ Facebook投稿失敗"
  FB_STATUS="failed"
  FB_ERROR=$(echo "$FB_OUTPUT" | tail -5)
  echo "$FB_OUTPUT" | tail -10
else
  FB_STATUS="success"
  if [ "$DRY_RUN" = "true" ]; then
    FB_STATUS="dry_run"
    echo "✅ Facebook: DRY RUN完了"
  else
    echo "✅ Facebook投稿成功"
  fi
  echo "$FB_OUTPUT" | tail -5
fi

# Pinterest（動画の場合はスキップ）
if [ "$IS_VIDEO" = false ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📌 [5/$TOTAL_PLATFORMS] Pinterest 投稿中..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  cd "$SCRIPT_DIR"
  PIN_FAIL=false
  PIN_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-pinterest.cjs "$MEDIA_FILE" "$CAPTION" "$BOARD" 2>&1) || PIN_FAIL=true

  if [ "$PIN_FAIL" = "true" ]; then
    echo "❌ Pinterest投稿失敗"
    PIN_STATUS="failed"
    PIN_ERROR=$(echo "$PIN_OUTPUT" | tail -5)
    echo "$PIN_OUTPUT" | tail -10
  else
    PIN_STATUS="success"
    if [ "$DRY_RUN" = "true" ]; then
      PIN_STATUS="dry_run"
      echo "✅ Pinterest: DRY RUN完了"
    else
      echo "✅ Pinterest投稿成功"
    fi
    echo "$PIN_OUTPUT" | tail -5
  fi
else
  # 動画の場合はPinterestスキップ
  PIN_STATUS="skipped"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📌 Pinterest: 動画非対応のためスキップ"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "========================================="
echo "📊 投稿結果サマリー${DRY_RUN_LABEL}"
echo "========================================="
echo "📸 Instagram:   $IG_STATUS"
echo "🧵 Threads:     $TH_STATUS"
echo "🐦 X (Twitter): $X_STATUS"
echo "📘 Facebook:    $FB_STATUS"
echo "📌 Pinterest:   $PIN_STATUS"
echo "========================================="

# 成功数カウント（success + dry_run両方）
SUCCESS_COUNT=0
is_ok() { [ "$1" = "success" ] || [ "$1" = "dry_run" ] || [ "$1" = "skipped" ]; }
is_ok "$IG_STATUS"  && SUCCESS_COUNT=$((SUCCESS_COUNT+1))
is_ok "$TH_STATUS"  && SUCCESS_COUNT=$((SUCCESS_COUNT+1))
is_ok "$X_STATUS"   && SUCCESS_COUNT=$((SUCCESS_COUNT+1))
is_ok "$FB_STATUS"  && SUCCESS_COUNT=$((SUCCESS_COUNT+1))
is_ok "$PIN_STATUS" && SUCCESS_COUNT=$((SUCCESS_COUNT+1))

# JSONレコード保存
cat > "$RECORD_FILE" << EOF
{
  "post_id": "$POST_ID",
  "timestamp": "$TIMESTAMP",
  "media_path": "$MEDIA_FILE",
  "media_type": "$MEDIA_TYPE",
  "is_video": $IS_VIDEO,
  "dry_run": $DRY_RUN,
  "caption": $(echo "$CAPTION" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().rstrip()))"),
  "hashtags": [$(echo "$HASHTAGS" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/' | sed 's/""//' )],
  "platforms": {
    "instagram": {"status": "$IG_STATUS", "post_id": "$IG_POST_ID", "url": "$IG_URL"},
    "threads": {"status": "$TH_STATUS"},
    "x": {"status": "$X_STATUS"},
    "facebook": {"status": "$FB_STATUS"},
    "pinterest": {"status": "$PIN_STATUS", "board": "$BOARD"}
  }
}
EOF

echo "💾 投稿記録保存: $RECORD_FILE"

# ステータス絵文字変換
status_emoji() {
  case "$1" in
    success) echo "✅" ;;
    dry_run) echo "🔄" ;;
    failed)  echo "❌" ;;
    *)       echo "⏳" ;;
  esac
}

IG_EMOJI=$(status_emoji "$IG_STATUS")
TH_EMOJI=$(status_emoji "$TH_STATUS")
X_EMOJI=$(status_emoji "$X_STATUS")
FB_EMOJI=$(status_emoji "$FB_STATUS")
PIN_EMOJI=$(status_emoji "$PIN_STATUS")

# Discord結果通知
if [ "$IS_VIDEO" = true ]; then
  PINTEREST_LINE=""
else
  PINTEREST_LINE="${PIN_EMOJI} Pinterest: **$PIN_STATUS**"
fi

timeout 15 clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "$(cat << DISCORDEOF
📊 **SNS投稿結果**${DRY_RUN_LABEL} | \`$POST_ID\` | $SUCCESS_COUNT/$TOTAL_PLATFORMS 成功

${IG_EMOJI} Instagram: **$IG_STATUS**
${TH_EMOJI} Threads: **$TH_STATUS**
${X_EMOJI} X (Twitter): **$X_STATUS**
${FB_EMOJI} Facebook: **$FB_STATUS**
${PINTEREST_LINE}

$MEDIA_EMOJI \`$(basename "$MEDIA_FILE")\` (\`$MEDIA_TYPE\`)
💾 記録: \`$RECORD_FILE\`
DISCORDEOF
)" 2>/dev/null || true

echo ""
echo "📤 Discord通知送信完了"

# 全失敗チェック（DRY_RUNは失敗扱いしない）
if [ "$SUCCESS_COUNT" -eq 0 ]; then
  echo "⚠️ 全SNSへの投稿が失敗しました。ネットワーク接続を確認してください。"
  exit 1
fi

echo "✅ 投稿処理完了 ($SUCCESS_COUNT/$TOTAL_PLATFORMS 成功)"
