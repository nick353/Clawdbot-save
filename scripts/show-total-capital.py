#!/usr/bin/env python3
"""
トータル資金状況を表示
- 使用可能資金 + ポジション投資額 = トータル資金
- 初期資金からの変化を表示
"""
import json
import requests
import csv

def get_total_capital_status():
    """トータル資金状況を取得"""
    
    # ポジション情報読み込み
    with open('/root/clawd/data/positions.json', 'r') as f:
        data = json.load(f)
    
    positions = data['positions']
    available_capital = data['capital']
    
    # ポジション投資額の合計
    total_position_size = sum(pos['position_size'] for pos in positions.values())
    
    # トータル資金（使用可能 + ポジション投資額）
    total_capital = available_capital + total_position_size
    
    # 未実現損益を計算
    total_unrealized_pnl = 0
    for symbol, pos in positions.items():
        # 現在価格取得
        response = requests.get(f'https://api.bitget.com/api/v2/spot/market/tickers?symbol={symbol}')
        ticker_data = response.json()
        current_price = float(ticker_data['data'][0]['lastPr'])
        
        # 未実現損益
        current_value = pos['quantity'] * current_price
        unrealized_pnl = current_value - pos['position_size']
        total_unrealized_pnl += unrealized_pnl
    
    # 確定損益を計算
    total_realized_pnl = 0
    with open('/root/clawd/data/trade-log.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Win/Loss'] in ['Win', 'Loss']:
                total_realized_pnl += float(row['PnL ($)'])
    
    # 初期資金（設定ファイルから読み込み）
    try:
        with open('/root/clawd/config/bitget-trading.json', 'r') as f:
            config = json.load(f)
            initial_capital = config.get('initial_capital', 10000.0)
    except:
        initial_capital = 10000.0
    
    # 実質総資産（トータル資金 + 未実現損益）
    real_total_assets = total_capital + total_unrealized_pnl
    
    # トータル損益（実質総資産 - 初期資金）
    total_pnl = real_total_assets - initial_capital
    total_pnl_pct = (total_pnl / initial_capital) * 100
    
    return {
        'initial_capital': initial_capital,
        'available_capital': available_capital,
        'position_size': total_position_size,
        'total_capital': total_capital,
        'realized_pnl': total_realized_pnl,
        'unrealized_pnl': total_unrealized_pnl,
        'real_total_assets': real_total_assets,
        'total_pnl': total_pnl,
        'total_pnl_pct': total_pnl_pct,
        'position_count': len(positions)
    }

def print_total_capital_status():
    """トータル資金状況を表示"""
    status = get_total_capital_status()
    
    print('💰 資金状況（トータル）\n')
    print(f'📊 初期資金: ${status["initial_capital"]:,.2f}')
    print(f'💵 現在のトータル資金: ${status["total_capital"]:,.2f}')
    print(f'  ├─ 使用可能資金: ${status["available_capital"]:,.2f}')
    print(f'  └─ ポジション投資額: ${status["position_size"]:,.2f} ({status["position_count"]}件)')
    print()
    print(f'✅ 確定損益: ${status["realized_pnl"]:+,.2f}')
    print(f'📈 未実現損益: ${status["unrealized_pnl"]:+,.2f}')
    print(f'💼 実質総資産: ${status["real_total_assets"]:,.2f}')
    print()
    
    emoji = '💚' if status['total_pnl'] >= 0 else '❤️'
    print(f'{emoji} トータル損益: ${status["total_pnl"]:+,.2f} ({status["total_pnl_pct"]:+.2f}%)')

if __name__ == "__main__":
    print_total_capital_status()
