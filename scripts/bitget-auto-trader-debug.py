#!/usr/bin/env python3
"""
デバッグ版: どこでハングしているか特定
"""

import os
import sys
import json

print("=" * 80, flush=True)
print("🐥 デバッグ開始", flush=True)
print("=" * 80, flush=True)

# ステップ1: import確認
print("\n1️⃣ import開始...", flush=True)
try:
    import csv
    print("  ✅ csv", flush=True)
    import time
    print("  ✅ time", flush=True)
    import subprocess
    print("  ✅ subprocess", flush=True)
    import requests
    print("  ✅ requests", flush=True)
    import pandas as pd
    print("  ✅ pandas", flush=True)
    import pandas_ta as ta
    print("  ✅ pandas_ta", flush=True)
    from datetime import datetime, timedelta
    print("  ✅ datetime", flush=True)
    from typing import Dict, List, Optional, Tuple
    print("  ✅ typing", flush=True)
except Exception as e:
    print(f"❌ import失敗: {e}", flush=True)
    sys.exit(1)

print("✅ 全import成功", flush=True)

# ステップ2: 設定ファイル読み込み
print("\n2️⃣ 設定ファイル読み込み...", flush=True)
config_path = "/root/clawd/config/bitget-trading.json"
try:
    with open(config_path, 'r') as f:
        config = json.load(f)
    print(f"  ✅ 成功: {len(config['symbols'])}銘柄", flush=True)
except Exception as e:
    print(f"  ❌ 失敗: {e}", flush=True)
    sys.exit(1)

# ステップ3: クラス初期化（段階的）
print("\n3️⃣ クラス初期化開始...", flush=True)

class BitgetAutoTraderDebug:
    def __init__(self):
        print("  3-1. __init__開始", flush=True)
        
        # 設定読み込み
        print("  3-2. 設定読み込み開始", flush=True)
        self.config = self.load_config("/root/clawd/config/bitget-trading.json")
        print("  3-3. 設定読み込み完了", flush=True)
        
        # API設定
        print("  3-4. API設定開始", flush=True)
        self.base_url = "https://api.bitget.com"
        print("  3-5. API設定完了", flush=True)
        
        # トレード設定
        print("  3-6. トレード設定開始", flush=True)
        self.paper_trade = self.config.get("paper_trade", True)
        self.initial_capital = self.config.get("initial_capital", 10000.0)
        self.capital = self.initial_capital
        print("  3-7. トレード設定完了", flush=True)
        
        # 戦略パラメータ
        print("  3-8. 戦略パラメータ設定開始", flush=True)
        self.sma_period = 200
        self.ema_period = 200
        self.proximity_pct = 2.0
        self.stop_loss_pct = 5.0
        self.take_profit_pct = 10.0
        self.position_size_pct = 10.0
        self.volume_multiplier = 1.5
        self.trailing_stop_activation = 5.0
        self.trailing_stop_distance = 3.0
        print("  3-9. 戦略パラメータ設定完了", flush=True)
        
        # ポジション管理
        print("  3-10. ポジション管理初期化開始", flush=True)
        self.positions = {}
        print("  3-11. ポジション管理初期化完了", flush=True)
        
        # トレード記録
        print("  3-12. トレード記録初期化開始", flush=True)
        self.trade_log_path = "/root/clawd/data/trade-log.csv"
        self.screenshot_dir = "/root/clawd/data/screenshots"
        print("  3-13. init_trade_log()呼び出し開始", flush=True)
        self.init_trade_log()
        print("  3-14. init_trade_log()完了", flush=True)
        
        # スクリーンショットディレクトリ作成
        print("  3-15. スクリーンショットディレクトリ作成開始", flush=True)
        os.makedirs(self.screenshot_dir, exist_ok=True)
        print("  3-16. スクリーンショットディレクトリ作成完了", flush=True)
        
        print("  3-17. __init__完了", flush=True)
        
        print(f"🐥 Bitget自動トレーダー起動完了", flush=True)
        print(f"📊 モード: {'ペーパートレード' if self.paper_trade else 'リアルトレード'}", flush=True)
        print(f"💰 初期資金: ${self.capital:,.2f}", flush=True)
    
    def load_config(self, config_path: str) -> Dict:
        """設定ファイル読み込み"""
        print("    load_config開始", flush=True)
        try:
            with open(config_path, 'r') as f:
                data = json.load(f)
            print("    load_config完了", flush=True)
            return data
        except FileNotFoundError:
            print("    load_config: ファイルなし、デフォルト使用", flush=True)
            return {"paper_trade": True, "initial_capital": 10000.0}
    
    def init_trade_log(self):
        """トレード記録CSV初期化"""
        print("      init_trade_log開始", flush=True)
        os.makedirs(os.path.dirname(self.trade_log_path), exist_ok=True)
        print("      ディレクトリ作成完了", flush=True)
        
        if not os.path.exists(self.trade_log_path):
            print("      CSV新規作成開始", flush=True)
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
            print(f"      CSV作成完了: {self.trade_log_path}", flush=True)
        else:
            print(f"      CSV既存: {self.trade_log_path}", flush=True)
        
        print("      init_trade_log完了", flush=True)

# ステップ4: インスタンス化
print("\n4️⃣ インスタンス化開始...", flush=True)
try:
    trader = BitgetAutoTraderDebug()
    print("✅ インスタンス化成功", flush=True)
except Exception as e:
    print(f"❌ インスタンス化失敗: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80, flush=True)
print("✅ デバッグ完了！全ステップ成功", flush=True)
print("=" * 80, flush=True)
