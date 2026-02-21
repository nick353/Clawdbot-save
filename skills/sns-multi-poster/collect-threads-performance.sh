#!/bin/bash
# collect-threads-performance.sh
# Threadsのパフォーマンスデータを収集（camoufox版）
# Usage: bash collect-threads-performance.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATE_STR=$(date '+%Y%m%d')
OUTPUT_DIR="/root/clawd/data/sns-performance"
OUTPUT_FILE="$OUTPUT_DIR/threads_${DATE_STR}.json"
CAMOUFOX_DIR="/root/camoufox-test"
PYTHON_SCRIPT="$CAMOUFOX_DIR/collect_threads_performance.py"

mkdir -p "$OUTPUT_DIR"

echo "🧵 Threadsパフォーマンスデータ収集開始 (camoufox)..."
echo "📅 日付: $DATE_STR"

source "$CAMOUFOX_DIR/bin/activate"

if python3 "$PYTHON_SCRIPT" "$OUTPUT_FILE"; then
  echo "✅ Threadsパフォーマンス収集完了: $OUTPUT_FILE"
  TOTAL=$(python3 -c "import json; d=json.load(open('$OUTPUT_FILE')); print(d.get('totalPosts',0))" 2>/dev/null || echo "?")
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" \
    --message "🧵 Threads パフォーマンス収集完了: ${DATE_STR} / ${TOTAL}件" 2>/dev/null || true
else
  echo "⚠️  Threadsパフォーマンス収集エラー"
fi
