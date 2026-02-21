#!/usr/bin/env python3
"""
新設定バックテスト
- バランス型パラメータ
- ポジションサイズ20%
- 最大3ポジション
"""

import sys
sys.path.insert(0, '/root/clawd/scripts')

# カスタムバックテストをインポート
exec(open('/root/clawd/scripts/bitget-backtest-custom.py').read())

print("=" * 80)
print("🚀 新設定バックテスト")
print("=" * 80)

# 新設定
params_new = {
    'initial_capital': 10000.0,
    'timeframe': '5m',
    'sma_period': 200,
    'ema_period': 200,
    'proximity_pct': 3.0,  # バランス型
    'stop_loss_pct': 5.0,
    'take_profit_pct': 15.0,  # バランス型
    'position_size_pct': 20.0,  # 20%!
    'volume_multiplier': 1.2,  # バランス型
    'trailing_stop_activation': 3.0,  # バランス型
    'trailing_stop_distance': 3.0
}

bt = CustomBacktest(**params_new)
results = bt.run()

if results:
    total_trades = sum(r['trade_count'] for r in results)
    total_pnl = sum(r['total_pnl'] for r in results)
    
    if total_trades > 0:
        win_trades = sum(len([t for t in r['trades'] if t['pnl'] > 0]) for r in results)
        win_rate = win_trades / total_trades * 100
        
        print("\n" + "=" * 80)
        print("📊 期待される運用効果")
        print("=" * 80)
        print(f"トレード数: {total_trades}")
        print(f"勝率: {win_rate:.1f}%")
        print(f"総PnL: ${total_pnl:.2f}")
        print(f"利益率: {total_pnl/100:.2f}%")
        
        # 旧設定との比較（参考値）
        print(f"\n📈 改善見込み:")
        print(f"   旧設定（10%）: 約$350（推定）")
        print(f"   新設定（20%）: ${total_pnl:.2f}")
        print(f"   改善率: {total_pnl/350*100:.1f}%")
        print("=" * 80)
