#!/usr/bin/env python3
"""
3つの設定を比較するバックテスト
"""

import sys
sys.path.insert(0, '/root/clawd/scripts')

# カスタムバックテストをインポート
exec(open('/root/clawd/scripts/bitget-backtest-custom.py').read())

print("=" * 80)
print("🐥 3つの設定を比較バックテスト")
print("=" * 80)

# 案1: バランス型
print("\n\n" + "=" * 80)
print("📊 案1: バランス型（推奨）")
print("=" * 80)
params1 = {
    'initial_capital': 10000.0,
    'timeframe': '5m',
    'sma_period': 200,
    'ema_period': 200,
    'proximity_pct': 3.0,  # 2% → 3%
    'stop_loss_pct': 5.0,
    'take_profit_pct': 15.0,  # 10% → 15%
    'position_size_pct': 10.0,
    'volume_multiplier': 1.2,  # 1.5x → 1.2x
    'trailing_stop_activation': 3.0,  # 5% → 3%
    'trailing_stop_distance': 3.0
}
bt1 = CustomBacktest(**params1)
results1 = bt1.run()

# 案2: 積極型
print("\n\n" + "=" * 80)
print("📊 案2: 積極型")
print("=" * 80)
params2 = {
    'initial_capital': 10000.0,
    'timeframe': '5m',
    'sma_period': 200,
    'ema_period': 200,
    'proximity_pct': 4.0,  # 2% → 4%
    'stop_loss_pct': 5.0,
    'take_profit_pct': 20.0,  # 10% → 20%
    'position_size_pct': 10.0,
    'volume_multiplier': 1.0,  # 1.5x → 1.0x（条件なし）
    'trailing_stop_activation': 3.0,  # 5% → 3%
    'trailing_stop_distance': 2.0  # 3% → 2%
}
bt2 = CustomBacktest(**params2)
results2 = bt2.run()

# 現在の設定（比較用）
print("\n\n" + "=" * 80)
print("📊 現在の設定（デフォルト）")
print("=" * 80)
params0 = {
    'initial_capital': 10000.0,
    'timeframe': '5m',
    'sma_period': 200,
    'ema_period': 200,
    'proximity_pct': 2.0,
    'stop_loss_pct': 5.0,
    'take_profit_pct': 10.0,
    'position_size_pct': 10.0,
    'volume_multiplier': 1.5,
    'trailing_stop_activation': 5.0,
    'trailing_stop_distance': 3.0
}
bt0 = CustomBacktest(**params0)
results0 = bt0.run()

# 比較サマリー
print("\n\n" + "=" * 80)
print("📊 比較サマリー")
print("=" * 80)

def summarize(results, name):
    if not results:
        return f"{name}: トレードなし"
    
    total_trades = sum(r['trade_count'] for r in results)
    total_pnl = sum(r['total_pnl'] for r in results)
    
    if total_trades > 0:
        win_trades = sum(len([t for t in r['trades'] if t['pnl'] > 0]) for r in results)
        win_rate = win_trades / total_trades * 100
        
        return f"""
{name}:
  トレード数: {total_trades}
  勝率: {win_rate:.1f}%
  総PnL: ${total_pnl:.2f} ({total_pnl / 100:.2f}%)
"""
    else:
        return f"{name}: トレードなし"

print(summarize(results0, "現在の設定"))
print(summarize(results1, "案1: バランス型"))
print(summarize(results2, "案2: 積極型"))

print("\n" + "=" * 80)
print("✅ バックテスト完了")
print("=" * 80)
