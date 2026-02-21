#!/usr/bin/env python3
"""
現在のポジション損益をリアルタイム計算
positions.json（実際のトレーダー管理データ）を正とする
"""

import json
import csv
from datetime import datetime
import requests

def get_current_price(symbol: str) -> float:
    """Bitget APIで現在価格取得"""
    try:
        url = f"https://api.bitget.com/api/v2/spot/market/tickers?symbol={symbol}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('code') == '00000' and data.get('data'):
            return float(data['data'][0]['lastPr'])
        else:
            return 0.0
    except Exception as e:
        print(f"⚠️  {symbol} 価格取得エラー: {e}")
        return 0.0

def calculate_positions():
    """positions.jsonを正として損益計算"""
    
    # positions.jsonを読み込み（実際のトレーダー管理データ）
    try:
        with open('/root/clawd/data/positions.json', 'r') as f:
            pos_data = json.load(f)
    except FileNotFoundError:
        print("⚠️  positions.json が見つかりません")
        pos_data = {'positions': {}, 'capital': 0}
    
    positions = pos_data.get('positions', {})
    cash = pos_data.get('capital', 0)
    
    print(f"🔍 オープンポジション数: {len(positions)}")
    print(f"💵 現金部分: ${cash:,.2f}")
    print()
    
    total_unrealized_pnl = 0.0
    position_details = []
    
    for symbol, pos in positions.items():
        entry_price = pos['entry_price']
        quantity = pos['quantity']
        entry_time = pos['entry_time']
        
        # 現在価格取得
        current_price = get_current_price(symbol)
        
        if current_price == 0.0:
            print(f"⚠️  {symbol} の価格取得に失敗")
            continue
        
        # 損益計算
        entry_value = entry_price * quantity
        current_value = current_price * quantity
        unrealized_pnl = current_value - entry_value
        unrealized_pnl_pct = (unrealized_pnl / entry_value) * 100
        
        position_details.append({
            'symbol': symbol,
            'entry_price': entry_price,
            'current_price': current_price,
            'quantity': quantity,
            'entry_value': entry_value,
            'current_value': current_value,
            'unrealized_pnl': unrealized_pnl,
            'unrealized_pnl_pct': unrealized_pnl_pct,
            'entry_time': entry_time,
        })
        
        total_unrealized_pnl += unrealized_pnl
        
        pnl_sign = "+" if unrealized_pnl >= 0 else ""
        emoji = "🟢" if unrealized_pnl >= 0 else "🔴"
        print(f"{emoji} {symbol}")
        print(f"   エントリー: ${entry_price:.6f}")
        print(f"   現在価格:   ${current_price:.6f}")
        print(f"   数量:       {quantity:,.2f}")
        print(f"   未実現損益: {pnl_sign}${unrealized_pnl:.2f} ({pnl_sign}{unrealized_pnl_pct:.2f}%)")
        print()
    
    # 正しい総資金計算
    # 総資金 = 現金部分（positions.jsonのcapital） + ポジションの現在価値
    total_position_value = sum(p['current_value'] for p in position_details)
    total_entry_value = sum(p['entry_value'] for p in position_details)
    total_capital = cash + total_position_value
    
    # クローズ済みの確定利益を計算
    confirmed_pnl = 0.0
    try:
        with open('/root/clawd/data/trade-log.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['Exit Time'] and row['PnL ($)']:
                    confirmed_pnl += float(row['PnL ($)'])
    except:
        pass
    
    print("=" * 60)
    print(f"💵 現金部分（残り資金）:  ${cash:,.2f}")
    print(f"📦 ポジションの現在価値: ${total_position_value:,.2f}")
    print(f"   （エントリー時:       ${total_entry_value:,.2f}）")
    print(f"📊 未実現損益:           ${total_unrealized_pnl:+,.2f}")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"💰 現在の総資金:         ${total_capital:,.2f}")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"📈 初期資金:             $10,000.00")
    print(f"📈 確定損益（累計）:     ${confirmed_pnl:+,.2f}")
    print(f"📈 トータル損益:         ${total_capital - 10000:+,.2f}")
    print(f"📈 利益率:               {(total_capital - 10000) / 10000 * 100:+.2f}%")
    print("=" * 60)
    
    # JSON保存
    output = {
        'timestamp': datetime.now().isoformat(),
        'cash': cash,
        'total_position_value': total_position_value,
        'total_entry_value': total_entry_value,
        'total_unrealized_pnl': total_unrealized_pnl,
        'total_capital': total_capital,
        'confirmed_pnl': confirmed_pnl,
        'initial_capital': 10000.0,
        'total_pnl': total_capital - 10000,
        'positions': position_details
    }
    
    with open('/root/clawd/data/current-pnl.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print()
    print("✅ /root/clawd/data/current-pnl.json に保存しました")
    
    return output

if __name__ == '__main__':
    calculate_positions()
