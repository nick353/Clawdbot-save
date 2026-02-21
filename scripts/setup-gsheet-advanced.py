#!/usr/bin/env python3
"""
Googleスプレッドシート高度セットアップ
- ダッシュボード
- トレード記録
- 統計
- グラフ
"""

import os
import sys
from typing import Dict, List
from google.oauth2 import service_account
from googleapiclient.discovery import build

class GoogleSheetAdvancedSetup:
    """
    Googleスプレッドシート高度セットアップ
    """
    
    def __init__(self, credentials_path: str = "/root/.clawdbot/google-credentials.json"):
        self.credentials_path = credentials_path
        self.spreadsheet_id = "19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo"
        self.service = None
        
        # シートID管理
        self.sheet_ids = {
            'Dashboard': 0,
            'Trades': 1,
            'Statistics': 2,
            'Charts': 3
        }
        
        self.init_service()
    
    def init_service(self):
        """Google Sheets APIサービス初期化"""
        try:
            if not os.path.exists(self.credentials_path):
                print(f"⚠️  認証情報が見つかりません: {self.credentials_path}")
                print(f"\n💡 手動セットアップガイド:")
                print(f"   /root/clawd/docs/gsheet-setup-manual.md を参照")
                return
            
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            
            self.service = build('sheets', 'v4', credentials=credentials)
            print(f"✅ Google Sheets API接続成功")
        except Exception as e:
            print(f"❌ Google Sheets API接続エラー: {e}")
    
    def create_sheets(self):
        """シート作成"""
        if not self.service:
            return
        
        try:
            print(f"📝 シート構成作成中...")
            
            requests = []
            
            # 既存シートを削除（Sheet1など）
            # 新しいシートを作成
            
            # Dashboard
            requests.append({
                'addSheet': {
                    'properties': {
                        'sheetId': self.sheet_ids['Dashboard'],
                        'title': 'Dashboard',
                        'index': 0,
                        'gridProperties': {
                            'rowCount': 100,
                            'columnCount': 10
                        }
                    }
                }
            })
            
            # Trades
            requests.append({
                'addSheet': {
                    'properties': {
                        'sheetId': self.sheet_ids['Trades'],
                        'title': 'Trades',
                        'index': 1,
                        'gridProperties': {
                            'rowCount': 1000,
                            'columnCount': 16,
                            'frozenRowCount': 2  # ヘッダー行を固定
                        }
                    }
                }
            })
            
            # Statistics
            requests.append({
                'addSheet': {
                    'properties': {
                        'sheetId': self.sheet_ids['Statistics'],
                        'title': 'Statistics',
                        'index': 2,
                        'gridProperties': {
                            'rowCount': 100,
                            'columnCount': 10
                        }
                    }
                }
            })
            
            # Charts
            requests.append({
                'addSheet': {
                    'properties': {
                        'sheetId': self.sheet_ids['Charts'],
                        'title': 'Charts',
                        'index': 3,
                        'gridProperties': {
                            'rowCount': 100,
                            'columnCount': 10
                        }
                    }
                }
            })
            
            body = {'requests': requests}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print(f"✅ シート作成完了")
        except Exception as e:
            print(f"⚠️  シート作成エラー（既存の可能性）: {e}")
    
    def setup_dashboard(self):
        """ダッシュボードセットアップ"""
        if not self.service:
            return
        
        try:
            print(f"📊 ダッシュボードセットアップ中...")
            
            # タイトル
            values = [
                ['🐥 Bitget自動トレーディング - ダッシュボード'],
                [''],
                ['📈 総合成績', '', '', '', '', '📅 最近のトレード'],
                ['総トレード数', '=COUNTA(Trades!C3:C1000)', '', '', '', 'Symbol', 'Entry Time', 'PnL ($)', 'Win/Loss'],
                ['勝率', '=COUNTIF(Trades!I3:I1000,"Win")/COUNTA(Trades!I3:I1000)', '', '', '', '=Trades!C3', '=Trades!A3', '=Trades!G3', '=Trades!I3'],
                ['総PnL ($)', '=SUM(Trades!G3:G1000)', '', '', '', '=Trades!C4', '=Trades!A4', '=Trades!G4', '=Trades!I4'],
                ['現在資金 ($)', '=10000+SUM(Trades!G3:G1000)', '', '', '', '=Trades!C5', '=Trades!A5', '=Trades!G5', '=Trades!I5'],
                ['', '', '', '', '', '=Trades!C6', '=Trades!A6', '=Trades!G6', '=Trades!I6'],
                ['', '', '', '', '', '=Trades!C7', '=Trades!A7', '=Trades!G7', '=Trades!I7'],
                [''],
                ['💡 更新日時', '=NOW()']
            ]
            
            body = {'values': values}
            
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='Dashboard!A1',
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()
            
            # フォーマット設定
            requests = []
            
            # タイトル行
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': self.sheet_ids['Dashboard'],
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 0.9},
                            'textFormat': {
                                'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                                'bold': True,
                                'fontSize': 16
                            },
                            'horizontalAlignment': 'CENTER'
                        }
                    },
                    'fields': 'userEnteredFormat'
                }
            })
            
            # セクションヘッダー
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': self.sheet_ids['Dashboard'],
                        'startRowIndex': 2,
                        'endRowIndex': 3
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9},
                            'textFormat': {'bold': True, 'fontSize': 12}
                        }
                    },
                    'fields': 'userEnteredFormat'
                }
            })
            
            body = {'requests': requests}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print(f"✅ ダッシュボード完成")
        except Exception as e:
            print(f"❌ ダッシュボードエラー: {e}")
    
    def setup_trades_sheet(self):
        """トレード記録シートセットアップ"""
        if not self.service:
            return
        
        try:
            print(f"📝 トレード記録シートセットアップ中...")
            
            # 1行目: タイトル
            # 2行目: ヘッダー
            # 3行目以降: データ
            
            values = [
                ['📊 Bitget自動トレーディング - トレード記録'],
                ['Entry Time', 'Exit Time', 'Symbol', 'Entry Price', 'Exit Price', 'Quantity', 'PnL ($)', 'PnL (%)', 'Win/Loss', 'Entry Reason', 'Exit Reason', 'Hold Time (min)', 'Trailing Stop Used', 'Highest Price', 'Capital After', 'Notes']
            ]
            
            body = {'values': values}
            
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='Trades!A1',
                valueInputOption='RAW',
                body=body
            ).execute()
            
            # フォーマット設定
            requests = []
            
            # タイトル行
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': self.sheet_ids['Trades'],
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 0.9},
                            'textFormat': {
                                'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                                'bold': True,
                                'fontSize': 14
                            },
                            'horizontalAlignment': 'CENTER'
                        }
                    },
                    'fields': 'userEnteredFormat'
                }
            })
            
            # ヘッダー行
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': self.sheet_ids['Trades'],
                        'startRowIndex': 1,
                        'endRowIndex': 2
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.85, 'green': 0.85, 'blue': 0.85},
                            'textFormat': {'bold': True}
                        }
                    },
                    'fields': 'userEnteredFormat'
                }
            })
            
            # Win/Loss条件付き書式
            requests.append({
                'addConditionalFormatRule': {
                    'rule': {
                        'ranges': [{
                            'sheetId': self.sheet_ids['Trades'],
                            'startRowIndex': 2,
                            'startColumnIndex': 8,
                            'endColumnIndex': 9
                        }],
                        'booleanRule': {
                            'condition': {
                                'type': 'TEXT_EQ',
                                'values': [{'userEnteredValue': 'Win'}]
                            },
                            'format': {
                                'backgroundColor': {'red': 0.7, 'green': 1.0, 'blue': 0.7}
                            }
                        }
                    },
                    'index': 0
                }
            })
            
            requests.append({
                'addConditionalFormatRule': {
                    'rule': {
                        'ranges': [{
                            'sheetId': self.sheet_ids['Trades'],
                            'startRowIndex': 2,
                            'startColumnIndex': 8,
                            'endColumnIndex': 9
                        }],
                        'booleanRule': {
                            'condition': {
                                'type': 'TEXT_EQ',
                                'values': [{'userEnteredValue': 'Loss'}]
                            },
                            'format': {
                                'backgroundColor': {'red': 1.0, 'green': 0.7, 'blue': 0.7}
                            }
                        }
                    },
                    'index': 1
                }
            })
            
            # 列幅自動調整
            requests.append({
                'autoResizeDimensions': {
                    'dimensions': {
                        'sheetId': self.sheet_ids['Trades'],
                        'dimension': 'COLUMNS',
                        'startIndex': 0,
                        'endIndex': 16
                    }
                }
            })
            
            body = {'requests': requests}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print(f"✅ トレード記録シート完成")
        except Exception as e:
            print(f"❌ トレード記録シートエラー: {e}")
    
    def setup_statistics_sheet(self):
        """統計シートセットアップ"""
        if not self.service:
            return
        
        try:
            print(f"📈 統計シートセットアップ中...")
            
            values = [
                ['📊 統計'],
                [''],
                ['📌 銘柄別成績'],
                ['Symbol', 'トレード数', '勝率 (%)', '総PnL ($)', '平均PnL ($)'],
                [''],
                ['（データは自動更新されます）'],
                [''],
                [''],
                ['📌 エグジット理由別'],
                ['Exit Reason', '回数', '総PnL ($)'],
                [''],
                [''],
                [''],
                ['📌 日別PnL'],
                ['Date', '総PnL ($)']
            ]
            
            body = {'values': values}
            
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='Statistics!A1',
                valueInputOption='RAW',
                body=body
            ).execute()
            
            print(f"✅ 統計シート完成")
        except Exception as e:
            print(f"❌ 統計シートエラー: {e}")
    
    def setup_charts_sheet(self):
        """グラフシートセットアップ"""
        if not self.service:
            return
        
        try:
            print(f"📉 グラフシートセットアップ中...")
            
            values = [
                ['📈 グラフ'],
                [''],
                ['（グラフは手動で追加してください）'],
                [''],
                ['推奨グラフ:'],
                ['1. 資金推移グラフ（Trades!O:O）'],
                ['2. 勝率推移グラフ'],
                ['3. 銘柄別PnL比較']
            ]
            
            body = {'values': values}
            
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='Charts!A1',
                valueInputOption='RAW',
                body=body
            ).execute()
            
            print(f"✅ グラフシート完成")
        except Exception as e:
            print(f"❌ グラフシートエラー: {e}")
    
    def run(self):
        """実行"""
        print(f"\n{'='*80}")
        print(f"🚀 Googleスプレッドシート高度セットアップ")
        print(f"{'='*80}\n")
        
        if not self.service:
            print(f"⚠️  認証情報が未設定です。")
            print(f"手動セットアップガイド: /root/clawd/docs/gsheet-setup-manual.md")
            return
        
        print(f"🔗 スプレッドシート: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}\n")
        
        # シート作成
        self.create_sheets()
        
        # 各シートセットアップ
        self.setup_dashboard()
        self.setup_trades_sheet()
        self.setup_statistics_sheet()
        self.setup_charts_sheet()
        
        print(f"\n{'='*80}")
        print(f"🎉 セットアップ完了！")
        print(f"{'='*80}")
        print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
        print(f"\n📋 シート構成:")
        print(f"   1. Dashboard - 総合ダッシュボード")
        print(f"   2. Trades - トレード記録（3行目からデータ追加）")
        print(f"   3. Statistics - 統計情報")
        print(f"   4. Charts - グラフ")
        print(f"\n💡 トレードデータは「Trades」シートの3行目以降に自動追加されます。")
        print(f"\n{'='*80}\n")

if __name__ == "__main__":
    setup = GoogleSheetAdvancedSetup()
    setup.run()
