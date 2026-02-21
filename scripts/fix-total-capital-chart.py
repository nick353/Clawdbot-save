#!/usr/bin/env python3
"""
資金推移グラフを修正：トータル資金（ポジション含む）で表示
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

print("📊 トータル資金を計算中...")

# CSVから確定トレードのみを読み込み
with open('/root/clawd/data/trade-log.csv', 'r') as f:
    reader = csv.DictReader(f)
    closed_trades = [row for row in reader if row['Win/Loss'] in ['Win', 'Loss']]

print(f"✅ 確定トレード: {len(closed_trades)}件")

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
    
    if i <= 5:  # 最初の5件を表示
        print(f"  {i}. {trade['Symbol']}: PnL=${pnl:+.2f}, 累積=${cumulative_pnl:+.2f}, トータル=${total_capital:.2f}")

print(f"\n💰 最終トータル資金: ${total_capital:.2f}")
print(f"💰 初期資金: ${initial_capital:.2f}")
print(f"💰 累積損益: ${cumulative_pnl:+.2f}")

# ChartDataシートにデータを書き込み
service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='ChartData!A1:G1000',
    valueInputOption='USER_ENTERED',
    body={'values': chart_data}
).execute()

print(f"\n✅ ChartData更新完了（{len(chart_data)-1}件）")

# グラフの説明を更新
print("\n📊 グラフの表示内容:")
print("  資金推移 = 初期資金 + 累積損益")
print("  ※ポジションに使っている資金も含まれた総資産です")
print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
