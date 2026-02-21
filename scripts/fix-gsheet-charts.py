#!/usr/bin/env python3
"""
Google Sheetsのグラフを修正
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

# スプレッドシート情報取得
spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
sheets = spreadsheet.get('sheets', [])

# Chartsシートを探す
charts_sheet_id = None
for sheet in sheets:
    if sheet['properties']['title'] == 'Charts':
        charts_sheet_id = sheet['properties']['sheetId']
        break

if not charts_sheet_id:
    print("❌ Chartsシートが見つかりません")
    exit(1)

print(f"✅ Chartsシート発見: ID={charts_sheet_id}")

# 既存のグラフを削除
print("🗑️  既存のグラフを削除中...")
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
    print(f"✅ {len(delete_requests)}個のグラフを削除しました")

# Tradesシートのデータ範囲を確認
print("📊 Tradesシートのデータ範囲を確認中...")
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range='Trades!A:A'
).execute()
num_rows = len(result.get('values', []))
print(f"✅ Tradesシート: {num_rows}行")

# 新しいグラフを作成
print("📈 新しいグラフを作成中...")

# Tradesシートのシートidを取得
trades_sheet_id = None
for sheet in sheets:
    if sheet['properties']['title'] == 'Trades':
        trades_sheet_id = sheet['properties']['sheetId']
        break

if not trades_sheet_id:
    print("❌ Tradesシートが見つかりません")
    exit(1)

chart_requests = []

# 1. 資金推移グラフ（折れ線グラフ）
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': '資金推移',
                'basicChart': {
                    'chartType': 'LINE',
                    'legendPosition': 'BOTTOM_LEGEND',
                    'axis': [
                        {
                            'position': 'BOTTOM_AXIS',
                            'title': 'トレード'
                        },
                        {
                            'position': 'LEFT_AXIS',
                            'title': '資金 ($)'
                        }
                    ],
                    'domains': [
                        {
                            'domain': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': trades_sheet_id,
                                            'startRowIndex': 2,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 2,  # Symbol列
                                            'endColumnIndex': 3
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    'series': [
                        {
                            'series': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': trades_sheet_id,
                                            'startRowIndex': 2,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 14,  # Capital After列
                                            'endColumnIndex': 15
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS'
                        }
                    ]
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 0,
                        'columnIndex': 0
                    }
                }
            }
        }
    }
})

# 2. 日別PnL推移グラフ（棒グラフ）
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': '日別PnL推移',
                'basicChart': {
                    'chartType': 'COLUMN',
                    'legendPosition': 'BOTTOM_LEGEND',
                    'axis': [
                        {
                            'position': 'BOTTOM_AXIS',
                            'title': '日付'
                        },
                        {
                            'position': 'LEFT_AXIS',
                            'title': 'PnL ($)'
                        }
                    ],
                    'domains': [
                        {
                            'domain': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': trades_sheet_id,
                                            'startRowIndex': 2,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 1,  # Exit Time列
                                            'endColumnIndex': 2
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    'series': [
                        {
                            'series': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': trades_sheet_id,
                                            'startRowIndex': 2,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 6,  # PnL ($)列
                                            'endColumnIndex': 7
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS'
                        }
                    ]
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 0,
                        'columnIndex': 8
                    }
                }
            }
        }
    }
})

# 3. 銘柄別PnL比較グラフ（横棒グラフ）
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': '銘柄別PnL比較',
                'basicChart': {
                    'chartType': 'BAR',
                    'legendPosition': 'BOTTOM_LEGEND',
                    'axis': [
                        {
                            'position': 'BOTTOM_AXIS',
                            'title': 'PnL ($)'
                        },
                        {
                            'position': 'LEFT_AXIS',
                            'title': '銘柄'
                        }
                    ],
                    'domains': [
                        {
                            'domain': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': trades_sheet_id,
                                            'startRowIndex': 2,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 2,  # Symbol列
                                            'endColumnIndex': 3
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    'series': [
                        {
                            'series': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': trades_sheet_id,
                                            'startRowIndex': 2,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 6,  # PnL ($)列
                                            'endColumnIndex': 7
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'BOTTOM_AXIS'
                        }
                    ]
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 25,
                        'columnIndex': 0
                    }
                }
            }
        }
    }
})

# グラフを作成
service.spreadsheets().batchUpdate(
    spreadsheetId=SPREADSHEET_ID,
    body={'requests': chart_requests}
).execute()

print(f"✅ {len(chart_requests)}個のグラフを作成しました")
print("\n📊 作成したグラフ:")
print("  1. 資金推移（折れ線グラフ）")
print("  2. 日別PnL推移（棒グラフ）")
print("  3. 銘柄別PnL比較（横棒グラフ）")
print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
