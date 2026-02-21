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
    
    def __init__(self, config_path: str = "/root/clawd/config/bitget-trading.json"):
        print("🐥 Bitget自動トレーダー V2 起動中...", flush=True)
        
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
        
        # 戦略パラメータ（バランス型 + 20%ポジション）
        self.sma_period = 200
        self.ema_period = 200
        self.proximity_pct = 3.0  # バランス型: 2% → 3%
        self.stop_loss_pct = 5.0
        self.take_profit_pct = 15.0  # バランス型: 10% → 15%
        self.position_size_pct = 20.0  # 10% → 20%
        self.volume_multiplier = 1.2  # バランス型: 1.5x → 1.2x
        self.trailing_stop_activation = 3.0  # バランス型: 5% → 3%
        self.trailing_stop_distance = 3.0
        
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
            
            # 出来高MA
            df['volume_ma'] = ta.sma(df['volume'], length=20)
            
            return df
        except Exception as e:
            print(f"  ⚠️  インジケーター計算エラー: {e}", flush=True)
            return df
    
    def check_entry_signal(self, df: pd.DataFrame) -> tuple[bool, str]:
        """エントリー判定"""
        try:
            latest = df.iloc[-1]
            
            # データ不足チェック
            if pd.isna(latest['sma_200']) or pd.isna(latest['ema_200']):
                return False, "データ不足"
            
            price = latest['close']
            sma = latest['sma_200']
            ema = latest['ema_200']
            
            # SMA/EMAへの接近判定
            sma_dist = abs(price - sma) / sma * 100
            ema_dist = abs(price - ema) / ema * 100
            
            if sma_dist > self.proximity_pct and ema_dist > self.proximity_pct:
                return False, "SMA/EMAから遠い"
            
            # MACD確認
            if 'MACD_12_26_9' in df.columns:
                macd = latest['MACD_12_26_9']
                macd_signal = latest['MACDs_12_26_9']
                
                # MACDがシグナルを上抜け
                if macd > macd_signal:
                    # 出来高確認
                    if latest['volume'] > latest['volume_ma'] * self.volume_multiplier:
                        return True, "SMA/EMA反発 + MACD上抜け + 出来高増"
            
            return False, "条件不一致"
            
        except Exception as e:
            print(f"  ⚠️  エントリー判定エラー: {e}", flush=True)
            return False, "判定エラー"
    
    def update_position(self, symbol: str, df: pd.DataFrame) -> Optional[Dict]:
        """ポジション更新とエグジット判定"""
        try:
            position = self.positions[symbol]
            latest = df.iloc[-1]
            
            price = latest['close']
            high = latest['high']
            low = latest['low']
            
            # 最高値更新
            if high > position['highest_price']:
                position['highest_price'] = high
                
                # トレイリングストップ発動
                profit_pct = (high - position['entry_price']) / position['entry_price'] * 100
                if profit_pct >= self.trailing_stop_activation:
                    position['trailing_stop'] = high * (1 - self.trailing_stop_distance / 100)
                    position['trailing_stop_used'] = True
            
            # エグジット判定
            exit_reason = None
            exit_price = price
            
            if position['trailing_stop'] and low <= position['trailing_stop']:
                exit_reason = "Trailing Stop"
                exit_price = position['trailing_stop']
            elif low <= position['stop_loss']:
                exit_reason = "Stop Loss"
                exit_price = position['stop_loss']
            elif high >= position['take_profit']:
                exit_reason = "Take Profit"
                exit_price = position['take_profit']
            
            if exit_reason:
                # エグジット実行
                pnl = (exit_price - position['entry_price']) * position['quantity']
                pnl_pct = (exit_price - position['entry_price']) / position['entry_price'] * 100
                
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
                    f"ポジションID: {symbol}_{position['entry_time']}"
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
        
        for symbol in symbols:
            try:
                # データ取得
                df = self.get_klines(symbol, limit=250)
                
                if df is None or len(df) < self.sma_period:
                    continue
                
                # インジケーター計算
                df = self.calculate_indicators(df)
                
                # ポジションあり → エグジット判定
                if symbol in self.positions:
                    trade = self.update_position(symbol, df)
                    
                    if trade:
                        # ポジション削除
                        del self.positions[symbol]
                        
                        # ポジション永続化
                        self.save_positions()
                
                # ポジションなし → エントリー判定
                else:
                    # 最大ポジション数チェック
                    max_positions = self.config.get('max_positions', 3)
                    if len(self.positions) >= max_positions:
                        continue  # 次の銘柄へ
                    
                    can_enter, reason = self.check_entry_signal(df)
                    
                    if can_enter:
                        # エントリー
                        price = df.iloc[-1]['close']
                        # 現在の資金から計算
                        position_size = self.capital * (self.position_size_pct / 100.0)
                        
                        # 資金チェック
                        if self.capital < position_size:
                            print(f"  ⚠️  {symbol}: 資金不足（必要: ${position_size:.2f}, 利用可能: ${self.capital:.2f}）", flush=True)
                            continue
                        
                        quantity = position_size / price
                        
                        # 資金減算
                        self.capital -= position_size
                        
                        self.positions[symbol] = {
                            'entry_time': datetime.now().isoformat(),
                            'entry_price': price,
                            'quantity': quantity,
                            'position_size': position_size,
                            'stop_loss': price * (1 - self.stop_loss_pct / 100.0),
                            'take_profit': price * (1 + self.take_profit_pct / 100.0),
                            'trailing_stop': None,
                            'trailing_stop_used': False,
                            'highest_price': price,
                            'entry_reason': reason
                        }
                        
                        print(f"  🟢 {symbol}: エントリー @ ${price:.6f} ({reason})", flush=True)
                        print(f"     💰 資金: ${position_size:.2f}減算 → 残高: ${self.capital:.2f}", flush=True)
                        
                        # ポジション永続化
                        self.save_positions()
                        
                        # エントリー即時記録
                        self.log_entry(symbol, self.positions[symbol])
                        
                        # Discord通知
                        notification = f"""
🟢 **エントリー**

**銘柄:** {symbol}
**価格:** ${price:.6f}
**理由:** {reason}
**ポジションサイズ:** ${position_size:.2f} ({self.position_size_pct}%)
**ストップロス:** ${self.positions[symbol]['stop_loss']:.6f} (-{self.stop_loss_pct}%)
**テイクプロフィット:** ${self.positions[symbol]['take_profit']:.6f} (+{self.take_profit_pct}%)
"""
                        self.send_discord_notification(notification.strip())
                
            except Exception as e:
                print(f"  ❌ {symbol} 処理エラー: {e}", flush=True)
                continue
    
    def run(self, check_interval: int = 60):
        """メインループ"""
        print(f"\n{'='*80}", flush=True)
        print(f"🚀 Bitget自動トレーダー V2 開始", flush=True)
        print(f"{'='*80}", flush=True)
        print(f"⏰ チェック間隔: {check_interval}秒", flush=True)
        print(f"💰 現在資金: ${self.capital:,.2f}", flush=True)
        print(f"📊 トレード記録: {self.trade_log_path}", flush=True)
        print(f"{'='*80}\n", flush=True)
        
        iteration = 0
        
        try:
            while True:
                iteration += 1
                print(f"🔄 チェック #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
                print(f"💰 現在資金: ${self.capital:,.2f} | ポジション: {len(self.positions)}", flush=True)
                
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
    trader = BitgetTraderV2()
    trader.run(check_interval=60)
