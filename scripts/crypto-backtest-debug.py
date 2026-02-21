#!/usr/bin/env python3
"""
仮想通貨トレード戦略バックテスト（デバッグモード）
条件の詳細チェック + 初期資金$100,000
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
import pandas_ta as ta
from datetime import datetime, timedelta

class SMAEMABounceStrategyDebug(Strategy):
    """
    デバッグ版: 各条件の成立回数をカウント
    """
    
    # パラメータ
    sma_period = 200
    ema_period = 200
    volatility_threshold = 10.0  # 前日比±10%
    proximity_pct = 2.0  # SMA/EMAへの接近判定（±2%）
    overlap_pct = 1.0    # SMA/EMAの重なり判定（±1%）
    stop_loss_pct = 5.0  # ストップロス -5%
    
    # クラス変数としてデバッグ統計を保存
    debug_stats_storage = {}
    
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
        
        # 前日比（%）
        self.daily_change_pct = self.I(lambda: close.pct_change() * 100)
        
        # インスタンスのデバッグカウンター
        self.debug_stats = {
            'total_bars': 0,
            'volatility_ok': 0,
            'proximity_ok': 0,
            'bounce_ok': 0,
            'overlap_ok': 0,
            'all_conditions_met': 0,
        }
        
        # クラス変数にも保存（バックテスト後にアクセス可能）
        SMAEMABounceStrategyDebug.debug_stats_storage = self.debug_stats
    
    def next(self):
        """各バーでの処理"""
        # データ不足時はスキップ
        if len(self.data) < self.sma_period + 10:
            return
        
        self.debug_stats['total_bars'] += 1
        
        price = self.data.Close[-1]
        sma = self.sma200[-1]
        ema = self.ema200[-1]
        daily_change = abs(self.daily_change_pct[-1])
        
        # NaNチェック
        if np.isnan(sma) or np.isnan(ema) or np.isnan(daily_change):
            return
        
        # === 各条件のチェック ===
        # 1. 前日比±10%以上のボラティリティ
        volatility_ok = daily_change >= self.volatility_threshold
        if volatility_ok:
            self.debug_stats['volatility_ok'] += 1
        
        # 2. SMA/EMAへの接近判定
        proximity_sma = abs((price - sma) / sma * 100) <= self.proximity_pct
        proximity_ema = abs((price - ema) / ema * 100) <= self.proximity_pct
        proximity_ok = proximity_sma or proximity_ema
        if proximity_ok:
            self.debug_stats['proximity_ok'] += 1
        
        # 3. (オプション) SMA/EMAの重なり判定
        overlap_ok = abs((sma - ema) / sma * 100) <= self.overlap_pct
        if overlap_ok:
            self.debug_stats['overlap_ok'] += 1
        
        # 4. 反発確認（価格がSMA/EMAより上）
        bounce_ok = price > sma and price > ema
        if bounce_ok:
            self.debug_stats['bounce_ok'] += 1
        
        # 全条件一致チェック
        if volatility_ok and proximity_ok and bounce_ok:
            self.debug_stats['all_conditions_met'] += 1
        
        # === エントリー条件チェック ===
        if not self.position:
            if volatility_ok and proximity_ok and bounce_ok:
                self.buy(size=0.1)  # 資金の10%
        
        # === エグジット条件チェック ===
        elif self.position:
            # ストップロス（-5%）
            entry_price = self.position.entry_price
            if price <= entry_price * (1 - self.stop_loss_pct / 100):
                self.position.close()
                return
            
            # MACDダイバージェンス検出（簡易版）
            if len(self.data) >= 5:
                price_rising = price > self.data.Close[-5]
                macd_falling = self.macd_hist[-1] < self.macd_hist[-5]
                
                if price_rising and macd_falling:
                    self.position.close()

def run_backtest_debug(symbol="BTC-USD", days=365, cash=100000):
    """
    デバッグ付きバックテスト実行
    """
    print(f"\n{'='*80}")
    print(f"🐛 デバッグモード: {symbol}")
    print(f"📅 期間: 直近 {days}日")
    print(f"💰 初期資金: ${cash:,}")
    print(f"{'='*80}\n")
    
    # データ取得
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    print(f"📊 データ取得中... ({start_date.date()} ~ {end_date.date()})")
    data = yf.download(symbol, start=start_date, end=end_date, interval='1d', progress=False)
    
    if data.empty:
        print(f"❌ データ取得失敗: {symbol}")
        return None
    
    # カラム名を統一
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
    
    print(f"✅ データ取得完了: {len(data)}行\n")
    
    # バックテスト実行
    bt = Backtest(
        data,
        SMAEMABounceStrategyDebug,
        cash=cash,
        commission=0.002,
        exclusive_orders=True
    )
    
    print("🔄 バックテスト実行中...")
    stats = bt.run()
    
    # デバッグ情報取得（クラス変数から）
    debug_stats = SMAEMABounceStrategyDebug.debug_stats_storage
    
    # 結果表示
    print(f"\n{'='*80}")
    print(f"🐛 条件チェック詳細: {symbol}")
    print(f"{'='*80}\n")
    
    total = debug_stats['total_bars']
    print(f"📊 総バー数:                 {total}")
    print(f"💨 前日比±10%達成:           {debug_stats['volatility_ok']:4} ({debug_stats['volatility_ok']/total*100:5.2f}%)")
    print(f"🎯 SMA/EMA接近±2%:           {debug_stats['proximity_ok']:4} ({debug_stats['proximity_ok']/total*100:5.2f}%)")
    print(f"📈 反発（価格>SMA/EMA）:     {debug_stats['bounce_ok']:4} ({debug_stats['bounce_ok']/total*100:5.2f}%)")
    print(f"🔗 SMA/EMA重なり±1%:         {debug_stats['overlap_ok']:4} ({debug_stats['overlap_ok']/total*100:5.2f}%)")
    print(f"✅ 全条件一致:               {debug_stats['all_conditions_met']:4} ({debug_stats['all_conditions_met']/total*100:5.2f}%)")
    
    print(f"\n{'='*80}")
    print(f"📈 バックテスト結果: {symbol}")
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
    
    # チャート保存
    chart_path = f"/root/clawd/backtest_debug_{symbol.replace('-', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    bt.plot(filename=chart_path, open_browser=False)
    print(f"📊 チャート保存: {chart_path}\n")
    
    return stats, debug_stats

def test_multiple_coins_debug(coins=None, days=365, cash=100000):
    """
    複数の仮想通貨でデバッグバックテスト
    """
    if coins is None:
        coins = ["BTC-USD", "ETH-USD", "BNB-USD"]
    
    results = {}
    
    for coin in coins:
        try:
            stats, debug_stats = run_backtest_debug(coin, days, cash)
            if stats is not None:
                results[coin] = {
                    'stats': stats,
                    'debug': debug_stats
                }
        except Exception as e:
            print(f"❌ {coin} のバックテストエラー: {e}\n")
            import traceback
            traceback.print_exc()
    
    # 総合結果
    if results:
        print(f"\n{'='*80}")
        print(f"📊 総合結果サマリー")
        print(f"{'='*80}\n")
        
        print(f"{'銘柄':12} | {'リターン':>8} | {'勝率':>6} | {'トレード数':>10} | {'全条件一致':>10}")
        print(f"{'-'*80}")
        
        for coin, data in results.items():
            stats = data['stats']
            debug = data['debug']
            print(f"{coin:12} | {stats['Return [%]']:7.2f}% | {stats['Win Rate [%]']:5.2f}% | {stats['# Trades']:10} | {debug['all_conditions_met']:10}")
    
    return results

if __name__ == "__main__":
    print("\n🐥 andoさんのトレード戦略バックテスト（デバッグ版）\n")
    print("💰 初期資金: $100,000")
    print("🐛 デバッグモード: 各条件の成立回数をカウント\n")
    
    # メジャーな仮想通貨でテスト
    coins = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "ADA-USD"]
    
    results = test_multiple_coins_debug(coins, days=365, cash=100000)
    
    print("\n✅ デバッグバックテスト完了っぴ！\n")
