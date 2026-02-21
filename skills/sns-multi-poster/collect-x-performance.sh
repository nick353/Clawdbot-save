#!/bin/bash
# collect-x-performance.sh
# X (Twitter) の直近投稿のパフォーマンスデータを取得（bird CLI版）
# Usage: bash collect-x-performance.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATE_STR=$(date '+%Y%m%d')
OUTPUT_DIR="/root/clawd/data/sns-performance"
OUTPUT_FILE="$OUTPUT_DIR/x_${DATE_STR}.json"

mkdir -p "$OUTPUT_DIR"

echo "🐦 X (Twitter) パフォーマンスデータ収集開始..."
echo "📅 日付: $DATE_STR"

# source ~/.profile for AUTH_TOKEN, CT0
source ~/.profile 2>/dev/null || true

TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
BIRD_SUCCESS=false
POSTS_JSON="[]"
TOTAL=0

if command -v bird &>/dev/null; then
  echo "🔍 bird CLI で収集中..."

  # from:Nisenprints で検索
  RAW=$(bird search "from:Nisenprints" -n 10 2>&1) || RAW=""

  if echo "$RAW" | grep -q "Nisenprints\|status\|tweet"; then
    BIRD_SUCCESS=true
    echo "✅ bird CLI 成功"
    echo "$RAW" | head -30

    # 簡易パースしてJSON作成
    POSTS_JSON=$(python3 -c "
import sys, json, re

raw = '''$RAW'''
posts = []
lines = raw.split('\n')
url = None
text_lines = []
for line in lines:
    if 'x.com/' in line and '/status/' in line:
        if url and text_lines:
            posts.append({'url': url.strip(), 'text': ' '.join(text_lines).strip()[:200], 'likes': 0, 'reposts': 0})
        url = line.strip().lstrip('🔗 ')
        text_lines = []
    elif line.startswith('📅') or line.startswith('──'):
        if url and text_lines:
            posts.append({'url': url.strip(), 'text': ' '.join(text_lines).strip()[:200], 'likes': 0, 'reposts': 0})
        url = None
        text_lines = []
    elif url is not None and line.strip() and not line.startswith('📅') and not line.startswith('🔗') and not line.startswith('🖼️'):
        text_lines.append(line.strip())

if url and text_lines:
    posts.append({'url': url.strip(), 'text': ' '.join(text_lines).strip()[:200], 'likes': 0, 'reposts': 0})

print(json.dumps(posts[:10], ensure_ascii=False))
" 2>/dev/null || echo "[]")
    TOTAL=$(echo "$POSTS_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  else
    echo "⚠️ bird CLI データなし"
  fi
else
  echo "⚠️ bird CLI が見つかりません"
fi

# 結果保存
python3 -c "
import json, sys
from pathlib import Path

posts_json = '''$POSTS_JSON'''
try:
    posts = json.loads(posts_json)
except:
    posts = []

result = {
    'collectedAt': '$TIMESTAMP',
    'platform': 'x',
    'account': 'Nisenprints',
    'profile_url': 'https://x.com/Nisenprints',
    'totalPosts': len(posts),
    'posts': posts,
    'bird_success': '$BIRD_SUCCESS' == 'true',
}
Path('$OUTPUT_FILE').parent.mkdir(parents=True, exist_ok=True)
Path('$OUTPUT_FILE').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(f'✅ 保存完了: $OUTPUT_FILE')
print(f'📊 合計: {len(posts)}件')
"

if [ "$BIRD_SUCCESS" = "true" ]; then
  echo "✅ X パフォーマンス収集完了"
  clawdbot message send --channel discord --target "$DISCORD_CHANNEL_ID" \
    --message "🐦 X パフォーマンス収集完了: ${DATE_STR} / ${TOTAL}件取得" 2>/dev/null || true
else
  echo "⚠️ X パフォーマンス収集: bird CLIデータなし（認証確認要）"
fi
