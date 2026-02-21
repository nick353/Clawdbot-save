#!/usr/bin/env python3
"""
スクリーニング結果を自動的にトレーダー設定に反映
上位15銘柄を抽出して設定ファイルを更新
"""

import json
import subprocess
from datetime import datetime

SCREENER_RESULTS = "/root/clawd/data/screener-results.json"
CONFIG_FILE = "/root/clawd/config/bitget-trading-v3.json"
TOP_N = 15  # 上位15銘柄を選択

def apply_screening():
    """スクリーニング結果を設定に反映"""
    
    print("📊 スクリーニング結果を読み込み中...")
    
    # スクリーニング結果読み込み
    try:
        with open(SCREENER_RESULTS, 'r') as f:
            screener_data = json.load(f)
    except FileNotFoundError:
        print("❌ スクリーニング結果が見つかりません")
        print("   先に daily-screening.sh を実行してください")
        return False
    
    results = screener_data.get('results', [])
    
    if not results:
        print("❌ スクリーニング結果が空です")
        return False
    
    print(f"✅ {len(results)}銘柄のスクリーニング結果を読み込みました")
    print(f"📅 スクリーニング実行日時: {screener_data.get('timestamp')}")
    
    # 上位N銘柄を抽出
    print(f"\n🔍 上位{TOP_N}銘柄を抽出中...")
    
    # 結果は既にスコア順でソートされている
    selected_symbols = [r['symbol'] for r in results[:TOP_N]]
    
    print(f"✅ {len(selected_symbols)}銘柄を選定しました")
    print()
    
    # 選定された銘柄を表示
    for i, r in enumerate(results[:TOP_N], 1):
        symbol = r['symbol']
        score = r['score']
        total_change = r.get('total_change', 0)
        sign = "+" if total_change >= 0 else ""
        print(f"  {i:2d}. {symbol:12s} スコア:{score:3.0f} 7日間変動:{sign}{total_change:6.2f}%")
    
    # 設定ファイル読み込み
    print(f"\n📝 設定ファイルを読み込み中: {CONFIG_FILE}")
    
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
    
    # 銘柄リストを更新
    old_symbols = config.get('symbols', [])
    config['symbols'] = selected_symbols
    
    # max_monitored_symbolsも更新
    config['max_monitored_symbols'] = TOP_N
    
    # 設定ファイルに書き込み
    print(f"\n💾 設定ファイルを更新中...")
    
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print(f"✅ 設定ファイルを更新しました")
    
    # 変更サマリー
    print(f"\n📊 銘柄リスト変更:")
    print(f"   更新前: {len(old_symbols)}銘柄")
    print(f"   更新後: {len(selected_symbols)}銘柄")
    
    # 追加された銘柄
    added = set(selected_symbols) - set(old_symbols)
    if added:
        print(f"\n   ➕ 追加: {', '.join(sorted(added))}")
    
    # 削除された銘柄
    removed = set(old_symbols) - set(selected_symbols)
    if removed:
        print(f"   ➖ 削除: {', '.join(sorted(removed))}")
    
    # 変更なし
    if not added and not removed:
        print(f"   ℹ️  変更なし（同じ銘柄リスト）")
    
    return True

def restart_trader():
    """トレーダーを再起動"""
    
    print(f"\n🔄 トレーダーを再起動中...")
    
    try:
        # V3トレーダー再起動
        result = subprocess.run(
            ["sudo", "systemctl", "restart", "bitget-trader-v3.service"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(f"✅ bitget-trader-v3.service を再起動しました")
        else:
            print(f"⚠️  再起動エラー: {result.stderr}")
            return False
        
        # V2トレーダー再起動（念のため）
        subprocess.run(
            ["sudo", "systemctl", "restart", "bitget-trader.service"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"✅ トレーダー再起動完了")
        
        return True
        
    except Exception as e:
        print(f"❌ 再起動エラー: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("🤖 スクリーニング結果を自動反映")
    print(f"📅 実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # 設定更新
    if apply_screening():
        print()
        print("=" * 60)
        
        # 再起動
        restart_trader()
        
        print()
        print("=" * 60)
        print("✅ スクリーニング結果の反映完了")
        print(f"🎯 {TOP_N}銘柄で自動トレード開始")
        print("=" * 60)
    else:
        print()
        print("=" * 60)
        print("⚠️  スクリーニング結果の反映をスキップしました")
        print("=" * 60)
