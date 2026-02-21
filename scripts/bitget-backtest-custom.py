#!/usr/bin/env python3
"""
Bitgetカスタムバックテスト
- パラメータを簡単に変更可能
- コマンドライン引数対応
"""

import sys
import json
import requests
import pandas as pd
import pandas_ta as ta
from datetime import datetime
from typing import Dict, List, Optional

class CustomBacktest:
    """カスタムバックテスター"""
    
    def __init__(self, **params):
        self.base_url = "https://api.bitget.com"
        self.initial_capital = params.get('initial_capital', 10000.0)
        self.timeframe = params.get('timeframe', '5m')
        
        # 戦略パラメータ（デフォルト値）
        self.sma_period = params.get('sma_period', 200)
        self.ema_period = params.get('ema_period', 200)
        self.proximity_pct = params.get('proximity_pct', 2.0)
        self.stop_loss_pct = params.get('stop_loss_pct', 5.0)
        self.take_profit_pct = params.get('take_profit_pct', 10.0)
        self.position_size_pct = params.get('position_size_pct', 10.0)
        self.volume_multiplier = params.get('volume_multiplier', 1.5)
        self.trailing_stop_activation = params.get('trailing_stop_activation', 5.0)
        self.trailing_stop_distance = params.get('trailing_stop_distance', 3.0)
        
        print("=" * 80)
        print("🐥 カスタムバックテスト設定")
        print("=" * 80)
        print(f"初期資金: ${self.initial_capital:,.2f}")
        print(f"時間足: {self.timeframe}")
        print(f"SMA期間: {self.sma_period}")
        print(f"EMA期間: {self.ema_period}")
        print(f"SMA/EMA接近判定: ±{self.proximity_pct}%")
        print(f"ストップロス: -{self.stop_loss_pct}%")
        print(f"テイクプロフィット: +{self.take_profit_pct}%")
        print(f"ポジションサイズ: {self.position_size_pct}%")
        print(f"出来高倍率: {self.volume_multiplier}x")
        print(f"トレイリングストップ発動: +{self.trailing_stop_activation}%")
        print(f"トレイリングストップ距離: {self.trailing_stop_distance}%")
        print("=" * 80)
    
    def load_screener_results(self, min_change: float = 10.0) -> List[Dict]:
        """スクリーニング結果読み込み"""
        try:
            with open("/root/clawd/data/screener-results.json", 'r') as f:
                data = json.load(f)
            
            positive_results = [
                r for r in data['results'] 
                if r.get('total_change', 0) >= min_change
            ]
            
            print(f"\n✅ スクリーニング結果:")
            print(f"   全体: {len(data['results'])} 銘柄")
            print(f"   前日比+{min_change}%以上: {len(positive_results)} 銘柄")
            
            return positive_results
        except FileNotFoundError:
            print("❌ スクリーニング結果が見つかりません")
            return []
    
    def get_klines(self, symbol: str, limit: int = 500) -> Optional[pd.DataFrame]:
        """K線データ取得"""
        try:
            endpoint = "/api/v2/mix/market/candles"
            params = {
                "symbol": symbol,
                "productType": "usdt-futures",
                "granularity": self.timeframe,
                "limit": str(limit)
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
            print(f"  ❌ {symbol} データ取得失敗: {e}")
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
        print(f"\n📊 {symbol} バックテスト開始...")
        
        df = self.get_klines(symbol, limit=500)
        
        if df is None or len(df) < self.sma_period:
            print(f"  ⏭️  スキップ（データ不足）")
            return None
        
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
                
                # 最高値更新
                if high > position['highest_price']:
                    position['highest_price'] = high
                    
                    # トレイリングストップ発動
                    profit_pct = (high - position['entry_price']) / position['entry_price'] * 100
                    if profit_pct >= self.trailing_stop_activation:
                        position['trailing_stop'] = high * (1 - self.trailing_stop_distance / 100)
                        position['trailing_stop_used'] = True
                
                # エグジット判定
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
                            # エントリー
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
        total_pnl_pct = (capital - self.initial_capital) / self.initial_capital * 100
        
        print(f"  ✅ 完了")
        print(f"     トレード数: {len(trades)}")
        print(f"     勝率: {win_rate:.1f}%")
        print(f"     総PnL: ${total_pnl:.2f} ({total_pnl_pct:+.2f}%)")
        
        return {
            'symbol': symbol,
            'trades': trades,
            'trade_count': len(trades),
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'total_pnl_pct': total_pnl_pct,
            'final_capital': capital
        }
    
    def run(self, symbols: List[str] = None, min_change: float = 10.0):
        """バックテスト実行"""
        if symbols is None:
            screener_results = self.load_screener_results(min_change)
            symbols = [r['symbol'] for r in screener_results]
        
        if not symbols:
            print("❌ 銘柄がありません")
            return
        
        print(f"\n🚀 バックテスト開始: {len(symbols)}銘柄")
        
        all_results = []
        
        for symbol in symbols:
            result = self.backtest_symbol(symbol)
            if result:
                all_results.append(result)
        
        # サマリー
        print("\n" + "=" * 80)
        print("📊 バックテスト結果サマリー")
        print("=" * 80)
        
        total_trades = sum(r['trade_count'] for r in all_results)
        total_pnl = sum(r['total_pnl'] for r in all_results)
        
        if total_trades > 0:
            win_trades = sum(len([t for t in r['trades'] if t['pnl'] > 0]) for r in all_results)
            overall_win_rate = win_trades / total_trades * 100
            
            print(f"総トレード数: {total_trades}")
            print(f"総勝率: {overall_win_rate:.1f}%")
            print(f"総PnL: ${total_pnl:.2f}")
            
            # トップ3
            sorted_results = sorted(all_results, key=lambda x: x['total_pnl'], reverse=True)
            print(f"\n🏆 トップ3:")
            for i, r in enumerate(sorted_results[:3], 1):
                print(f"  {i}. {r['symbol']}: ${r['total_pnl']:.2f} ({r['total_pnl_pct']:+.2f}%) - {r['trade_count']}トレード")
        else:
            print("トレード発生なし")
        
        print("=" * 80)
        
        return all_results

if __name__ == "__main__":
    # コマンドライン引数または対話形式
    params = {
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
    
    bt = CustomBacktest(**params)
    bt.run()
