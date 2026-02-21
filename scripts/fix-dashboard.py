#!/usr/bin/env python3
"""
Dashboardシートを修正
"""
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# 認証情報
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SERVICE_ACCOUNT_FILE = '/root/.clawdbot/google-credentials.json'
SPREADSHEET_ID = '19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'

# 認証
creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)

print("📊 Dashboardシートを更新中...")

# Dashboardシートのデータを更新
dashboard_data = [
    ['Bitget自動トレーディング - Dashboard', '', '', ''],
    ['', '', '', ''],
    ['📊 総合成績', '', '', ''],
    ['トータルトレード数', '=COUNTA(Trades!C3:C)', '', ''],
    ['勝ちトレード', '=COUNTIF(Trades!I3:I,"Win")', '', ''],
    ['負けトレード', '=COUNTIF(Trades!I3:I,"Loss")', '', ''],
    ['勝率', '=IF(B4>0,B5/B4,0)', '', ''],
    ['総損益 ($)', '=SUM(Trades!G3:G)', '', ''],
    ['平均損益 ($)', '=AVERAGE(Trades!G3:G)', '', ''],
    ['最大利益 ($)', '=MAX(Trades!G3:G)', '', ''],
    ['最大損失 ($)', '=MIN(Trades!G3:G)', '', ''],
    ['', '', '', ''],
    ['💰 資金状況', '', '', ''],
    ['初期資金', '10000', '', ''],
    ['現在資金', '=MAX(Trades!O3:O)', '', ''],
    ['総損益率 (%)', '=(B15-B14)/B14', '', ''],
    ['', '', '', ''],
    ['⏱️ トレード時間', '', '', ''],
    ['平均保有時間（分）', '=AVERAGE(Trades!L3:L)', '', ''],
    ['最長保有時間（分）', '=MAX(Trades!L3:L)', '', ''],
    ['最短保有時間（分）', '=MIN(Trades!L3:L)', '', '']
]

# Dashboardシートにデータを書き込み
service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='Dashboard!A1:D21',
    valueInputOption='USER_ENTERED',
    body={'values': dashboard_data}
).execute()

print("✅ Dashboardシート更新完了")

# フォーマット設定
requests = [
    # タイトル行のフォーマット
    {
        'repeatCell': {
            'range': {
                'sheetId': 0,  # Dashboard is usually the first sheet
                'startRowIndex': 0,
                'endRowIndex': 1,
                'startColumnIndex': 0,
                'endColumnIndex': 4
            },
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 1.0},
                    'textFormat': {
                        'bold': True,
                        'fontSize': 14,
                        'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}
                    },
                    'horizontalAlignment': 'CENTER'
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
    },
    # セクションヘッダーのフォーマット
    {
        'repeatCell': {
            'range': {
                'sheetId': 0,
                'startRowIndex': 2,
                'endRowIndex': 3,
                'startColumnIndex': 0,
                'endColumnIndex': 4
            },
            'cell': {
                'userEnteredFormat': {
                    'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9},
                    'textFormat': {
                        'bold': True,
                        'fontSize': 12
                    }
                }
            },
            'fields': 'userEnteredFormat(backgroundColor,textFormat)'
        }
    }
]

service.spreadsheets().batchUpdate(
    spreadsheetId=SPREADSHEET_ID,
    body={'requests': requests}
).execute()

print("✅ フォーマット設定完了")
print(f"🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
