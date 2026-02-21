#!/bin/bash
# collect-all-performance.sh
# 全SNSのパフォーマンスを収集（順次実行）
# Usage: bash collect-all-performance.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATE_STR=$(date '+%Y%m%d')

echo "🚀 全SNSパフォーマンス収集開始 (${DATE_STR})"
echo "=========================================="

bash "$SCRIPT_DIR/collect-instagram-performance.sh"
echo ""
bash "$SCRIPT_DIR/collect-threads-performance.sh"
echo ""
bash "$SCRIPT_DIR/collect-x-performance.sh"
echo ""
bash "$SCRIPT_DIR/collect-facebook-performance.sh"
echo ""
bash "$SCRIPT_DIR/collect-pinterest-performance.sh"

echo ""
echo "=========================================="
echo "📊 パフォーマンス収集結果サマリー (${DATE_STR})"
echo "=========================================="

RESULTS=""
for PLATFORM in instagram threads x facebook pinterest; do
  FILE="/root/clawd/data/sns-performance/${PLATFORM}_${DATE_STR}.json"
  if [ -f "$FILE" ]; then
    TOTAL=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$FILE','utf8'));console.log(d.totalPosts||d.totalPins||0)}catch(e){console.log(0)}" 2>/dev/null || echo "0")
    AVG=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$FILE','utf8'));console.log(d.avgLikes||d.avgSaves||0)}catch(e){console.log(0)}" 2>/dev/null || echo "0")
    MAX=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$FILE','utf8'));console.log(d.maxLikes||d.maxSaves||0)}catch(e){console.log(0)}" 2>/dev/null || echo "0")
    HAS_ERROR=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$FILE','utf8'));console.log(d.error?'⚠️':'✅')}catch(e){console.log('❌')}" 2>/dev/null || echo "❌")
    echo "  $HAS_ERROR $PLATFORM: ${TOTAL}件 / 平均いいね: ${AVG} / 最高: ${MAX}"
    RESULTS="${RESULTS}\n  $HAS_ERROR $PLATFORM: ${TOTAL}件 / 平均: ${AVG} / 最高: ${MAX}"
  else
    echo "  ❌ $PLATFORM: データなし"
    RESULTS="${RESULTS}\n  ❌ $PLATFORM: データなし"
  fi
done

echo ""
echo "✅ 全SNSパフォーマンス収集完了"

# Discord通知
clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" \
  --message "📈 全SNSパフォーマンス収集完了 (${DATE_STR})
$(echo -e "$RESULTS")

詳細: /root/clawd/data/sns-performance/" 2>/dev/null || true
