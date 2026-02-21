#!/usr/bin/env python3
"""
ChartDataシートのデータ型を修正
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

print("📊 ChartDataシートを修正中...")

# CSVから確定トレードのみを読み込み
with open('/root/clawd/data/trade-log.csv', 'r') as f:
    reader = csv.DictReader(f)
    closed_trades = [row for row in reader if row['Win/Loss'] in ['Win', 'Loss']]

# トータル資金を計算
initial_capital = 10000.0
cumulative_pnl = 0

# ChartDataシートのデータを作成（数値を明示的に数値型として）
chart_data = [
    ['トレード番号', '銘柄', 'PnL ($)', 'トータル資金', 'ホールド時間（分）', 'Win/Loss', '日付']
]

for i, trade in enumerate(closed_trades, 1):
    pnl = float(trade['PnL ($)'])
    cumulative_pnl += pnl
    total_capital = initial_capital + cumulative_pnl
    
    chart_data.append([
        i,  # 数値
        trade['Symbol'],  # 文字列
        pnl,  # 数値
        total_capital,  # 数値
        int(trade['Hold Time (min)']),  # 数値
        trade['Win/Loss'],  # 文字列
        trade['Exit Time'][:10]  # 文字列（日付）
    ])

# ChartDataシートにデータを書き込み（RAW形式で数値を保持）
service.spreadsheets().values().clear(
    spreadsheetId=SPREADSHEET_ID,
    range='ChartData!A1:G1000'
).execute()

service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='ChartData!A1',
    valueInputOption='RAW',  # RAW形式で数値を保持
    body={'values': chart_data}
).execute()

print(f"✅ ChartData更新完了（{len(chart_data)-1}件）")

# セル範囲に数値フォーマットを適用
spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
chart_data_sheet_id = None
for sheet in spreadsheet['sheets']:
    if sheet['properties']['title'] == 'ChartData':
        chart_data_sheet_id = sheet['properties']['sheetId']
        break

if chart_data_sheet_id:
    format_requests = [
        # トレード番号列（A列）を数値フォーマット
        {
            'repeatCell': {
                'range': {
                    'sheetId': chart_data_sheet_id,
                    'startRowIndex': 1,
                    'endRowIndex': len(chart_data),
                    'startColumnIndex': 0,
                    'endColumnIndex': 1
                },
                'cell': {
                    'userEnteredFormat': {
                        'numberFormat': {
                            'type': 'NUMBER',
                            'pattern': '0'
                        }
                    }
                },
                'fields': 'userEnteredFormat.numberFormat'
            }
        },
        # PnL列（C列）を数値フォーマット
        {
            'repeatCell': {
                'range': {
                    'sheetId': chart_data_sheet_id,
                    'startRowIndex': 1,
                    'endRowIndex': len(chart_data),
                    'startColumnIndex': 2,
                    'endColumnIndex': 3
                },
                'cell': {
                    'userEnteredFormat': {
                        'numberFormat': {
                            'type': 'NUMBER',
                            'pattern': '0.00'
                        }
                    }
                },
                'fields': 'userEnteredFormat.numberFormat'
            }
        },
        # トータル資金列（D列）を数値フォーマット
        {
            'repeatCell': {
                'range': {
                    'sheetId': chart_data_sheet_id,
                    'startRowIndex': 1,
                    'endRowIndex': len(chart_data),
                    'startColumnIndex': 3,
                    'endColumnIndex': 4
                },
                'cell': {
                    'userEnteredFormat': {
                        'numberFormat': {
                            'type': 'NUMBER',
                            'pattern': '0.00'
                        }
                    }
                },
                'fields': 'userEnteredFormat.numberFormat'
            }
        },
        # ホールド時間列（E列）を数値フォーマット
        {
            'repeatCell': {
                'range': {
                    'sheetId': chart_data_sheet_id,
                    'startRowIndex': 1,
                    'endRowIndex': len(chart_data),
                    'startColumnIndex': 4,
                    'endColumnIndex': 5
                },
                'cell': {
                    'userEnteredFormat': {
                        'numberFormat': {
                            'type': 'NUMBER',
                            'pattern': '0'
                        }
                    }
                },
                'fields': 'userEnteredFormat.numberFormat'
            }
        }
    ]
    
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': format_requests}
    ).execute()
    
    print("✅ 数値フォーマット適用完了")

print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
