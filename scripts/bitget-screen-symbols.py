#!/usr/bin/env python3
"""
Bitget 動的銘柄スクリーニング
ロス・キャメロン戦略用: ペニーストック + 高出来高変動率
"""
import json
import requests
import time
from pathlib import Path
from typing import List, Dict
from datetime import datetime

# 設定
CONFIG_PATH = "/root/clawd/config/bitget-trading-v3.json"
BITGET_API_BASE = "https://api.bitget.com"
CACHE_PATH = "/tmp/bitget_volume_cache.json"

# フィルター条件
PRICE_MIN = 0.1
PRICE_MAX = 5.0
VOLUME_CHANGE_MIN = 3.0  # 3倍
VOLUME_CHANGE_MAX = 5.0  # 5倍
VOLUME_USD_MIN = 500000  # $500,000
MAX_SYMBOLS = 15


def load_volume_cache() -> Dict:
    """前回の出来高データをキャッシュから読み込み"""
    try:
        if Path(CACHE_PATH).exists():
            with open(CACHE_PATH, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"⚠️ キャッシュ読み込み失敗: {e}")
    return {}


def save_volume_cache(data: Dict):
    """出来高データをキャッシュに保存"""
    try:
        with open(CACHE_PATH, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"⚠️ キャッシュ保存失敗: {e}")


def get_all_tickers() -> List[Dict]:
    """Bitget API で全USDT建て銘柄のティッカー情報を取得"""
    url = f"{BITGET_API_BASE}/api/v2/spot/market/tickers"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('code') != '00000':
            raise Exception(f"API Error: {data.get('msg', 'Unknown error')}")
        
        tickers = data.get('data', [])
        # USDT建て銘柄のみ
        usdt_tickers = [t for t in tickers if t.get('symbol', '').endswith('USDT')]
        print(f"✅ {len(usdt_tickers)} USDT建て銘柄を取得")
        return usdt_tickers
    
    except requests.exceptions.RequestException as e:
        print(f"❌ API接続エラー: {e}")
        return []
    except Exception as e:
        print(f"❌ データ取得エラー: {e}")
        return []


def calculate_volume_change(symbol: str, current_volume: float, cache: Dict) -> float:
    """出来高変動率を計算（キャッシュ比較）"""
    if symbol not in cache:
        return 0.0  # 初回は変動率不明
    
    prev_volume = cache[symbol].get('volume', 0)
    if prev_volume == 0:
        return 0.0
    
    return current_volume / prev_volume


def screen_symbols(tickers: List[Dict], cache: Dict) -> List[Dict]:
    """銘柄スクリーニング"""
    candidates = []
    
    for ticker in tickers:
        try:
            symbol = ticker.get('symbol', '')
            price = float(ticker.get('lastPr', 0))
            volume_24h = float(ticker.get('quoteVolume', 0))  # USDT建て出来高
            
            # 価格フィルター
            if not (PRICE_MIN <= price <= PRICE_MAX):
                continue
            
            # 出来高フィルター（流動性）
            if volume_24h < VOLUME_USD_MIN:
                continue
            
            # 出来高変動率計算
            volume_change_ratio = calculate_volume_change(symbol, volume_24h, cache)
            
            # 初回実行時は変動率チェックをスキップ
            if volume_change_ratio > 0 and not (VOLUME_CHANGE_MIN <= volume_change_ratio <= VOLUME_CHANGE_MAX):
                continue
            
            candidates.append({
                'symbol': symbol,
                'price': price,
                'volume_24h': volume_24h,
                'volume_change': volume_change_ratio,
                'change_24h': float(ticker.get('change24h', 0)),
                'score': volume_24h * volume_change_ratio  # スコアリング
            })
        
        except (ValueError, TypeError) as e:
            continue
    
    # スコア順にソート（出来高 × 変動率）
    candidates.sort(key=lambda x: x['score'], reverse=True)
    return candidates[:MAX_SYMBOLS]


def update_config(symbols: List[str]):
    """bitget-trading-v3.json の symbols を更新"""
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
        
        old_symbols = config.get('symbols', [])
        config['symbols'] = symbols
        config['last_symbol_update'] = datetime.utcnow().isoformat() + 'Z'
        
        with open(CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print(f"✅ 設定ファイル更新完了: {len(symbols)}銘柄")
        print(f"   変更: {set(old_symbols) ^ set(symbols)}")
        return True
    
    except Exception as e:
        print(f"❌ 設定ファイル更新失敗: {e}")
        return False


def main():
    print("=" * 60)
    print("🔍 Bitget 動的銘柄スクリーニング開始")
    print(f"⏰ {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 60)
    
    # 前回の出来高データを読み込み
    cache = load_volume_cache()
    print(f"📊 キャッシュ銘柄数: {len(cache)}")
    
    # 全銘柄取得
    tickers = get_all_tickers()
    if not tickers:
        print("❌ 銘柄データ取得失敗。終了します。")
        return
    
    # スクリーニング実行
    print("\n🎯 スクリーニング条件:")
    print(f"   価格: ${PRICE_MIN} 〜 ${PRICE_MAX}")
    print(f"   出来高変動率: {VOLUME_CHANGE_MIN}x 〜 {VOLUME_CHANGE_MAX}x")
    print(f"   24h取引量: > ${VOLUME_USD_MIN:,}")
    
    selected = screen_symbols(tickers, cache)
    
    if not selected:
        print("\n⚠️ 条件に合う銘柄が見つかりませんでした。")
        print("   既存の銘柄リストを維持します。")
        # キャッシュだけ更新
        new_cache = {t['symbol']: {'volume': float(t.get('quoteVolume', 0))} for t in tickers}
        save_volume_cache(new_cache)
        return
    
    print(f"\n✅ {len(selected)}銘柄を選定:")
    print(f"{'順位':<4} {'銘柄':<12} {'価格':<10} {'24h出来高':<15} {'変動率':<10} {'24h変動%':<10}")
    print("-" * 70)
    
    for i, s in enumerate(selected, 1):
        vol_change_str = f"{s['volume_change']:.2f}x" if s['volume_change'] > 0 else "初回"
        print(f"{i:<4} {s['symbol']:<12} ${s['price']:<9.4f} ${s['volume_24h']:>13,.0f} {vol_change_str:<10} {s['change_24h']:>8.2f}%")
    
    # 設定ファイル更新
    symbols = [s['symbol'] for s in selected]
    if update_config(symbols):
        print("\n🎉 動的スクリーニング完了！")
    
    # 新しい出来高データをキャッシュ
    new_cache = {t['symbol']: {'volume': float(t.get('quoteVolume', 0))} for t in tickers}
    save_volume_cache(new_cache)
    print(f"💾 出来高キャッシュ更新: {len(new_cache)}銘柄")


if __name__ == "__main__":
    main()
