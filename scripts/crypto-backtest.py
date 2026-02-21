#!/usr/bin/env python3
"""
仮想通貨トレード戦略バックテスト
andoさんの戦略: SMA/EMA 200反発 + 前日比±10% + MACDダイバージェンス利確
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
import pandas_ta as ta
from datetime import datetime, timedelta

class SMAEMABounceStrategy(Strategy):
    """
    エントリー条件:
    1. 前日比±10%以上のボラティリティ
    2. 価格がSMA200/EMA200に接近して反発
    3. (オプション) SMA200とEMA200が重なっている
    
    エグジット条件:
    1. MACDダイバージェンス発生
    2. ストップロス（-5%）
    """
    
    # パラメータ
    sma_period = 200
    ema_period = 200
    volatility_threshold = 10.0  # 前日比±10%
    proximity_pct = 2.0  # SMA/EMAへの接近判定（±2%）
    overlap_pct = 1.0    # SMA/EMAの重なり判定（±1%）
    stop_loss_pct = 5.0  # ストップロス -5%
    
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
    
    def next(self):
        """各バーでの処理"""
        # データ不足時はスキップ
        if len(self.data) < self.sma_period + 10:
            return
        
        price = self.data.Close[-1]
        sma = self.sma200[-1]
        ema = self.ema200[-1]
        daily_change = abs(self.daily_change_pct[-1])
        
        # NaNチェック
        if np.isnan(sma) or np.isnan(ema) or np.isnan(daily_change):
            return
        
        # === エントリー条件チェック ===
        if not self.position:
            # 1. 前日比±10%以上のボラティリティ
            volatility_ok = daily_change >= self.volatility_threshold
            
            # 2. SMA/EMAへの接近判定
            proximity_sma = abs((price - sma) / sma * 100) <= self.proximity_pct
            proximity_ema = abs((price - ema) / ema * 100) <= self.proximity_pct
            proximity_ok = proximity_sma or proximity_ema
            
            # 3. (オプション) SMA/EMAの重なり判定
            overlap_ok = abs((sma - ema) / sma * 100) <= self.overlap_pct
            
            # 4. 反発確認（価格がSMA/EMAより上）
            bounce_ok = price > sma and price > ema
            
            # エントリー判定
            if volatility_ok and proximity_ok and bounce_ok:
                # オプション条件で確率UP（記録用にメモ）
                confidence = "high" if overlap_ok else "medium"
                self.buy(size=0.1)  # 資金の10%
        
        # === エグジット条件チェック ===
        elif self.position:
            # ストップロス（-5%）
            entry_price = self.position.entry_price
            if price <= entry_price * (1 - self.stop_loss_pct / 100):
                self.position.close()
                return
            
            # MACDダイバージェンス検出（簡易版）
            # 価格は上昇しているがMACDヒストグラムは減少
            if len(self.data) >= 5:
                price_rising = price > self.data.Close[-5]
                macd_falling = self.macd_hist[-1] < self.macd_hist[-5]
                
                if price_rising and macd_falling:
                    # 弱気ダイバージェンス検出 → 利確
                    self.position.close()

def run_backtest(symbol="BTC-USD", days=365):
    """
    バックテスト実行
    
    Args:
        symbol: 取引ペア（例: BTC-USD, ETH-USD）
        days: テスト期間（日数）
    """
    print(f"\n{'='*80}")
    print(f"🚀 バックテスト開始: {symbol}")
    print(f"📅 期間: 直近 {days}日")
    print(f"{'='*80}\n")
    
    # データ取得
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    print(f"📊 データ取得中... ({start_date.date()} ~ {end_date.date()})")
    data = yf.download(symbol, start=start_date, end=end_date, interval='1d', progress=False)
    
    if data.empty:
        print(f"❌ データ取得失敗: {symbol}")
        return None
    
    # カラム名を統一（MultiIndex対策）
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
    
    print(f"✅ データ取得完了: {len(data)}行\n")
    
    # バックテスト実行
    bt = Backtest(
        data,
        SMAEMABounceStrategy,
        cash=10000,  # 初期資金 $10,000
        commission=0.002,  # 手数料 0.2%
        exclusive_orders=True
    )
    
    print("🔄 バックテスト実行中...")
    stats = bt.run()
    
    # 結果表示
    print(f"\n{'='*80}")
    print(f"📈 バックテスト結果: {symbol}")
    print(f"{'='*80}\n")
    
    print(f"🏁 最終資産:          ${stats['Equity Final [$]']:,.2f}")
    print(f"📊 リターン:          {stats['Return [%]']:.2f}%")
    print(f"📉 最大ドローダウン:  {stats['Max. Drawdown [%]']:.2f}%")
    print(f"🎯 勝率:              {stats['Win Rate [%]']:.2f}%")
    print(f"🔢 総トレード数:      {stats['# Trades']}")
    print(f"💰 平均トレード:      {stats['Avg. Trade [%]']:.2f}%")
    print(f"⏱️  平均保有期間:      {stats['Avg. Trade Duration']}")
    print(f"📈 シャープレシオ:    {stats['Sharpe Ratio']:.2f}")
    print(f"📊 ソルティーノ比:    {stats['Sortino Ratio']:.2f}")
    
    print(f"\n{'='*80}\n")
    
    # チャート保存
    chart_path = f"/root/clawd/backtest_{symbol.replace('-', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    bt.plot(filename=chart_path, open_browser=False)
    print(f"📊 チャート保存: {chart_path}\n")
    
    return stats

def test_multiple_coins(coins=None, days=365):
    """
    複数の仮想通貨でバックテスト
    
    Args:
        coins: テストする仮想通貨リスト（デフォルト: BTC, ETH, BNB）
        days: テスト期間（日数）
    """
    if coins is None:
        coins = ["BTC-USD", "ETH-USD", "BNB-USD"]
    
    results = {}
    
    for coin in coins:
        try:
            stats = run_backtest(coin, days)
            if stats is not None:
                results[coin] = stats
        except Exception as e:
            print(f"❌ {coin} のバックテストエラー: {e}\n")
    
    # 総合結果
    if results:
        print(f"\n{'='*80}")
        print(f"📊 総合結果サマリー")
        print(f"{'='*80}\n")
        
        for coin, stats in results.items():
            print(f"{coin:12} | リターン: {stats['Return [%]']:7.2f}% | 勝率: {stats['Win Rate [%]']:5.2f}% | トレード数: {stats['# Trades']:3}")
    
    return results

if __name__ == "__main__":
    # 仮想通貨でバックテスト（直近1年）
    print("\n🐥 andoさんのトレード戦略バックテスト\n")
    
    # メジャーな仮想通貨でテスト
    coins = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "ADA-USD"]
    
    results = test_multiple_coins(coins, days=365)
    
    print("\n✅ バックテスト完了っぴ！\n")
