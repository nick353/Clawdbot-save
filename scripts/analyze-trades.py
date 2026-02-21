#!/usr/bin/env python3
"""
トレード記録分析ツール
"""

import csv
import pandas as pd
from datetime import datetime
from typing import Dict, List

class TradeAnalyzer:
    """
    トレード分析
    """
    
    def __init__(self, log_path: str = "/root/clawd/data/trade-log.csv"):
        self.log_path = log_path
        self.df = None
        self.load_data()
    
    def load_data(self):
        """トレード記録読み込み"""
        try:
            self.df = pd.read_csv(self.log_path)
            print(f"✅ トレード記録読み込み: {len(self.df)} 件")
        except FileNotFoundError:
            print(f"⚠️  トレード記録が見つかりません: {self.log_path}")
            self.df = pd.DataFrame()
    
    def summary(self):
        """総合サマリー"""
        if self.df.empty:
            print(f"\n⚠️  トレード記録なし\n")
            return
        
        print(f"\n{'='*80}")
        print(f"📊 トレード分析レポート")
        print(f"{'='*80}\n")
        
        # 基本統計
        total_trades = len(self.df)
        wins = len(self.df[self.df['Win/Loss'] == 'Win'])
        losses = len(self.df[self.df['Win/Loss'] == 'Loss'])
        win_rate = wins / total_trades * 100 if total_trades > 0 else 0
        
        total_pnl = self.df['PnL ($)'].sum()
        avg_pnl = self.df['PnL ($)'].mean()
        best_trade = self.df['PnL ($)'].max()
        worst_trade = self.df['PnL ($)'].min()
        
        avg_win = self.df[self.df['Win/Loss'] == 'Win']['PnL ($)'].mean() if wins > 0 else 0
        avg_loss = self.df[self.df['Win/Loss'] == 'Loss']['PnL ($)'].mean() if losses > 0 else 0
        
        print(f"🏆 総合成績")
        print(f"   総トレード数: {total_trades}")
        print(f"   勝敗: {wins}勝 {losses}敗")
        print(f"   勝率: {win_rate:.1f}%")
        print(f"   総PnL: ${total_pnl:,.2f}")
        print(f"   平均PnL: ${avg_pnl:.2f}")
        print(f"   最大利益: ${best_trade:.2f}")
        print(f"   最大損失: ${worst_trade:.2f}")
        print(f"   平均勝ちトレード: ${avg_win:.2f}")
        print(f"   平均負けトレード: ${avg_loss:.2f}")
        print()
        
        # 銘柄別成績
        print(f"📈 銘柄別成績")
        symbol_stats = self.df.groupby('Symbol').agg({
            'PnL ($)': ['count', 'sum', 'mean'],
            'Win/Loss': lambda x: (x == 'Win').sum() / len(x) * 100
        }).round(2)
        
        symbol_stats.columns = ['トレード数', '総PnL', '平均PnL', '勝率']
        symbol_stats = symbol_stats.sort_values('総PnL', ascending=False)
        
        print(symbol_stats.to_string())
        print()
        
        # エグジット理由別
        print(f"🔚 エグジット理由別")
        exit_reasons = self.df['Exit Reason'].value_counts()
        for reason, count in exit_reasons.items():
            pnl = self.df[self.df['Exit Reason'] == reason]['PnL ($)'].sum()
            print(f"   {reason}: {count}回 (総PnL: ${pnl:,.2f})")
        print()
        
        # トレイリングストップ効果
        trailing_trades = len(self.df[self.df['Trailing Stop Used'] == 'Yes'])
        if trailing_trades > 0:
            trailing_pnl = self.df[self.df['Trailing Stop Used'] == 'Yes']['PnL ($)'].sum()
            trailing_avg = self.df[self.df['Trailing Stop Used'] == 'Yes']['PnL ($)'].mean()
            
            print(f"📈 トレイリングストップ効果")
            print(f"   使用回数: {trailing_trades}回")
            print(f"   総PnL: ${trailing_pnl:,.2f}")
            print(f"   平均PnL: ${trailing_avg:.2f}")
            print()
        
        # 時間別分析
        if 'Hold Time (min)' in self.df.columns:
            avg_hold = self.df['Hold Time (min)'].astype(float).mean()
            max_hold = self.df['Hold Time (min)'].astype(float).max()
            min_hold = self.df['Hold Time (min)'].astype(float).min()
            
            print(f"⏱️  ポジション保有時間")
            print(f"   平均: {avg_hold:.0f}分")
            print(f"   最長: {max_hold:.0f}分")
            print(f"   最短: {min_hold:.0f}分")
            print()
        
        # 日別成績
        if len(self.df) > 0:
            self.df['Date'] = pd.to_datetime(self.df['Entry Time']).dt.date
            daily_pnl = self.df.groupby('Date')['PnL ($)'].sum()
            
            print(f"📅 日別PnL（直近10日）")
            for date, pnl in daily_pnl.tail(10).items():
                print(f"   {date}: ${pnl:+,.2f}")
            print()
        
        print(f"{'='*80}\n")
    
    def export_excel(self, output_path: str = "/root/clawd/data/trade-analysis.xlsx"):
        """Excel形式でエクスポート（追加機能）"""
        if self.df.empty:
            print(f"⚠️  トレード記録なし")
            return
        
        try:
            # pandasのExcelライター（openpyxl必要）
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                # 全トレード
                self.df.to_excel(writer, sheet_name='All Trades', index=False)
                
                # 銘柄別サマリー
                symbol_stats = self.df.groupby('Symbol').agg({
                    'PnL ($)': ['count', 'sum', 'mean'],
                    'Win/Loss': lambda x: (x == 'Win').sum() / len(x) * 100
                }).round(2)
                symbol_stats.columns = ['トレード数', '総PnL', '平均PnL', '勝率']
                symbol_stats.to_excel(writer, sheet_name='Symbol Summary')
                
                # 日別サマリー
                if 'Date' in self.df.columns or len(self.df) > 0:
                    df_copy = self.df.copy()
                    df_copy['Date'] = pd.to_datetime(df_copy['Entry Time']).dt.date
                    daily = df_copy.groupby('Date').agg({
                        'PnL ($)': ['count', 'sum', 'mean']
                    }).round(2)
                    daily.columns = ['トレード数', '総PnL', '平均PnL']
                    daily.to_excel(writer, sheet_name='Daily Summary')
            
            print(f"✅ Excel出力完了: {output_path}")
        except ImportError:
            print(f"⚠️  openpyxlがインストールされていません")
            print(f"💡 インストール: pip install openpyxl")

if __name__ == "__main__":
    import sys
    
    analyzer = TradeAnalyzer()
    analyzer.summary()
    
    # Excelエクスポート（オプション）
    if len(sys.argv) > 1 and sys.argv[1] == "--excel":
        analyzer.export_excel()
