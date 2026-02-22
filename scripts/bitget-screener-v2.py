#!/usr/bin/env python3
"""
Bitget銘柄スクリーニング v2
出来高 + ボラティリティベースのランキング（シンプル版）
前日比±10%フィルタ適用
"""

import os
import json
import time
import requests
import numpy as np
from datetime import datetime

def get_ticker(symbol):
    """指定銘柄のティッカー情報取得"""
    try:
        url = f"https://api.bitget.com/api/v2/mix/market/ticker?symbol={symbol}&productType=USDT-FUTURES"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "00000" and data.get("data"):
                return data["data"][0]
    except Exception as e:
        pass
    
    return None

def get_candles(symbol, limit=24):
    """指定銘柄のローソク足データ取得（1時間足）"""
    try:
        url = f"https://api.bitget.com/api/v2/mix/market/candles?symbol={symbol}&granularity=1H&limit={limit}&productType=USDT-FUTURES"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "00000" and data.get("data"):
                return data["data"]
    except Exception:
        pass
    
    return None

def calc_volatility(symbol):
    """ボラティリティ計算（変動係数）"""
    candles = get_candles(symbol)
    
    if not candles or len(candles) < 2:
        return 0.0
    
    try:
        # 終値を抽出（インデックス4）
        closes = np.array([float(c[4]) for c in candles])
        
        # 変動係数 = StdDev / Mean
        mean = np.mean(closes)
        if mean == 0:
            return 0.0
        
        stddev = np.std(closes)
        cv = stddev / mean
        
        return float(cv)
    except Exception:
        return 0.0

def get_24h_volume(ticker):
    """24時間出来高（USDT）"""
    try:
        return float(ticker.get("quoteVolume", 0))
    except:
        return 0.0

def check_price_change(ticker):
    """前日比パーセンテージ（%単位）
    
    計算方法:
    1. 優先: (現在値 - 24時間前の開場価格) / 開場価格 × 100
    2. 代替: change24h フィールド（小数表記）を % 変換
    """
    try:
        # 方法1: open24h と lastPr から計算（最も正確）
        last_price = float(ticker.get("lastPr", 0))
        open_24h = float(ticker.get("open24h", 0))
        
        if open_24h > 0 and last_price > 0:
            change_pct = ((last_price - open_24h) / open_24h) * 100
            return change_pct
        
        # 方法2: change24h フィールド（小数表記 → % に変換）
        change = ticker.get("change24h")
        if change is not None:
            change_pct = float(change) * 100
            return change_pct
        
        return 0.0
    except Exception as e:
        print(f"⚠️ Error calculating price change: {e}")
        return 0.0

def main():
    base_url = "https://api.bitget.com"
    
    # 主要銘柄リスト（USDT永続先物）
    symbols = [
        "BTCUSDT", "ETHUSDT", "ADAUSDT", "XRPUSDT", "DOGEUSDT",
        "SOLUSDT", "POLKAUSDT", "LINKUSDT", "AVAXUSDT", "UNIUSDT",
        "LITUSDT", "BNBUSDT", "MATICUSDT", "APTUSDT", "OPUSDT",
        "ARBUSDT", "GMXUSDT", "MAGAUSDT", "INJUSDT", "FILUSDT"
    ]
    
    print("🔍 Bitget銘柄スクリーニング開始 (v2: Volume × Volatility)")
    print("=" * 60)
    print("")
    
    screened = []
    
    for symbol in symbols:
        print(f"Screening {symbol}...", end=" ", flush=True)
        
        # ティッカー取得
        ticker = get_ticker(symbol)
        if not ticker:
            print("SKIP (no ticker)")
            continue
        
        # 前日比チェック（±5%以上の値動きがある銘柄のみ）
        price_change = check_price_change(ticker)
        if abs(price_change) < 5:  # 値動きが小さい銘柄は除外
            print(f"FILTERED (change: {price_change:+.2f}%)")
            continue
        
        # ボラティリティ計算
        vol = calc_volatility(symbol)
        
        # 出来高取得
        volume = get_24h_volume(ticker)
        
        # スコア: 出来高 × ボラティリティ
        score = volume * vol
        
        result = {
            "symbol": symbol,
            "price_change": round(price_change, 4),
            "volatility": round(vol, 6),
            "volume_24h": round(volume, 2),
            "score": round(score, 2)
        }
        
        screened.append(result)
        print(f"OK (score: {score:.2f})")
        
        # API制限回避
        time.sleep(0.1)
    
    # 値動き（価格変化率の絶対値）でソート（降順）
    screened.sort(key=lambda x: abs(x["price_change"]), reverse=True)
    
    print("\n" + "=" * 60)
    print(f"✅ スクリーニング完了: {len(screened)} 銘柄")
    print("")
    
    # 結果サマリー（上位15）
    top_15 = screened[:15]
    print("🎯 **Top 15 Symbols (値動きランキング ±5%以上):**")
    print("")
    for i, r in enumerate(top_15, 1):
        print(f"  {i:2d}. {r['symbol']:10s} | "
              f"Change: {r['price_change']:+.2f}% | "
              f"Volatility: {r['volatility']:.6f} | "
              f"Volume: ${r['volume_24h']:,.0f} | "
              f"Score: {r['score']:12.2f}")
    
    print("")
    
    # 結果をJSON保存
    os.makedirs("/root/clawd/data", exist_ok=True)
    
    output = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "method": "Price Change Ranking (絶対値で降順)",
        "filter": "Price change: ±5% 以上",
        "total_screened": len(screened),
        "top_15": top_15,
        "results": screened
    }
    
    with open("/root/clawd/data/screener-results.json", 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✅ Results saved to /root/clawd/data/screener-results.json")

if __name__ == "__main__":
    main()
