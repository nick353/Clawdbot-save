#!/bin/bash
# collect-facebook-buzz.sh
# Facebookでハッシュタグのバズ投稿を収集（camoufox版）
# Usage: bash collect-facebook-buzz.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATE_STR=$(date '+%Y%m%d')
OUTPUT_DIR="/root/clawd/data/buzz"
OUTPUT_FILE="$OUTPUT_DIR/facebook_${DATE_STR}.json"
CAMOUFOX_DIR="/root/camoufox-test"
PYTHON_SCRIPT="$CAMOUFOX_DIR/collect_facebook_buzz.py"

mkdir -p "$OUTPUT_DIR"

echo "📘 Facebookバズ調査開始 (camoufox)..."
echo "📅 日付: $DATE_STR"

source "$CAMOUFOX_DIR/bin/activate"

if python3 "$PYTHON_SCRIPT" "$OUTPUT_FILE"; then
  echo "✅ Facebookバズ調査完了: $OUTPUT_FILE"
  TOTAL=$(python3 -c "import json; d=json.load(open('$OUTPUT_FILE')); print(d.get('totalPosts',0))" 2>/dev/null || echo "?")
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" \
    --message "📘 Facebook バズ調査完了: ${DATE_STR} / ${TOTAL}件取得" 2>/dev/null || true
else
  echo "⚠️  Facebookバズ調査エラー"
  python3 -c "
import json
from pathlib import Path
Path('$OUTPUT_FILE').parent.mkdir(parents=True, exist_ok=True)
Path('$OUTPUT_FILE').write_text(json.dumps({'collectedAt': '$(date -u +%Y-%m-%dT%H:%M:%SZ)', 'platform': 'facebook', 'error': 'camoufox failed', 'posts': [], 'totalPosts': 0, 'maxLikes': 0}, indent=2))
" 2>/dev/null || true
fi
