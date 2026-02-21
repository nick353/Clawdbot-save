#!/usr/bin/env python3
"""
Statisticsシートを修正
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

print("📊 Statisticsシートを更新中...")

# Statisticsシートのデータを更新
statistics_data = [
    ['Bitget自動トレーディング - Statistics', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['📊 銘柄別統計', '', '', '', '', ''],
    ['銘柄', 'トレード数', '勝ち', '負け', '勝率', '総損益 ($)'],
    ['=UNIQUE(Trades!C3:C)', '=COUNTIF(Trades!C3:C,A5)', '=COUNTIFS(Trades!C3:C,A5,Trades!I3:I,"Win")', '=COUNTIFS(Trades!C3:C,A5,Trades!I3:I,"Loss")', '=IF(B5>0,C5/B5,0)', '=SUMIF(Trades!C3:C,A5,Trades!G3:G)'],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['📊 エグジット理由別統計', '', '', '', '', ''],
    ['理由', 'トレード数', '勝ち', '負け', '勝率', '総損益 ($)'],
    ['=UNIQUE(Trades!K3:K)', '=COUNTIF(Trades!K3:K,A10)', '=COUNTIFS(Trades!K3:K,A10,Trades!I3:I,"Win")', '=COUNTIFS(Trades!K3:K,A10,Trades!I3:I,"Loss")', '=IF(B10>0,C10/B10,0)', '=SUMIF(Trades!K3:K,A10,Trades!G3:G)'],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['📊 日別統計', '', '', '', '', ''],
    ['日付', 'トレード数', '勝ち', '負け', '勝率', '総損益 ($)'],
    ['=UNIQUE(ARRAYFORMULA(TEXT(Trades!B3:B,"YYYY-MM-DD")))', '=COUNTIF(ARRAYFORMULA(TEXT(Trades!B3:B,"YYYY-MM-DD")),A15)', '=COUNTIFS(ARRAYFORMULA(TEXT(Trades!B3:B,"YYYY-MM-DD")),A15,Trades!I3:I,"Win")', '=COUNTIFS(ARRAYFORMULA(TEXT(Trades!B3:B,"YYYY-MM-DD")),A15,Trades!I3:I,"Loss")', '=IF(B15>0,C15/B15,0)', '=SUMIF(ARRAYFORMULA(TEXT(Trades!B3:B,"YYYY-MM-DD")),A15,Trades!G3:G)']
]

# Statisticsシートにデータを書き込み
service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='Statistics!A1:F16',
    valueInputOption='USER_ENTERED',
    body={'values': statistics_data}
).execute()

print("✅ Statisticsシート更新完了")

# フォーマット設定
statistics_sheet_id = None
spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
for sheet in spreadsheet['sheets']:
    if sheet['properties']['title'] == 'Statistics':
        statistics_sheet_id = sheet['properties']['sheetId']
        break

if statistics_sheet_id:
    requests = [
        # タイトル行のフォーマット
        {
            'repeatCell': {
                'range': {
                    'sheetId': statistics_sheet_id,
                    'startRowIndex': 0,
                    'endRowIndex': 1,
                    'startColumnIndex': 0,
                    'endColumnIndex': 6
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
        # ヘッダー行のフォーマット
        {
            'repeatCell': {
                'range': {
                    'sheetId': statistics_sheet_id,
                    'startRowIndex': 3,
                    'endRowIndex': 4,
                    'startColumnIndex': 0,
                    'endColumnIndex': 6
                },
                'cell': {
                    'userEnteredFormat': {
                        'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9},
                        'textFormat': {
                            'bold': True
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
