#!/usr/bin/env python3
"""
Bitget自動トレーダー（本番運用版）
- 5分足SMA/EMA 200反発戦略
- トレイリングストップ
- CSV記録（Excel対応）
"""

import os
import sys
import json
import csv
import time
import subprocess
import requests
import pandas as pd
import pandas_ta as ta
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

# 環境変数PYTHONUNBUFFERED=1で実行してください

class BitgetAutoTrader:
    """
    Bitget自動トレーダー
    """
    
    def __init__(self, config_path: str = "/root/clawd/config/bitget-trading.json"):
        # 設定読み込み
        self.config = self.load_config(config_path)
        
        # API設定
        self.base_url = "https://api.bitget.com"
        
        # トレード設定
        self.paper_trade = self.config.get("paper_trade", True)
        self.initial_capital = self.config.get("initial_capital", 10000.0)
        self.capital = self.initial_capital
        
        # 戦略パラメータ
        self.sma_period = 200
        self.ema_period = 200
        self.proximity_pct = 2.0
        self.stop_loss_pct = 5.0
        self.take_profit_pct = 10.0
        self.position_size_pct = 10.0
        self.volume_multiplier = 1.5
        self.trailing_stop_activation = 5.0
        self.trailing_stop_distance = 3.0
        
        # ポジション管理
        self.positions = {}
        
        # トレード記録
        self.trade_log_path = "/root/clawd/data/trade-log.csv"
        self.screenshot_dir = "/root/clawd/data/screenshots"
        self.init_trade_log()
        
        # スクリーンショットディレクトリ作成
        os.makedirs(self.screenshot_dir, exist_ok=True)
        
        print(f"🐥 Bitget自動トレーダー起動")
        print(f"📊 モード: {'ペーパートレード' if self.paper_trade else 'リアルトレード'}")
        print(f"💰 初期資金: ${self.capital:,.2f}")
    
    def load_config(self, config_path: str) -> Dict:
        """設定ファイル読み込み"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"paper_trade": True, "initial_capital": 10000.0}
    
    def init_trade_log(self):
        """トレード記録CSV初期化"""
        os.makedirs(os.path.dirname(self.trade_log_path), exist_ok=True)
        
        if not os.path.exists(self.trade_log_path):
            with open(self.trade_log_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'Entry Time', 'Exit Time', 'Symbol', 
                    'Entry Price', 'Exit Price', 'Quantity',
                    'PnL ($)', 'PnL (%)', 'Win/Loss',
                    'Entry Reason', 'Exit Reason',
                    'Hold Time (min)', 'Trailing Stop Used',
                    'Highest Price', 'Capital After', 'Notes'
                ])
            print(f"✅ トレード記録CSV作成: {self.trade_log_path}")
    
    def take_chart_screenshot(self, symbol: str) -> str:
        """
        チャートスクリーンショット撮影（一時的に無効化）
        
        Returns:
            スクリーンショットファイルパス
        """
        # 一時的に無効化（動作確認後に有効化）
        print(f"  📸 スクリーンショットスキップ（動作確認モード）")
        return ""
        
        # --- 以下、動作確認後に有効化 ---
        # try:
        #     # タイムスタンプ
        #     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        #     filename = f"{timestamp}_{symbol}.png"
        #     filepath = os.path.join(self.screenshot_dir, filename)
        #     
        #     # BitgetチャートURL
        #     chart_url = f"https://www.bitget.com/futures/usdt/{symbol}"
        #     
        #     # Clawdbot browserツールでスクリーンショット撮影
        #     cmd = [
        #         "clawdbot", "browser", "screenshot",
        #         "--url", chart_url,
        #         "--output", filepath,
        #         "--wait", "3000"  # 3秒待機（チャート読み込み）
        #     ]
        #     
        #     result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        #     
        #     if result.returncode == 0 and os.path.exists(filepath):
        #         print(f"  📸 スクリーンショット保存: {filename}")
        #         return filepath
        #     else:
        #         print(f"  ⚠️  スクリーンショット失敗: {result.stderr}")
        #         return ""
        # except Exception as e:
        #     print(f"  ⚠️  スクリーンショットエラー: {e}")
        #     return ""
    
    def log_trade(self, trade: Dict):
        """トレード記録を追加"""
        with open(self.trade_log_path, 'a', newline='') as f:
            writer = csv.writer(f)
            
            entry_time = trade['entry_time']
            exit_time = trade['exit_time']
            hold_time = (datetime.fromisoformat(exit_time) - datetime.fromisoformat(entry_time)).total_seconds() / 60
            
            # 備考欄にスクリーンショットパス追加
            notes = trade.get('notes', '')
            if trade.get('screenshot_path'):
                notes = f"Screenshot: {trade['screenshot_path']}"
                if trade.get('notes'):
                    notes += f" | {trade['notes']}"
            
            writer.writerow([
                entry_time,
                exit_time,
                trade['symbol'],
                trade['entry_price'],
                trade['exit_price'],
                trade['quantity'],
                trade['pnl'],
                trade['pnl_pct'],
                'Win' if trade['pnl'] > 0 else 'Loss',
                trade['entry_reason'],
                trade['exit_reason'],
                f"{hold_time:.0f}",
                'Yes' if trade.get('trailing_stop_used') else 'No',
                trade.get('highest_price', trade['exit_price']),
                trade['capital_after'],
                notes
            ])
        
        print(f"📝 トレード記録保存: {trade['symbol']} PnL: ${trade['pnl']:.2f}")
    
    def get_screened_symbols(self) -> List[str]:
        """スクリーニング済み銘柄を取得"""
        try:
            with open("/root/clawd/data/screener-results.json", 'r') as f:
                data = json.load(f)
            
            # 前日比+10%以上のみ
            positive = [
                r['symbol'] for r in data['results']
                if r.get('total_change', 0) >= 10.0
            ]
            
            return positive
        except FileNotFoundError:
            print(f"⚠️  スクリーニング結果が見つかりません")
            return []
    
    def get_klines(self, symbol: str, interval: str = "5m", limit: int = 250) -> Optional[pd.DataFrame]:
        """K線データ取得"""
        try:
            endpoint = "/api/v2/mix/market/candles"
            params = {
                "symbol": symbol,
                "granularity": interval,
                "limit": str(limit),
                "productType": "usdt-futures"
            }
            
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            request_path = endpoint + "?" + query_string
            
            response = requests.get(self.base_url + request_path, timeout=10)
            
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
        """テクニカル指標計算"""
        df['sma200'] = ta.sma(df['close'], length=self.sma_period)
        df['ema200'] = ta.ema(df['close'], length=self.ema_period)
        
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        df['macd'] = macd['MACD_12_26_9']
        df['macd_signal'] = macd['MACDs_12_26_9']
        
        df['volume_sma'] = ta.sma(df['volume'], length=20)
        
        return df
    
    def check_entry_signal(self, df: pd.DataFrame) -> Tuple[bool, str]:
        """エントリーシグナル判定"""
        if len(df) < self.sma_period:
            return False, "データ不足"
        
        row = df.iloc[-1]
        price = row['close']
        sma = row['sma200']
        ema = row['ema200']
        volume = row['volume']
        volume_sma = row['volume_sma']
        
        if pd.isna(sma) or pd.isna(ema) or pd.isna(volume_sma):
            return False, "指標欠損"
        
        # 1. SMA/EMA接近
        proximity_sma = abs((price - sma) / sma * 100) <= self.proximity_pct
        proximity_ema = abs((price - ema) / ema * 100) <= self.proximity_pct
        
        if not (proximity_sma or proximity_ema):
            return False, "SMA/EMA距離不足"
        
        # 2. 反発確認
        if not (price > sma and price > ema):
            return False, "反発未確認"
        
        # 3. MACD
        if not (row['macd'] > row['macd_signal']):
            return False, "MACD条件未達"
        
        # 4. 出来高
        if not (volume >= volume_sma * self.volume_multiplier):
            return False, f"出来高不足 ({volume/volume_sma:.1f}x)"
        
        return True, "全条件クリア"
    
    def update_position(self, symbol: str, df: pd.DataFrame) -> Optional[Dict]:
        """ポジション更新（エグジット判定）"""
        position = self.positions[symbol]
        row = df.iloc[-1]
        
        price = row['close']
        high = row['high']
        low = row['low']
        
        # 最高価格更新
        if high > position['highest_price']:
            position['highest_price'] = high
        
        # トレイリングストップ更新
        unrealized_pnl_pct = (position['highest_price'] - position['entry_price']) / position['entry_price'] * 100
        
        if unrealized_pnl_pct >= self.trailing_stop_activation:
            trailing_stop = position['highest_price'] * (1 - self.trailing_stop_distance / 100.0)
            
            if position['trailing_stop'] is None:
                position['trailing_stop'] = trailing_stop
                position['trailing_stop_used'] = True
                print(f"  📈 {symbol}: トレイリングストップ有効化 @ ${trailing_stop:.6f}")
            elif trailing_stop > position['trailing_stop']:
                position['trailing_stop'] = trailing_stop
        
        # エグジット判定
        exit_reason = None
        exit_price = price
        
        if position['trailing_stop'] and low <= position['trailing_stop']:
            exit_reason = "Trailing Stop"
            exit_price = position['trailing_stop']
        elif low <= position['stop_loss']:
            exit_reason = "Stop Loss"
            exit_price = position['stop_loss']
        elif high >= position['take_profit']:
            exit_reason = "Take Profit"
            exit_price = position['take_profit']
        
        if exit_reason:
            # エグジット実行
            pnl = (exit_price - position['entry_price']) * position['quantity']
            pnl_pct = (exit_price - position['entry_price']) / position['entry_price'] * 100
            
            self.capital += pnl
            
            trade = {
                'symbol': symbol,
                'entry_time': position['entry_time'],
                'exit_time': datetime.now().isoformat(),
                'entry_price': position['entry_price'],
                'exit_price': exit_price,
                'quantity': position['quantity'],
                'pnl': pnl,
                'pnl_pct': pnl_pct,
                'entry_reason': position['entry_reason'],
                'exit_reason': exit_reason,
                'highest_price': position['highest_price'],
                'trailing_stop_used': position.get('trailing_stop_used', False),
                'screenshot_path': position.get('screenshot_path', ''),
                'capital_after': self.capital
            }
            
            self.log_trade(trade)
            
            print(f"  🔴 {symbol}: エグジット @ ${exit_price:.6f} ({exit_reason}) PnL: ${pnl:.2f} ({pnl_pct:+.2f}%)")
            
            return trade
        
        return None
    
    def run_iteration(self):
        """1回のチェック実行"""
        symbols = self.get_screened_symbols()
        
        if not symbols:
            print(f"⚠️  スクリーニング済み銘柄なし")
            return
        
        for symbol in symbols:
            # データ取得
            df = self.get_klines(symbol, interval="5m", limit=500)
            
            if df is None or len(df) < self.sma_period:
                continue
            
            # 指標計算
            df = self.calculate_indicators(df)
            
            # ポジションあり → エグジット判定
            if symbol in self.positions:
                trade = self.update_position(symbol, df)
                
                if trade:
                    # ポジション削除
                    del self.positions[symbol]
            
            # ポジションなし → エントリー判定
            else:
                can_enter, reason = self.check_entry_signal(df)
                
                if can_enter:
                    # エントリー
                    price = df.iloc[-1]['close']
                    position_size = self.capital * (self.position_size_pct / 100.0)
                    quantity = position_size / price
                    
                    # スクリーンショット撮影
                    print(f"  🟢 {symbol}: エントリー @ ${price:.6f} ({reason})")
                    print(f"  📸 チャートスクリーンショット撮影中...")
                    screenshot_path = self.take_chart_screenshot(symbol)
                    
                    self.positions[symbol] = {
                        'entry_time': datetime.now().isoformat(),
                        'entry_price': price,
                        'quantity': quantity,
                        'position_size': position_size,
                        'stop_loss': price * (1 - self.stop_loss_pct / 100.0),
                        'take_profit': price * (1 + self.take_profit_pct / 100.0),
                        'trailing_stop': None,
                        'trailing_stop_used': False,
                        'highest_price': price,
                        'entry_reason': reason,
                        'screenshot_path': screenshot_path
                    }
    
    def run(self, check_interval: int = 60):
        """メインループ"""
        print(f"\n{'='*80}")
        print(f"🚀 Bitget自動トレーダー開始")
        print(f"{'='*80}")
        print(f"⏰ チェック間隔: {check_interval}秒")
        print(f"💰 現在資金: ${self.capital:,.2f}")
        print(f"📊 トレード記録: {self.trade_log_path}")
        print(f"{'='*80}\n")
        
        iteration = 0
        
        try:
            while True:
                iteration += 1
                print(f"\n🔄 チェック #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"💰 現在資金: ${self.capital:,.2f} | ポジション: {len(self.positions)}")
                
                self.run_iteration()
                
                print(f"⏱️  次のチェックまで{check_interval}秒待機...")
                time.sleep(check_interval)
        
        except KeyboardInterrupt:
            print(f"\n\n{'='*80}")
            print(f"🛑 自動トレーダー停止")
            print(f"{'='*80}")
            print(f"💰 最終資金: ${self.capital:,.2f}")
            print(f"📈 損益: ${self.capital - self.initial_capital:+,.2f} ({(self.capital - self.initial_capital) / self.initial_capital * 100:+.2f}%)")
            print(f"📊 トレード記録: {self.trade_log_path}")
            print(f"{'='*80}\n")

if __name__ == "__main__":
    trader = BitgetAutoTrader()
    trader.run(check_interval=60)
