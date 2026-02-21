#!/bin/bash
# test-anti-ban.sh - BAN対策版のDRY RUNテスト
# 使い方: bash test-anti-ban.sh

set -e

echo "🧪 BAN対策版テスト開始..."
echo ""

# テスト用ダミー画像作成
TEST_IMAGE="/tmp/test-anti-ban.jpg"

echo "📷 テスト用ダミー画像作成中..."
python3 << PYEOF
from PIL import Image, ImageDraw, ImageFont
import datetime

img = Image.new('RGB', (1080, 1080), color='skyblue')
draw = ImageDraw.Draw(img)

text = f"BAN対策テスト\n{datetime.datetime.now().strftime('%H:%M:%S')}"
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
except:
    font = ImageFont.load_default()

bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
x = (1080 - text_width) // 2
y = (1080 - text_height) // 2

draw.text((x, y), text, fill='white', font=font)

img.save('$TEST_IMAGE')
PYEOF
echo "✅ テスト画像作成完了: $TEST_IMAGE"

# テストキャプション
CAPTION="BAN対策テスト $(date +%Y%m%d_%H%M%S) #test #automation 🛡️"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 全SNS一括テスト（DRY RUN）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DRY_RUN=true bash post-to-all-sns-v2-anti-ban.sh "$TEST_IMAGE" "$CAPTION" Animal

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ テスト完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 レート制限ログ確認:"
cat /root/clawd/data/sns-posts/rate-limit-log.json 2>/dev/null || echo "   （まだログなし）"
echo ""
echo "💡 次のステップ:"
echo "   1. DRY_RUN=false で実際の投稿テスト"
echo "   2. 2週間様子見（BANされないか確認）"
echo "   3. 必要ならLevel 4（有料プロキシ）導入"
