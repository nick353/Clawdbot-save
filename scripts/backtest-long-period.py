#!/usr/bin/env python3
"""
バランス型 - 長期間バックテスト
- データ量を増やして母数を確保
- より信頼性の高い結果を取得
"""

import sys
import json
import requests
import pandas as pd
import pandas_ta as ta
from datetime import datetime
from typing import Dict, List, Optional

class LongPeriodBacktest:
    """長期間バックテスター"""
    
    def __init__(self, data_limit: int = 1000):
        self.base_url = "https://api.bitget.com"
        self.initial_capital = 10000.0
        self.timeframe = '5m'
        self.data_limit = data_limit  # データ取得本数
        
        # バランス型パラメータ
        self.sma_period = 200
        self.ema_period = 200
        self.proximity_pct = 3.0
        self.stop_loss_pct = 5.0
        self.take_profit_pct = 15.0
        self.position_size_pct = 10.0
        self.volume_multiplier = 1.2
        self.trailing_stop_activation = 3.0
        self.trailing_stop_distance = 3.0
        
        print("=" * 80)
        print(f"🔬 長期間バックテスト（バランス型）")
        print("=" * 80)
        print(f"データ量: {data_limit}本のローソク足")
        print(f"期間: 約{data_limit * 5 / 60 / 24:.1f}日分")
        print(f"時間足: {self.timeframe}")
        print("=" * 80)
    
    def load_screener_results(self) -> List[Dict]:
        """スクリーニング結果読み込み"""
        try:
            with open("/root/clawd/data/screener-results.json", 'r') as f:
                data = json.load(f)
            
            positive_results = [
                r for r in data['results'] 
                if r.get('total_change', 0) >= 10.0
            ]
            
            print(f"\n✅ スクリーニング結果: {len(positive_results)} 銘柄")
            return positive_results
        except FileNotFoundError:
            return []
    
    def get_klines(self, symbol: str) -> Optional[pd.DataFrame]:
        """K線データ取得（長期間）"""
        try:
            endpoint = "/api/v2/mix/market/candles"
            params = {
                "symbol": symbol,
                "productType": "usdt-futures",
                "granularity": self.timeframe,
                "limit": str(self.data_limit)
            }
            
            response = requests.get(f"{self.base_url}{endpoint}", params=params, timeout=10)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            candles = data.get('data', [])
            
            if not candles:
                return None
            
            df = pd.DataFrame(candles, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume', 'quote_volume'])
            df = df.astype({
                'open': float,
                'high': float,
                'low': float,
                'close': float,
                'volume': float
            })
            
            return df
            
        except Exception as e:
            return None
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """インジケーター計算"""
        df['sma'] = ta.sma(df['close'], length=self.sma_period)
        df['ema'] = ta.ema(df['close'], length=self.ema_period)
        
        macd = ta.macd(df['close'])
        if macd is not None:
            df = pd.concat([df, macd], axis=1)
        
        df['volume_ma'] = ta.sma(df['volume'], length=20)
        
        return df
    
    def backtest_symbol(self, symbol: str) -> Dict:
        """1銘柄のバックテスト"""
        print(f"\n📊 {symbol} バックテスト中...", end=" ", flush=True)
        
        df = self.get_klines(symbol)
        
        if df is None or len(df) < self.sma_period:
            print(f"❌ データ不足")
            return None
        
        print(f"✅ {len(df)}本取得", end=" ", flush=True)
        
        df = self.calculate_indicators(df)
        
        capital = self.initial_capital
        trades = []
        position = None
        
        for i in range(self.sma_period, len(df)):
            row = df.iloc[i]
            
            if position:
                # エグジット判定
                high = row['high']
                low = row['low']
                close = row['close']
                
                if high > position['highest_price']:
                    position['highest_price'] = high
                    
                    profit_pct = (high - position['entry_price']) / position['entry_price'] * 100
                    if profit_pct >= self.trailing_stop_activation:
                        position['trailing_stop'] = high * (1 - self.trailing_stop_distance / 100)
                        position['trailing_stop_used'] = True
                
                exit_reason = None
                exit_price = close
                
                if position.get('trailing_stop') and low <= position['trailing_stop']:
                    exit_reason = "Trailing Stop"
                    exit_price = position['trailing_stop']
                elif low <= position['stop_loss']:
                    exit_reason = "Stop Loss"
                    exit_price = position['stop_loss']
                elif high >= position['take_profit']:
                    exit_reason = "Take Profit"
                    exit_price = position['take_profit']
                
                if exit_reason:
                    pnl = (exit_price - position['entry_price']) * position['quantity']
                    pnl_pct = (exit_price - position['entry_price']) / position['entry_price'] * 100
                    capital += pnl
                    
                    trades.append({
                        'symbol': symbol,
                        'entry_price': position['entry_price'],
                        'exit_price': exit_price,
                        'pnl': pnl,
                        'pnl_pct': pnl_pct,
                        'exit_reason': exit_reason,
                        'trailing_stop_used': position.get('trailing_stop_used', False)
                    })
                    
                    position = None
            
            else:
                # エントリー判定
                if pd.isna(row['sma']) or pd.isna(row['ema']):
                    continue
                
                price = row['close']
                sma = row['sma']
                ema = row['ema']
                
                sma_dist = abs(price - sma) / sma * 100
                ema_dist = abs(price - ema) / ema * 100
                
                if sma_dist > self.proximity_pct and ema_dist > self.proximity_pct:
                    continue
                
                if 'MACD_12_26_9' in df.columns:
                    macd = row['MACD_12_26_9']
                    macd_signal = row['MACDs_12_26_9']
                    
                    if macd > macd_signal:
                        if row['volume'] > row['volume_ma'] * self.volume_multiplier:
                            position_size = capital * (self.position_size_pct / 100)
                            quantity = position_size / price
                            
                            position = {
                                'entry_price': price,
                                'quantity': quantity,
                                'stop_loss': price * (1 - self.stop_loss_pct / 100),
                                'take_profit': price * (1 + self.take_profit_pct / 100),
                                'trailing_stop': None,
                                'trailing_stop_used': False,
                                'highest_price': price
                            }
        
        # 結果
        win_trades = [t for t in trades if t['pnl'] > 0]
        win_rate = len(win_trades) / len(trades) * 100 if trades else 0
        total_pnl = sum(t['pnl'] for t in trades)
        
        print(f"→ {len(trades)}トレード | 勝率{win_rate:.1f}% | PnL ${total_pnl:.2f}")
        
        return {
            'symbol': symbol,
            'trades': trades,
            'trade_count': len(trades),
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'final_capital': capital
        }
    
    def run(self):
        """バックテスト実行"""
        screener_results = self.load_screener_results()
        symbols = [r['symbol'] for r in screener_results]
        
        if not symbols:
            print("❌ 銘柄がありません")
            return
        
        print(f"\n🚀 バックテスト開始: {len(symbols)}銘柄")
        
        all_results = []
        all_trades = []
        
        for symbol in symbols:
            result = self.backtest_symbol(symbol)
            if result and result['trades']:
                all_results.append(result)
                all_trades.extend(result['trades'])
        
        # 総合分析
        print("\n" + "=" * 80)
        print("📊 長期間バックテスト結果")
        print("=" * 80)
        
        total_trades = len(all_trades)
        
        if total_trades == 0:
            print("トレード発生なし")
            return
        
        win_trades = [t for t in all_trades if t['pnl'] > 0]
        loss_trades = [t for t in all_trades if t['pnl'] <= 0]
        total_pnl = sum(t['pnl'] for t in all_trades)
        
        print(f"\n1️⃣ 基本統計:")
        print(f"   データ量: {self.data_limit}本 (約{self.data_limit * 5 / 60 / 24:.1f}日分)")
        print(f"   総トレード数: {total_trades}")
        print(f"   勝ちトレード: {len(win_trades)} ({len(win_trades)/total_trades*100:.1f}%)")
        print(f"   負けトレード: {len(loss_trades)} ({len(loss_trades)/total_trades*100:.1f}%)")
        
        print(f"\n2️⃣ PnL統計:")
        print(f"   総PnL: ${total_pnl:.2f}")
        print(f"   利益率: {total_pnl/100:.2f}%")
        print(f"   平均PnL: ${total_pnl/total_trades:.2f}")
        print(f"   最大利益: ${max(t['pnl'] for t in all_trades):.2f}")
        print(f"   最大損失: ${min(t['pnl'] for t in all_trades):.2f}")
        
        # エグジット理由別
        from collections import Counter
        exit_reasons = Counter(t['exit_reason'] for t in all_trades)
        
        print(f"\n3️⃣ エグジット理由別:")
        for reason, count in exit_reasons.most_common():
            reason_trades = [t for t in all_trades if t['exit_reason'] == reason]
            reason_pnl = sum(t['pnl'] for t in reason_trades)
            reason_win = len([t for t in reason_trades if t['pnl'] > 0])
            print(f"   {reason:15s}: {count:3d}回 (勝率 {reason_win/count*100:5.1f}%) | 総PnL: ${reason_pnl:8.2f}")
        
        # トレイリングストップ
        trailing_used = [t for t in all_trades if t['trailing_stop_used']]
        print(f"\n4️⃣ トレイリングストップ:")
        print(f"   使用回数: {len(trailing_used)}/{total_trades} ({len(trailing_used)/total_trades*100:.1f}%)")
        if trailing_used:
            print(f"   総PnL: ${sum(t['pnl'] for t in trailing_used):.2f}")
        
        # 銘柄別トップ5
        print(f"\n5️⃣ 銘柄別成績（トップ5）:")
        sorted_results = sorted(all_results, key=lambda x: x['total_pnl'], reverse=True)
        for i, r in enumerate(sorted_results[:5], 1):
            print(f"   {i}. {r['symbol']:10s}: ${r['total_pnl']:8.2f} | {r['trade_count']:3d}トレード | 勝率 {r['win_rate']:5.1f}%")
        
        print("\n" + "=" * 80)
        print("✅ 長期間バックテスト完了")
        print("=" * 80)
        
        return all_results

if __name__ == "__main__":
    # データ量を指定（デフォルト: 1000本）
    import sys
    data_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    
    bt = LongPeriodBacktest(data_limit=data_limit)
    bt.run()
