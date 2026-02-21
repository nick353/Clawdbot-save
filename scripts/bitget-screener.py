#!/usr/bin/env python3
"""
Bitget銘柄スクリーニング
7日間でボラティリティが高い銘柄を検出
"""

import os
import json
import time
import requests
import pandas as pd
import numpy as np
import pandas_ta as ta
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

class BitgetScreener:
    """
    Bitget銘柄スクリーナー
    """
    
    def __init__(self):
        self.base_url = "https://api.bitget.com"
        self.results = []
    
    def get_all_symbols(self) -> List[str]:
        """
        全銘柄リスト取得（USDT-FUTURES）
        """
        try:
            endpoint = "/api/v2/mix/market/tickers"
            params = "?productType=USDT-FUTURES"
            
            response = requests.get(
                self.base_url + endpoint + params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                tickers = data.get("data", [])
                
                # シンボルリスト抽出
                symbols = [t.get("symbol") for t in tickers if t.get("symbol")]
                
                # 主要銘柄のみ（出来高がある程度あるもの）
                filtered = []
                for ticker in tickers:
                    symbol = ticker.get("symbol", "")
                    volume = float(ticker.get("baseVolume", "0"))
                    
                    # 出来高フィルター（24時間で10万ドル以上）
                    if symbol and volume > 100000:
                        filtered.append(symbol)
                
                return filtered
            else:
                print(f"❌ 銘柄リスト取得エラー: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ 銘柄リスト取得エラー: {e}")
            return []
    
    def get_klines(self, symbol: str, interval: str = "1D", limit: int = 7) -> Optional[pd.DataFrame]:
        """
        K線データ取得
        """
        try:
            endpoint = "/api/v2/mix/market/candles"
            params = {
                "symbol": symbol,
                "granularity": interval,
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
    
    def calculate_volatility(self, df: pd.DataFrame) -> Dict:
        """
        ボラティリティ指標を計算
        """
        if len(df) < 2:
            return None
        
        # 日次変動率
        df['daily_change'] = df['close'].pct_change() * 100
        
        # 7日間の統計
        stats = {
            'max_gain': df['daily_change'].max(),
            'max_loss': df['daily_change'].min(),
            'avg_change': df['daily_change'].abs().mean(),
            'volatility': df['daily_change'].std(),
            'total_change': ((df['close'].iloc[-1] - df['close'].iloc[0]) / df['close'].iloc[0] * 100),
            'current_price': df['close'].iloc[-1],
            'volume_avg': df['volume'].mean()
        }
        
        return stats
    
    def score_symbol(self, stats: Dict) -> float:
        """
        銘柄をスコアリング
        
        スコア基準:
        - 最大変動率（±10%以上で高得点）
        - 平均変動率（高いほど良い）
        - ボラティリティ（適度が良い）
        """
        score = 0.0
        
        # 最大変動率（±10%で100点）
        max_move = max(abs(stats['max_gain']), abs(stats['max_loss']))
        if max_move >= 10.0:
            score += 100
        elif max_move >= 7.0:
            score += 70
        elif max_move >= 5.0:
            score += 50
        
        # 平均変動率（3%以上で50点）
        if stats['avg_change'] >= 3.0:
            score += 50
        elif stats['avg_change'] >= 2.0:
            score += 30
        
        # 総変動率（7日間で15%以上動いてたら50点）
        if abs(stats['total_change']) >= 15.0:
            score += 50
        elif abs(stats['total_change']) >= 10.0:
            score += 30
        
        return score
    
    def screen(self, top_n: int = 10) -> List[Dict]:
        """
        スクリーニング実行
        """
        print(f"🔍 Bitget銘柄スクリーニング開始")
        print(f"📊 対象期間: 直近7日間")
        print(f"🎯 目標: ボラティリティが高い銘柄を検出\n")
        
        # 全銘柄取得
        print(f"📡 全銘柄リスト取得中...")
        symbols = self.get_all_symbols()
        print(f"✅ {len(symbols)} 銘柄取得完了\n")
        
        # 各銘柄を分析
        results = []
        processed = 0
        
        for i, symbol in enumerate(symbols, 1):
            # プログレス表示
            if i % 20 == 0:
                print(f"⏳ 進捗: {i}/{len(symbols)} ({i/len(symbols)*100:.1f}%)")
            
            # K線データ取得
            df = self.get_klines(symbol, interval="1D", limit=8)  # 7日+1
            
            if df is None or len(df) < 7:
                continue
            
            # ボラティリティ計算
            stats = self.calculate_volatility(df)
            
            if stats is None:
                continue
            
            # スコアリング
            score = self.score_symbol(stats)
            
            if score >= 50:  # 50点以上のみ保存
                results.append({
                    'symbol': symbol,
                    'score': score,
                    **stats
                })
            
            processed += 1
            
            # API負荷軽減（100銘柄ごとに1秒休憩）
            if processed % 100 == 0:
                time.sleep(1)
        
        print(f"\n✅ スクリーニング完了: {processed} 銘柄分析")
        
        # スコア順にソート
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return results[:top_n]
    
    def print_results(self, results: List[Dict]):
        """
        結果を表示
        """
        if not results:
            print(f"\n⚠️  条件に合う銘柄が見つかりませんでした")
            return
        
        print(f"\n{'='*100}")
        print(f"🏆 トップ{len(results)}銘柄（7日間ボラティリティ）")
        print(f"{'='*100}\n")
        
        for i, r in enumerate(results, 1):
            print(f"#{i}. **{r['symbol']}** (スコア: {r['score']:.0f})")
            print(f"   現在価格: ${r['current_price']:.6f}")
            print(f"   7日間変動: {r['total_change']:+.2f}%")
            print(f"   最大上昇: {r['max_gain']:+.2f}%")
            print(f"   最大下落: {r['max_loss']:+.2f}%")
            print(f"   平均変動: {r['avg_change']:.2f}%/日")
            print(f"   ボラティリティ: {r['volatility']:.2f}%")
            print()
    
    def save_results(self, results: List[Dict], filename: str = "/root/clawd/data/screener-results.json"):
        """
        結果を保存
        """
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        output = {
            'timestamp': datetime.now().isoformat(),
            'period': '7days',
            'count': len(results),
            'results': results
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"💾 結果を保存: {filename}")

if __name__ == "__main__":
    screener = BitgetScreener()
    results = screener.screen(top_n=15)
    screener.print_results(results)
    screener.save_results(results)
