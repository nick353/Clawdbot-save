#!/usr/bin/env python3
"""
Bitget自動トレーディングシステム
andoさんのSMA/EMA 200反発戦略
"""

import os
import json
import time
import hmac
import hashlib
import base64
from datetime import datetime
from typing import Dict, List, Optional
import requests
import pandas as pd
import numpy as np
import pandas_ta as ta

class BitgetTrader:
    """
    Bitget API連携トレーダー
    """
    
    def __init__(self, config_path: str = "/root/clawd/config/bitget-trading.json"):
        """
        初期化
        
        Args:
            config_path: 設定ファイルパス
        """
        self.config = self.load_config(config_path)
        
        # Bitget API設定
        self.api_key = os.environ.get("BITGET_API_KEY")
        self.secret_key = os.environ.get("BITGET_SECRET_KEY")
        self.passphrase = os.environ.get("BITGET_PASSPHRASE")
        
        # APIエンドポイント
        self.base_url = "https://api.bitget.com"
        
        # トレード状態
        self.positions = {}
        self.daily_pnl = 0.0
        self.trade_count = 0
        
        # ペーパートレードモード
        self.paper_trade = self.config.get("paper_trade", True)
        
        print(f"🐥 Bitgetトレーダー初期化")
        print(f"📊 モード: {'ペーパートレード' if self.paper_trade else 'リアルトレード'}")
        print(f"💰 初期資金: ${self.config.get('initial_capital', 10000):,.2f}")
    
    def load_config(self, config_path: str) -> Dict:
        """
        設定ファイル読み込み
        """
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            print(f"✅ 設定ファイル読み込み: {config_path}")
            return config
        except FileNotFoundError:
            print(f"⚠️  設定ファイルが見つかりません: {config_path}")
            print(f"💡 デフォルト設定でテンプレートを作成します")
            return self.create_default_config(config_path)
    
    def create_default_config(self, config_path: str) -> Dict:
        """
        デフォルト設定ファイルを作成
        """
        default_config = {
            "paper_trade": True,
            "initial_capital": 10000.0,
            "discord_channel": "1471389000000000000",  # 専用チャンネルID
            "symbols": [
                "MANAUSDT",
                "AXSUSDT",
                "FETUSDT"
            ],
            "strategy": {
                "sma_period": 200,
                "ema_period": 200,
                "volatility_threshold": 10.0,
                "proximity_pct": 2.0,
                "stop_loss_pct": 5.0,
                "take_profit_pct": 10.0,
                "position_size_pct": 10.0
            },
            "risk_management": {
                "max_daily_loss": -100.0,
                "max_daily_trades": 20,
                "max_positions": 3
            },
            "timeframe": "5m",
            "check_interval": 60
        }
        
        # ディレクトリ作成
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        
        # ファイル保存
        with open(config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
        
        print(f"✅ デフォルト設定ファイル作成: {config_path}")
        return default_config
    
    def sign_request(self, method: str, request_path: str, body: str = "") -> Dict[str, str]:
        """
        Bitget API署名
        """
        timestamp = str(int(time.time() * 1000))
        message = timestamp + method + request_path + body
        
        signature = base64.b64encode(
            hmac.new(
                self.secret_key.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).digest()
        ).decode('utf-8')
        
        headers = {
            "ACCESS-KEY": self.api_key,
            "ACCESS-SIGN": signature,
            "ACCESS-TIMESTAMP": timestamp,
            "ACCESS-PASSPHRASE": self.passphrase,
            "Content-Type": "application/json"
        }
        
        return headers
    
    def get_account_balance(self) -> Optional[Dict]:
        """
        口座残高取得（V2 API）
        """
        if self.paper_trade:
            return {
                "available": self.config.get("initial_capital", 10000.0),
                "equity": self.config.get("initial_capital", 10000.0)
            }
        
        try:
            endpoint = "/api/v2/mix/account/accounts"
            params = "?productType=USDT-FUTURES"
            request_path = endpoint + params
            
            headers = self.sign_request("GET", request_path)
            response = requests.get(
                self.base_url + request_path,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("data", {})
            else:
                print(f"❌ 残高取得エラー: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ 残高取得エラー: {e}")
            return None
    
    def get_klines(self, symbol: str, interval: str = "5m", limit: int = 300) -> Optional[pd.DataFrame]:
        """
        K線データ取得（V2 API）
        
        Args:
            symbol: 取引ペア（例: BTCUSDT）
            interval: 時間足（5m, 1H, 4H, 1D）
            limit: 取得件数
        """
        try:
            # V2 API用に時間足フォーマットを変換
            interval_map = {
                "5m": "5m",
                "15m": "15m",
                "1h": "1H",
                "4h": "4H",
                "1d": "1D"
            }
            granularity = interval_map.get(interval, interval)
            
            endpoint = "/api/v2/mix/market/candles"
            params = {
                "symbol": symbol,
                "granularity": granularity,
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
                
                # DataFrameに変換
                df = pd.DataFrame(candles, columns=[
                    'timestamp', 'open', 'high', 'low', 'close', 'volume', 'quote_volume'
                ])
                
                # 型変換
                df['timestamp'] = pd.to_datetime(df['timestamp'].astype(int), unit='ms')
                for col in ['open', 'high', 'low', 'close', 'volume']:
                    df[col] = df[col].astype(float)
                
                df = df.sort_values('timestamp')
                df = df.set_index('timestamp')
                
                return df
            else:
                print(f"❌ K線取得エラー: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ K線取得エラー: {e}")
            return None
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        テクニカル指標を計算
        """
        strategy = self.config.get("strategy", {})
        
        # SMA 200
        df['sma200'] = ta.sma(df['close'], length=strategy.get("sma_period", 200))
        
        # EMA 200
        df['ema200'] = ta.ema(df['close'], length=strategy.get("ema_period", 200))
        
        # MACD
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        df['macd'] = macd['MACD_12_26_9']
        df['macd_signal'] = macd['MACDs_12_26_9']
        df['macd_hist'] = macd['MACDh_12_26_9']
        
        # 前バー比（%）
        df['bar_change_pct'] = df['close'].pct_change() * 100
        
        return df
    
    def check_entry_conditions(self, df: pd.DataFrame, symbol: str) -> bool:
        """
        エントリー条件チェック
        """
        if len(df) < 200:
            return False
        
        strategy = self.config.get("strategy", {})
        
        # 最新データ
        latest = df.iloc[-1]
        price = latest['close']
        sma = latest['sma200']
        ema = latest['ema200']
        
        # NaNチェック
        if pd.isna(sma) or pd.isna(ema):
            return False
        
        # 1. 日足で前日比±10%チェック（簡易版: 直近の大きな変動をチェック）
        max_change = df['bar_change_pct'].tail(24).abs().max()  # 直近24バー（2時間）
        volatility_ok = max_change >= strategy.get("volatility_threshold", 10.0)
        
        # 2. SMA/EMAへの接近判定
        proximity_pct = strategy.get("proximity_pct", 2.0)
        proximity_sma = abs((price - sma) / sma * 100) <= proximity_pct
        proximity_ema = abs((price - ema) / ema * 100) <= proximity_pct
        proximity_ok = proximity_sma or proximity_ema
        
        # 3. 反発確認（価格がSMA/EMAより上）
        bounce_ok = price > sma and price > ema
        
        # エントリー判定
        return volatility_ok and proximity_ok and bounce_ok
    
    def send_discord_notification(self, message: str):
        """
        Discord通知送信
        """
        channel_id = self.config.get("discord_channel")
        
        if not channel_id:
            print(f"💬 Discord通知: {message}")
            return
        
        # ここでClawdbotのmessage toolを使って通知
        # 実装は後で追加
        print(f"💬 Discord通知（{channel_id}）: {message}")
    
    def run(self):
        """
        トレーディングループ実行
        """
        print(f"\n{'='*80}")
        print(f"🚀 Bitget自動トレーディング開始")
        print(f"{'='*80}\n")
        
        symbols = self.config.get("symbols", [])
        interval = self.config.get("timeframe", "5m")
        check_interval = self.config.get("check_interval", 60)
        
        print(f"📊 監視銘柄: {', '.join(symbols)}")
        print(f"⏰ 時間足: {interval}")
        print(f"🔄 チェック間隔: {check_interval}秒\n")
        
        # 口座残高確認
        balance = self.get_account_balance()
        if balance:
            print(f"💰 口座残高: ${balance.get('equity', 0):,.2f}\n")
        
        self.send_discord_notification(
            f"🐥 Bitget自動トレーディング開始\n"
            f"📊 監視銘柄: {', '.join(symbols)}\n"
            f"⏰ 時間足: {interval}\n"
            f"💰 口座残高: ${balance.get('equity', 0) if balance else 0:,.2f}"
        )
        
        try:
            iteration = 0
            while True:
                iteration += 1
                print(f"\n{'='*80}")
                print(f"🔄 チェック #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"{'='*80}\n")
                
                for symbol in symbols:
                    print(f"📊 {symbol} チェック中...")
                    
                    # K線データ取得
                    df = self.get_klines(symbol, interval=interval, limit=300)
                    
                    if df is None:
                        print(f"⚠️  {symbol}: データ取得失敗")
                        continue
                    
                    # 指標計算
                    df = self.calculate_indicators(df)
                    
                    # エントリー条件チェック
                    if self.check_entry_conditions(df, symbol):
                        latest_price = df.iloc[-1]['close']
                        print(f"🎯 {symbol}: エントリー条件一致！価格: ${latest_price:.4f}")
                        
                        self.send_discord_notification(
                            f"🎯 **エントリー条件一致**\n"
                            f"銘柄: {symbol}\n"
                            f"価格: ${latest_price:.4f}\n"
                            f"時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                        )
                    else:
                        print(f"⏳ {symbol}: 条件未達")
                
                print(f"\n⏱️  次のチェックまで{check_interval}秒待機...")
                time.sleep(check_interval)
                
        except KeyboardInterrupt:
            print(f"\n\n{'='*80}")
            print(f"🛑 トレーディング停止")
            print(f"{'='*80}\n")
            
            self.send_discord_notification("🛑 Bitget自動トレーディング停止")

if __name__ == "__main__":
    trader = BitgetTrader()
    trader.run()
