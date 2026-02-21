#!/usr/bin/env python3
"""
Google Sheetsにグラフを追加
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os

CREDENTIALS_PATH = '/root/clawd/config/google-sheets-credentials.json'
SHEET_URL = 'https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'

def add_charts():
    """グラフを追加"""
    
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_PATH, scope)
    client = gspread.authorize(creds)
    
    print("🔐 Google Sheets認証中...")
    sheet = client.open_by_url(SHEET_URL)
    print(f"✅ スプレッドシート開きました")
    
    # Historyワークシート取得
    history_ws = sheet.worksheet("History")
    
    print("📈 グラフを追加中...")
    
    # グラフ1: 総資金の推移（折れ線グラフ）
    chart1_spec = {
        "addChart": {
            "chart": {
                "spec": {
                    "title": "総資金の推移",
                    "basicChart": {
                        "chartType": "LINE",
                        "legendPosition": "BOTTOM_LEGEND",
                        "axis": [
                            {
                                "position": "BOTTOM_AXIS",
                                "title": "日時"
                            },
                            {
                                "position": "LEFT_AXIS",
                                "title": "資金 ($)"
                            }
                        ],
                        "domains": [
                            {
                                "domain": {
                                    "sourceRange": {
                                        "sources": [
                                            {
                                                "sheetId": history_ws.id,
                                                "startRowIndex": 0,
                                                "endRowIndex": 1000,
                                                "startColumnIndex": 0,
                                                "endColumnIndex": 1
                                            }
                                        ]
                                    }
                                }
                            }
                        ],
                        "series": [
                            {
                                "series": {
                                    "sourceRange": {
                                        "sources": [
                                            {
                                                "sheetId": history_ws.id,
                                                "startRowIndex": 0,
                                                "endRowIndex": 1000,
                                                "startColumnIndex": 1,
                                                "endColumnIndex": 2
                                            }
                                        ]
                                    }
                                },
                                "targetAxis": "LEFT_AXIS"
                            }
                        ],
                        "headerCount": 1
                    }
                },
                "position": {
                    "overlayPosition": {
                        "anchorCell": {
                            "sheetId": history_ws.id,
                            "rowIndex": 1,
                            "columnIndex": 6
                        }
                    }
                }
            }
        }
    }
    
    # グラフ2: 資金内訳（積み上げ面グラフ）
    chart2_spec = {
        "addChart": {
            "chart": {
                "spec": {
                    "title": "資金内訳（現金 vs ポジション価値）",
                    "basicChart": {
                        "chartType": "AREA",
                        "legendPosition": "BOTTOM_LEGEND",
                        "stackedType": "STACKED",
                        "axis": [
                            {
                                "position": "BOTTOM_AXIS",
                                "title": "日時"
                            },
                            {
                                "position": "LEFT_AXIS",
                                "title": "資金 ($)"
                            }
                        ],
                        "domains": [
                            {
                                "domain": {
                                    "sourceRange": {
                                        "sources": [
                                            {
                                                "sheetId": history_ws.id,
                                                "startRowIndex": 0,
                                                "endRowIndex": 1000,
                                                "startColumnIndex": 0,
                                                "endColumnIndex": 1
                                            }
                                        ]
                                    }
                                }
                            }
                        ],
                        "series": [
                            {
                                "series": {
                                    "sourceRange": {
                                        "sources": [
                                            {
                                                "sheetId": history_ws.id,
                                                "startRowIndex": 0,
                                                "endRowIndex": 1000,
                                                "startColumnIndex": 2,
                                                "endColumnIndex": 3
                                            }
                                        ]
                                    }
                                },
                                "targetAxis": "LEFT_AXIS"
                            },
                            {
                                "series": {
                                    "sourceRange": {
                                        "sources": [
                                            {
                                                "sheetId": history_ws.id,
                                                "startRowIndex": 0,
                                                "endRowIndex": 1000,
                                                "startColumnIndex": 3,
                                                "endColumnIndex": 4
                                            }
                                        ]
                                    }
                                },
                                "targetAxis": "LEFT_AXIS"
                            }
                        ],
                        "headerCount": 1
                    }
                },
                "position": {
                    "overlayPosition": {
                        "anchorCell": {
                            "sheetId": history_ws.id,
                            "rowIndex": 20,
                            "columnIndex": 6
                        }
                    }
                }
            }
        }
    }
    
    # グラフ3: 未実現損益の推移（折れ線グラフ）
    chart3_spec = {
        "addChart": {
            "chart": {
                "spec": {
                    "title": "未実現損益の推移",
                    "basicChart": {
                        "chartType": "LINE",
                        "legendPosition": "BOTTOM_LEGEND",
                        "axis": [
                            {
                                "position": "BOTTOM_AXIS",
                                "title": "日時"
                            },
                            {
                                "position": "LEFT_AXIS",
                                "title": "未実現損益 ($)"
                            }
                        ],
                        "domains": [
                            {
                                "domain": {
                                    "sourceRange": {
                                        "sources": [
                                            {
                                                "sheetId": history_ws.id,
                                                "startRowIndex": 0,
                                                "endRowIndex": 1000,
                                                "startColumnIndex": 0,
                                                "endColumnIndex": 1
                                            }
                                        ]
                                    }
                                }
                            }
                        ],
                        "series": [
                            {
                                "series": {
                                    "sourceRange": {
                                        "sources": [
                                            {
                                                "sheetId": history_ws.id,
                                                "startRowIndex": 0,
                                                "endRowIndex": 1000,
                                                "startColumnIndex": 4,
                                                "endColumnIndex": 5
                                            }
                                        ]
                                    }
                                },
                                "targetAxis": "LEFT_AXIS",
                                "color": {
                                    "red": 0.9,
                                    "green": 0.3,
                                    "blue": 0.3
                                }
                            }
                        ],
                        "headerCount": 1
                    }
                },
                "position": {
                    "overlayPosition": {
                        "anchorCell": {
                            "sheetId": history_ws.id,
                            "rowIndex": 39,
                            "columnIndex": 6
                        }
                    }
                }
            }
        }
    }
    
    # バッチリクエスト実行
    body = {
        'requests': [chart1_spec, chart2_spec, chart3_spec]
    }
    
    sheet.batch_update(body)
    
    print("✅ グラフ追加完了！")
    print(f"📊 URL: {sheet.url}")

if __name__ == '__main__':
    try:
        add_charts()
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
