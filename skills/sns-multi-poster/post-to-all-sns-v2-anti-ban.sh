#!/bin/bash
# post-to-all-sns-v2-anti-ban.sh - BAN対策完全版
# 全SNSにBAN対策（Level 1 + Level 2）適用
#
# 使い方: bash post-to-all-sns-v2-anti-ban.sh <image_path> <caption> [pinterest_board]
# DRY_RUN=true でテスト実行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATA_DIR="/root/clawd/data/sns-posts"
PLATFORM_TIMEOUT=180

export DRY_RUN="${DRY_RUN:-false}"

mkdir -p "$DATA_DIR"

if [ $# -lt 2 ]; then
  echo "使い方: bash post-to-all-sns-v2-anti-ban.sh <image_path> <caption> [pinterest_board]"
  echo "例: bash post-to-all-sns-v2-anti-ban.sh /path/to/image.jpg 'キャプション' Animal"
  echo ""
  echo "✨ BAN対策機能:"
  echo "  ✅ レート制限（各SNS個別制限）"
  echo "  ✅ 投稿時間制限（7時〜23時のみ）"
  echo "  ✅ ランダム遅延（人間らしい操作）"
  echo "  ✅ 高度Bot検出回避（stealth plugin）"
  exit 1
fi

MEDIA_FILE="$1"
CAPTION="$2"
BOARD="${3:-Animal}"

if [ ! -f "$MEDIA_FILE" ]; then
  echo "❌ ファイルが見つかりません: $MEDIA_FILE"
  exit 1
fi

# ファイルタイプ判定
FILE_EXT="${MEDIA_FILE##*.}"
FILE_EXT_LOWER=$(echo "$FILE_EXT" | tr '[:upper:]' '[:lower:]')

IS_VIDEO=false
MEDIA_TYPE="image"

case "$FILE_EXT_LOWER" in
  mp4|mov|avi|mkv|webm|m4v)
    IS_VIDEO=true
    MEDIA_TYPE="video"
    echo "⚠️ 警告: 動画はBAN対策版未実装（今後対応予定）"
    echo "   旧バージョンのスクリプトを使用します"
    echo ""
    echo "   代替案: 画像投稿をご利用ください"
    exit 1
    ;;
  jpg|jpeg|png|gif|webp|bmp)
    echo "📷 画像ファイル検出: $MEDIA_FILE"
    ;;
  *)
    echo "❌ 未対応のファイル形式: .$FILE_EXT"
    exit 1
    ;;
esac

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
echo "🛡️  SNS一括投稿（BAN対策版）${DRY_RUN_LABEL}"
echo "========================================="
echo "📝 投稿ID: $POST_ID"
echo "📷 メディア: $MEDIA_FILE"
echo "💬 キャプション: ${CAPTION:0:80}..."
echo "📌 Pinterest: $BOARD"
echo "🎯 投稿先: 5 SNS（Instagram, Threads, X, Facebook, Pinterest）"
[ "$DRY_RUN" = "true" ] && echo "🔄 DRY RUN モード: 実際には投稿しません"
echo "========================================="

# Discord開始通知（DRY_RUNモードではスキップ）
if [ "$DRY_RUN" != "true" ]; then
  timeout 15 clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "🛡️  **SNS一括投稿（BAN対策版）開始**${DRY_RUN_LABEL} | \`$POST_ID\`
📷 \`$(basename "$MEDIA_FILE")\`
📝 ${CAPTION:0:100}
🎯 投稿先: 5 SNS（レート制限・時間制限・ランダム遅延適用）" 2>/dev/null || true
fi

# 結果追跡変数
IG_STATUS="pending"
TH_STATUS="pending"
X_STATUS="pending"
FB_STATUS="pending"
PIN_STATUS="pending"

# ━━━━━ Instagram（Playwright Cookie版） ━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📸 [1/5] Instagram 投稿中（Playwright Cookie認証）..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
IG_FAIL=false
IG_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-instagram-playwright.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || IG_FAIL=true

if [ "$IG_FAIL" = "true" ]; then
  echo "❌ Instagram投稿失敗"
  IG_STATUS="failed"
  echo "$IG_OUTPUT" | tail -10
else
  IG_STATUS="success"
  [ "$DRY_RUN" = "true" ] && IG_STATUS="dry_run"
  echo "✅ Instagram投稿成功"
  echo "$IG_OUTPUT" | tail -5
fi

# ━━━━━ Threads（Playwright Cookie版） ━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧵 [2/5] Threads 投稿中（Playwright Cookie認証）..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
TH_FAIL=false
TH_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-threads-playwright.cjs "$CAPTION" "$MEDIA_FILE" 2>&1) || TH_FAIL=true

if [ "$TH_FAIL" = "true" ]; then
  echo "❌ Threads投稿失敗"
  TH_STATUS="failed"
  echo "$TH_OUTPUT" | tail -10
else
  TH_STATUS="success"
  [ "$DRY_RUN" = "true" ] && TH_STATUS="dry_run"
  echo "✅ Threads投稿成功"
  echo "$TH_OUTPUT" | tail -5
fi

# ━━━━━ X (Twitter)（Playwright Cookie版） ━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐦 [3/5] X (Twitter) 投稿中（Playwright Cookie認証）..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
X_FAIL=false
X_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-x-playwright.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || X_FAIL=true

if [ "$X_FAIL" = "true" ]; then
  echo "❌ X投稿失敗"
  X_STATUS="failed"
  echo "$X_OUTPUT" | tail -10
else
  X_STATUS="success"
  [ "$DRY_RUN" = "true" ] && X_STATUS="dry_run"
  echo "✅ X投稿成功"
  echo "$X_OUTPUT" | tail -5
fi

# ━━━━━ Facebook（Playwright Cookie版） ━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📘 [4/5] Facebook 投稿中（Playwright Cookie認証）..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
FB_FAIL=false
FB_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-facebook-playwright.cjs "$CAPTION" "$MEDIA_FILE" 2>&1) || FB_FAIL=true

if [ "$FB_FAIL" = "true" ]; then
  echo "❌ Facebook投稿失敗"
  FB_STATUS="failed"
  echo "$FB_OUTPUT" | tail -10
else
  FB_STATUS="success"
  [ "$DRY_RUN" = "true" ] && FB_STATUS="dry_run"
  echo "✅ Facebook投稿成功"
  echo "$FB_OUTPUT" | tail -5
fi

# ━━━━━ Pinterest（Playwright Cookie版） ━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 [5/5] Pinterest 投稿中（Playwright Cookie認証）..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"
PIN_FAIL=false
PIN_OUTPUT=$(timeout "$PLATFORM_TIMEOUT" node post-to-pinterest-playwright.cjs "$MEDIA_FILE" "$CAPTION" 2>&1) || PIN_FAIL=true

if [ "$PIN_FAIL" = "true" ]; then
  echo "❌ Pinterest投稿失敗"
  PIN_STATUS="failed"
  echo "$PIN_OUTPUT" | tail -10
else
  PIN_STATUS="success"
  [ "$DRY_RUN" = "true" ] && PIN_STATUS="dry_run"
  echo "✅ Pinterest投稿成功"
  echo "$PIN_OUTPUT" | tail -5
fi

# ━━━━━ 結果サマリー ━━━━━
echo ""
echo "========================================="
echo "📊 投稿結果サマリー${DRY_RUN_LABEL}"
echo "========================================="
echo "📸 Instagram:   $IG_STATUS"
echo "🧵 Threads:     $TH_STATUS"
echo "🐦 X:           $X_STATUS"
echo "📘 Facebook:    $FB_STATUS"
echo "📌 Pinterest:   $PIN_STATUS"
echo "========================================="

# 成功数カウント
SUCCESS_COUNT=0
is_ok() { [ "$1" = "success" ] || [ "$1" = "dry_run" ]; }
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
  "anti_ban_version": "playwright-cookie",
  "dry_run": $DRY_RUN,
  "caption": $(echo "$CAPTION" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().rstrip()))"),
  "platforms": {
    "instagram": {"status": "$IG_STATUS"},
    "threads": {"status": "$TH_STATUS"},
    "x": {"status": "$X_STATUS"},
    "facebook": {"status": "$FB_STATUS"},
    "pinterest": {"status": "$PIN_STATUS", "board": "$BOARD"}
  }
}
EOF

echo "💾 投稿記録保存: $RECORD_FILE"

# ステータス絵文字
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

# Discord結果通知（DRY_RUNモードではスキップ）
if [ "$DRY_RUN" != "true" ]; then
  timeout 15 clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" --message "$(cat << DISCORDEOF
📊 **SNS投稿結果（BAN対策版）**${DRY_RUN_LABEL} | \`$POST_ID\` | $SUCCESS_COUNT/5 成功

${IG_EMOJI} Instagram: **$IG_STATUS**
${TH_EMOJI} Threads: **$TH_STATUS**
${X_EMOJI} X: **$X_STATUS**
${FB_EMOJI} Facebook: **$FB_STATUS**
${PIN_EMOJI} Pinterest: **$PIN_STATUS**

📷 \`$(basename "$MEDIA_FILE")\`
🛡️ BAN対策: レート制限・時間制限・ランダム遅延適用
💾 記録: \`$RECORD_FILE\`
DISCORDEOF
)" 2>/dev/null || true
  echo "📤 Discord通知送信完了"
else
  echo "🔄 DRY RUN: Discord通知スキップ"
fi

if [ "$SUCCESS_COUNT" -eq 0 ]; then
  echo "⚠️ 全SNSへの投稿が失敗しました"
  exit 1
fi

echo "✅ 投稿処理完了 ($SUCCESS_COUNT/5 成功)"
