#!/usr/bin/env python3
import ccxt
import json

# Bitget取引所に接続
exchange = ccxt.bitget()

# ポジション情報読み込み
with open('/root/clawd/data/positions.json', 'r') as f:
    data = json.load(f)

positions = data['positions']
capital = data['capital']

print('📊 現在のポジション状況\n')
print(f'💰 現在資金: ${capital:,.2f}\n')

total_unrealized_pnl = 0
total_position_value = 0

for symbol, pos in positions.items():
    # 現在価格取得
    ticker = exchange.fetch_ticker(symbol)
    current_price = ticker['last']
    
    entry_price = pos['entry_price']
    quantity = pos['quantity']
    position_size = pos['position_size']
    
    # 未実現損益計算
    current_value = quantity * current_price
    unrealized_pnl = current_value - position_size
    unrealized_pnl_pct = (unrealized_pnl / position_size) * 100
    
    total_unrealized_pnl += unrealized_pnl
    total_position_value += current_value
    
    # 最高価格からの下落率
    highest_price = pos['highest_price']
    drawdown_pct = ((current_price - highest_price) / highest_price) * 100
    
    print(f'🪙 {symbol}')
    print(f'  📍 エントリー: ${entry_price:.6f} ({pos["entry_time"][:19]})')
    print(f'  💹 現在価格: ${current_price:.6f}')
    print(f'  📈 最高価格: ${highest_price:.6f}')
    print(f'  📉 最高値からの下落: {drawdown_pct:+.2f}%')
    print(f'  💼 数量: {quantity:,.2f}')
    print(f'  💵 投資額: ${position_size:,.2f}')
    print(f'  💵 現在価値: ${current_value:,.2f}')
    emoji = '💚' if unrealized_pnl >= 0 else '❤️'
    print(f'  {emoji} 未実現損益: ${unrealized_pnl:+,.2f} ({unrealized_pnl_pct:+.2f}%)')
    print(f'  🛑 ストップロス: ${pos["stop_loss"]:.6f} (-5.00%)')
    print(f'  🎯 テイクプロフィット: ${pos["take_profit"]:.6f} (+15.00%)')
    if pos['trailing_stop']:
        print(f'  🔄 トレイリングストップ: ${pos["trailing_stop"]:.6f} (発動中)')
    print()

total_invested = sum(p["position_size"] for p in positions.values())
print(f'📊 合計')
print(f'  💼 総投資額: ${total_invested:,.2f}')
print(f'  💵 総現在価値: ${total_position_value:,.2f}')
emoji = '💚' if total_unrealized_pnl >= 0 else '❤️'
print(f'  {emoji} 総未実現損益: ${total_unrealized_pnl:+,.2f} ({(total_unrealized_pnl / total_invested) * 100:+.2f}%)')
print(f'  💰 資金+未実現: ${capital + total_unrealized_pnl:,.2f}')
