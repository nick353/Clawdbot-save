#!/usr/bin/env python3
"""
Bitget自動トレーダー V2（完全新規・軽量版）
- テスト済みコンポーネントのみ使用
- シンプルで確実に動作
- KVM環境対応（堅牢化）
"""

import os
import sys
import json
import csv
import time
import subprocess
import requests
import pandas as pd
import pandas_ta as ta
import signal
import gc
from datetime import datetime
from typing import Dict, List, Optional

def robust_sleep(seconds: float):
    """シグナルに強いsleep（KVM環境対応）"""
    end_time = time.time() + seconds
    while time.time() < end_time:
        try:
            remaining = end_time - time.time()
            if remaining > 0:
                time.sleep(min(remaining, 1.0))  # 1秒ずつスリープ
        except (InterruptedError, OSError):
            # シグナル受信時は継続
            continue
        except Exception as e:
            print(f"⚠️  Sleep中断: {e}", flush=True)
            break

class BitgetTraderV2:
    """軽量版Bitget自動トレーダー"""
    
    def __init__(self, config_path: str = "/root/clawd/config/bitget-trading-v3.json"):
        print("🐥 Bitget自動トレーダー V3 起動中...", flush=True)
        
        # シグナルハンドラ登録
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
        
        # 設定読み込み
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        # API設定
        self.base_url = "https://api.bitget.com"
        
        # トレード設定
        self.paper_trade = self.config.get("paper_trade", True)
        self.initial_capital = self.config.get("initial_capital", 10000.0)
        self.capital = self.initial_capital
        
        # 戦略パラメータ（設定ファイルから読み込み）
        self.strategy = self.config.get("strategy", {})
        strategy = self.strategy
        self.sma_period = strategy.get("sma_period", 200)
        self.ema_period = strategy.get("ema_period", 200)
        self.proximity_pct = strategy.get("proximity_pct", 3.0)
        self.stop_loss_pct = strategy.get("stop_loss_pct", 5.0)
        self.take_profit_pct = strategy.get("take_profit_pct", 10.0)
        self.position_size_pct = strategy.get("position_size_pct", 15.0)
        self.volume_multiplier = 1.2
        self.trailing_stop_activation = strategy.get("trailing_stop_activation_pct", 1.5)
        self.trailing_stop_distance = strategy.get("trailing_stop_distance_pct", 2.0)
        self.max_hold_time_minutes = strategy.get("max_hold_time_minutes", 240)
        
        # ポジション管理
        self.positions = {}
        self.positions_file = "/root/clawd/data/positions.json"
        
        # トレード記録
        self.trade_log_path = "/root/clawd/data/trade-log.csv"
        self.init_trade_log()
        
        # ポジション復元
        self.load_positions()
        
        # Discord通知設定
        self.discord_channel = self.config.get("discord_channel", "1471389526592327875")
        
        # Googleスプレッドシート同期設定
        self.enable_gsheet_sync = True
        self.gsheet_spreadsheet_id = "19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo"
        
        print(f"✅ 初期化完了", flush=True)
        print(f"📊 モード: {'ペーパートレード' if self.paper_trade else 'リアルトレード'}", flush=True)
        print(f"💰 初期資金: ${self.capital:,.2f}", flush=True)
        print(f"📈 監視銘柄: {len(self.config['symbols'])}銘柄", flush=True)
    
    def init_trade_log(self):
        """トレード記録CSV初期化"""
        os.makedirs(os.path.dirname(self.trade_log_path), exist_ok=True)
        
        if not os.path.exists(self.trade_log_path):
            with open(self.trade_log_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'Entry Time', 'Exit Time', 'Symbol',
                    'Entry Price', 'Exit Price', 'Quantity',
                    'PnL ($)', 'PnL (%)', 'Win/Loss',
                    'Entry Reason', 'Exit Reason',
                    'Hold Time (min)', 'Trailing Stop Used',
                    'Highest Price', 'Capital After', 'Notes'
                ])
    
    def load_positions(self):
        """ポジション情報を復元"""
        try:
            if os.path.exists(self.positions_file):
                with open(self.positions_file, 'r') as f:
                    data = json.load(f)
                    self.positions = data.get('positions', {})
                    self.capital = data.get('capital', self.initial_capital)
                    
                    if self.positions:
                        print(f"📂 ポジション復元: {len(self.positions)}個", flush=True)
                        for symbol, pos in self.positions.items():
                            print(f"   - {symbol}: ${pos['entry_price']:.6f} ({pos['entry_time']})", flush=True)
        except Exception as e:
            print(f"⚠️  ポジション復元失敗: {e}", flush=True)
    
    def save_positions(self):
        """ポジション情報を保存"""
        try:
            os.makedirs(os.path.dirname(self.positions_file), exist_ok=True)
            
            data = {
                'positions': self.positions,
                'capital': self.capital,
                'timestamp': datetime.now().isoformat()
            }
            
            with open(self.positions_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            print(f"⚠️  ポジション保存失敗: {e}", flush=True)
    
    def signal_handler(self, signum, frame):
        """シグナルハンドラ（グレースフルシャットダウン）"""
        print(f"\n⚠️  シグナル受信: {signum} ({signal.Signals(signum).name})", flush=True)
        print("💾 ポジション保存中...", flush=True)
        
        # 強制保存
        self.save_positions()
        
        print(f"💰 最終資金: ${self.capital:,.2f}", flush=True)
        print(f"📊 ポジション数: {len(self.positions)}", flush=True)
        print("👋 グレースフルシャットダウン完了", flush=True)
        
        sys.exit(0)
    
    def health_check(self):
        """ヘルスチェック（メモリ・ポジション）"""
        try:
            print(f"🏥 ヘルスチェック開始", flush=True)
            
            # メモリ使用量チェック
            try:
                print(f"  📊 メモリチェック中...", flush=True)
                import psutil
                process = psutil.Process()
                mem_percent = process.memory_percent()
                print(f"  ✅ メモリ: {mem_percent:.1f}%", flush=True)
                
                if mem_percent > 80:
                    print(f"  ⚠️  メモリ使用率高: {mem_percent:.1f}%", flush=True)
                    print(f"  🧹 ガベージコレクション実行中...", flush=True)
                    # ガベージコレクション強制実行
                    gc.collect()
                    print(f"  ✅ ガベージコレクション完了", flush=True)
            except ImportError:
                # psutil未インストールの場合はスキップ
                print(f"  ⚠️  psutil未インストール", flush=True)
                pass
            
            # ポジション定期バックアップ（5分ごと）
            if len(self.positions) > 0:
                print(f"  💾 ポジション保存中...", flush=True)
                self.save_positions()
                print(f"  ✅ ポジション保存完了", flush=True)
            
            print(f"🏥 ヘルスチェック完了", flush=True)
        
        except Exception as e:
            print(f"⚠️  ヘルスチェックエラー: {e}", flush=True)
            import traceback
            print(f"トレースバック:\n{traceback.format_exc()}", flush=True)
    
    def get_klines(self, symbol: str, limit: int = 250) -> Optional[pd.DataFrame]:
        """K線データ取得（V2 Spot API）"""
        try:
            # V2 Spot API エンドポイント
            endpoint = "/api/v2/spot/market/candles"
            params = {
                "symbol": symbol,
                "granularity": "5min",  # 5m → 5min
                "limit": str(limit)
            }
            
            response = requests.get(f"{self.base_url}{endpoint}", params=params, timeout=30)
            
            if response.status_code != 200:
                print(f"  ⚠️  API応答エラー: {response.status_code}", flush=True)
                return None
            
            data = response.json()
            
            # V2 APIレスポンス確認
            if data.get('code') != '00000':
                print(f"  ⚠️  API エラー: {data.get('msg')}", flush=True)
                return None
            
            candles = data.get('data', [])
            
            if not candles:
                print(f"  ⚠️  {symbol} データなし", flush=True)
                return None
            
            # DataFrame変換（V2 API形式）
            df = pd.DataFrame(candles)
            df.columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'quote_volume', 'usd_volume']
            df = df.astype({
                'open': float,
                'high': float,
                'low': float,
                'close': float,
                'volume': float
            })
            
            # 時系列を古い順に並べ替え
            df = df.sort_values('timestamp').reset_index(drop=True)
            
            return df
            
        except Exception as e:
            print(f"  ❌ {symbol} データ取得失敗: {e}", flush=True)
            return None
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """インジケーター計算"""
        try:
            # SMA/EMA
            df['sma_200'] = ta.sma(df['close'], length=self.sma_period)
            df['ema_200'] = ta.ema(df['close'], length=self.ema_period)
            
            # MACD
            macd = ta.macd(df['close'])
            if macd is not None:
                df = pd.concat([df, macd], axis=1)
            
            # RSI
            df['RSI_14'] = ta.rsi(df['close'], length=14)
            
            # 出来高MA
            df['volume_ma'] = ta.sma(df['volume'], length=20)
            
            return df
        except Exception as e:
            print(f"  ⚠️  インジケーター計算エラー: {e}", flush=True)
            return df
    
    def check_entry_signal(self, df: pd.DataFrame) -> tuple[bool, str, str]:
        """エントリー判定（上昇/下落トレンド両対応）
        
        Returns:
            (can_enter, reason, position_type)
            position_type: "long" or "short"
        """
        try:
            latest = df.iloc[-1]
            
            # データ不足チェック
            if pd.isna(latest['sma_200']) or pd.isna(latest['ema_200']):
                return False, "データ不足", None
            
            price = latest['close']
            sma = latest['sma_200']
            ema = latest['ema_200']

            # RSIフィルター（35〜65: ロング45-65, ショート35-55）
            rsi_cfg = self.strategy.get('rsi_filter', {})
            rsi = None
            if rsi_cfg.get('enabled', False) and 'RSI_14' in df.columns:
                rsi = latest.get('RSI_14')
            
            # MACD確認
            if 'MACD_12_26_9' not in df.columns:
                return False, "MACD未計算", None
            
            macd = latest['MACD_12_26_9']
            macd_signal = latest['MACDs_12_26_9']
            
            # 出来高確認
            volume_surge = latest['volume'] > latest['volume_ma'] * self.volume_multiplier
            if not volume_surge:
                return False, "出来高不足", None
            
            # ゴールデンクロス/デッドクロス判定
            golden_cross = ema > sma
            dead_cross = ema < sma
            price_above_ema = price > ema
            price_below_ema = price < ema
            
            # === ロング判定 ===
            if golden_cross:
                # RSIフィルター（ロング: 45-65）
                if rsi is not None and not pd.isna(rsi):
                    if rsi < 45 or rsi > 65:
                        pass  # ショート判定へ
                    else:
                        # MACD上抜け確認
                        if macd > macd_signal:
                            # パターン1: トレンドフォロー
                            if price_above_ema:
                                ema_divergence = (price - ema) / ema * 100
                                if ema_divergence < 10.0:
                                    return True, "ロング: ゴールデンクロス + 価格>EMA200", "long"
                            
                            # パターン2: 反発狙い
                            sma_dist = abs(price - sma) / sma * 100
                            ema_dist = abs(price - ema) / ema * 100
                            near_ma = sma_dist < self.proximity_pct or ema_dist < self.proximity_pct
                            if near_ma:
                                return True, "ロング: SMA/EMA反発 + ゴールデンクロス", "long"
            
            # === ショート判定 ===
            if dead_cross:
                # RSIフィルター（ショート: 35-55）
                if rsi is not None and not pd.isna(rsi):
                    if rsi < 35 or rsi > 55:
                        return False, f"RSI範囲外({rsi:.1f})", None
                
                # MACD下抜け確認
                if macd < macd_signal:
                    # パターン1: トレンドフォロー（下落）
                    if price_below_ema:
                        ema_divergence = (ema - price) / ema * 100
                        if ema_divergence < 10.0:
                            return True, "ショート: デッドクロス + 価格<EMA200", "short"
                    
                    # パターン2: 反発狙い（下落）
                    sma_dist = abs(price - sma) / sma * 100
                    ema_dist = abs(price - ema) / ema * 100
                    near_ma = sma_dist < self.proximity_pct or ema_dist < self.proximity_pct
                    if near_ma:
                        return True, "ショート: SMA/EMA反発 + デッドクロス", "short"
            
            return False, "条件不一致", None
            
        except Exception as e:
            print(f"  ⚠️  エントリー判定エラー: {e}", flush=True)
            return False, "判定エラー", None

    def check_btc_trend(self) -> bool:
        """BTCトレンドフィルター: BTCが下落トレンドの場合はFalseを返す"""
        try:
            df = self.get_klines('BTCUSDT', limit=50)
            if df is None or len(df) < 20:
                return True  # データ取得失敗時はフィルタースキップ
            closes = df['close'].tolist()
            sma20 = sum(closes[-20:]) / 20
            current = closes[-1]
            # BTCが20時間SMAの2%以上下にあれば下落トレンドとみなす
            if current < sma20 * 0.98:
                print(f"  🚫 BTCフィルター: BTC ${current:.0f} < SMA20 ${sma20:.0f} → ロング自粛", flush=True)
                return False
            return True
        except Exception as e:
            print(f"  ⚠️  BTCトレンド取得失敗（スキップ）: {e}", flush=True)
            return True  # エラー時はフィルタースキップ
    
    def update_position(self, symbol: str, df: pd.DataFrame) -> Optional[Dict]:
        """ポジション更新とエグジット判定（ロング/ショート対応）"""
        try:
            position = self.positions[symbol]
            latest = df.iloc[-1]
            
            price = latest['close']
            high = latest['high']
            low = latest['low']
            position_type = position.get('position_type', 'long')
            
            # ロング/ショート別の処理
            if position_type == "long":
                # 最高値更新
                if position['highest_price'] is None or high > position['highest_price']:
                    position['highest_price'] = high
                    
                    # トレイリングストップ発動
                    profit_pct = (high - position['entry_price']) / position['entry_price'] * 100
                    if profit_pct >= self.trailing_stop_activation:
                        position['trailing_stop'] = high * (1 - self.trailing_stop_distance / 100)
                        position['trailing_stop_used'] = True
            
            else:  # short
                # 最安値更新
                if position['lowest_price'] is None or low < position['lowest_price']:
                    position['lowest_price'] = low
                    
                    # トレイリングストップ発動（ショート）
                    profit_pct = (position['entry_price'] - low) / position['entry_price'] * 100
                    if profit_pct >= self.trailing_stop_activation:
                        position['trailing_stop'] = low * (1 + self.trailing_stop_distance / 100)
                        position['trailing_stop_used'] = True
            
            # エグジット判定
            exit_reason = None
            exit_price = price
            
            # 最大ホールド時間チェック
            entry_dt = datetime.fromisoformat(position['entry_time'])
            hold_minutes = (datetime.now() - entry_dt).total_seconds() / 60
            
            if hold_minutes >= self.max_hold_time_minutes:
                exit_reason = "Max Hold Time"
                exit_price = price
            elif position_type == "long":
                # ロングのエグジット
                if position['trailing_stop'] and low <= position['trailing_stop']:
                    exit_reason = "Trailing Stop"
                    exit_price = position['trailing_stop']
                elif low <= position['stop_loss']:
                    exit_reason = "Stop Loss"
                    exit_price = position['stop_loss']
                elif high >= position['take_profit']:
                    exit_reason = "Take Profit"
                    exit_price = position['take_profit']
            else:  # short
                # ショートのエグジット
                if position['trailing_stop'] and high >= position['trailing_stop']:
                    exit_reason = "Trailing Stop"
                    exit_price = position['trailing_stop']
                elif high >= position['stop_loss']:
                    exit_reason = "Stop Loss"
                    exit_price = position['stop_loss']
                elif low <= position['take_profit']:
                    exit_reason = "Take Profit"
                    exit_price = position['take_profit']
            
            if exit_reason:
                # エグジット実行（損益計算）
                if position_type == "long":
                    pnl = (exit_price - position['entry_price']) * position['quantity']
                    pnl_pct = (exit_price - position['entry_price']) / position['entry_price'] * 100
                else:  # short
                    pnl = (position['entry_price'] - exit_price) * position['quantity']
                    pnl_pct = (position['entry_price'] - exit_price) / position['entry_price'] * 100
                
                # 元本 + 損益を戻す
                self.capital += position['position_size'] + pnl
                
                trade = {
                    'symbol': symbol,
                    'entry_time': position['entry_time'],
                    'exit_time': datetime.now().isoformat(),
                    'entry_price': position['entry_price'],
                    'exit_price': exit_price,
                    'quantity': position['quantity'],
                    'pnl': pnl,
                    'pnl_pct': pnl_pct,
                    'entry_reason': position['entry_reason'],
                    'exit_reason': exit_reason,
                    'highest_price': position['highest_price'],
                    'trailing_stop_used': position.get('trailing_stop_used', False),
                    'capital_after': self.capital
                }
                
                self.log_trade(trade)
                
                print(f"  🔴 {symbol}: エグジット @ ${exit_price:.6f} ({exit_reason})", flush=True)
                print(f"     PnL: ${pnl:.2f} ({pnl_pct:+.2f}%)", flush=True)
                
                # Discord通知
                win_loss = "✅ Win" if pnl > 0 else "❌ Loss"
                entry_dt = datetime.fromisoformat(position['entry_time'])
                exit_dt = datetime.now()
                hold_minutes = (exit_dt - entry_dt).total_seconds() / 60
                
                notification = f"""
🔴 **エグジット**

**銘柄:** {symbol}
**価格:** ${exit_price:.6f}
**理由:** {exit_reason}
**PnL:** ${pnl:.2f} ({pnl_pct:+.2f}%) {win_loss}
**保有時間:** {hold_minutes:.0f}分
**現在資金:** ${self.capital:,.2f}
"""
                self.send_discord_notification(notification.strip())
                
                return trade
            
            return None
            
        except Exception as e:
            print(f"  ⚠️  {symbol} ポジション更新エラー: {e}", flush=True)
            return None
    
    def send_discord_notification(self, message: str):
        """Discord通知送信"""
        try:
            cmd = [
                "clawdbot", "message", "send",
                "--target", self.discord_channel,
                "--message", message
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print(f"  📤 Discord通知送信完了", flush=True)
            else:
                print(f"  ⚠️  Discord通知失敗: {result.stderr}", flush=True)
                
        except Exception as e:
            print(f"  ⚠️  Discord通知エラー: {e}", flush=True)
    
    def sync_to_gsheet(self):
        """Googleスプレッドシート同期"""
        if not self.enable_gsheet_sync:
            return
        
        try:
            cmd = [
                "python3",
                "/root/clawd/scripts/sync-to-gsheet.py"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print(f"  📊 Googleスプレッドシート同期完了", flush=True)
            else:
                print(f"  ⚠️  Googleスプレッドシート同期失敗: {result.stderr}", flush=True)
                
        except Exception as e:
            print(f"  ⚠️  Googleスプレッドシート同期エラー: {e}", flush=True)
    
    def log_entry(self, symbol: str, position: Dict):
        """エントリー即時記録"""
        try:
            position_type = position.get('position_type', 'long')
            with open(self.trade_log_path, 'a', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow([
                    position['entry_time'],
                    '',  # Exit Time（空欄）
                    symbol,
                    position['entry_price'],
                    '',  # Exit Price（空欄）
                    position['quantity'],
                    '',  # PnL（空欄）
                    '',  # PnL %（空欄）
                    'Open',  # Win/Loss（オープン中）
                    position['entry_reason'],
                    '',  # Exit Reason（空欄）
                    '',  # Hold Time（空欄）
                    'No',  # Trailing Stop Used
                    position['entry_price'],  # Highest Price（初期値）
                    self.capital,  # Capital After
                    f"{position_type.upper()}: {symbol}_{position['entry_time']}"
                ])
            
            print(f"  📝 エントリー記録保存（CSV）", flush=True)
            
        except Exception as e:
            print(f"  ⚠️  エントリー記録エラー: {e}", flush=True)
    
    def log_trade(self, trade: Dict):
        """トレード記録（決済時）"""
        try:
            # CSV全体を読み込み
            rows = []
            with open(self.trade_log_path, 'r', newline='') as f:
                reader = csv.reader(f)
                rows = list(reader)
            
            # 該当エントリーを探して更新
            position_id = f"{trade['symbol']}_{trade['entry_time']}"
            updated = False
            
            for i, row in enumerate(rows):
                if len(row) > 15 and position_id in row[15]:
                    # エントリー行を更新
                    entry_time = trade['entry_time']
                    exit_time = trade['exit_time']
                    hold_time = (datetime.fromisoformat(exit_time) - datetime.fromisoformat(entry_time)).total_seconds() / 60
                    
                    rows[i] = [
                        entry_time,
                        exit_time,
                        trade['symbol'],
                        trade['entry_price'],
                        trade['exit_price'],
                        trade['quantity'],
                        trade['pnl'],
                        trade['pnl_pct'],
                        'Win' if trade['pnl'] > 0 else 'Loss',
                        trade['entry_reason'],
                        trade['exit_reason'],
                        f"{hold_time:.0f}",
                        'Yes' if trade.get('trailing_stop_used') else 'No',
                        trade.get('highest_price', trade['exit_price']),
                        trade['capital_after'],
                        position_id
                    ]
                    updated = True
                    break
            
            # CSVに書き戻し
            with open(self.trade_log_path, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            
            if updated:
                print(f"  📝 トレード記録更新（CSV）", flush=True)
            else:
                print(f"  ⚠️  エントリー行が見つからず、新規追加", flush=True)
                # 見つからなかった場合は追加
                with open(self.trade_log_path, 'a', newline='') as f:
                    writer = csv.writer(f)
                    entry_time = trade['entry_time']
                    exit_time = trade['exit_time']
                    hold_time = (datetime.fromisoformat(exit_time) - datetime.fromisoformat(entry_time)).total_seconds() / 60
                    
                    writer.writerow([
                        entry_time,
                        exit_time,
                        trade['symbol'],
                        trade['entry_price'],
                        trade['exit_price'],
                        trade['quantity'],
                        trade['pnl'],
                        trade['pnl_pct'],
                        'Win' if trade['pnl'] > 0 else 'Loss',
                        trade['entry_reason'],
                        trade['exit_reason'],
                        f"{hold_time:.0f}",
                        'Yes' if trade.get('trailing_stop_used') else 'No',
                        trade.get('highest_price', trade['exit_price']),
                        trade['capital_after'],
                        position_id
                    ])
            
            # Googleスプレッドシート同期
            self.sync_to_gsheet()
            
        except Exception as e:
            print(f"  ⚠️  トレード記録エラー: {e}", flush=True)
    
    def run_iteration(self):
        """1回のチェック実行"""
        symbols = self.config['symbols']
        
        print(f"  🔍 監視銘柄チェック開始: {len(symbols)}銘柄", flush=True)
        
        for symbol in symbols:
            try:
                print(f"  📊 {symbol}: データ取得中...", flush=True)
                
                # データ取得
                df = self.get_klines(symbol, limit=250)
                
                if df is None:
                    print(f"  ⚠️ {symbol}: データ取得失敗", flush=True)
                    continue
                
                if len(df) < self.sma_period:
                    print(f"  ⚠️ {symbol}: データ不足 ({len(df)}/{self.sma_period})", flush=True)
                    continue
                
                print(f"  ✅ {symbol}: データ取得成功 ({len(df)}本)", flush=True)
                
                # インジケーター計算
                print(f"  📈 {symbol}: インジケーター計算中...", flush=True)
                df = self.calculate_indicators(df)
                
                # ポジションあり → エグジット判定
                if symbol in self.positions:
                    print(f"  👁️ {symbol}: ポジションあり - エグジット判定中...", flush=True)
                    trade = self.update_position(symbol, df)
                    
                    if trade:
                        # ポジション削除
                        del self.positions[symbol]
                        
                        # ポジション永続化
                        self.save_positions()
                
                # ポジションなし → エントリー判定
                else:
                    # 最大ポジション数チェック
                    risk_mgmt = self.config.get('risk_management', {})
                    max_positions = risk_mgmt.get('max_positions', 3)
                    if len(self.positions) >= max_positions:
                        continue  # 次の銘柄へ
                    
                    # BTCトレンドフィルター（設定で有効な場合のみ）
                    if self.strategy.get('btc_trend_filter', False):
                        if not self.check_btc_trend():
                            print(f"  🚫 {symbol}: BTCトレンドフィルターによりスキップ", flush=True)
                            continue

                    can_enter, reason, position_type = self.check_entry_signal(df)
                    
                    if can_enter:
                        # エントリー
                        price = df.iloc[-1]['close']
                        # 常に「総資金 ÷ 最大ポジション数」で計算（マックス活用）
                        total_capital = self.get_total_capital()
                        position_size = total_capital / max_positions
                        
                        # 資金チェック
                        if self.capital < position_size:
                            print(f"  ⚠️  {symbol}: 資金不足（必要: ${position_size:.2f}, 利用可能: ${self.capital:.2f}）", flush=True)
                            continue
                        
                        quantity = position_size / price
                        
                        # 資金減算
                        self.capital -= position_size
                        
                        # ロング/ショートでストップロス/テイクプロフィットを計算
                        if position_type == "long":
                            stop_loss = price * (1 - self.stop_loss_pct / 100.0)
                            take_profit = price * (1 + self.take_profit_pct / 100.0)
                            highest_price = price
                            lowest_price = None
                        else:  # short
                            stop_loss = price * (1 + self.stop_loss_pct / 100.0)
                            take_profit = price * (1 - self.take_profit_pct / 100.0)
                            highest_price = None
                            lowest_price = price
                        
                        self.positions[symbol] = {
                            'entry_time': datetime.now().isoformat(),
                            'entry_price': price,
                            'quantity': quantity,
                            'position_size': position_size,
                            'position_type': position_type,
                            'stop_loss': stop_loss,
                            'take_profit': take_profit,
                            'trailing_stop': None,
                            'trailing_stop_used': False,
                            'highest_price': highest_price,
                            'lowest_price': lowest_price,
                            'entry_reason': reason
                        }
                        
                        position_emoji = "🟢" if position_type == "long" else "🔴"
                        print(f"  {position_emoji} {symbol}: エントリー ({position_type.upper()}) @ ${price:.6f} ({reason})", flush=True)
                        print(f"     💰 資金: ${position_size:.2f}減算 → 残高: ${self.capital:.2f}", flush=True)
                        
                        # ポジション永続化
                        self.save_positions()
                        
                        # エントリー即時記録
                        self.log_entry(symbol, self.positions[symbol])
                        
                        # Discord通知
                        notification = f"""
{position_emoji} **エントリー ({position_type.upper()})**

**銘柄:** {symbol}
**価格:** ${price:.6f}
**理由:** {reason}
**ポジションサイズ:** ${position_size:.2f}
**ストップロス:** ${self.positions[symbol]['stop_loss']:.6f}
**テイクプロフィット:** ${self.positions[symbol]['take_profit']:.6f}
"""
                        self.send_discord_notification(notification.strip())
                
            except Exception as e:
                print(f"  ❌ {symbol} 処理エラー: {e}", flush=True)
                continue
    
    def get_total_capital(self):
        """トータル資金を計算（使用可能 + ポジション投資額）"""
        total_position_size = sum(pos['position_size'] for pos in self.positions.values())
        return self.capital + total_position_size
    
    def run(self, check_interval: int = 60):
        """メインループ"""
        total_capital = self.get_total_capital()
        print(f"\n{'='*80}", flush=True)
        print(f"🚀 Bitget自動トレーダー V2 開始", flush=True)
        print(f"{'='*80}", flush=True)
        print(f"⏰ チェック間隔: {check_interval}秒", flush=True)
        print(f"💰 トータル資金: ${total_capital:,.2f}", flush=True)
        print(f"   ├─ 使用可能: ${self.capital:,.2f}", flush=True)
        print(f"   └─ ポジション: ${total_capital - self.capital:,.2f} ({len(self.positions)}件)", flush=True)
        print(f"📊 トレード記録: {self.trade_log_path}", flush=True)
        print(f"{'='*80}\n", flush=True)
        
        iteration = 0
        
        try:
            while True:
                iteration += 1
                total_capital = self.get_total_capital()
                print(f"🔄 チェック #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
                print(f"💰 トータル資金: ${total_capital:,.2f} (使用可能: ${self.capital:,.2f}, ポジション: {len(self.positions)})", flush=True)
                
                try:
                    self.run_iteration()
                except Exception as e:
                    import traceback
                    print(f"❌ チェック失敗: {e}", flush=True)
                    print(f"❌ トレースバック:\n{traceback.format_exc()}", flush=True)
                
                # ヘルスチェック（5回に1回）
                if iteration % 5 == 0:
                    self.health_check()
                
                print(f"⏱️  次のチェックまで{check_interval}秒待機...", flush=True)
                print("", flush=True)  # 空行
                
                # 堅牢なsleep（KVM環境対応）
                try:
                    robust_sleep(check_interval)
                except Exception as e:
                    import traceback
                    print(f"❌ sleep失敗: {e}", flush=True)
                    print(f"❌ トレースバック:\n{traceback.format_exc()}", flush=True)
        
        except KeyboardInterrupt:
            print(f"\n{'='*80}", flush=True)
            print(f"🛑 自動トレーダー停止（KeyboardInterrupt）", flush=True)
            print(f"{'='*80}", flush=True)
            print(f"💰 最終資金: ${self.capital:,.2f}", flush=True)
            pnl = self.capital - self.initial_capital
            pnl_pct = pnl / self.initial_capital * 100
            print(f"📈 損益: ${pnl:+,.2f} ({pnl_pct:+.2f}%)", flush=True)
            print(f"📊 トレード記録: {self.trade_log_path}", flush=True)
            print(f"{'='*80}\n", flush=True)
        except Exception as e:
            import traceback
            print(f"\n{'='*80}", flush=True)
            print(f"🚨 予期しないエラーで停止", flush=True)
            print(f"{'='*80}", flush=True)
            print(f"❌ エラー: {e}", flush=True)
            print(f"❌ トレースバック:\n{traceback.format_exc()}", flush=True)
            print(f"💰 最終資金: ${self.capital:,.2f}", flush=True)
            print(f"📊 トレード記録: {self.trade_log_path}", flush=True)
            print(f"{'='*80}\n", flush=True)
            raise  # 再度raiseしてwatchdogが検知できるようにする

if __name__ == "__main__":
    config_path = "/root/clawd/config/bitget-trading-v3.json"
    trader = BitgetTraderV2(config_path)
    
    # 設定ファイルからcheck_intervalを読み込み
    with open(config_path, 'r') as f:
        config = json.load(f)
    check_interval = config.get('check_interval', 30)
    
    trader.run(check_interval=check_interval)
