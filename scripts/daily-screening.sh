#!/bin/bash
# 毎日のスクリーニング自動実行 (v2: 出来高 × ボラティリティベース)

echo "🔍 Bitget銘柄スクリーニング開始"
echo "📅 実行日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"
echo ""

# スクリーニング実行 (v2: 出来高 × ボラティリティランキング)
python3 /root/clawd/scripts/bitget-screener-v2.py

# 結果確認
if [ -f "/root/clawd/data/screener-results.json" ]; then
    echo ""
    echo "✅ スクリーニング完了"
    echo ""
    
    # 結果サマリー表示
    echo "📊 スクリーニング結果サマリー:"
    python3 << 'EOF'
import json

with open("/root/clawd/data/screener-results.json", 'r') as f:
    data = json.load(f)

results = data['results']
top_15 = data['top_15']

print(f"  全体: {len(results)} 銘柄")
print(f"  フィルタ後: {len(top_15)} 銘柄（前日比±10%以内）")
print("")

if top_15:
    print("🎯 Top 15 銘柄（スコア順）:")
    for i, r in enumerate(top_15[:5], 1):
        print(f"  {i}. {r['symbol']:10s} Score: {r['score']:10.0f} | Vol: {r['volatility']:.6f}")
EOF
    
    echo ""
    echo "======================================"
    echo "✅ スクリーニング完了"
    echo ""
    
    # 設定ファイルに自動反映
    echo "🔄 トレーダー設定に反映中..."
    python3 /root/clawd/scripts/apply-screening-to-config.py
    
    echo ""
    echo "======================================"
    echo "✅ 全処理完了。トレーダーが新しい銘柄で稼働中です。"
    echo ""
else
    echo "❌ スクリーニング失敗"
    exit 1
fi
