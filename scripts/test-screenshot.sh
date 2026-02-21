#!/bin/bash
# チャートスクリーンショットテスト

echo "📸 Bitgetチャートスクリーンショットテスト"
echo "======================================"
echo ""

# スクリーンショットディレクトリ作成
mkdir -p /root/clawd/data/screenshots

# テスト用銘柄
SYMBOL="BTCUSDT"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${TIMESTAMP}_${SYMBOL}.png"
FILEPATH="/root/clawd/data/screenshots/${FILENAME}"

echo "🎯 テスト銘柄: $SYMBOL"
echo "📁 保存先: $FILEPATH"
echo ""

# BitgetチャートURL
CHART_URL="https://www.bitget.com/futures/usdt/${SYMBOL}"

echo "🌐 チャートURL: $CHART_URL"
echo "⏳ スクリーンショット撮影中..."
echo ""

# Clawdbot browserツールでスクリーンショット
clawdbot browser screenshot \
    --url "$CHART_URL" \
    --output "$FILEPATH" \
    --wait 5000 \
    --full-page false

# 結果確認
if [ -f "$FILEPATH" ]; then
    FILESIZE=$(du -h "$FILEPATH" | cut -f1)
    echo ""
    echo "✅ スクリーンショット保存成功！"
    echo "📁 ファイル: $FILEPATH"
    echo "📊 サイズ: $FILESIZE"
    echo ""
    echo "======================================"
    echo "🎉 テスト成功！自動トレーダーで使用できます。"
else
    echo ""
    echo "❌ スクリーンショット保存失敗"
    echo ""
    echo "💡 トラブルシューティング:"
    echo "   1. Clawdbot browserが起動しているか確認"
    echo "   2. インターネット接続確認"
    echo "   3. 権限確認: chmod +x /root/clawd/scripts/*.sh"
fi

echo ""
