#!/usr/bin/env python3
"""
仮想通貨ボラティリティスクリーニング（過去7日間）
過去7日間のうち1日でも前日比±10%以上の銘柄を抽出
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import time

def get_popular_crypto_pairs():
    """
    メジャーな仮想通貨ペアリスト（yfinance対応）
    Bitgetで取引可能な主要銘柄を網羅
    """
    # メジャー銘柄（時価総額上位＋人気アルトコイン）
    major_pairs = [
        # Top 10
        "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
        "ADA-USD", "DOGE-USD", "AVAX-USD", "DOT-USD", "MATIC-USD",
        
        # Top 20
        "TRX-USD", "LINK-USD", "UNI-USD", "ATOM-USD", "LTC-USD",
        "ETC-USD", "BCH-USD", "XLM-USD", "ALGO-USD", "VET-USD",
        
        # DeFi
        "AAVE-USD", "MKR-USD", "COMP-USD", "SNX-USD", "CRV-USD",
        
        # Layer 2
        "ARB-USD", "OP-USD", "IMX-USD",
        
        # ミームコイン
        "SHIB-USD", "PEPE-USD", "FLOKI-USD",
        
        # AI/新興
        "FET-USD", "RNDR-USD", "AGIX-USD",
        
        # その他人気
        "FIL-USD", "SAND-USD", "MANA-USD", "AXS-USD", "GALA-USD",
        "APE-USD", "CHZ-USD", "ENJ-USD", "THETA-USD", "FTM-USD",
    ]
    
    return major_pairs

def calculate_7day_max_volatility(symbol, days=8):
    """
    過去7日間の最大前日比ボラティリティを計算
    
    Args:
        symbol: 取引ペア
        days: データ取得日数（8日 = 今日 + 過去7日）
    
    Returns:
        {
            'max_volatility': 最大ボラティリティ,
            'max_volatility_date': 最大ボラティリティの日付,
            'days_with_10pct': ±10%以上の日数,
            'all_changes': 全ての前日比リスト
        }
    """
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        data = yf.download(symbol, start=start_date, end=end_date, interval='1d', progress=False)
        
        if data.empty or len(data) < 2:
            return None
        
        # カラム名を統一
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        
        # 前日比を計算
        daily_changes = data['Close'].pct_change() * 100
        daily_changes = daily_changes.dropna()
        
        if len(daily_changes) == 0:
            return None
        
        # 絶対値で最大を取得
        abs_changes = daily_changes.abs()
        max_idx = abs_changes.idxmax()
        max_volatility = daily_changes[max_idx]
        max_volatility_date = max_idx.strftime('%Y-%m-%d')
        
        # ±10%以上の日数をカウント
        days_with_10pct = (abs_changes >= 10.0).sum()
        
        return {
            'max_volatility': max_volatility,
            'max_volatility_date': max_volatility_date,
            'days_with_10pct': days_with_10pct,
            'all_changes': daily_changes.tolist()
        }
        
    except Exception as e:
        return None

def screen_7day_high_volatility_coins(min_volatility=10.0, max_results=30):
    """
    過去7日間で高ボラティリティ銘柄をスクリーニング
    
    Args:
        min_volatility: 最小ボラティリティ（前日比±%）
        max_results: 最大表示数
    
    Returns:
        高ボラティリティ銘柄のリスト
    """
    print(f"\n{'='*80}")
    print(f"🔍 仮想通貨ボラティリティスクリーニング（過去7日間）")
    print(f"📊 条件: 過去7日間のうち1日でも前日比±{min_volatility}%以上")
    print(f"{'='*80}\n")
    
    crypto_pairs = get_popular_crypto_pairs()
    results = []
    
    print(f"🔄 {len(crypto_pairs)}銘柄をスキャン中...\n")
    
    for i, symbol in enumerate(crypto_pairs, 1):
        # レート制限対策（軽め）
        if i % 10 == 0:
            time.sleep(1)
            print(f"進捗: {i}/{len(crypto_pairs)}...")
        
        vol_data = calculate_7day_max_volatility(symbol)
        
        if vol_data is not None and abs(vol_data['max_volatility']) >= min_volatility:
            results.append({
                'symbol': symbol,
                'max_volatility': vol_data['max_volatility'],
                'abs_max_volatility': abs(vol_data['max_volatility']),
                'max_volatility_date': vol_data['max_volatility_date'],
                'days_with_10pct': vol_data['days_with_10pct']
            })
    
    # ボラティリティでソート（降順）
    results.sort(key=lambda x: x['abs_max_volatility'], reverse=True)
    
    # 結果表示
    print(f"\n{'='*80}")
    print(f"✅ スクリーニング結果")
    print(f"{'='*80}\n")
    
    if results:
        print(f"🎯 過去7日間で±{min_volatility}%以上の銘柄: {len(results)}件\n")
        
        print(f"{'順位':>4} | {'銘柄':12} | {'最大変動':>12} | {'日付':>12} | {'±10%日数':>10}")
        print(f"{'-'*80}")
        
        for i, coin in enumerate(results[:max_results], 1):
            symbol = coin['symbol'].replace('-USD', '')
            max_vol = coin['max_volatility']
            abs_vol = coin['abs_max_volatility']
            date = coin['max_volatility_date']
            days_10pct = coin['days_with_10pct']
            
            # 色分け（上昇=緑、下降=赤）
            direction = "📈" if max_vol > 0 else "📉"
            
            print(f"{i:4} | {symbol:12} | {direction} {max_vol:>7.2f}% | {date:>12} | {days_10pct:10}日")
        
        print(f"\n{'='*80}\n")
        
        # 銘柄リストを返す
        return [coin['symbol'] for coin in results[:max_results]]
    else:
        print(f"❌ 過去7日間で前日比±{min_volatility}%以上の銘柄が見つかりませんでした\n")
        print(f"💡 提案: min_volatility を下げて再実行してください\n")
        return []

def screen_and_save(min_volatility=10.0, output_file="/root/clawd/high_volatility_coins_7days.txt"):
    """
    スクリーニングして結果をファイルに保存
    """
    high_vol_coins = screen_7day_high_volatility_coins(min_volatility=min_volatility)
    
    if high_vol_coins:
        # ファイルに保存
        with open(output_file, 'w') as f:
            for coin in high_vol_coins:
                f.write(f"{coin}\n")
        
        print(f"💾 結果を保存: {output_file}")
        print(f"📋 {len(high_vol_coins)}銘柄を保存しました\n")
        
        return high_vol_coins
    else:
        return []

if __name__ == "__main__":
    print("\n🐥 andoさんの高ボラティリティ銘柄スクリーニング（過去7日間版）\n")
    
    # 過去7日間で前日比±10%以上の銘柄を抽出
    high_vol_coins = screen_and_save(min_volatility=10.0)
    
    if high_vol_coins:
        print(f"✅ スクリーニング完了っぴ！")
        print(f"🎯 次のステップ: これらの銘柄でバックテストを実行しますっぴ！\n")
    else:
        print(f"⚠️  高ボラティリティ銘柄が見つかりませんでした")
        print(f"💡 条件を緩和（±5%など）して再実行することをおすすめしますっぴ\n")
