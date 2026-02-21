#!/usr/bin/env python3
"""
Bitgetスクリーニング結果でバックテスト
"""

import json
import requests
import pandas as pd
import numpy as np
import pandas_ta as ta
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class BitgetBacktest:
    """
    Bitgetバックテスター
    """
    
    def __init__(self):
        self.base_url = "https://api.bitget.com"
        self.initial_capital = 10000.0
        
        # 戦略パラメータ
        self.sma_period = 200
        self.ema_period = 200
        self.proximity_pct = 2.0  # SMA/EMAへの接近判定（%）
        self.stop_loss_pct = 5.0
        self.take_profit_pct = 10.0
        self.position_size_pct = 10.0
    
    def load_screener_results(self, filename: str = "/root/clawd/data/screener-results.json") -> List[str]:
        """
        スクリーニング結果を読み込み
        """
        with open(filename, 'r') as f:
            data = json.load(f)
        
        symbols = [r['symbol'] for r in data['results']]
        print(f"✅ スクリーニング結果読み込み: {len(symbols)} 銘柄")
        return symbols
    
    def get_klines(self, symbol: str, interval: str = "5m", limit: int = 2000) -> Optional[pd.DataFrame]:
        """
        K線データ取得
        """
        try:
            endpoint = "/api/v2/mix/market/candles"
            params = {
                "symbol": symbol,
                "granularity": interval,
                "limit": limit,
                "productType": "USDT-FUTURES"
            }
            
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            request_path = endpoint + "?" + query_string
            
            response = requests.get(
                self.base_url + request_path,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                candles = data.get("data", [])
                
                if not candles:
                    return None
                
                df = pd.DataFrame(candles, columns=[
                    'timestamp', 'open', 'high', 'low', 'close', 'volume', 'quote_volume'
                ])
                
                df['timestamp'] = pd.to_datetime(df['timestamp'].astype(int), unit='ms')
                for col in ['open', 'high', 'low', 'close', 'volume']:
                    df[col] = df[col].astype(float)
                
                df = df.sort_values('timestamp')
                df = df.set_index('timestamp')
                
                return df
            else:
                return None
                
        except Exception as e:
            return None
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        テクニカル指標計算
        """
        # SMA 200
        df['sma200'] = ta.sma(df['close'], length=self.sma_period)
        
        # EMA 200
        df['ema200'] = ta.ema(df['close'], length=self.ema_period)
        
        # MACD
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        df['macd'] = macd['MACD_12_26_9']
        df['macd_signal'] = macd['MACDs_12_26_9']
        df['macd_hist'] = macd['MACDh_12_26_9']
        
        return df
    
    def check_entry_signal(self, df: pd.DataFrame, index: int) -> bool:
        """
        エントリーシグナル判定
        """
        if index < self.sma_period:
            return False
        
        row = df.iloc[index]
        price = row['close']
        sma = row['sma200']
        ema = row['ema200']
        
        if pd.isna(sma) or pd.isna(ema):
            return False
        
        # 1. SMA/EMAへの接近判定
        proximity_sma = abs((price - sma) / sma * 100) <= self.proximity_pct
        proximity_ema = abs((price - ema) / ema * 100) <= self.proximity_pct
        proximity_ok = proximity_sma or proximity_ema
        
        # 2. 反発確認（価格がSMA/EMAより上）
        bounce_ok = price > sma and price > ema
        
        # 3. MACD確認（ゴールデンクロス）
        macd_ok = row['macd'] > row['macd_signal']
        
        return proximity_ok and bounce_ok and macd_ok
    
    def backtest_symbol(self, symbol: str) -> Dict:
        """
        単一銘柄のバックテスト
        """
        print(f"\n📊 {symbol} バックテスト中...")
        
        # データ取得（1時間足、最大500本 = 約20日間）
        df = self.get_klines(symbol, interval="1H", limit=500)
        
        if df is None or len(df) < self.sma_period:
            print(f"⚠️  {symbol}: データ不足")
            return None
        
        # 指標計算
        df = self.calculate_indicators(df)
        
        # トレード記録
        trades = []
        current_position = None
        capital = self.initial_capital
        
        # バックテストループ
        for i in range(self.sma_period, len(df)):
            row = df.iloc[i]
            price = row['close']
            timestamp = df.index[i]
            
            # ポジションなし → エントリー判定
            if current_position is None:
                if self.check_entry_signal(df, i):
                    # エントリー
                    position_size = capital * (self.position_size_pct / 100.0)
                    quantity = position_size / price
                    
                    current_position = {
                        'entry_time': timestamp,
                        'entry_price': price,
                        'quantity': quantity,
                        'position_size': position_size,
                        'stop_loss': price * (1 - self.stop_loss_pct / 100.0),
                        'take_profit': price * (1 + self.take_profit_pct / 100.0)
                    }
                    
                    print(f"  🟢 エントリー: {timestamp} @ ${price:.6f}")
            
            # ポジションあり → エグジット判定
            else:
                exit_reason = None
                
                # ストップロス
                if price <= current_position['stop_loss']:
                    exit_reason = "Stop Loss"
                
                # テイクプロフィット
                elif price >= current_position['take_profit']:
                    exit_reason = "Take Profit"
                
                # エグジット実行
                if exit_reason:
                    pnl = (price - current_position['entry_price']) * current_position['quantity']
                    pnl_pct = (price - current_position['entry_price']) / current_position['entry_price'] * 100
                    
                    capital += pnl
                    
                    trades.append({
                        'entry_time': current_position['entry_time'],
                        'entry_price': current_position['entry_price'],
                        'exit_time': timestamp,
                        'exit_price': price,
                        'quantity': current_position['quantity'],
                        'pnl': pnl,
                        'pnl_pct': pnl_pct,
                        'exit_reason': exit_reason
                    })
                    
                    print(f"  🔴 エグジット: {timestamp} @ ${price:.6f} ({exit_reason}) PnL: ${pnl:.2f} ({pnl_pct:+.2f}%)")
                    
                    current_position = None
        
        # 結果集計
        if not trades:
            print(f"  ⚠️  {symbol}: トレードなし")
            return {
                'symbol': symbol,
                'trades': 0,
                'total_pnl': 0.0,
                'win_rate': 0.0,
                'final_capital': self.initial_capital
            }
        
        total_pnl = sum(t['pnl'] for t in trades)
        win_trades = [t for t in trades if t['pnl'] > 0]
        win_rate = len(win_trades) / len(trades) * 100
        
        result = {
            'symbol': symbol,
            'trades': len(trades),
            'total_pnl': total_pnl,
            'total_pnl_pct': (capital - self.initial_capital) / self.initial_capital * 100,
            'win_rate': win_rate,
            'win_trades': len(win_trades),
            'loss_trades': len(trades) - len(win_trades),
            'final_capital': capital,
            'avg_pnl': total_pnl / len(trades),
            'best_trade': max(trades, key=lambda x: x['pnl'])['pnl'] if trades else 0,
            'worst_trade': min(trades, key=lambda x: x['pnl'])['pnl'] if trades else 0
        }
        
        print(f"  ✅ {symbol}: {len(trades)} トレード, PnL: ${total_pnl:.2f} ({result['total_pnl_pct']:+.2f}%), 勝率: {win_rate:.1f}%")
        
        return result
    
    def run_backtest(self, symbols: List[str]) -> List[Dict]:
        """
        複数銘柄のバックテスト実行
        """
        print(f"\n{'='*100}")
        print(f"🚀 Bitgetバックテスト開始")
        print(f"{'='*100}")
        print(f"💰 初期資金: ${self.initial_capital:,.2f}")
        print(f"📊 対象銘柄: {len(symbols)} 銘柄")
        print(f"⏰ 時間足: 1時間足")
        print(f"📈 戦略: SMA/EMA 200反発 + MACD確認")
        print(f"{'='*100}\n")
        
        results = []
        
        for symbol in symbols:
            result = self.backtest_symbol(symbol)
            if result:
                results.append(result)
        
        return results
    
    def print_summary(self, results: List[Dict]):
        """
        サマリー表示
        """
        if not results:
            print(f"\n⚠️  結果なし")
            return
        
        print(f"\n{'='*100}")
        print(f"📊 バックテスト結果サマリー")
        print(f"{'='*100}\n")
        
        # トレードがあった銘柄のみ
        traded = [r for r in results if r['trades'] > 0]
        
        if not traded:
            print(f"⚠️  全銘柄でトレードなし")
            return
        
        # 総合統計
        total_trades = sum(r['trades'] for r in traded)
        total_pnl = sum(r['total_pnl'] for r in traded)
        
        print(f"🏆 総合成績")
        print(f"   トレード銘柄数: {len(traded)}/{len(results)}")
        print(f"   総トレード数: {total_trades}")
        print(f"   総PnL: ${total_pnl:,.2f}\n")
        
        # 銘柄別ランキング
        traded.sort(key=lambda x: x['total_pnl'], reverse=True)
        
        print(f"📈 銘柄別ランキング（PnL順）\n")
        
        for i, r in enumerate(traded[:10], 1):
            print(f"#{i}. **{r['symbol']}**")
            print(f"   トレード数: {r['trades']}")
            print(f"   総PnL: ${r['total_pnl']:,.2f} ({r['total_pnl_pct']:+.2f}%)")
            print(f"   勝率: {r['win_rate']:.1f}% ({r['win_trades']}勝 {r['loss_trades']}敗)")
            print(f"   平均PnL: ${r['avg_pnl']:.2f}")
            print(f"   最大利益: ${r['best_trade']:.2f}")
            print(f"   最大損失: ${r['worst_trade']:.2f}")
            print()
    
    def save_results(self, results: List[Dict], filename: str = "/root/clawd/data/backtest-screened-results.json"):
        """
        結果保存
        """
        import os
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        output = {
            'timestamp': datetime.now().isoformat(),
            'initial_capital': self.initial_capital,
            'count': len(results),
            'results': results
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"💾 結果保存: {filename}")

if __name__ == "__main__":
    backtest = BitgetBacktest()
    symbols = backtest.load_screener_results()
    results = backtest.run_backtest(symbols)
    backtest.print_summary(results)
    backtest.save_results(results)
