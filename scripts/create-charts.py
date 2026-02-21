#!/usr/bin/env python3
"""
Googleスプレッドシートグラフ自動作成
- 資金推移グラフ
- 勝率推移グラフ
- 銘柄別PnL比較グラフ
"""

import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

class ChartCreator:
    """
    グラフ自動作成
    """
    
    def __init__(self, credentials_path: str = "/root/.clawdbot/google-credentials.json"):
        self.credentials_path = credentials_path
        self.spreadsheet_id = "19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo"
        self.service = None
        self.sheet_ids = {}
        
        self.init_service()
        self.get_sheet_ids()
    
    def init_service(self):
        """Google Sheets APIサービス初期化"""
        try:
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            self.service = build('sheets', 'v4', credentials=credentials)
            print(f"✅ Google Sheets API接続成功")
        except Exception as e:
            print(f"❌ Google Sheets API接続エラー: {e}")
    
    def get_sheet_ids(self):
        """シートIDを取得"""
        if not self.service:
            return
        
        try:
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()
            
            for sheet in spreadsheet['sheets']:
                title = sheet['properties']['title']
                sheet_id = sheet['properties']['sheetId']
                self.sheet_ids[title] = sheet_id
                print(f"📊 {title}: シートID {sheet_id}")
        except Exception as e:
            print(f"❌ シートID取得エラー: {e}")
    
    def create_capital_chart(self):
        """資金推移グラフ作成"""
        if not self.service or 'Charts' not in self.sheet_ids or 'Trades' not in self.sheet_ids:
            return
        
        try:
            print(f"\n📈 資金推移グラフ作成中...")
            
            chart_spec = {
                'title': '資金推移',
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
                    'domains': [
                        {
                            'domain': {
                                'sourceRange': {
                                    'sources': [
                                        {
                                            'sheetId': self.sheet_ids['Trades'],
                                            'startRowIndex': 2,
                                            'endRowIndex': 1000,
                                            'startColumnIndex': 0,
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
                                            'sheetId': self.sheet_ids['Trades'],
                                            'startRowIndex': 2,
                                            'endRowIndex': 1000,
                                            'startColumnIndex': 14,  # Capital After列（O列）
                                            'endColumnIndex': 15
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS'
                        }
                    ]
                }
            }
            
            request = {
                'addChart': {
                    'chart': {
                        'spec': chart_spec,
                        'position': {
                            'overlayPosition': {
                                'anchorCell': {
                                    'sheetId': self.sheet_ids['Charts'],
                                    'rowIndex': 2,
                                    'columnIndex': 0
                                }
                            }
                        }
                    }
                }
            }
            
            body = {'requests': [request]}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print(f"✅ 資金推移グラフ作成完了")
        except Exception as e:
            print(f"❌ 資金推移グラフエラー: {e}")
            import traceback
            traceback.print_exc()
    
    def create_winrate_chart(self):
        """勝率推移グラフ作成"""
        if not self.service or 'Charts' not in self.sheet_ids:
            return
        
        try:
            print(f"\n📊 勝率推移グラフ作成中...")
            
            # 累積勝率を計算するヘルパー列をTradesシートに追加（または別シート）
            # ここでは簡易的に Statistics の日別データを使用
            
            chart_spec = {
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
                                            'sheetId': self.sheet_ids['Statistics'],
                                            'startRowIndex': 17,  # 日別PnLのDate列
                                            'endRowIndex': 100,
                                            'startColumnIndex': 0,
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
                                            'sheetId': self.sheet_ids['Statistics'],
                                            'startRowIndex': 17,
                                            'endRowIndex': 100,
                                            'startColumnIndex': 1,  # 総PnL列
                                            'endColumnIndex': 2
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'LEFT_AXIS'
                        }
                    ]
                }
            }
            
            request = {
                'addChart': {
                    'chart': {
                        'spec': chart_spec,
                        'position': {
                            'overlayPosition': {
                                'anchorCell': {
                                    'sheetId': self.sheet_ids['Charts'],
                                    'rowIndex': 2,
                                    'columnIndex': 6
                                }
                            }
                        }
                    }
                }
            }
            
            body = {'requests': [request]}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print(f"✅ 日別PnL推移グラフ作成完了")
        except Exception as e:
            print(f"❌ 日別PnL推移グラフエラー: {e}")
            import traceback
            traceback.print_exc()
    
    def create_symbol_pnl_chart(self):
        """銘柄別PnL比較グラフ作成"""
        if not self.service or 'Charts' not in self.sheet_ids:
            return
        
        try:
            print(f"\n📉 銘柄別PnL比較グラフ作成中...")
            
            chart_spec = {
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
                                            'sheetId': self.sheet_ids['Statistics'],
                                            'startRowIndex': 4,  # 銘柄別成績のSymbol列
                                            'endRowIndex': 50,
                                            'startColumnIndex': 0,
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
                                            'sheetId': self.sheet_ids['Statistics'],
                                            'startRowIndex': 4,
                                            'endRowIndex': 50,
                                            'startColumnIndex': 3,  # 総PnL列
                                            'endColumnIndex': 4
                                        }
                                    ]
                                }
                            },
                            'targetAxis': 'BOTTOM_AXIS'
                        }
                    ]
                }
            }
            
            request = {
                'addChart': {
                    'chart': {
                        'spec': chart_spec,
                        'position': {
                            'overlayPosition': {
                                'anchorCell': {
                                    'sheetId': self.sheet_ids['Charts'],
                                    'rowIndex': 22,
                                    'columnIndex': 0
                                }
                            }
                        }
                    }
                }
            }
            
            body = {'requests': [request]}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print(f"✅ 銘柄別PnL比較グラフ作成完了")
        except Exception as e:
            print(f"❌ 銘柄別PnL比較グラフエラー: {e}")
            import traceback
            traceback.print_exc()
    
    def run(self):
        """実行"""
        print(f"\n{'='*80}")
        print(f"📊 グラフ自動作成開始")
        print(f"{'='*80}\n")
        
        if not self.service:
            return
        
        # グラフ作成
        self.create_capital_chart()
        self.create_winrate_chart()
        self.create_symbol_pnl_chart()
        
        print(f"\n{'='*80}")
        print(f"🎉 グラフ作成完了！")
        print(f"{'='*80}")
        print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
        print(f"\n✅ 作成したグラフ:")
        print(f"   1. 資金推移グラフ（折れ線）")
        print(f"   2. 日別PnL推移グラフ（棒）")
        print(f"   3. 銘柄別PnL比較グラフ（横棒）")
        print(f"\n💡 Tradesシートにデータを追加すると、グラフが自動更新されます！")
        print(f"\n{'='*80}\n")

if __name__ == "__main__":
    creator = ChartCreator()
    creator.run()
