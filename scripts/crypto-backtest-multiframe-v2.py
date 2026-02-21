#!/usr/bin/env python3
"""
仮想通貨トレード戦略バックテスト（マルチタイムフレームV2）
エントリー条件: 日足で前日比±10%
エントリータイミング: 短時間足（5分足、1時間足など）
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy
import pandas_ta as ta
from datetime import datetime, timedelta

class SMAEMABounceStrategyMultiV2(Strategy):
    """
    日足フィルター + 短時間足エントリー
    """
    
    # パラメータ
    sma_period = 200
    ema_period = 200
    proximity_pct = 2.0  # SMA/EMAへの接近判定（±2%）
    stop_loss_pct = 5.0  # ストップロス -5%
    
    # 日足の前日比データ（外部から注入）
    daily_volatility = None
    
    def init(self):
        """指標の初期化"""
        close = pd.Series(self.data.Close, index=self.data.index)
        
        # SMA 200とEMA 200
        self.sma200 = self.I(ta.sma, close, length=self.sma_period)
        self.ema200 = self.I(ta.ema, close, length=self.ema_period)
        
        # MACD
        macd = ta.macd(close, fast=12, slow=26, signal=9)
        self.macd = self.I(lambda: macd['MACD_12_26_9'].values)
        self.macd_signal = self.I(lambda: macd['MACDs_12_26_9'].values)
        self.macd_hist = self.I(lambda: macd['MACDh_12_26_9'].values)
    
    def next(self):
        """各バーでの処理"""
        # データ不足時はスキップ
        if len(self.data) < self.sma_period + 10:
            return
        
        price = self.data.Close[-1]
        sma = self.sma200[-1]
        ema = self.ema200[-1]
        
        # NaNチェック
        if np.isnan(sma) or np.isnan(ema):
            return
        
        # 現在の日付
        current_date = self.data.index[-1].date()
        
        # 日足での前日比±10%チェック（外部データから）
        volatility_ok = False
        if self.daily_volatility is not None and current_date in self.daily_volatility:
            daily_change = abs(self.daily_volatility[current_date])
            volatility_ok = daily_change >= 10.0
        
        # === エントリー条件チェック ===
        if not self.position and volatility_ok:
            # 2. SMA/EMAへの接近判定
            proximity_sma = abs((price - sma) / sma * 100) <= self.proximity_pct
            proximity_ema = abs((price - ema) / ema * 100) <= self.proximity_pct
            proximity_ok = proximity_sma or proximity_ema
            
            # 3. 反発確認（価格がSMA/EMAより上）
            bounce_ok = price > sma and price > ema
            
            # エントリー判定
            if proximity_ok and bounce_ok:
                self.buy(size=0.1)  # 資金の10%
        
        # === エグジット条件チェック ===
        elif self.position:
            # ストップロス（-5%）- tradesから最後のエントリー価格を取得
            if self.trades:
                last_trade = self.trades[-1]
                entry_price = last_trade.entry_price
                if price <= entry_price * (1 - self.stop_loss_pct / 100):
                    self.position.close()
                    return
            
            # MACDダイバージェンス検出（簡易版）
            if len(self.data) >= 5:
                price_rising = price > self.data.Close[-5]
                macd_falling = self.macd_hist[-1] < self.macd_hist[-5]
                
                if price_rising and macd_falling:
                    self.position.close()

def get_daily_volatility(symbol, days=365):
    """
    日足の前日比ボラティリティを取得
    
    Returns:
        {date: volatility_pct, ...}
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    try:
        data = yf.download(symbol, start=start_date, end=end_date, interval='1d', progress=False)
        
        if data.empty:
            return {}
        
        # カラム名を統一
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        
        # 前日比を計算
        daily_changes = data['Close'].pct_change() * 100
        
        # {date: volatility} の辞書を作成
        volatility_dict = {}
        for date, change in daily_changes.items():
            volatility_dict[date.date()] = change
        
        return volatility_dict
        
    except Exception as e:
        print(f"⚠️  日足データ取得エラー: {e}")
        return {}

def run_backtest_multiframe_v2(symbol, interval='1h', days=90, cash=100000):
    """
    マルチタイムフレームバックテストV2
    日足フィルター + 短時間足エントリー
    """
    interval_names = {
        '5m': '5分足',
        '15m': '15分足',
        '1h': '1時間足',
        '4h': '4時間足',
        '1d': '日足'
    }
    
    print(f"\n{'='*80}")
    print(f"🚀 バックテスト: {symbol} ({interval_names.get(interval, interval)})")
    print(f"📅 期間: 直近 {days}日")
    print(f"💰 初期資金: ${cash:,}")
    print(f"📊 フィルター: 日足で前日比±10%")
    print(f"{'='*80}\n")
    
    # 1. 日足の前日比データを取得
    print(f"📊 日足データ取得中（前日比±10%判定用）...")
    daily_volatility = get_daily_volatility(symbol, days=days)
    
    if not daily_volatility:
        print(f"❌ 日足データが取得できませんでした")
        return None
    
    # ±10%以上の日数をカウント
    high_vol_days = sum(1 for v in daily_volatility.values() if abs(v) >= 10.0)
    print(f"✅ 日足データ取得完了: 前日比±10%以上の日数 = {high_vol_days}日\n")
    
    # 2. 短時間足データを取得
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    print(f"📊 {interval_names.get(interval, interval)}データ取得中...")
    try:
        data = yf.download(symbol, start=start_date, end=end_date, interval=interval, progress=False)
    except Exception as e:
        print(f"❌ データ取得エラー: {e}")
        return None
    
    if data.empty:
        print(f"❌ データが空です")
        return None
    
    # カラム名を統一
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
    
    print(f"✅ データ取得完了: {len(data)}バー\n")
    
    # 3. バックテスト実行
    try:
        bt = Backtest(
            data,
            SMAEMABounceStrategyMultiV2,
            cash=cash,
            commission=0.002,
            exclusive_orders=True
        )
        
        # 日足ボラティリティデータを戦略に注入
        SMAEMABounceStrategyMultiV2.daily_volatility = daily_volatility
        
        print("🔄 バックテスト実行中...")
        stats = bt.run()
        
        # 結果表示
        print(f"\n{'='*80}")
        print(f"📈 バックテスト結果: {symbol} ({interval_names.get(interval, interval)})")
        print(f"{'='*80}\n")
        
        print(f"🏁 最終資産:          ${stats['Equity Final [$]']:,.2f}")
        print(f"📊 リターン:          {stats['Return [%]']:.2f}%")
        print(f"📉 最大ドローダウン:  {stats['Max. Drawdown [%]']:.2f}%")
        print(f"🎯 勝率:              {stats['Win Rate [%]']:.2f}%")
        print(f"🔢 総トレード数:      {stats['# Trades']}")
        
        if stats['# Trades'] > 0:
            print(f"💰 平均トレード:      {stats['Avg. Trade [%]']:.2f}%")
            print(f"⏱️  平均保有期間:      {stats['Avg. Trade Duration']}")
            print(f"📈 シャープレシオ:    {stats['Sharpe Ratio']:.2f}")
            print(f"📊 ソルティーノ比:    {stats['Sortino Ratio']:.2f}")
        
        print(f"\n{'='*80}\n")
        
        return stats
        
    except Exception as e:
        print(f"❌ バックテストエラー: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_multiframe_strategy_v2(coins_file="/root/clawd/high_volatility_coins_7days.txt"):
    """
    高ボラティリティ銘柄を複数の時間足でテスト（V2）
    """
    # 銘柄リスト読み込み
    try:
        with open(coins_file, 'r') as f:
            coins = [line.strip() for line in f if line.strip()]
    except Exception as e:
        print(f"❌ 銘柄リスト読み込みエラー: {e}")
        return
    
    print(f"\n🐥 andoさんのマルチタイムフレームバックテストV2\n")
    print(f"📋 対象銘柄: {len(coins)}銘柄")
    print(f"⏰ テスト時間足: 5分足、1時間足、4時間足、日足")
    print(f"📊 エントリー条件: 日足で前日比±10%\n")
    
    # テスト設定
    test_configs = [
        {'interval': '5m', 'days': 30, 'name': '5分足'},
        {'interval': '1h', 'days': 90, 'name': '1時間足'},
        {'interval': '4h', 'days': 180, 'name': '4時間足'},
        {'interval': '1d', 'days': 365, 'name': '日足'},
    ]
    
    results = {}
    
    # トップ10銘柄でテスト
    test_coins = coins[:10]
    
    for config in test_configs:
        interval = config['interval']
        days = config['days']
        name = config['name']
        
        print(f"\n{'='*80}")
        print(f"⏰ {name}でバックテスト開始")
        print(f"{'='*80}\n")
        
        results[interval] = {}
        
        for coin in test_coins:
            stats = run_backtest_multiframe_v2(coin, interval=interval, days=days, cash=100000)
            if stats is not None:
                results[interval][coin] = stats
    
    # 総合結果サマリー
    print(f"\n{'='*80}")
    print(f"📊 総合結果サマリー（時間足別）")
    print(f"{'='*80}\n")
    
    for config in test_configs:
        interval = config['interval']
        name = config['name']
        
        if interval in results and results[interval]:
            print(f"\n【{name}】")
            print(f"{'銘柄':12} | {'リターン':>8} | {'勝率':>6} | {'トレード数':>10} | {'シャープ':>8}")
            print(f"{'-'*80}")
            
            for coin, stats in results[interval].items():
                symbol = coin.replace('-USD', '')
                ret = stats['Return [%]']
                win_rate = stats['Win Rate [%]']
                trades = stats['# Trades']
                sharpe = stats['Sharpe Ratio']
                
                print(f"{symbol:12} | {ret:7.2f}% | {win_rate:5.2f}% | {trades:10} | {sharpe:8.2f}")
    
    print(f"\n{'='*80}\n")
    print(f"✅ マルチタイムフレームバックテストV2完了っぴ！\n")

if __name__ == "__main__":
    test_multiframe_strategy_v2()
