#!/bin/bash
# collect-all-buzz.sh
# 全SNSのバズ調査を並列実行
# Usage: bash collect-all-buzz.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATE_STR=$(date '+%Y%m%d')
LOG_DIR="/root/clawd/data/buzz"

mkdir -p "$LOG_DIR"

echo "🚀 全SNSバズ調査開始 (${DATE_STR})"
echo "=========================================="

# 並列実行（各SNSのエラーが他に影響しない）
bash "$SCRIPT_DIR/collect-instagram-buzz.sh" > "$LOG_DIR/instagram_${DATE_STR}.log" 2>&1 &
PID_IG=$!
echo "📸 Instagram バズ調査開始 (PID: $PID_IG)"

bash "$SCRIPT_DIR/collect-threads-buzz.sh" > "$LOG_DIR/threads_${DATE_STR}.log" 2>&1 &
PID_TH=$!
echo "🧵 Threads バズ調査開始 (PID: $PID_TH)"

bash "$SCRIPT_DIR/collect-x-buzz.sh" > "$LOG_DIR/x_${DATE_STR}.log" 2>&1 &
PID_X=$!
echo "🐦 X バズ調査開始 (PID: $PID_X)"

bash "$SCRIPT_DIR/collect-facebook-buzz.sh" > "$LOG_DIR/facebook_${DATE_STR}.log" 2>&1 &
PID_FB=$!
echo "📘 Facebook バズ調査開始 (PID: $PID_FB)"

bash "$SCRIPT_DIR/collect-pinterest-buzz.sh" > "$LOG_DIR/pinterest_${DATE_STR}.log" 2>&1 &
PID_PT=$!
echo "📌 Pinterest バズ調査開始 (PID: $PID_PT)"

echo ""
echo "⏳ 全プロセス完了を待機中..."
wait $PID_IG; IG_STATUS=$?
wait $PID_TH; TH_STATUS=$?
wait $PID_X;  X_STATUS=$?
wait $PID_FB; FB_STATUS=$?
wait $PID_PT; PT_STATUS=$?

echo ""
echo "=========================================="
echo "📊 バズ調査結果サマリー (${DATE_STR})"
echo "=========================================="

RESULTS=""
for PLATFORM in instagram threads x facebook pinterest; do
  FILE="/root/clawd/data/buzz/${PLATFORM}_${DATE_STR}.json"
  if [ -f "$FILE" ]; then
    TOTAL=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$FILE','utf8'));console.log(d.totalPosts||d.totalPins||0)}catch(e){console.log(0)}" 2>/dev/null || echo "0")
    MAX_LIKES=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$FILE','utf8'));console.log(d.maxLikes||d.maxSaves||0)}catch(e){console.log(0)}" 2>/dev/null || echo "0")
    HAS_ERROR=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$FILE','utf8'));console.log(d.error?'⚠️':'✅')}catch(e){console.log('❌')}" 2>/dev/null || echo "❌")
    echo "  $HAS_ERROR $PLATFORM: ${TOTAL}件 / 最高: ${MAX_LIKES}"
    RESULTS="${RESULTS}\n  $HAS_ERROR $PLATFORM: ${TOTAL}件 / 最高: ${MAX_LIKES}"
  else
    echo "  ❌ $PLATFORM: データなし"
    RESULTS="${RESULTS}\n  ❌ $PLATFORM: データなし"
  fi
done

echo ""
echo "✅ 全SNSバズ調査完了"

# Discord通知
clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" \
  --message "📊 全SNSバズ調査完了 (${DATE_STR})
$(echo -e "$RESULTS")

ログ: /root/clawd/data/buzz/" 2>/dev/null || true
