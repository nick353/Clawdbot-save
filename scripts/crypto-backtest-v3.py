#!/usr/bin/env python3
"""
仮想通貨バックテスト（200 SMA/EMA重なり版 v3）
平均足スムーズド + 200 SMA/EMA重なり + レンジフィルター
"""

import ccxt
import pandas as pd
import numpy as np
from ta.trend import SMAIndicator, EMAIndicator, MACD
from ta.volatility import AverageTrueRange
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
import json

class HeikinAshiSmoothed:
    """平均足スムーズド計算"""
    
    def __init__(self, df, period1=6, period2=2):
        self.df = df.copy()
        self.period1 = period1
        self.period2 = period2
        
    def calculate(self):
        """2段階スムーズド移動平均を適用した平均足"""
        df = self.df
        
        # 通常の平均足を計算
        ha_close = (df['open'] + df['high'] + df['low'] + df['close']) / 4
        ha_open = pd.Series(index=df.index, dtype=float)
        ha_open.iloc[0] = (df['open'].iloc[0] + df['close'].iloc[0]) / 2
        
        for i in range(1, len(df)):
            ha_open.iloc[i] = (ha_open.iloc[i-1] + ha_close.iloc[i-1]) / 2
        
        ha_high = pd.concat([df['high'], ha_open, ha_close], axis=1).max(axis=1)
        ha_low = pd.concat([df['low'], ha_open, ha_close], axis=1).min(axis=1)
        
        # 1段階目: SMMA(6)
        ha_close_smooth1 = ha_close.ewm(alpha=1/self.period1, adjust=False).mean()
        ha_open_smooth1 = ha_open.ewm(alpha=1/self.period1, adjust=False).mean()
        ha_high_smooth1 = ha_high.ewm(alpha=1/self.period1, adjust=False).mean()
        ha_low_smooth1 = ha_low.ewm(alpha=1/self.period1, adjust=False).mean()
        
        # 2段階目: SMMA(2)
        ha_close_smooth2 = ha_close_smooth1.ewm(alpha=1/self.period2, adjust=False).mean()
        ha_open_smooth2 = ha_open_smooth1.ewm(alpha=1/self.period2, adjust=False).mean()
        ha_high_smooth2 = ha_high_smooth1.ewm(alpha=1/self.period2, adjust=False).mean()
        ha_low_smooth2 = ha_low_smooth1.ewm(alpha=1/self.period2, adjust=False).mean()
        
        return pd.DataFrame({
            'ha_open': ha_open_smooth2,
            'ha_high': ha_high_smooth2,
            'ha_low': ha_low_smooth2,
            'ha_close': ha_close_smooth2
        })

def detect_abnormal_candle(ha_df, lookback=20, threshold=1.5):
    """異常値（長い実体/ヒゲ）を検出"""
    
    # 実体のサイズ
    body = abs(ha_df['ha_close'] - ha_df['ha_open'])
    
    # 上ヒゲのサイズ
    upper_wick = ha_df['ha_high'] - ha_df[['ha_open', 'ha_close']].max(axis=1)
    
    # 下ヒゲのサイズ
    lower_wick = ha_df[['ha_open', 'ha_close']].min(axis=1) - ha_df['ha_low']
    
    # 過去N本の平均と比較
    body_avg = body.rolling(lookback).mean()
    upper_wick_avg = upper_wick.rolling(lookback).mean()
    lower_wick_avg = lower_wick.rolling(lookback).mean()
    
    # 異常値判定（平均の1.5倍以上）
    long_body = body > (body_avg * threshold)
    long_upper_wick = upper_wick > (upper_wick_avg * threshold)
    long_lower_wick = lower_wick > (lower_wick_avg * threshold)
    
    # 大陽線/大陰線の判定
    bullish_candle = ha_df['ha_close'] > ha_df['ha_open']
    bearish_candle = ha_df['ha_close'] < ha_df['ha_open']
    
    result = pd.DataFrame({
        'long_upper_wick': long_upper_wick,
        'long_lower_wick': long_lower_wick,
        'long_bullish_body': long_body & bullish_candle,
        'long_bearish_body': long_body & bearish_candle
    })
    
    return result

def detect_divergence(prices, macd_values, lookback=5):
    """ダイバージェンス検出"""
    
    if len(prices) < lookback + 1:
        return None
    
    # 価格のトレンド
    price_trend = prices.iloc[-1] - prices.iloc[-lookback]
    
    # MACDのトレンド
    macd_trend = macd_values.iloc[-1] - macd_values.iloc[-lookback]
    
    # 強気ダイバージェンス（価格↓、MACD↑）
    if price_trend < 0 and macd_trend > 0:
        return 'bullish'
    
    # 弱気ダイバージェンス（価格↑、MACD↓）
    elif price_trend > 0 and macd_trend < 0:
        return 'bearish'
    
    return None

def is_ranging(df, i, atr, lookback=20, threshold=0.5):
    """レンジ相場（横横）を検出"""
    
    if i < lookback + 14:  # ATR計算に必要
        return False
    
    # 直近N本の高値/安値の範囲
    recent_high = df['high'].iloc[i-lookback:i].max()
    recent_low = df['low'].iloc[i-lookback:i].min()
    range_size = recent_high - recent_low
    
    # ATRとの比較
    current_atr = atr.iloc[i]
    
    if pd.isna(current_atr) or current_atr == 0:
        return False
    
    # レンジサイズがATRの閾値以下ならレンジ相場
    range_ratio = range_size / (current_atr * lookback)
    
    return range_ratio < threshold

def check_sma_ema_overlap(sma_200, ema_200, current_price, i, overlap_threshold_pct=3.0, price_threshold_pct=5.0):
    """200 SMA と 200 EMA が重なっているかチェック（緩い条件）"""
    
    sma_val = sma_200.iloc[i]
    ema_val = ema_200.iloc[i]
    
    # NaNチェック
    if pd.isna(sma_val) or pd.isna(ema_val):
        return False, None
    
    # SMA と EMA の差（パーセント）
    diff_pct = abs(sma_val - ema_val) / sma_val * 100
    
    # 閾値以内なら「重なっている」と判定
    if diff_pct > overlap_threshold_pct:
        return False, None
    
    # 価格が SMA/EMA の近く（5%以内）にいるか
    avg_ma = (sma_val + ema_val) / 2
    price_diff_pct = abs(current_price - avg_ma) / avg_ma * 100
    
    if price_diff_pct > price_threshold_pct:
        return False, None
    
    # 上から接触 or 下から接触
    if current_price > avg_ma:
        return True, 'short'
    else:
        return True, 'long'

def check_entry_conditions(df, i, ha_df, abnormal, sma_200, ema_200, macd_line, atr, divergence_lookback=5):
    """エントリー条件チェック（緩い条件 + レンジフィルター）"""
    
    if i < divergence_lookback + 20:  # 十分なデータがない
        return None
    
    current_price = df['close'].iloc[i]
    
    # レンジ相場フィルター（横横は避ける）
    if is_ranging(df, i, atr, lookback=20, threshold=0.5):
        return None
    
    # 200 SMA と 200 EMA が重なっているかチェック
    is_overlapping, direction = check_sma_ema_overlap(sma_200, ema_200, current_price, i, 
                                                       overlap_threshold_pct=3.0, 
                                                       price_threshold_pct=5.0)
    
    if not is_overlapping:
        return None
    
    # 異常値（長いヒゲ/実体）チェック
    has_signal = False
    
    if direction == 'short':
        has_signal = abnormal['long_upper_wick'].iloc[i] or abnormal['long_bullish_body'].iloc[i]
    else:  # long
        has_signal = abnormal['long_lower_wick'].iloc[i] or abnormal['long_bearish_body'].iloc[i]
    
    if not has_signal:
        return None
    
    # ダイバージェンス検出（あれば加点、なくてもOK）
    divergence = detect_divergence(
        df['close'].iloc[i-divergence_lookback:i+1],
        macd_line.iloc[i-divergence_lookback:i+1],
        lookback=divergence_lookback
    )
    
    # エントリー
    if direction == 'short':
        stop_loss = ha_df['ha_high'].iloc[i] * 1.01
        take_profit = current_price - (stop_loss - current_price) * 1.5
        
        return {
            'action': 'short',
            'price': current_price,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'divergence': divergence if divergence == 'bearish' else None
        }
    
    else:  # long
        stop_loss = ha_df['ha_low'].iloc[i] * 0.99
        take_profit = current_price + (current_price - stop_loss) * 1.5
        
        return {
            'action': 'long',
            'price': current_price,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'divergence': divergence if divergence == 'bullish' else None
        }

def check_exit_conditions(position, df, i, macd_line, divergence_lookback=5):
    """エグジット条件チェック（両方向）"""
    
    current_price = df['close'].iloc[i]
    
    # 損切り/利確チェック
    if position['action'] == 'short':
        if current_price >= position['stop_loss']:
            return True, 'stop_loss', current_price
        if current_price <= position['take_profit']:
            return True, 'take_profit', current_price
    else:  # long
        if current_price <= position['stop_loss']:
            return True, 'stop_loss', current_price
        if current_price >= position['take_profit']:
            return True, 'take_profit', current_price
    
    # 逆向きダイバージェンス（エグジットシグナル）
    if i >= divergence_lookback + 20:
        divergence = detect_divergence(
            df['close'].iloc[i-divergence_lookback:i+1],
            macd_line.iloc[i-divergence_lookback:i+1],
            lookback=divergence_lookback
        )
        
        # ショートポジションで強気ダイバージェンス → エグジット
        if position['action'] == 'short' and divergence == 'bullish':
            return True, 'divergence', current_price
        
        # ロングポジションで弱気ダイバージェンス → エグジット
        if position['action'] == 'long' and divergence == 'bearish':
            return True, 'divergence', current_price
    
    return False, None, None

def fetch_historical_data(exchange, symbol, timeframe, days_back):
    """複数回リクエストして長期データを取得"""
    
    all_data = []
    since = exchange.parse8601((datetime.now() - timedelta(days=days_back)).isoformat())
    
    while True:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=1000)
        
        if len(ohlcv) == 0:
            break
        
        all_data.extend(ohlcv)
        since = ohlcv[-1][0] + 1  # 最後のタイムスタンプ + 1ms
        
        # 現在時刻に到達したら終了
        if since >= exchange.milliseconds():
            break
    
    return all_data

def run_backtest(symbol='BTC/USDT', timeframe='5m', days_back=30):
    """バックテスト実行"""
    
    print(f"🐥 バックテスト開始")
    print(f"📊 銘柄: {symbol}")
    print(f"⏱️  時間足: {timeframe}")
    print(f"📅 期間: 過去{days_back}日間")
    print()
    
    # Binanceからデータ取得
    exchange = ccxt.binance()
    
    print("📥 データ取得中...")
    ohlcv = fetch_historical_data(exchange, symbol, timeframe, days_back)
    
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df.set_index('timestamp', inplace=True)
    
    print(f"✅ データ取得完了: {len(df)}本")
    print()
    
    # インジケーター計算
    print("🔧 インジケーター計算中...")
    
    # 平均足スムーズド
    ha_calculator = HeikinAshiSmoothed(df, period1=6, period2=2)
    ha_df = ha_calculator.calculate()
    
    # 異常値検出（閾値: 1.5）
    abnormal = detect_abnormal_candle(ha_df, lookback=20, threshold=1.5)
    
    # SMA/EMA
    sma_200 = SMAIndicator(df['close'], window=200).sma_indicator()
    ema_200 = EMAIndicator(df['close'], window=200).ema_indicator()
    
    # MACD
    macd = MACD(df['close'])
    macd_line = macd.macd()
    
    # ATR（レンジフィルター用）
    atr_indicator = AverageTrueRange(df['high'], df['low'], df['close'], window=14)
    atr = atr_indicator.average_true_range()
    
    print("✅ インジケーター計算完了")
    print()
    
    # バックテスト実行
    print("🚀 シミュレーション開始...")
    
    position = None
    trades = []
    equity_curve = [10000]  # 初期資金
    
    for i in range(200, len(df)):  # 最初の200本はスキップ（SMA/EMA 200計算のため）
        
        if position is None:
            # エントリーチェック
            entry = check_entry_conditions(df, i, ha_df, abnormal, sma_200, ema_200, macd_line, atr)
            
            if entry:
                position = entry.copy()
                position['entry_time'] = df.index[i]
                position['entry_index'] = i
                
                div_str = f"（div: {entry['divergence']}）" if entry['divergence'] else ""
                print(f"📍 {entry['action'].upper()} エントリー @ {entry['price']:.2f} {div_str} ({df.index[i]})")
        
        else:
            # エグジットチェック
            should_exit, exit_reason, exit_price = check_exit_conditions(position, df, i, macd_line)
            
            if should_exit:
                # PnL計算
                if position['action'] == 'short':
                    pnl_pct = (position['price'] - exit_price) / position['price'] * 100
                else:  # long
                    pnl_pct = (exit_price - position['price']) / position['price'] * 100
                
                # 資金更新
                equity_curve.append(equity_curve[-1] * (1 + pnl_pct / 100))
                
                trade = {
                    'action': position['action'],
                    'entry_time': position['entry_time'],
                    'entry_price': position['price'],
                    'exit_time': df.index[i],
                    'exit_price': exit_price,
                    'exit_reason': exit_reason,
                    'pnl_pct': pnl_pct,
                    'divergence': position['divergence']
                }
                
                trades.append(trade)
                
                emoji = "✅" if pnl_pct > 0 else "❌"
                print(f"{emoji} エグジット @ {exit_price:.2f} | 理由: {exit_reason} | PnL: {pnl_pct:+.2f}%")
                
                position = None
    
    # 結果サマリー
    print()
    print("="*60)
    print("📊 バックテスト結果")
    print("="*60)
    
    if len(trades) == 0:
        print("⚠️ トレードなし")
        return
    
    trades_df = pd.DataFrame(trades)
    
    # 勝敗統計
    winning_trades = trades_df[trades_df['pnl_pct'] > 0]
    losing_trades = trades_df[trades_df['pnl_pct'] < 0]
    
    win_rate = len(winning_trades) / len(trades_df) * 100
    
    total_return = (equity_curve[-1] - equity_curve[0]) / equity_curve[0] * 100
    
    # 最大ドローダウン
    equity_series = pd.Series(equity_curve)
    running_max = equity_series.expanding().max()
    drawdown = (equity_series - running_max) / running_max * 100
    max_drawdown = drawdown.min()
    
    print(f"総トレード数: {len(trades_df)}")
    print(f"  ロング: {len(trades_df[trades_df['action'] == 'long'])}")
    print(f"  ショート: {len(trades_df[trades_df['action'] == 'short'])}")
    print()
    print(f"勝率: {win_rate:.2f}%")
    print(f"  勝ち: {len(winning_trades)} 回")
    print(f"  負け: {len(losing_trades)} 回")
    print()
    print(f"平均利益: {winning_trades['pnl_pct'].mean():.2f}%" if len(winning_trades) > 0 else "平均利益: N/A")
    print(f"平均損失: {losing_trades['pnl_pct'].mean():.2f}%" if len(losing_trades) > 0 else "平均損失: N/A")
    print()
    print(f"総リターン: {total_return:+.2f}%")
    print(f"最大ドローダウン: {max_drawdown:.2f}%")
    print()
    
    # エグジット理由の内訳
    print("エグジット理由:")
    exit_reasons = trades_df['exit_reason'].value_counts()
    for reason, count in exit_reasons.items():
        print(f"  {reason}: {count}回")
    
    # ダイバージェンス付きトレード
    div_trades = trades_df[trades_df['divergence'].notna()]
    if len(div_trades) > 0:
        print()
        print(f"ダイバージェンス付きトレード: {len(div_trades)}回")
    
    # 結果をJSONで保存
    result_file = f"/root/clawd/trading-strategies/backtest-result-{timeframe}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    
    result_summary = {
        'symbol': symbol,
        'timeframe': timeframe,
        'period_days': days_back,
        'total_trades': len(trades_df),
        'long_trades': int(len(trades_df[trades_df['action'] == 'long'])),
        'short_trades': int(len(trades_df[trades_df['action'] == 'short'])),
        'win_rate': float(win_rate),
        'winning_trades': int(len(winning_trades)),
        'losing_trades': int(len(losing_trades)),
        'avg_win': float(winning_trades['pnl_pct'].mean()) if len(winning_trades) > 0 else 0,
        'avg_loss': float(losing_trades['pnl_pct'].mean()) if len(losing_trades) > 0 else 0,
        'total_return_pct': float(total_return),
        'max_drawdown_pct': float(max_drawdown),
        'exit_reasons': exit_reasons.to_dict(),
        'trades': trades
    }
    
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(result_summary, f, ensure_ascii=False, indent=2, default=str)
    
    print()
    print(f"✅ 結果を保存: {result_file}")
    
    # グラフ生成
    plt.figure(figsize=(12, 6))
    plt.plot(equity_curve)
    plt.title(f'Equity Curve ({timeframe})')
    plt.xlabel('Trade Number')
    plt.ylabel('Equity ($)')
    plt.grid(True)
    
    chart_file = f"/root/clawd/trading-strategies/equity-curve-{timeframe}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.png"
    plt.savefig(chart_file)
    print(f"✅ チャート保存: {chart_file}")

if __name__ == "__main__":
    # 5分足でテスト（過去30日間）
    print("=" * 60)
    print("テスト1: 5分足（過去30日間）")
    print("=" * 60)
    run_backtest(symbol='BTC/USDT', timeframe='5m', days_back=30)
    
    print("\n\n")
    
    # 15分足でテスト（過去30日間）
    print("=" * 60)
    print("テスト2: 15分足（過去30日間）")
    print("=" * 60)
    run_backtest(symbol='BTC/USDT', timeframe='15m', days_back=30)
