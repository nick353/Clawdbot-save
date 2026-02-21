#!/usr/bin/env python3
"""
ChartDataシートを更新（確定トレードのみ）
"""
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import csv

def update_chart_data():
    """ChartDataシートを更新"""
    # 認証情報
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
    SERVICE_ACCOUNT_FILE = '/root/.clawdbot/google-credentials.json'
    SPREADSHEET_ID = '19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'
    
    # 認証
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    
    # CSVから確定トレードのみを読み込み
    with open('/root/clawd/data/trade-log.csv', 'r') as f:
        reader = csv.DictReader(f)
        closed_trades = [row for row in reader if row['Win/Loss'] in ['Win', 'Loss']]
    
    # トータル資金を計算
    # トータル資金 = 初期資金 + 累積損益
    initial_capital = 10000.0
    cumulative_pnl = 0
    
    # ChartDataシートのデータを作成
    chart_data = [
        ['トレード番号', '銘柄', 'PnL ($)', 'トータル資金', 'ホールド時間（分）', 'Win/Loss', '日付']
    ]
    
    for i, trade in enumerate(closed_trades, 1):
        pnl = float(trade['PnL ($)'])
        cumulative_pnl += pnl
        total_capital = initial_capital + cumulative_pnl
        
        chart_data.append([
            i,
            trade['Symbol'],
            pnl,
            total_capital,  # トータル資金（初期資金 + 累積損益）
            int(trade['Hold Time (min)']),
            trade['Win/Loss'],
            trade['Exit Time'][:10]
        ])
    
    # ChartDataシートにデータを書き込み
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range='ChartData!A1:G1000',
        valueInputOption='USER_ENTERED',
        body={'values': chart_data}
    ).execute()
    
    return len(chart_data) - 1

if __name__ == "__main__":
    count = update_chart_data()
    print(f"✅ ChartData更新完了（{count}件）")
