#!/usr/bin/env python3
"""
Googleスプレッドシート修正スクリプト
- Tradesシートのフォーマット設定
- Statistics自動連携設定
"""

import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

class GoogleSheetFixer:
    """
    Googleスプレッドシート修正
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
    
    def setup_trades_sheet(self):
        """Tradesシートセットアップ"""
        if not self.service or 'Trades' not in self.sheet_ids:
            print(f"⚠️  Tradesシートが見つかりません")
            return
        
        try:
            print(f"\n📝 Tradesシートセットアップ中...")
            
            sheet_id = self.sheet_ids['Trades']
            
            # 1行目: タイトル
            # 2行目: ヘッダー
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
            
            print(f"✅ データ書き込み完了")
            
            # フォーマット設定
            requests = []
            
            # タイトル行（A1:P1結合、青背景、白文字、太字）
            requests.append({
                'mergeCells': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': 16
                    },
                    'mergeType': 'MERGE_ALL'
                }
            })
            
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.29, 'green': 0.53, 'blue': 0.91},
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
            
            # ヘッダー行（グレー背景、太字）
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
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
            
            # 1〜2行目を固定
            requests.append({
                'updateSheetProperties': {
                    'properties': {
                        'sheetId': sheet_id,
                        'gridProperties': {
                            'frozenRowCount': 2
                        }
                    },
                    'fields': 'gridProperties.frozenRowCount'
                }
            })
            
            # Win/Loss条件付き書式（Win = 緑）
            requests.append({
                'addConditionalFormatRule': {
                    'rule': {
                        'ranges': [{
                            'sheetId': sheet_id,
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
                                'backgroundColor': {'red': 0.85, 'green': 0.92, 'blue': 0.83}
                            }
                        }
                    },
                    'index': 0
                }
            })
            
            # Win/Loss条件付き書式（Loss = 赤）
            requests.append({
                'addConditionalFormatRule': {
                    'rule': {
                        'ranges': [{
                            'sheetId': sheet_id,
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
                                'backgroundColor': {'red': 0.96, 'green': 0.8, 'blue': 0.8}
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
                        'sheetId': sheet_id,
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
            
            print(f"✅ Tradesシートフォーマット設定完了")
        except Exception as e:
            print(f"❌ Tradesシートエラー: {e}")
            import traceback
            traceback.print_exc()
    
    def setup_statistics_formulas(self):
        """Statistics自動連携設定"""
        if not self.service:
            return
        
        try:
            print(f"\n📈 Statistics自動連携設定中...")
            
            # 銘柄別成績の自動集計
            values = [
                ['📊 統計'],
                [''],
                ['📌 銘柄別成績（自動更新）'],
                ['Symbol', 'トレード数', '勝率 (%)', '総PnL ($)', '平均PnL ($)'],
                # UNIQUE関数で銘柄を自動抽出
                ['=UNIQUE(FILTER(Trades!C3:C1000, Trades!C3:C1000<>""))', 
                 '=ARRAYFORMULA(IF(A5:A<>"", COUNTIF(Trades!C:C, A5:A), ""))',
                 '=ARRAYFORMULA(IF(A5:A<>"", COUNTIFS(Trades!C:C, A5:A, Trades!I:I, "Win")/COUNTIF(Trades!C:C, A5:A)*100, ""))',
                 '=ARRAYFORMULA(IF(A5:A<>"", SUMIF(Trades!C:C, A5:A, Trades!G:G), ""))',
                 '=ARRAYFORMULA(IF(A5:A<>"", AVERAGEIF(Trades!C:C, A5:A, Trades!G:G), ""))'],
                ['', '', '', '', ''],
                ['', '', '', '', ''],
                [''],
                ['📌 エグジット理由別（自動更新）'],
                ['Exit Reason', '回数', '総PnL ($)'],
                ['=UNIQUE(FILTER(Trades!K3:K1000, Trades!K3:K1000<>""))',
                 '=ARRAYFORMULA(IF(A11:A<>"", COUNTIF(Trades!K:K, A11:A), ""))',
                 '=ARRAYFORMULA(IF(A11:A<>"", SUMIF(Trades!K:K, A11:A, Trades!G:G), ""))'],
                ['', '', ''],
                ['', '', ''],
                [''],
                ['📌 日別PnL（自動更新）'],
                ['Date', '総PnL ($)', 'トレード数'],
                # DATE関数でEntry Timeから日付を抽出
                ['=UNIQUE(FILTER(ARRAYFORMULA(INT(Trades!A3:A1000)), Trades!A3:A1000<>""))',
                 '=ARRAYFORMULA(IF(A18:A<>"", SUMIFS(Trades!G:G, ARRAYFORMULA(INT(Trades!A:A)), A18:A), ""))',
                 '=ARRAYFORMULA(IF(A18:A<>"", COUNTIFS(ARRAYFORMULA(INT(Trades!A:A)), A18:A), ""))']
            ]
            
            body = {'values': values}
            
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='Statistics!A1',
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()
            
            print(f"✅ Statistics自動連携設定完了")
        except Exception as e:
            print(f"❌ Statisticsエラー: {e}")
            import traceback
            traceback.print_exc()
    
    def run(self):
        """実行"""
        print(f"\n{'='*80}")
        print(f"🔧 Googleスプレッドシート修正開始")
        print(f"{'='*80}\n")
        
        if not self.service:
            return
        
        # Tradesシート修正
        self.setup_trades_sheet()
        
        # Statistics自動連携設定
        self.setup_statistics_formulas()
        
        print(f"\n{'='*80}")
        print(f"🎉 修正完了！")
        print(f"{'='*80}")
        print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
        print(f"\n✅ 完成した機能:")
        print(f"   1. Tradesシート - 完全フォーマット適用")
        print(f"   2. Statistics - 自動集計（銘柄別、理由別、日別）")
        print(f"\n💡 Tradesシートにデータを追加すると、Statisticsが自動更新されます！")
        print(f"\n{'='*80}\n")

if __name__ == "__main__":
    fixer = GoogleSheetFixer()
    fixer.run()
