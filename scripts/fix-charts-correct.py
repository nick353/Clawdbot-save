#!/usr/bin/env python3
"""
Chartsのグラフを正しく修正
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

# シートIDを取得
trades_sheet_id = None
charts_sheet_id = None
for sheet in sheets:
    if sheet['properties']['title'] == 'Trades':
        trades_sheet_id = sheet['properties']['sheetId']
    elif sheet['properties']['title'] == 'Charts':
        charts_sheet_id = sheet['properties']['sheetId']

if not trades_sheet_id or not charts_sheet_id:
    print("❌ 必要なシートが見つかりません")
    exit(1)

print(f"✅ Tradesシート: ID={trades_sheet_id}")
print(f"✅ Chartsシート: ID={charts_sheet_id}")

# Tradesシートのデータ範囲を確認
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range='Trades!A:A'
).execute()
num_rows = len(result.get('values', []))
print(f"✅ Tradesシート: {num_rows}行")

# 既存のグラフを削除
print("\n🗑️  既存のグラフを削除中...")
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

# 新しいグラフを作成
print("\n📈 正しいグラフを作成中...")

chart_requests = []

# 1. 資金推移グラフ（全体の資金推移）
# X軸: トレード番号、Y軸: Capital After（累積資金）
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': '資金推移（全体）',
                'basicChart': {
                    'chartType': 'LINE',
                    'legendPosition': 'BOTTOM_LEGEND',
                    'axis': [
                        {
                            'position': 'BOTTOM_AXIS',
                            'title': 'トレード番号'
                        },
                        {
                            'position': 'LEFT_AXIS',
                            'title': '資金 ($)'
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
                                            'startColumnIndex': 14,  # Capital After列（O列）
                                            'endColumnIndex': 15
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS',
                            'type': 'LINE'
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
                    'offsetXPixels': 10,
                    'offsetYPixels': 10,
                    'widthPixels': 600,
                    'heightPixels': 371
                }
            }
        }
    }
})

# 2. トレード別PnLグラフ（各トレードの損益）
# X軸: 銘柄、Y軸: PnL ($)
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': 'トレード別損益',
                'basicChart': {
                    'chartType': 'COLUMN',
                    'legendPosition': 'BOTTOM_LEGEND',
                    'axis': [
                        {
                            'position': 'BOTTOM_AXIS',
                            'title': '銘柄'
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
                                            'startColumnIndex': 2,  # Symbol列（C列）
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
                                            'startColumnIndex': 6,  # PnL ($)列（G列）
                                            'endColumnIndex': 7
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS',
                            'type': 'COLUMN',
                            'color': {
                                'red': 0.3,
                                'green': 0.7,
                                'blue': 1.0
                            }
                        }
                    ]
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 1,
                        'columnIndex': 8
                    },
                    'offsetXPixels': 10,
                    'offsetYPixels': 10,
                    'widthPixels': 600,
                    'heightPixels': 371
                }
            }
        }
    }
})

# 3. 勝率グラフ（Win vs Loss）
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': '勝敗分布',
                'pieChart': {
                    'legendPosition': 'RIGHT_LEGEND',
                    'domain': {
                        'sourceRange': {
                            'sources': [
                                {
                                    'sheetId': trades_sheet_id,
                                    'startRowIndex': 2,
                                    'endRowIndex': num_rows,
                                    'startColumnIndex': 8,  # Win/Loss列（I列）
                                    'endColumnIndex': 9
                                }
                            ]
                        }
                    },
                    'series': {
                        'sourceRange': {
                            'sources': [
                                {
                                    'sheetId': trades_sheet_id,
                                    'startRowIndex': 2,
                                    'endRowIndex': num_rows,
                                    'startColumnIndex': 8,  # Win/Loss列（I列）
                                    'endColumnIndex': 9
                                }
                            ]
                        }
                    }
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 22,
                        'columnIndex': 0
                    },
                    'offsetXPixels': 10,
                    'offsetYPixels': 10,
                    'widthPixels': 400,
                    'heightPixels': 300
                }
            }
        }
    }
})

# 4. ホールド時間分布グラフ
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': 'ホールド時間分布',
                'basicChart': {
                    'chartType': 'COLUMN',
                    'legendPosition': 'BOTTOM_LEGEND',
                    'axis': [
                        {
                            'position': 'BOTTOM_AXIS',
                            'title': '銘柄'
                        },
                        {
                            'position': 'LEFT_AXIS',
                            'title': 'ホールド時間（分）'
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
                                            'startColumnIndex': 11,  # Hold Time列（L列）
                                            'endColumnIndex': 12
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS',
                            'type': 'COLUMN'
                        }
                    ]
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 22,
                        'columnIndex': 8
                    },
                    'offsetXPixels': 10,
                    'offsetYPixels': 10,
                    'widthPixels': 600,
                    'heightPixels': 300
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
print("  1. 資金推移（全体）- 全てのトレードを通じた資金の変化")
print("  2. トレード別損益 - 各トレードの損益を銘柄別に表示")
print("  3. 勝敗分布 - WinとLossの割合（円グラフ）")
print("  4. ホールド時間分布 - 各トレードの保有時間")
print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
