#!/usr/bin/env python3
"""
グラフ用のヘルパーシートを作成
確定トレードのみをフィルタして、グラフ用のデータを作成
"""
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import csv

# 認証情報
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SERVICE_ACCOUNT_FILE = '/root/.clawdbot/google-credentials.json'
SPREADSHEET_ID = '19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'

# 認証
creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)

print("📊 グラフ用ヘルパーシートを作成中...")

# スプレッドシート情報取得
spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
sheets = spreadsheet.get('sheets', [])

# ChartDataシートが存在するか確認
chart_data_exists = any(s['properties']['title'] == 'ChartData' for s in sheets)

if not chart_data_exists:
    # ChartDataシートを作成
    print("🆕 ChartDataシートを作成中...")
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={
            'requests': [{
                'addSheet': {
                    'properties': {
                        'title': 'ChartData',
                        'gridProperties': {
                            'rowCount': 1000,
                            'columnCount': 10
                        },
                        'hidden': True  # グラフ用のデータなので非表示
                    }
                }
            }]
        }
    ).execute()
    print("✅ ChartDataシート作成完了")

# CSVから確定トレードのみを読み込み
with open('/root/clawd/data/trade-log.csv', 'r') as f:
    reader = csv.DictReader(f)
    closed_trades = [row for row in reader if row['Win/Loss'] in ['Win', 'Loss']]

print(f"📈 確定トレード: {len(closed_trades)}件")

# ChartDataシートのデータを作成
chart_data = [
    ['トレード番号', '銘柄', 'PnL ($)', '資金', 'ホールド時間（分）', 'Win/Loss', '日付']
]

for i, trade in enumerate(closed_trades, 1):
    chart_data.append([
        i,
        trade['Symbol'],
        float(trade['PnL ($)']),
        float(trade['Capital After']),
        int(trade['Hold Time (min)']),
        trade['Win/Loss'],
        trade['Exit Time'][:10]  # YYYY-MM-DD
    ])

# ChartDataシートにデータを書き込み
service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='ChartData!A1:G1000',
    valueInputOption='USER_ENTERED',
    body={'values': chart_data}
).execute()

print(f"✅ ChartDataシート更新完了（{len(chart_data)-1}件）")
print(f"🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
