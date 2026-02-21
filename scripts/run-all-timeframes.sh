#!/bin/bash
# 全時間足でバックテスト実行

echo "🚀 全時間足バックテスト開始"
echo "======================================"
echo ""

# 時間足リスト
TIMEFRAMES=("5m" "15m" "1H" "4H")

for TF in "${TIMEFRAMES[@]}"; do
    echo "⏰ $TF 実行中..."
    python3 /root/clawd/scripts/bitget-backtest-advanced.py "$TF"
    echo ""
    echo "✅ $TF 完了"
    echo "======================================"
    echo ""
    
    # API負荷軽減（30秒待機）
    if [ "$TF" != "4H" ]; then
        echo "⏳ 30秒待機（API負荷軽減）..."
        sleep 30
    fi
done

echo ""
echo "🎉 全時間足バックテスト完了！"
echo ""
echo "📊 結果ファイル:"
ls -lh /root/clawd/data/backtest-advanced-*.json
echo ""
echo "💡 次は結果比較スクリプトで分析してくださいっぴ！"
