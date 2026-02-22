#!/usr/bin/env python3
"""
Bitget銘柄スクリーニング v3 - 全銘柄版
出来高 + ボラティリティベースのランキング
Bitgetで取引可能な全ての銘柄（USDT永続先物）を自動取得してスクリーニング
"""

import os
import json
import time
import requests
import numpy as np
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# API設定
BITGET_BASE_URL = "https://api.bitget.com/api/v2"
MAX_WORKERS = 10
API_DELAY = 0.05

def get_all_symbols():
    """Bitgetで取引可能な全USDT永続先物銘柄を取得"""
    try:
        url = f"{BITGET_BASE_URL}/mix/market/tickers?productType=USDT-FUTURES"
        response = requests.get(url, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "00000" and data.get("data"):
                # シンボル抽出
                symbols = [item['symbol'] for item in data['data']]
                print(f"📊 取得した銘柄数: {len(symbols)}")
                return sorted(symbols)
    except Exception as e:
        print(f"❌ エラー: 全銘柄取得失敗 - {e}")
    
    return []

def get_ticker(symbol):
    """指定銘柄のティッカー情報取得"""
    try:
        url = f"{BITGET_BASE_URL}/mix/market/ticker?symbol={symbol}&productType=USDT-FUTURES"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "00000" and data.get("data"):
                return data["data"][0]
    except Exception:
        pass
    
    return None

def get_candles(symbol, limit=24):
    """指定銘柄のローソク足データ取得（1時間足）"""
    try:
        url = f"{BITGET_BASE_URL}/mix/market/candles?symbol={symbol}&granularity=1H&limit={limit}&productType=USDT-FUTURES"
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
    """前日比パーセンテージ（%単位）"""
    try:
        last_price = float(ticker.get("lastPr", 0))
        open_24h = float(ticker.get("open24h", 0))
        
        if open_24h > 0 and last_price > 0:
            change_pct = ((last_price - open_24h) / open_24h) * 100
            return change_pct
        
        change = ticker.get("change24h")
        if change is not None:
            change_pct = float(change) * 100
            return change_pct
        
        return 0.0
    except Exception:
        return 0.0

def screen_symbol(symbol):
    """1つの銘柄をスクリーニング"""
    try:
        # ティッカー取得
        ticker = get_ticker(symbol)
        if not ticker:
            return None
        
        # 価格変化チェック（±5%以上）
        price_change = check_price_change(ticker)
        if abs(price_change) < 5:
            return None
        
        # ボラティリティ計算
        vol = calc_volatility(symbol)
        
        # 出来高取得
        volume = get_24h_volume(ticker)
        
        # スコア: 出来高 × ボラティリティ
        score = volume * vol
        
        if score <= 0:
            return None
        
        result = {
            "symbol": symbol,
            "price_change": round(price_change, 4),
            "volatility": round(vol, 6),
            "volume_24h": round(volume, 2),
            "score": round(score, 2)
        }
        
        return result
    except Exception as e:
        print(f"⚠️ {symbol} スクリーニング失敗: {e}")
        return None

def main():
    print("🔍 Bitget全銘柄スクリーニング開始 (v3-Full)")
    print("=" * 80)
    print("")
    
    # 全銘柄取得
    print("📥 全銘柄リストを取得中...")
    symbols = get_all_symbols()
    
    if not symbols:
        print("❌ 銘柄リスト取得失敗")
        return
    
    print(f"✅ {len(symbols)} 銘柄を取得しました")
    print("")
    print("🔄 スクリーニング中（並列処理）...")
    print("")
    
    screened = []
    completed = 0
    
    # 並列スクリーニング
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(screen_symbol, symbol): symbol for symbol in symbols}
        
        for future in as_completed(futures):
            completed += 1
            symbol = futures[future]
            
            # 進捗表示（100銘柄ごと）
            if completed % 100 == 0:
                print(f"  進捗: {completed}/{len(symbols)} ({completed*100//len(symbols)}%)")
            
            try:
                result = future.result()
                if result:
                    screened.append(result)
            except Exception as e:
                print(f"⚠️ {symbol} 処理エラー: {e}")
            
            time.sleep(API_DELAY)
    
    print("")
    print("=" * 80)
    print(f"✅ スクリーニング完了")
    print(f"  チェック対象: {len(symbols)} 銘柄")
    print(f"  フィルタ条件: 価格変化 ±5% 以上")
    print(f"  スクリーニング通過: {len(screened)} 銘柄")
    print("")
    
    if not screened:
        print("⚠️ スクリーニング対象銘柄がありません")
        return
    
    # 値動き（価格変化率の絶対値）でソート（降順）
    screened.sort(key=lambda x: abs(x["price_change"]), reverse=True)
    
    # 結果サマリー（上位15）
    top_15 = screened[:15]
    print("🎯 **Top 15 銘柄（値動きランキング）:**")
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
        "version": "v3-full",
        "method": "All symbols dynamic screening + Price Change Ranking",
        "total_checked": len(symbols),
        "filter": "Price change: ±5% 以上",
        "total_passed": len(screened),
        "top_15": top_15,
        "results": screened
    }
    
    with open("/root/clawd/data/screener-results.json", 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✅ 結果保存: /root/clawd/data/screener-results.json")
    print("")
    print("=" * 80)

if __name__ == "__main__":
    main()
