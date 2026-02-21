#!/usr/bin/env python3
"""
時間足別バックテスト結果比較
"""

import json
import glob
from typing import Dict, List

def load_results(timeframe: str) -> Dict:
    """
    時間足別の結果を読み込み
    """
    try:
        with open(f"/root/clawd/data/backtest-advanced-{timeframe}.json", 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def compare_timeframes():
    """
    全時間足の結果を比較
    """
    timeframes = ["5m", "15m", "1H", "4H"]
    
    print(f"\n{'='*120}")
    print(f"📊 時間足別バックテスト結果比較")
    print(f"{'='*120}\n")
    
    # ヘッダー
    print(f"{'時間足':<8} {'銘柄数':<8} {'トレード数':<12} {'勝率':<10} {'総PnL':<15} {'最優秀銘柄':<15}")
    print(f"{'-'*120}")
    
    best_timeframe = None
    best_pnl = -float('inf')
    
    for tf in timeframes:
        data = load_results(tf)
        
        if data is None:
            print(f"{tf:<8} {'結果なし':<100}")
            continue
        
        results = data.get('results', [])
        traded = [r for r in results if r.get('trades', 0) > 0]
        
        if not traded:
            print(f"{tf:<8} {'トレードなし':<100}")
            continue
        
        # 統計計算
        total_trades = sum(r['trades'] for r in traded)
        total_wins = sum(r['win_trades'] for r in traded)
        total_losses = sum(r['loss_trades'] for r in traded)
        overall_win_rate = total_wins / (total_wins + total_losses) * 100 if (total_wins + total_losses) > 0 else 0
        total_pnl = sum(r['total_pnl'] for r in traded)
        
        # 最優秀銘柄
        best_symbol = max(traded, key=lambda x: x['total_pnl'])
        best_symbol_name = best_symbol['symbol']
        best_symbol_pnl = best_symbol['total_pnl']
        
        # 表示
        print(f"{tf:<8} {len(traded):<8} {total_trades:<12} {overall_win_rate:>6.1f}%   ${total_pnl:>12,.2f}  {best_symbol_name} (${best_symbol_pnl:,.2f})")
        
        # 最優秀時間足判定
        if total_pnl > best_pnl:
            best_pnl = total_pnl
            best_timeframe = tf
    
    print(f"{'-'*120}\n")
    
    if best_timeframe:
        print(f"🏆 最優秀時間足: **{best_timeframe}** (総PnL: ${best_pnl:,.2f})")
        print(f"\n💡 推奨: {best_timeframe}で本番運用を検討してくださいっぴ！\n")
        
        # 詳細表示
        print(f"\n{'='*120}")
        print(f"🔍 {best_timeframe} の詳細")
        print(f"{'='*120}\n")
        
        data = load_results(best_timeframe)
        results = data.get('results', [])
        traded = [r for r in results if r.get('trades', 0) > 0]
        traded.sort(key=lambda x: x['total_pnl'], reverse=True)
        
        print(f"{'順位':<6} {'銘柄':<12} {'トレード':<10} {'勝率':<10} {'総PnL':<15}")
        print(f"{'-'*120}")
        
        for i, r in enumerate(traded[:10], 1):
            print(f"{i:<6} {r['symbol']:<12} {r['trades']:<10} {r['win_rate']:>6.1f}%    ${r['total_pnl']:>12,.2f} ({r['total_pnl_pct']:+.2f}%)")
        
        print()

if __name__ == "__main__":
    compare_timeframes()
