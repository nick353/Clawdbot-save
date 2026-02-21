#!/bin/bash
# 毎日のスクリーニング自動実行

echo "🔍 Bitget銘柄スクリーニング開始"
echo "📅 実行日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"
echo ""

# スクリーニング実行
python3 /root/clawd/scripts/bitget-screener.py

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
positive = [r for r in results if r.get('total_change', 0) >= 10.0]

print(f"  全体: {len(results)} 銘柄")
print(f"  前日比+10%以上: {len(positive)} 銘柄")
print("")

if positive:
    print("🎯 トレード対象銘柄:")
    for i, r in enumerate(positive[:5], 1):
        print(f"  {i}. {r['symbol']}: {r['total_change']:+.2f}% (最大変動: {r['max_gain']:+.2f}%)")
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
