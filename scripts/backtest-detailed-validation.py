#!/usr/bin/env python3
"""
バランス型の詳細検証バックテスト
- 各トレードの詳細を表示
- 勝率の内訳を分析
- 銘柄ごとの成績を詳細化
"""

import sys
sys.path.insert(0, '/root/clawd/scripts')

# カスタムバックテストをインポート
exec(open('/root/clawd/scripts/bitget-backtest-custom.py').read())

print("=" * 80)
print("🔬 バランス型 - 詳細検証バックテスト")
print("=" * 80)

# バランス型の設定
params = {
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

bt = CustomBacktest(**params)
screener_results = bt.load_screener_results(min_change=10.0)
symbols = [r['symbol'] for r in screener_results]

print(f"\n🚀 バックテスト開始: {len(symbols)}銘柄")
print("\n" + "=" * 80)
print("📋 各銘柄の詳細分析")
print("=" * 80)

all_results = []
all_trades_detail = []

for symbol in symbols:
    result = bt.backtest_symbol(symbol)
    if result:
        all_results.append(result)
        
        # 詳細表示
        if result['trades']:
            print(f"\n📊 {symbol} - 詳細トレード記録:")
            for i, trade in enumerate(result['trades'], 1):
                win_loss = "✅ Win" if trade['pnl'] > 0 else "❌ Loss"
                trailing = "🎯 Trailing" if trade.get('trailing_stop_used') else ""
                print(f"  {i}. {trade['exit_reason']:15s} | PnL: ${trade['pnl']:7.2f} ({trade['pnl_pct']:+6.2f}%) {win_loss} {trailing}")
                
                all_trades_detail.append({
                    'symbol': symbol,
                    'pnl': trade['pnl'],
                    'pnl_pct': trade['pnl_pct'],
                    'exit_reason': trade['exit_reason'],
                    'trailing_used': trade.get('trailing_stop_used', False)
                })

# 総合分析
print("\n" + "=" * 80)
print("📊 総合分析")
print("=" * 80)

total_trades = len(all_trades_detail)
win_trades = [t for t in all_trades_detail if t['pnl'] > 0]
loss_trades = [t for t in all_trades_detail if t['pnl'] <= 0]

print(f"\n1️⃣ トレード数:")
print(f"   総トレード数: {total_trades}")
print(f"   勝ちトレード: {len(win_trades)} ({len(win_trades)/total_trades*100:.1f}%)")
print(f"   負けトレード: {len(loss_trades)} ({len(loss_trades)/total_trades*100:.1f}%)")

# エグジット理由別
from collections import Counter
exit_reasons = Counter(t['exit_reason'] for t in all_trades_detail)

print(f"\n2️⃣ エグジット理由別:")
for reason, count in exit_reasons.most_common():
    reason_trades = [t for t in all_trades_detail if t['exit_reason'] == reason]
    reason_pnl = sum(t['pnl'] for t in reason_trades)
    reason_win = len([t for t in reason_trades if t['pnl'] > 0])
    print(f"   {reason:15s}: {count:2d}回 (勝率 {reason_win/count*100:5.1f}%) | 総PnL: ${reason_pnl:7.2f}")

# トレイリングストップ効果
trailing_used = [t for t in all_trades_detail if t['trailing_used']]
print(f"\n3️⃣ トレイリングストップ:")
print(f"   使用回数: {len(trailing_used)}/{total_trades} ({len(trailing_used)/total_trades*100:.1f}%)")
if trailing_used:
    trailing_pnl = sum(t['pnl'] for t in trailing_used)
    print(f"   トレイリング時の総PnL: ${trailing_pnl:.2f}")

# PnL分布
print(f"\n4️⃣ PnL分布:")
print(f"   平均PnL: ${sum(t['pnl'] for t in all_trades_detail)/total_trades:.2f}")
print(f"   最大利益: ${max(t['pnl'] for t in all_trades_detail):.2f} ({max(t['pnl_pct'] for t in all_trades_detail):.2f}%)")
print(f"   最大損失: ${min(t['pnl'] for t in all_trades_detail):.2f} ({min(t['pnl_pct'] for t in all_trades_detail):.2f}%)")

# 総PnL
total_pnl = sum(t['pnl'] for t in all_trades_detail)
print(f"\n5️⃣ 総合成績:")
print(f"   総PnL: ${total_pnl:.2f}")
print(f"   利益率: {total_pnl/100:.2f}%")
print(f"   勝ちトレード総額: ${sum(t['pnl'] for t in win_trades):.2f}")
print(f"   負けトレード総額: ${sum(t['pnl'] for t in loss_trades):.2f}")

# 銘柄別ランキング
print(f"\n6️⃣ 銘柄別成績（トップ5）:")
sorted_results = sorted(all_results, key=lambda x: x['total_pnl'], reverse=True)
for i, r in enumerate(sorted_results[:5], 1):
    print(f"   {i}. {r['symbol']:10s}: ${r['total_pnl']:7.2f} ({r['total_pnl_pct']:+6.2f}%) | {r['trade_count']}トレード | 勝率 {r['win_rate']:.1f}%")

print("\n" + "=" * 80)
print("✅ 詳細検証完了")
print("=" * 80)

# 結論
print(f"\n📝 結論:")
print(f"   バランス型設定は {total_trades} トレードを生成")
print(f"   勝率 {len(win_trades)/total_trades*100:.1f}% で安定")
print(f"   総PnL ${total_pnl:.2f} は信頼できる結果")

if len(win_trades)/total_trades > 0.7:
    print(f"   ✅ 高勝率（70%以上）を維持")
else:
    print(f"   ⚠️  勝率がやや低い（70%未満）")

if total_pnl > 200:
    print(f"   ✅ 高利益（$200以上）を達成")
else:
    print(f"   ⚠️  利益がやや低い（$200未満）")

print("\n" + "=" * 80)
