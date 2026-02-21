#!/usr/bin/env python3
"""
Googleスプレッドシート初期設定
"""

import os
import sys
from typing import Dict, List
from google.oauth2 import service_account
from googleapiclient.discovery import build

class GoogleSheetSetup:
    """
    Googleスプレッドシート初期設定
    """
    
    def __init__(self, credentials_path: str = "/root/.clawdbot/google-credentials.json"):
        self.credentials_path = credentials_path
        self.spreadsheet_id = "19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo"
        self.sheet_name = "Trades"
        self.service = None
        
        self.init_service()
    
    def init_service(self):
        """Google Sheets APIサービス初期化"""
        try:
            if not os.path.exists(self.credentials_path):
                print(f"⚠️  認証情報が見つかりません: {self.credentials_path}")
                print(f"\n💡 セットアップ手順:")
                print(f"   1. Google Cloud Console: https://console.cloud.google.com/")
                print(f"   2. 「APIとサービス」→「認証情報」")
                print(f"   3. 「認証情報を作成」→「サービスアカウント」")
                print(f"   4. サービスアカウント作成後、「キー」タブ→「キーを追加」→「JSON」")
                print(f"   5. ダウンロードしたJSONを {self.credentials_path} に保存")
                print(f"\n   mkdir -p ~/.clawdbot")
                print(f"   cp ~/Downloads/your-key.json ~/.clawdbot/google-credentials.json")
                print(f"\n   6. スプレッドシートを開いて「共有」→サービスアカウントのメールアドレスに編集権限付与")
                print()
                return
            
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            
            self.service = build('sheets', 'v4', credentials=credentials)
            print(f"✅ Google Sheets API接続成功")
        except Exception as e:
            print(f"❌ Google Sheets API接続エラー: {e}")
    
    def create_header(self) -> List[List[str]]:
        """ヘッダー行作成"""
        return [[
            'Entry Time',
            'Exit Time',
            'Symbol',
            'Entry Price',
            'Exit Price',
            'Quantity',
            'PnL ($)',
            'PnL (%)',
            'Win/Loss',
            'Entry Reason',
            'Exit Reason',
            'Hold Time (min)',
            'Trailing Stop Used',
            'Highest Price',
            'Capital After',
            'Notes'
        ]]
    
    def create_sample_data(self) -> List[List[str]]:
        """サンプルデータ作成"""
        return [
            [
                '2026-02-11 13:30:00',
                '2026-02-11 21:25:00',
                'JASMYUSDT',
                '0.005449',
                '0.005994',
                '1835.38',
                '100.00',
                '10.00',
                'Win',
                '全条件クリア',
                'Take Profit',
                '475',
                'Yes',
                '0.006000',
                '10100.00',
                'Screenshot: /root/clawd/data/screenshots/20260211_133000_JASMYUSDT.png'
            ],
            [
                '2026-02-11 14:10:00',
                '2026-02-11 23:00:00',
                'XVGUSDT',
                '0.005827',
                '0.005987',
                '1717.20',
                '27.43',
                '2.74',
                'Win',
                '全条件クリア',
                'Trailing Stop',
                '530',
                'Yes',
                '0.006120',
                '10127.43',
                'Screenshot: /root/clawd/data/screenshots/20260211_141000_XVGUSDT.png'
            ],
            [
                '2026-02-11 14:55:00',
                '2026-02-11 20:20:00',
                'OGUSDT',
                '4.920000',
                '4.674000',
                '203.25',
                '-50.00',
                '-5.00',
                'Loss',
                '全条件クリア',
                'Stop Loss',
                '325',
                'No',
                '4.920000',
                '10077.43',
                'Screenshot: /root/clawd/data/screenshots/20260211_145500_OGUSDT.png'
            ]
        ]
    
    def setup_sheet(self):
        """シート初期設定"""
        if not self.service:
            print(f"⚠️  Google Sheets API未初期化")
            return
        
        try:
            print(f"\n📊 Googleスプレッドシート初期設定開始")
            print(f"🔗 URL: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
            print()
            
            # 1. ヘッダー行 + サンプルデータ作成
            header = self.create_header()
            sample_data = self.create_sample_data()
            all_data = header + sample_data
            
            # 2. データ書き込み
            print(f"📝 ヘッダー行 + サンプルデータ書き込み中...")
            body = {
                'values': all_data
            }
            
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"{self.sheet_name}!A1",
                valueInputOption='RAW',
                body=body
            ).execute()
            
            print(f"✅ データ書き込み完了: {result.get('updatedCells')} セル")
            
            # 3. フォーマット設定
            print(f"🎨 フォーマット設定中...")
            
            requests = []
            
            # ヘッダー行のフォーマット（太字 + 背景色）
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': 0,
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {
                                'red': 0.2,
                                'green': 0.6,
                                'blue': 0.9
                            },
                            'textFormat': {
                                'foregroundColor': {
                                    'red': 1.0,
                                    'green': 1.0,
                                    'blue': 1.0
                                },
                                'bold': True
                            }
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            })
            
            # Win/Loss列の条件付き書式
            # Win = 緑、Loss = 赤
            requests.append({
                'addConditionalFormatRule': {
                    'rule': {
                        'ranges': [{
                            'sheetId': 0,
                            'startRowIndex': 1,
                            'startColumnIndex': 8,
                            'endColumnIndex': 9
                        }],
                        'booleanRule': {
                            'condition': {
                                'type': 'TEXT_EQ',
                                'values': [{'userEnteredValue': 'Win'}]
                            },
                            'format': {
                                'backgroundColor': {
                                    'red': 0.7,
                                    'green': 1.0,
                                    'blue': 0.7
                                }
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
                            'sheetId': 0,
                            'startRowIndex': 1,
                            'startColumnIndex': 8,
                            'endColumnIndex': 9
                        }],
                        'booleanRule': {
                            'condition': {
                                'type': 'TEXT_EQ',
                                'values': [{'userEnteredValue': 'Loss'}]
                            },
                            'format': {
                                'backgroundColor': {
                                    'red': 1.0,
                                    'green': 0.7,
                                    'blue': 0.7
                                }
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
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 0,
                        'endIndex': 16
                    }
                }
            })
            
            # フォーマット適用
            body = {
                'requests': requests
            }
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            print(f"✅ フォーマット設定完了")
            
            # 4. 完了メッセージ
            print(f"\n{'='*80}")
            print(f"🎉 Googleスプレッドシート初期設定完了！")
            print(f"{'='*80}")
            print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
            print(f"\n📋 設定内容:")
            print(f"   - ヘッダー行（太字 + 青背景）")
            print(f"   - サンプルデータ3件")
            print(f"   - 条件付き書式（Win=緑、Loss=赤）")
            print(f"   - 列幅自動調整")
            print(f"\n💡 次のステップ:")
            print(f"   - 自動トレーダー起動でリアルタイム記録")
            print(f"   - 手動同期: python3 /root/clawd/scripts/sync-to-gsheet.py")
            print(f"\n{'='*80}\n")
            
        except Exception as e:
            print(f"❌ シート設定エラー: {e}")
            import traceback
            traceback.print_exc()
    
    def run(self):
        """実行"""
        if not self.service:
            print(f"\n⚠️  認証情報が未設定です。")
            print(f"手動でスプレッドシートを準備する場合:")
            print(f"\n1. スプレッドシートを開く")
            print(f"   https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}")
            print(f"\n2. ヘッダー行（A1セルから）をコピー:")
            print(f"   Entry Time | Exit Time | Symbol | Entry Price | Exit Price | Quantity | PnL ($) | PnL (%) | Win/Loss | Entry Reason | Exit Reason | Hold Time (min) | Trailing Stop Used | Highest Price | Capital After | Notes")
            print(f"\n3. サンプルデータを追加（オプション）")
            print(f"\n4. Win/Loss列（I列）に条件付き書式を設定:")
            print(f"   - Win → 緑背景")
            print(f"   - Loss → 赤背景")
            print()
            return
        
        self.setup_sheet()

if __name__ == "__main__":
    setup = GoogleSheetSetup()
    setup.run()
