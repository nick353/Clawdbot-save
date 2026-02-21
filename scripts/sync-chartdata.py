#!/usr/bin/env python3
"""
trade-log.csvからChartDataシートを完全に同期
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials
import csv
from datetime import datetime

CREDENTIALS_PATH = '/root/clawd/config/google-sheets-credentials.json'
SHEET_URL = 'https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'
TRADE_LOG_PATH = '/root/clawd/data/trade-log.csv'

def sync_chartdata():
    """ChartDataシートを完全同期"""
    
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_PATH, scope)
    client = gspread.authorize(creds)
    
    print("🔐 Google Sheets認証中...")
    sheet = client.open_by_url(SHEET_URL)
    chartdata_ws = sheet.worksheet("ChartData")
    
    print("📊 trade-log.csvを読み込み中...")
    
    # CSVからトレード履歴を読み込み（クローズ済みのみ）
    trades = []
    with open(TRADE_LOG_PATH, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Exit Time']:  # クローズ済みトレードのみ
                trades.append(row)
    
    print(f"   ✅ {len(trades)}件のクローズ済みトレードを読み込みました")
    
    # ChartData用のデータを生成
    chartdata = [
        ['トレード番号', '銘柄', 'PnL ($)', 'トータル資金', 'ホールド時間（分）', 'Win/Loss', '日付']
    ]
    
    # 初期資金
    current_capital = 10000.0
    chartdata.append([
        '0', '', '', f'{current_capital:.2f}', '', '', datetime.now().strftime('%Y-%m-%d')
    ])
    
    # 各トレードを追加
    for i, trade in enumerate(trades, 1):
        pnl = float(trade['PnL ($)'])
        current_capital += pnl
        
        # ホールド時間を計算
        hold_time = trade['Hold Time (min)']
        
        # 日付を抽出
        entry_time = trade['Entry Time']
        date = entry_time.split('T')[0] if 'T' in entry_time else entry_time.split()[0]
        
        chartdata.append([
            str(i),
            trade['Symbol'],
            f'{pnl:.2f}',
            f'{current_capital:.2f}',
            hold_time,
            trade['Win/Loss'],
            date
        ])
    
    print(f"\n📊 ChartDataシート更新中...")
    print(f"   トレード数: {len(trades)}")
    print(f"   最終資金: ${current_capital:,.2f}")
    
    # シート更新
    chartdata_ws.clear()
    chartdata_ws.update(chartdata, value_input_option='USER_ENTERED')
    
    print(f"   ✅ ChartData更新完了（{len(chartdata)}行）")
    print(f"\n📊 URL: {sheet.url}")
    
    return current_capital

if __name__ == '__main__':
    try:
        final_capital = sync_chartdata()
        print("\n" + "="*60)
        print("✅ 同期完了！")
        print(f"💰 初期資金: $10,000.00")
        print(f"💰 最終資金: ${final_capital:,.2f}")
        print(f"📊 利益: ${final_capital - 8000:+,.2f} ({(final_capital - 8000) / 8000 * 100:+.2f}%)")
        print("="*60)
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
