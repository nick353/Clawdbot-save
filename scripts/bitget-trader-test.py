#!/usr/bin/env python3
"""
Bitget自動トレーディング - テストモード（1回のみ実行）
"""

import os
import json
import requests
import pandas as pd
import numpy as np
import pandas_ta as ta
from datetime import datetime

# 設定読み込み
config_path = "/root/clawd/config/bitget-trading.json"
with open(config_path, 'r') as f:
    config = json.load(f)

print(f"\n{'='*80}")
print(f"🐥 Bitget自動トレーディング - テストモード")
print(f"{'='*80}\n")

print(f"📊 監視銘柄: {', '.join(config['symbols'])}")
print(f"⏰ 時間足: {config['timeframe']}")
print(f"💰 初期資金: ${config['initial_capital']:,.2f}")
print(f"🐛 ペーパートレード: {config['paper_trade']}\n")

# K線データ取得関数
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
        print(f"❌ K線取得エラー: {response.text}")
        return None

# テクニカル指標計算
def calculate_indicators(df):
    strategy = config.get("strategy", {})
    
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

# エントリー条件チェック
def check_entry_conditions(df):
    if len(df) < 200:
        return False, "データ不足"
    
    strategy = config.get("strategy", {})
    
    # 最新データ
    latest = df.iloc[-1]
    price = latest['close']
    sma = latest['sma200']
    ema = latest['ema200']
    
    # NaNチェック
    if pd.isna(sma) or pd.isna(ema):
        return False, "指標未計算"
    
    # 1. ボラティリティチェック（簡易版: 直近24バーの最大変動）
    max_change = df['bar_change_pct'].tail(24).abs().max()
    volatility_ok = max_change >= strategy.get("volatility_threshold", 10.0)
    
    # 2. SMA/EMAへの接近判定
    proximity_pct = strategy.get("proximity_pct", 2.0)
    proximity_sma = abs((price - sma) / sma * 100) <= proximity_pct
    proximity_ema = abs((price - ema) / ema * 100) <= proximity_pct
    proximity_ok = proximity_sma or proximity_ema
    
    # 3. 反発確認（価格がSMA/EMAより上）
    bounce_ok = price > sma and price > ema
    
    # 判定結果
    details = f"価格=${price:.4f}, SMA=${sma:.4f}, EMA=${ema:.4f}, 最大変動={max_change:.2f}%"
    
    if volatility_ok and proximity_ok and bounce_ok:
        return True, f"✅ 全条件一致 ({details})"
    else:
        reasons = []
        if not volatility_ok:
            reasons.append(f"ボラティリティ不足({max_change:.2f}% < {strategy.get('volatility_threshold')}%)")
        if not proximity_ok:
            reasons.append("SMA/EMA接近せず")
        if not bounce_ok:
            reasons.append("反発なし")
        return False, f"❌ 条件未達: {', '.join(reasons)} ({details})"

# メインチェックループ
print(f"{'='*80}")
print(f"🔄 チェック開始 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{'='*80}\n")

for symbol in config['symbols']:
    print(f"📊 {symbol} チェック中...")
    
    # K線データ取得
    df = get_klines(symbol, interval=config['timeframe'], limit=300)
    
    if df is None:
        print(f"   ⚠️  データ取得失敗\n")
        continue
    
    # 指標計算
    df = calculate_indicators(df)
    
    # エントリー条件チェック
    entry, message = check_entry_conditions(df)
    
    if entry:
        print(f"   🎯 **エントリー条件一致！**")
        print(f"   {message}\n")
    else:
        print(f"   {message}\n")

print(f"{'='*80}")
print(f"✅ テスト完了")
print(f"{'='*80}\n")
