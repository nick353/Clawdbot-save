#!/usr/bin/env python3
"""
Bitget自動トレーダーの動作テスト
"""

import os
import json
import requests
import pandas as pd
import pandas_ta as ta
from datetime import datetime

print("=" * 80)
print("🐥 Bitget自動トレーダー テスト")
print("=" * 80)

# 1. 設定ファイル読み込み
print("\n1️⃣ 設定ファイル読み込み...")
config_path = "/root/clawd/config/bitget-trading.json"
try:
    with open(config_path, 'r') as f:
        config = json.load(f)
    print(f"✅ 成功: {len(config['symbols'])}銘柄")
    print(f"   銘柄: {', '.join(config['symbols'][:3])}...")
except Exception as e:
    print(f"❌ 失敗: {e}")
    exit(1)

# 2. API接続テスト
print("\n2️⃣ API接続テスト...")
base_url = "https://api.bitget.com"
symbol = config['symbols'][0]

try:
    endpoint = "/api/v2/mix/market/candles"
    params = {
        "symbol": symbol,
        "productType": "usdt-futures",
        "granularity": "5m",
        "limit": "200"
    }
    
    response = requests.get(f"{base_url}{endpoint}", params=params, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        candles = data.get('data', [])
        print(f"✅ 成功: {len(candles)}本のローソク足取得")
        print(f"   最新価格: {candles[0][1] if candles else 'N/A'}")
    else:
        print(f"❌ 失敗: Status {response.status_code}")
        print(f"   {response.text[:200]}")
        exit(1)
except Exception as e:
    print(f"❌ 例外: {e}")
    exit(1)

# 3. データフレーム変換テスト
print("\n3️⃣ データフレーム変換テスト...")
try:
    df = pd.DataFrame(candles, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume', 'quote_volume'])
    df = df.astype({
        'open': float,
        'high': float,
        'low': float,
        'close': float,
        'volume': float
    })
    print(f"✅ 成功: {len(df)}行のデータフレーム")
    print(f"   最新Close: {df['close'].iloc[0]}")
except Exception as e:
    print(f"❌ 失敗: {e}")
    exit(1)

# 4. インジケーター計算テスト
print("\n4️⃣ インジケーター計算テスト...")
try:
    # SMA/EMA
    df['sma_200'] = ta.sma(df['close'], length=200)
    df['ema_200'] = ta.ema(df['close'], length=200)
    
    # MACD
    macd = ta.macd(df['close'])
    if macd is not None:
        df = pd.concat([df, macd], axis=1)
    
    print(f"✅ 成功")
    sma_val = df['sma_200'].iloc[0]
    ema_val = df['ema_200'].iloc[0]
    sma_str = f"{sma_val:.4f}" if not pd.isna(sma_val) else "N/A"
    ema_str = f"{ema_val:.4f}" if not pd.isna(ema_val) else "N/A"
    print(f"   SMA200: {sma_str}")
    print(f"   EMA200: {ema_str}")
except Exception as e:
    print(f"❌ 失敗: {e}")
    exit(1)

# 5. CSV記録テスト
print("\n5️⃣ CSV記録テスト...")
trade_log_path = "/root/clawd/data/trade-log-test.csv"
try:
    import csv
    os.makedirs(os.path.dirname(trade_log_path), exist_ok=True)
    
    if not os.path.exists(trade_log_path):
        with open(trade_log_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Entry Time', 'Symbol', 'Price'])
            writer.writerow([datetime.now().isoformat(), symbol, df['close'].iloc[0]])
    
    print(f"✅ 成功: {trade_log_path}")
except Exception as e:
    print(f"❌ 失敗: {e}")
    exit(1)

print("\n" + "=" * 80)
print("✅ 全テスト完了！自動トレーダーは正常に動作可能です")
print("=" * 80)
