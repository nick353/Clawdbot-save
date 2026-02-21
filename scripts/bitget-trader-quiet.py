#!/usr/bin/env python3
"""
Bitget自動トレーディング - 静音モード
エントリー条件一致時のみDiscord通知
"""

import os
import json
import requests
import pandas as pd
import numpy as np
import pandas_ta as ta
from datetime import datetime
import time

# 設定読み込み
config_path = "/root/clawd/config/bitget-trading.json"
with open(config_path, 'r') as f:
    config = json.load(f)

def get_klines(symbol, interval="5m", limit=300):
    endpoint = "/api/v2/mix/market/candles"
    params = {
        "symbol": symbol,
        "productType": "USDT-FUTURES",
        "granularity": interval,
        "limit": str(limit)
    }
    
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    url = f"https://api.bitget.com{endpoint}?{query_string}"
    
    response = requests.get(url, timeout=10)
    
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

def calculate_indicators(df):
    strategy = config.get("strategy", {})
    
    df['sma200'] = ta.sma(df['close'], length=strategy.get("sma_period", 200))
    df['ema200'] = ta.ema(df['close'], length=strategy.get("ema_period", 200))
    
    macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
    df['macd'] = macd['MACD_12_26_9']
    df['macd_signal'] = macd['MACDs_12_26_9']
    df['macd_hist'] = macd['MACDh_12_26_9']
    
    df['bar_change_pct'] = df['close'].pct_change() * 100
    
    return df

def check_entry_conditions(df):
    if len(df) < 200:
        return False
    
    strategy = config.get("strategy", {})
    
    latest = df.iloc[-1]
    price = latest['close']
    sma = latest['sma200']
    ema = latest['ema200']
    
    if pd.isna(sma) or pd.isna(ema):
        return False
    
    max_change = df['bar_change_pct'].tail(24).abs().max()
    volatility_ok = max_change >= strategy.get("volatility_threshold", 10.0)
    
    proximity_pct = strategy.get("proximity_pct", 2.0)
    proximity_sma = abs((price - sma) / sma * 100) <= proximity_pct
    proximity_ema = abs((price - ema) / ema * 100) <= proximity_pct
    proximity_ok = proximity_sma or proximity_ema
    
    bounce_ok = price > sma and price > ema
    
    return volatility_ok and proximity_ok and bounce_ok, price

def send_discord_notification(message):
    """Discord通知（Clawdbot message toolの代替）"""
    print(f"📣 Discord通知: {message}")

# メインループ
print(f"🐥 Bitgetトレーダー起動（静音モード）")
print(f"📊 監視銘柄: {', '.join(config['symbols'])}")
print(f"⏰ チェック間隔: {config['check_interval']}秒\n")

send_discord_notification(
    f"🐥 Bitgetトレーダー起動（静音モード）\n"
    f"📊 監視銘柄: {', '.join(config['symbols'])}\n"
    f"⏰ チェック間隔: {config['check_interval']}秒"
)

iteration = 0
last_report_time = time.time()
REPORT_INTERVAL = 3600  # 1時間ごとのレポート

try:
    while True:
        iteration += 1
        current_time = time.time()
        
        # 1時間ごとの定期レポート
        if current_time - last_report_time >= REPORT_INTERVAL:
            send_discord_notification(
                f"📊 定期レポート\n"
                f"🔄 チェック数: {iteration}\n"
                f"時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )
            last_report_time = current_time
        
        for symbol in config['symbols']:
            df = get_klines(symbol, interval=config['timeframe'], limit=300)
            
            if df is None:
                continue
            
            df = calculate_indicators(df)
            
            entry, price = check_entry_conditions(df)
            
            if entry:
                # エントリー条件一致時のみ通知
                send_discord_notification(
                    f"🎯 **エントリー条件一致**\n"
                    f"銘柄: {symbol}\n"
                    f"価格: ${price:.4f}\n"
                    f"時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )
        
        time.sleep(config['check_interval'])
        
except KeyboardInterrupt:
    print("\n🛑 トレーダー停止")
    send_discord_notification("🛑 Bitgetトレーダー停止")
