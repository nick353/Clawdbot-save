#!/usr/bin/env python3
"""
並列処理版トレーダー（例）
複数銘柄を同時に処理して高速化
"""

import concurrent.futures
import requests
import pandas as pd
from typing import List, Optional

def fetch_single_symbol(symbol: str, base_url: str) -> Optional[pd.DataFrame]:
    """1銘柄のデータ取得（並列実行用）"""
    try:
        endpoint = "/api/v2/mix/market/candles"
        params = {
            "symbol": symbol,
            "productType": "usdt-futures",
            "granularity": "5m",
            "limit": "250"
        }
        
        response = requests.get(f"{base_url}{endpoint}", params=params, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            candles = data.get('data', [])
            
            if candles:
                df = pd.DataFrame(candles, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume', 'quote_volume'])
                df = df.astype({'open': float, 'high': float, 'low': float, 'close': float, 'volume': float})
                return df
        
        return None
    except Exception as e:
        print(f"  ❌ {symbol}: {e}")
        return None

def fetch_multiple_symbols_parallel(symbols: List[str], base_url: str, max_workers: int = 5) -> dict:
    """
    複数銘柄を並列取得
    
    Args:
        symbols: 銘柄リスト
        base_url: APIベースURL
        max_workers: 同時実行数（APIレート制限に注意）
    
    Returns:
        {symbol: DataFrame}
    """
    results = {}
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 全銘柄を並列で実行
        future_to_symbol = {
            executor.submit(fetch_single_symbol, symbol, base_url): symbol
            for symbol in symbols
        }
        
        # 完了したものから順次取得
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                df = future.result()
                if df is not None:
                    results[symbol] = df
                    print(f"  ✅ {symbol}: {len(df)}本取得")
            except Exception as e:
                print(f"  ❌ {symbol}: 例外 {e}")
    
    return results

# 使用例
if __name__ == "__main__":
    base_url = "https://api.bitget.com"
    symbols = ["STGUSDT", "ZROUSDT", "MEUSDT", "TNSRUSDT", "OGUSDT"]
    
    print("並列取得開始...")
    import time
    start = time.time()
    
    results = fetch_multiple_symbols_parallel(symbols, base_url, max_workers=5)
    
    elapsed = time.time() - start
    
    print(f"\n✅ 完了: {len(results)}/{len(symbols)}銘柄")
    print(f"⏱️  処理時間: {elapsed:.2f}秒")
    print(f"📊 1銘柄あたり: {elapsed / len(symbols):.2f}秒")
