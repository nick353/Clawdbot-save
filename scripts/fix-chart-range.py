#!/usr/bin/env python3
"""
グラフのデータ範囲を修正
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
chart_data_sheet_id = None
charts_sheet_id = None
for sheet in sheets:
    if sheet['properties']['title'] == 'ChartData':
        chart_data_sheet_id = sheet['properties']['sheetId']
    elif sheet['properties']['title'] == 'Charts':
        charts_sheet_id = sheet['properties']['sheetId']

print(f"✅ ChartDataシート: ID={chart_data_sheet_id}")
print(f"✅ Chartsシート: ID={charts_sheet_id}")

# ChartDataのデータ範囲を確認
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range='ChartData!A:A'
).execute()
num_rows = len(result.get('values', []))
print(f"✅ ChartData: {num_rows}行（ヘッダー含む）")

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

# 新しいグラフを作成（データ範囲を正しく設定）
print("\n📈 新しいグラフを作成中...")

chart_requests = []

# 1. トータル資金推移グラフ
# ヘッダー行（0行目）を除外し、データ行（1行目以降）のみを使用
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': 'トータル資金推移（ポジション含む）',
                'subtitle': '初期資金 + 累積損益',
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
                            'title': 'トータル資金 ($)'
                        }
                    ],
                    'domains': [
                        {
                            'domain': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': chart_data_sheet_id,
                                            'startRowIndex': 1,  # ヘッダーをスキップ
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 0,  # トレード番号（A列）
                                            'endColumnIndex': 1
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
                                            'sheetId': chart_data_sheet_id,
                                            'startRowIndex': 1,  # ヘッダーをスキップ
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 3,  # トータル資金（D列）
                                            'endColumnIndex': 4
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS',
                            'type': 'LINE',
                            'lineStyle': {
                                'width': 3
                            },
                            'pointStyle': {
                                'shape': 'CIRCLE',
                                'size': 5
                            }
                        }
                    ],
                    'headerCount': 0  # ヘッダーなし
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
                    'widthPixels': 700,
                    'heightPixels': 400
                }
            }
        }
    }
})

# 2. トレード別損益グラフ
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': 'トレード別損益',
                'subtitle': '各トレードの損益（銘柄別）',
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
                                            'sheetId': chart_data_sheet_id,
                                            'startRowIndex': 1,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 1,  # 銘柄（B列）
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
                                            'sheetId': chart_data_sheet_id,
                                            'startRowIndex': 1,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 2,  # PnL（C列）
                                            'endColumnIndex': 3
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS',
                            'type': 'COLUMN'
                        }
                    ],
                    'headerCount': 0
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 1,
                        'columnIndex': 9
                    },
                    'offsetXPixels': 10,
                    'offsetYPixels': 10,
                    'widthPixels': 700,
                    'heightPixels': 400
                }
            }
        }
    }
})

# 3. 日別損益グラフ
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': '日別損益',
                'subtitle': '日付ごとの損益',
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
                                            'sheetId': chart_data_sheet_id,
                                            'startRowIndex': 1,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 6,  # 日付（G列）
                                            'endColumnIndex': 7
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
                                            'sheetId': chart_data_sheet_id,
                                            'startRowIndex': 1,
                                            'endRowIndex': num_rows,
                                            'startColumnIndex': 2,  # PnL（C列）
                                            'endColumnIndex': 3
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS',
                            'type': 'COLUMN'
                        }
                    ],
                    'headerCount': 0
                }
            },
            'position': {
                'overlayPosition': {
                    'anchorCell': {
                        'sheetId': charts_sheet_id,
                        'rowIndex': 25,
                        'columnIndex': 0
                    },
                    'offsetXPixels': 10,
                    'offsetYPixels': 10,
                    'widthPixels': 700,
                    'heightPixels': 400
                }
            }
        }
    }
})

# 4. 勝敗分布（円グラフ）
chart_requests.append({
    'addChart': {
        'chart': {
            'spec': {
                'title': '勝敗分布',
                'subtitle': 'Win vs Loss',
                'pieChart': {
                    'legendPosition': 'RIGHT_LEGEND',
                    'domain': {
                        'sourceRange': {
                            'sources': [
                                {
                                    'sheetId': chart_data_sheet_id,
                                    'startRowIndex': 1,
                                    'endRowIndex': num_rows,
                                    'startColumnIndex': 5,  # Win/Loss（F列）
                                    'endColumnIndex': 6
                                }
                            ]
                        }
                    },
                    'series': {
                        'sourceRange': {
                            'sources': [
                                {
                                    'sheetId': chart_data_sheet_id,
                                    'startRowIndex': 1,
                                    'endRowIndex': num_rows,
                                    'startColumnIndex': 5,
                                    'endColumnIndex': 6
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
                        'rowIndex': 25,
                        'columnIndex': 9
                    },
                    'offsetXPixels': 10,
                    'offsetYPixels': 10,
                    'widthPixels': 500,
                    'heightPixels': 400
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
print("  1. トータル資金推移（ポジション含む）")
print("  2. トレード別損益")
print("  3. 日別損益")
print("  4. 勝敗分布")
print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
print("\n✅ データ範囲を修正しました（ヘッダー行を除外）")
