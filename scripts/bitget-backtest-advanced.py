#!/usr/bin/env python3
"""
Bitget高度バックテスト（RSI削除版）
- 出来高急増フィルター（1.5倍に緩和）
- トレイリングストップ
- 複数時間足対応
- 前日比+10%以上の銘柄のみ
"""

import json
import requests
import pandas as pd
import numpy as np
import pandas_ta as ta
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

class AdvancedBacktest:
    """
    高度バックテスター
    """
    
    def __init__(self, timeframe: str = "1H"):
        self.base_url = "https://api.bitget.com"
        self.initial_capital = 10000.0
        self.timeframe = timeframe
        
        # 戦略パラメータ
        self.sma_period = 200
        self.ema_period = 200
        self.proximity_pct = 2.0
        self.stop_loss_pct = 5.0
        self.take_profit_pct = 10.0
        self.position_size_pct = 10.0
        
        # 新規追加パラメータ
        self.volume_multiplier = 1.5  # 平均出来高の1.5倍（緩和）
        self.trailing_stop_activation = 5.0  # +5%で有効化
        self.trailing_stop_distance = 3.0  # トレイリング距離3%
    
    def load_screener_results(self, filename: str = "/root/clawd/data/screener-results.json") -> List[Dict]:
        """
        スクリーニング結果を読み込み（前日比+10%以上のみ）
        """
        with open(filename, 'r') as f:
            data = json.load(f)
        
        # 前日比+10%以上の銘柄のみフィルター
        positive_results = [
            r for r in data['results'] 
            if r.get('total_change', 0) >= 10.0
        ]
        
        print(f"✅ スクリーニング結果読み込み:")
        print(f"   全体: {len(data['results'])} 銘柄")
        print(f"   前日比+10%以上: {len(positive_results)} 銘柄")
        
        return positive_results
    
    def get_klines(self, symbol: str, limit: int = 500) -> Optional[pd.DataFrame]:
        """
        K線データ取得
        """
        try:
            endpoint = "/api/v2/mix/market/candles"
            params = {
                "symbol": symbol,
                "granularity": self.timeframe,
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
        # SMA/EMA
        df['sma200'] = ta.sma(df['close'], length=self.sma_period)
        df['ema200'] = ta.ema(df['close'], length=self.ema_period)
        
        # MACD
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        df['macd'] = macd['MACD_12_26_9']
        df['macd_signal'] = macd['MACDs_12_26_9']
        df['macd_hist'] = macd['MACDh_12_26_9']
        
        # 出来高平均
        df['volume_sma'] = ta.sma(df['volume'], length=20)
        
        return df
    
    # RSIダイバージェンス検出は削除（andoさんの要望）
    
    def check_entry_signal(self, df: pd.DataFrame, index: int) -> Tuple[bool, str]:
        """
        エントリーシグナル判定（改良版）
        
        Returns:
            (エントリー可否, 理由)
        """
        if index < self.sma_period:
            return False, "データ不足"
        
        row = df.iloc[index]
        price = row['close']
        sma = row['sma200']
        ema = row['ema200']
        volume = row['volume']
        volume_sma = row['volume_sma']
        
        # NaNチェック
        if pd.isna(sma) or pd.isna(ema) or pd.isna(volume_sma):
            return False, "指標欠損"
        
        # 1. SMA/EMAへの接近判定
        proximity_sma = abs((price - sma) / sma * 100) <= self.proximity_pct
        proximity_ema = abs((price - ema) / ema * 100) <= self.proximity_pct
        proximity_ok = proximity_sma or proximity_ema
        
        if not proximity_ok:
            return False, "SMA/EMA距離不足"
        
        # 2. 反発確認（価格がSMA/EMAより上）
        bounce_ok = price > sma and price > ema
        
        if not bounce_ok:
            return False, "反発未確認"
        
        # 3. MACD確認
        macd_ok = row['macd'] > row['macd_signal']
        
        if not macd_ok:
            return False, "MACD条件未達"
        
        # 4. 出来高急増フィルター（1.5倍に緩和）
        volume_surge = volume >= volume_sma * self.volume_multiplier
        
        if not volume_surge:
            return False, f"出来高不足 ({volume/volume_sma:.1f}x)"
        
        # 全条件クリア
        return True, "全条件クリア"
    
    def backtest_symbol(self, symbol: str, symbol_data: Dict) -> Dict:
        """
        単一銘柄のバックテスト
        """
        print(f"\n📊 {symbol} ({self.timeframe}) バックテスト中...")
        print(f"   7日間変動: {symbol_data.get('total_change', 0):+.2f}%")
        
        # データ取得
        df = self.get_klines(symbol, limit=500)
        
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
            high = row['high']
            low = row['low']
            timestamp = df.index[i]
            
            # ポジションなし → エントリー判定
            if current_position is None:
                can_enter, reason = self.check_entry_signal(df, i)
                
                if can_enter:
                    # エントリー
                    position_size = capital * (self.position_size_pct / 100.0)
                    quantity = position_size / price
                    
                    current_position = {
                        'entry_time': timestamp,
                        'entry_price': price,
                        'quantity': quantity,
                        'position_size': position_size,
                        'stop_loss': price * (1 - self.stop_loss_pct / 100.0),
                        'take_profit': price * (1 + self.take_profit_pct / 100.0),
                        'trailing_stop': None,
                        'highest_price': price,
                        'entry_reason': reason
                    }
                    
                    print(f"  🟢 エントリー: {timestamp} @ ${price:.6f} ({reason})")
            
            # ポジションあり → エグジット判定
            else:
                # 最高価格更新
                if high > current_position['highest_price']:
                    current_position['highest_price'] = high
                
                # トレイリングストップ更新
                unrealized_pnl_pct = (current_position['highest_price'] - current_position['entry_price']) / current_position['entry_price'] * 100
                
                if unrealized_pnl_pct >= self.trailing_stop_activation:
                    # トレイリングストップ有効化
                    trailing_stop = current_position['highest_price'] * (1 - self.trailing_stop_distance / 100.0)
                    
                    if current_position['trailing_stop'] is None:
                        current_position['trailing_stop'] = trailing_stop
                        print(f"  📈 トレイリングストップ有効化: ${trailing_stop:.6f}")
                    else:
                        # トレイリングストップを引き上げ
                        if trailing_stop > current_position['trailing_stop']:
                            current_position['trailing_stop'] = trailing_stop
                
                # エグジット判定
                exit_reason = None
                exit_price = price
                
                # トレイリングストップ（最優先）
                if current_position['trailing_stop'] is not None and low <= current_position['trailing_stop']:
                    exit_reason = "Trailing Stop"
                    exit_price = current_position['trailing_stop']
                
                # ストップロス
                elif low <= current_position['stop_loss']:
                    exit_reason = "Stop Loss"
                    exit_price = current_position['stop_loss']
                
                # テイクプロフィット
                elif high >= current_position['take_profit']:
                    exit_reason = "Take Profit"
                    exit_price = current_position['take_profit']
                
                # エグジット実行
                if exit_reason:
                    pnl = (exit_price - current_position['entry_price']) * current_position['quantity']
                    pnl_pct = (exit_price - current_position['entry_price']) / current_position['entry_price'] * 100
                    
                    capital += pnl
                    
                    trades.append({
                        'entry_time': str(current_position['entry_time']),
                        'entry_price': current_position['entry_price'],
                        'exit_time': str(timestamp),
                        'exit_price': exit_price,
                        'quantity': current_position['quantity'],
                        'pnl': pnl,
                        'pnl_pct': pnl_pct,
                        'exit_reason': exit_reason,
                        'entry_reason': current_position['entry_reason']
                    })
                    
                    print(f"  🔴 エグジット: {timestamp} @ ${exit_price:.6f} ({exit_reason}) PnL: ${pnl:.2f} ({pnl_pct:+.2f}%)")
                    
                    current_position = None
        
        # 結果集計
        if not trades:
            print(f"  ⚠️  {symbol}: トレードなし")
            return {
                'symbol': symbol,
                'timeframe': self.timeframe,
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
            'timeframe': self.timeframe,
            'trades': len(trades),
            'total_pnl': total_pnl,
            'total_pnl_pct': (capital - self.initial_capital) / self.initial_capital * 100,
            'win_rate': win_rate,
            'win_trades': len(win_trades),
            'loss_trades': len(trades) - len(win_trades),
            'final_capital': capital,
            'avg_pnl': total_pnl / len(trades),
            'best_trade': max(trades, key=lambda x: x['pnl'])['pnl'] if trades else 0,
            'worst_trade': min(trades, key=lambda x: x['pnl'])['pnl'] if trades else 0,
            'trades_detail': trades
        }
        
        print(f"  ✅ {symbol}: {len(trades)} トレード, PnL: ${total_pnl:.2f} ({result['total_pnl_pct']:+.2f}%), 勝率: {win_rate:.1f}%")
        
        return result
    
    def run_backtest(self, symbols_data: List[Dict]) -> List[Dict]:
        """
        複数銘柄のバックテスト実行
        """
        print(f"\n{'='*100}")
        print(f"🚀 高度バックテスト開始")
        print(f"{'='*100}")
        print(f"💰 初期資金: ${self.initial_capital:,.2f}")
        print(f"📊 対象銘柄: {len(symbols_data)} 銘柄（前日比+10%以上のみ）")
        print(f"⏰ 時間足: {self.timeframe}")
        print(f"📈 戦略: SMA/EMA 200反発 + MACD + 出来高(1.5倍) + トレイリングストップ")
        print(f"{'='*100}\n")
        
        results = []
        
        for symbol_data in symbols_data:
            symbol = symbol_data['symbol']
            result = self.backtest_symbol(symbol, symbol_data)
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
        print(f"📊 バックテスト結果サマリー ({self.timeframe})")
        print(f"{'='*100}\n")
        
        # トレードがあった銘柄のみ
        traded = [r for r in results if r['trades'] > 0]
        
        if not traded:
            print(f"⚠️  全銘柄でトレードなし")
            return
        
        # 総合統計
        total_trades = sum(r['trades'] for r in traded)
        total_pnl = sum(r['total_pnl'] for r in traded)
        total_wins = sum(r['win_trades'] for r in traded)
        total_losses = sum(r['loss_trades'] for r in traded)
        overall_win_rate = total_wins / (total_wins + total_losses) * 100 if (total_wins + total_losses) > 0 else 0
        
        print(f"🏆 総合成績")
        print(f"   トレード銘柄数: {len(traded)}/{len(results)}")
        print(f"   総トレード数: {total_trades}")
        print(f"   総勝敗: {total_wins}勝 {total_losses}敗")
        print(f"   総合勝率: {overall_win_rate:.1f}%")
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
    
    def save_results(self, results: List[Dict], filename: str = None):
        """
        結果保存
        """
        import os
        
        if filename is None:
            filename = f"/root/clawd/data/backtest-advanced-{self.timeframe}.json"
        
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        output = {
            'timestamp': datetime.now().isoformat(),
            'timeframe': self.timeframe,
            'initial_capital': self.initial_capital,
            'count': len(results),
            'results': results
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"💾 結果保存: {filename}")

if __name__ == "__main__":
    import sys
    
    # コマンドライン引数から時間足を取得
    timeframe = sys.argv[1] if len(sys.argv) > 1 else "1H"
    
    backtest = AdvancedBacktest(timeframe=timeframe)
    symbols_data = backtest.load_screener_results()
    results = backtest.run_backtest(symbols_data)
    backtest.print_summary(results)
    backtest.save_results(results)
