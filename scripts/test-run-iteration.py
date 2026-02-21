#!/usr/bin/env python3
"""
run_iteration()のデバッグテスト
"""

import os
import sys
import json
import requests
import pandas as pd
import pandas_ta as ta
from typing import List, Optional
from datetime import datetime

# 標準出力即座にフラッシュ
sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', buffering=1)

print("=" * 80, flush=True)
print("🐥 run_iteration() デバッグ", flush=True)
print("=" * 80, flush=True)

base_url = "https://api.bitget.com"

def get_screened_symbols() -> List[str]:
    """スクリーニング済み銘柄を取得"""
    print("\n1️⃣ get_screened_symbols()開始...", flush=True)
    try:
        with open("/root/clawd/data/screener-results.json", 'r') as f:
            data = json.load(f)
        
        # 前日比+10%以上のみ
        positive = [
            r['symbol'] for r in data['results']
            if r.get('total_change', 0) >= 10.0
        ]
        
        print(f"  ✅ {len(positive)}銘柄取得: {', '.join(positive[:3])}...", flush=True)
        return positive
    except FileNotFoundError:
        print(f"  ❌ スクリーニング結果が見つかりません", flush=True)
        return []

def get_klines(symbol: str, interval: str = "5m", limit: int = 250) -> Optional[pd.DataFrame]:
    """K線データ取得"""
    print(f"\n  2️⃣-{symbol}: get_klines()開始...", flush=True)
    try:
        endpoint = "/api/v2/mix/market/candles"
        params = {
            "symbol": symbol,
            "granularity": interval,
            "limit": str(limit),
            "productType": "usdt-futures"
        }
        
        print(f"    API呼び出し中...", flush=True)
        response = requests.get(f"{base_url}{endpoint}", params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            candles = data.get("data", [])
            
            if not candles:
                print(f"    ❌ データなし", flush=True)
                return None
            
            print(f"    ✅ {len(candles)}本取得", flush=True)
            
            # DataFrame変換
            print(f"    DataFrame変換中...", flush=True)
            df = pd.DataFrame(candles, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume', 'quote_volume'])
            df = df.astype({
                'open': float,
                'high': float,
                'low': float,
                'close': float,
                'volume': float
            })
            
            print(f"    ✅ DataFrame作成完了（{len(df)}行）", flush=True)
            return df
        else:
            print(f"    ❌ APIエラー: {response.status_code}", flush=True)
            return None
            
    except Exception as e:
        print(f"    ❌ 例外: {e}", flush=True)
        return None

def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """インジケーター計算"""
    print(f"    インジケーター計算中...", flush=True)
    try:
        # SMA/EMA
        df['sma_200'] = ta.sma(df['close'], length=200)
        df['ema_200'] = ta.ema(df['close'], length=200)
        
        # MACD
        macd = ta.macd(df['close'])
        if macd is not None:
            df = pd.concat([df, macd], axis=1)
        
        # 出来高MA
        df['volume_ma'] = ta.sma(df['volume'], length=20)
        
        print(f"    ✅ インジケーター計算完了", flush=True)
        return df
    except Exception as e:
        print(f"    ❌ インジケーター計算失敗: {e}", flush=True)
        return df

# テスト実行
print("\n🚀 run_iteration()シミュレーション開始\n", flush=True)

symbols = get_screened_symbols()

if not symbols:
    print("❌ 銘柄なし、終了", flush=True)
    sys.exit(1)

print(f"\n📊 {len(symbols)}銘柄を処理します\n", flush=True)

for i, symbol in enumerate(symbols, 1):
    print(f"\n{'='*60}", flush=True)
    print(f"銘柄 {i}/{len(symbols)}: {symbol}", flush=True)
    print(f"{'='*60}", flush=True)
    
    # データ取得
    df = get_klines(symbol, interval="5m", limit=500)
    
    if df is None or len(df) < 200:
        print(f"  ⏭️  スキップ（データ不足）", flush=True)
        continue
    
    # 指標計算
    df = calculate_indicators(df)
    
    print(f"  ✅ {symbol} 処理完了", flush=True)

print(f"\n{'='*80}", flush=True)
print(f"✅ 全銘柄処理完了！", flush=True)
print(f"{'='*80}", flush=True)
