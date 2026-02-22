#!/bin/bash
# 毎日のスクリーニング自動実行 (v3: 全銘柄版)
# Bitgetで取引可能な全銘柄から自動スクリーニング

# スクリーニング実行 (v3-Full: 全銘柄の動的取得)
python3 /root/clawd/scripts/bitget-screener-v3-full.py

# 結果確認
if [ -f "/root/clawd/data/screener-results.json" ]; then
    # 結果サマリー表示
    python3 << 'EOF'
import json

with open("/root/clawd/data/screener-results.json", 'r') as f:
    data = json.load(f)

print("\n✅ スクリーニング完了")
print("")
print("📊 スクリーニング結果:")
print(f"  全銘柄数: {data['total_checked']} 個")
print(f"  フィルタ通過: {data['total_passed']} 個（価格変化 ±5% 以上）")
print(f"  監視対象（Top 15）: {len(data['top_15'])} 個")
print("")

if data['top_15']:
    print("🎯 Top 15 銘柄:")
    for i, r in enumerate(data['top_15'][:5], 1):
        print(f"  {i}. {r['symbol']:10s} | Change: {r['price_change']:+.2f}% | Score: {r['score']:.0f}")
    if len(data['top_15']) > 5:
        print(f"  ... 他 {len(data['top_15']) - 5} 銘柄")
EOF
    
    echo ""
    echo "🔄 トレーダー設定に反映中..."
    python3 /root/clawd/scripts/apply-screening-to-config.py
    
    echo ""
    echo "✅ 全処理完了。トレーダーが新しい銘柄で稼働中です。"
    echo ""
else
    echo "❌ スクリーニング失敗"
    exit 1
fi
