#!/usr/bin/env python3
"""
全てのシートを最新情報で更新（統合スクリプト）
セッション1(2/14-2/18) / セッション2(2/18〜) 対応版
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import csv
from datetime import datetime

CREDENTIALS_PATH = '/root/clawd/config/google-sheets-credentials.json'
SHEET_URL = 'https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'

SESSION1_PNL = -54.0   # 第1セッション確定損益（手動設定）
SESSION2_INITIAL = 10000.0  # 第2セッション開始資金

def split_sessions(all_trades):
    """===RESTART=== 行を基準にセッション1/2に分割"""
    session1 = []
    session2 = []
    found_restart = False
    for t in all_trades:
        if t['Symbol'] == '===RESTART===':
            found_restart = True
            continue
        if found_restart:
            session2.append(t)
        else:
            session1.append(t)
    return session1, session2

def update_full_dashboard():
    """全シート更新"""
    
    # 現在のポジション損益を読み込み
    with open('/root/clawd/data/current-pnl.json', 'r') as f:
        pnl_data = json.load(f)
    
    # トレードログを読み込み
    with open('/root/clawd/data/trade-log.csv', 'r') as f:
        reader = csv.DictReader(f)
        all_trades = list(reader)
    
    # セッション分割
    s1_trades, s2_trades = split_sessions(all_trades)

    # --- セッション1 ---
    s1_closed = [t for t in s1_trades if t['Exit Time'] and t['Win/Loss'] not in ('Open', 'RESTART', 'Close')]
    # 手動クローズ（再スタート）は除外
    s1_closed = [t for t in s1_closed if t.get('Exit Reason', '') != '手動クローズ（再スタート）']
    s1_wins = [t for t in s1_closed if t['Win/Loss'] == 'Win']
    s1_losses = [t for t in s1_closed if t['Win/Loss'] == 'Loss']
    s1_win_rate = (len(s1_wins) / len(s1_closed) * 100) if s1_closed else 0
    s1_total_pnl = sum(float(t['PnL ($)']) for t in s1_closed) if s1_closed else SESSION1_PNL

    # --- セッション2 ---
    s2_closed = [t for t in s2_trades if t['Exit Time'] and t['Win/Loss'] not in ('Open', 'RESTART')]
    s2_open = [t for t in s2_trades if not t['Exit Time']]
    s2_wins = [t for t in s2_closed if t['Win/Loss'] == 'Win']
    s2_losses = [t for t in s2_closed if t['Win/Loss'] == 'Loss']
    s2_win_rate = (len(s2_wins) / len(s2_closed) * 100) if s2_closed else 0
    s2_confirmed_pnl = sum(float(t['PnL ($)']) for t in s2_closed) if s2_closed else 0.0

    # 現在の総資金
    current_total = pnl_data['total_capital']
    s2_total_pnl = current_total - SESSION2_INITIAL
    s2_pnl_pct = (s2_total_pnl / SESSION2_INITIAL) * 100

    avg_win_s2 = sum(float(t['PnL ($)']) for t in s2_wins) / len(s2_wins) if s2_wins else 0
    avg_loss_s2 = sum(float(t['PnL ($)']) for t in s2_losses) / len(s2_losses) if s2_losses else 0

    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_PATH, scope)
    client = gspread.authorize(creds)
    
    print("🔐 Google Sheets認証中...")
    sheet = client.open_by_url(SHEET_URL)
    
    # --- Dashboard更新 ---
    print("\n📊 Dashboard更新中...")
    dashboard_ws = sheet.worksheet("Dashboard")
    
    dashboard_data = [
        ['Bitget自動トレーディング - Dashboard', '', ''],
        ['', '', ''],
        ['🏁 第1セッション (2/14 〜 2/18)', '', ''],
        ['開始資金',      '$10,000.00', ''],
        ['確定損益',      f'${SESSION1_PNL:+,.2f}', ''],
        ['終了資金',      f'${10000 + SESSION1_PNL:,.2f}', ''],
        ['トレード数',    len(s1_closed), ''],
        ['勝ち / 負け',  f'{len(s1_wins)} / {len(s1_losses)}', ''],
        ['勝率',          f'{s1_win_rate:.1f}%', ''],
        ['備考',          '2026-02-18 08:00 UTC に $10,000 で再スタート', ''],
        ['', '', ''],
        ['🚀 第2セッション (2/18 〜)', '', ''],
        ['開始資金',      f'${SESSION2_INITIAL:,.2f}', ''],
        ['確定損益（クローズ済み）', f'${s2_confirmed_pnl:+,.2f}', ''],
        ['未実現損益',    f'${pnl_data["total_unrealized_pnl"]:+,.2f}', ''],
        ['━━━━━━━━━━━━━━━━━━━━━━', '', ''],
        ['現在の総資金',  f'${current_total:,.2f}', ''],
        ['トータル損益',  f'${s2_total_pnl:+,.2f} ({s2_pnl_pct:+.2f}%)', ''],
        ['', '', ''],
        ['📊 第2セッション 成績', '', ''],
        ['クローズ済みトレード', len(s2_closed), ''],
        ['勝ち / 負け',  f'{len(s2_wins)} / {len(s2_losses)}', ''],
        ['勝率',          f'{s2_win_rate:.1f}%', ''],
        ['平均勝ちトレード', f'${avg_win_s2:+,.2f}', ''],
        ['平均負けトレード', f'${avg_loss_s2:+,.2f}', ''],
        ['プロフィットファクター',
            f'{abs(avg_win_s2 / avg_loss_s2):.2f}' if avg_loss_s2 != 0 else 'N/A', ''],
        ['', '', ''],
        ['🔄 現在の状況', '', ''],
        ['オープンポジション数', len(s2_open), ''],
        ['現金部分', f'${pnl_data.get("cash", 0):,.2f}', ''],
        ['最終更新', datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'), ''],
    ]
    
    dashboard_ws.clear()
    dashboard_ws.update(dashboard_data, value_input_option='USER_ENTERED')
    print(f"   ✅ Dashboard更新完了")

    # --- TradeLog シートのハイライト ---
    try:
        tradelog_ws = sheet.worksheet("TradeLog")
        print("\n📋 TradeLog シート更新中...")
        
        # ヘッダー行を書き込み
        header = ['Entry Time','Exit Time','Symbol','Entry Price','Exit Price',
                  'Quantity','PnL ($)','PnL (%)','Win/Loss','Entry Reason',
                  'Exit Reason','Hold Time (min)','Trailing Stop Used',
                  'Highest Price','Capital After','Notes']
        rows = [header]
        restart_row_index = None

        for t in all_trades:
            row = [
                t.get('Entry Time',''), t.get('Exit Time',''), t.get('Symbol',''),
                t.get('Entry Price',''), t.get('Exit Price',''), t.get('Quantity',''),
                t.get('PnL ($)',''), t.get('PnL (%)',''), t.get('Win/Loss',''),
                t.get('Entry Reason',''), t.get('Exit Reason',''),
                t.get('Hold Time (min)',''), t.get('Trailing Stop Used',''),
                t.get('Highest Price',''), t.get('Capital After',''), t.get('Notes','')
            ]
            if t.get('Symbol') == '===RESTART===':
                restart_row_index = len(rows) + 1  # 1-indexed (header is row 1)
            rows.append(row)

        tradelog_ws.clear()
        tradelog_ws.update(rows, value_input_option='USER_ENTERED')

        # 再スタート行をハイライト（オレンジ背景）
        if restart_row_index:
            tradelog_ws.format(
                f'A{restart_row_index}:P{restart_row_index}',
                {
                    "backgroundColor": {"red": 1.0, "green": 0.6, "blue": 0.0},
                    "textFormat": {"bold": True},
                    "horizontalAlignment": "CENTER"
                }
            )
            print(f"   🟠 行 {restart_row_index} をオレンジでハイライト")
        print(f"   ✅ TradeLog 更新完了 ({len(rows)-1} 行)")
    except gspread.exceptions.WorksheetNotFound:
        print("   ⚠️ TradeLog シートが存在しないためスキップ")

    print("\n" + "="*60)
    print("✅ 全シート更新完了！")
    print(f"🏁 第1セッション確定損益: ${SESSION1_PNL:+,.2f}")
    print(f"🚀 第2セッション開始資金: ${SESSION2_INITIAL:,.2f}")
    print(f"💰 第2セッション現在の総資金: ${current_total:,.2f}")
    print(f"📊 第2セッション損益: ${s2_total_pnl:+,.2f} ({s2_pnl_pct:+.2f}%)")
    print(f"📦 オープンポジション: {len(s2_open)}個")
    print(f"📊 URL: {sheet.url}")
    print("="*60)

if __name__ == '__main__':
    try:
        update_full_dashboard()
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
