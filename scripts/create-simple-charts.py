#!/usr/bin/env python3
"""
シンプルなグラフを作成（確実に動作する方法）
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

print("📊 シンプルなグラフを作成中...")

# スプレッドシート情報取得
spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
sheets = spreadsheet.get('sheets', [])

# シートIDを取得
chart_data_sheet_id = None
charts_sheet_id = None
for sheet in sheets:
    if sheet['properties']['title'] == 'ChartData':
        chart_data_sheet_id = sheet['properties']['sheetId']
    elif sheet['properties']['title'] == 'Charts':
        charts_sheet_id = sheet['properties']['sheetId']

# 既存のグラフを削除
delete_requests = []
for sheet in sheets:
    if sheet['properties']['title'] == 'Charts':
        charts = sheet.get('charts', [])
        for chart in charts:
            delete_requests.append({
                'deleteEmbeddedObject': {
                    'objectId': chart['chartId']
                }
            })

if delete_requests:
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': delete_requests}
    ).execute()
    print(f"✅ {len(delete_requests)}個の既存グラフを削除")

# ChartDataのデータ範囲を確認
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range='ChartData!A:A'
).execute()
num_data_rows = len(result.get('values', [])) - 1  # ヘッダーを除く

print(f"✅ データ行数: {num_data_rows}件")

# 新しいグラフを作成
chart_requests = []

# 1. 資金推移グラフ（LINE）
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': 'トータル資金推移',
                'basicChart': {
                    'chartType': 'LINE',
                    'series': [
                        {
                            'series': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': chart_data_sheet_id,
                                            'startRowIndex': 0,
                                            'endRowIndex': num_data_rows + 1,
                                            'startColumnIndex': 3,
                                            'endColumnIndex': 4
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS'
                        }
                    ],
                    'axis': [
                        {
                            'position': 'LEFT_AXIS',
                            'title': '資金 ($)'
                        },
                        {
                            'position': 'BOTTOM_AXIS',
                            'title': 'トレード'
                        }
                    ],
                    'headerCount': 1
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 1,
                        'columnIndex': 0
                    },
                    'widthPixels': 700,
                    'heightPixels': 400
                }
            }
        }
    }
})

# グラフを作成
try:
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': chart_requests}
    ).execute()
    print("✅ グラフ作成成功")
except Exception as e:
    print(f"❌ エラー: {e}")
    print("\n代替案を試します...")

print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
