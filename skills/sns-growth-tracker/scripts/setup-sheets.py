#!/usr/bin/env python3
"""
Google Sheets初期セットアップスクリプト
新しいスプレッドシートを作成し、構造を設定
"""

import os
import sys
import json
from pathlib import Path

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("❌ Google API ライブラリがインストールされていません")
    print("インストール: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    sys.exit(1)

class SheetsSetup:
    def __init__(self, credentials_path):
        """初期化"""
        self.credentials_path = credentials_path
        self.service = self._authenticate()
    
    def _authenticate(self):
        """Google Sheets APIに認証"""
        SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
        
        if not Path(self.credentials_path).exists():
            raise FileNotFoundError(f"認証情報が見つかりません: {self.credentials_path}")
        
        creds = service_account.Credentials.from_service_account_file(
            self.credentials_path, scopes=SCOPES)
        
        return build('sheets', 'v4', credentials=creds)
    
    def create_spreadsheet(self, title="SNS成長トラッカー"):
        """新しいスプレッドシートを作成"""
        spreadsheet = {
            'properties': {
                'title': title
            }
        }
        
        try:
            spreadsheet = self.service.spreadsheets().create(
                body=spreadsheet,
                fields='spreadsheetId,spreadsheetUrl'
            ).execute()
            
            return {
                'id': spreadsheet.get('spreadsheetId'),
                'url': spreadsheet.get('spreadsheetUrl')
            }
        
        except HttpError as error:
            print(f"❌ スプレッドシート作成エラー: {error}")
            return None
    
    def setup_sheets(self, spreadsheet_id, structure_file):
        """シート構造をセットアップ"""
        # 構造ファイルを読み込み
        with open(structure_file, 'r', encoding='utf-8') as f:
            structure = json.load(f)
        
        requests = []
        
        # デフォルトのSheet1を削除
        requests.append({
            'deleteSheet': {
                'sheetId': 0
            }
        })
        
        # 各シートを作成
        for idx, sheet in enumerate(structure['sheets']):
            # シート作成リクエスト
            requests.append({
                'addSheet': {
                    'properties': {
                        'sheetId': idx + 1,
                        'title': sheet['name'],
                        'gridProperties': {
                            'rowCount': 1000,
                            'columnCount': len(sheet['headers']),
                            'frozenRowCount': 1
                        }
                    }
                }
            })
        
        # バッチ実行
        try:
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={'requests': requests}
            ).execute()
            
            print(f"✅ {len(structure['sheets'])}個のシートを作成しました")
        
        except HttpError as error:
            print(f"❌ シート作成エラー: {error}")
            return False
        
        # ヘッダー行を設定
        for idx, sheet in enumerate(structure['sheets']):
            self._setup_sheet_headers(
                spreadsheet_id,
                idx + 1,
                sheet['name'],
                sheet['headers'],
                structure['formatting']
            )
        
        return True
    
    def _setup_sheet_headers(self, spreadsheet_id, sheet_id, sheet_name, headers, formatting):
        """ヘッダー行を設定"""
        # ヘッダーデータを書き込み
        values = [headers]
        
        try:
            self.service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{sheet_name}'!A1",
                valueInputOption='RAW',
                body={'values': values}
            ).execute()
            
            # フォーマット設定
            requests = []
            
            # ヘッダー行のフォーマット
            header_format = formatting['header_row']
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': header_format['background_color'],
                            'textFormat': {
                                'foregroundColor': header_format['text_color'],
                                'bold': True
                            },
                            'horizontalAlignment': 'CENTER'
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
            })
            
            # バッチ実行
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={'requests': requests}
            ).execute()
            
            print(f"✅ {sheet_name}: ヘッダー設定完了")
        
        except HttpError as error:
            print(f"❌ ヘッダー設定エラー ({sheet_name}): {error}")

def main():
    """メイン処理"""
    # パス設定
    skill_dir = Path(__file__).parent.parent
    credentials_path = skill_dir / 'google-credentials.json'
    structure_file = skill_dir / 'templates' / 'sheets-structure.json'
    
    # 認証情報チェック
    if not credentials_path.exists():
        print("❌ Google認証情報が見つかりません")
        print(f"配置先: {credentials_path}")
        print("\n取得方法:")
        print("1. Google Cloud Consoleでサービスアカウント作成")
        print("2. JSONキーをダウンロード")
        print("3. 上記パスに配置")
        sys.exit(1)
    
    # セットアップ開始
    print("🚀 SNS成長トラッカー - Google Sheets セットアップ")
    print("=" * 60)
    
    setup = SheetsSetup(str(credentials_path))
    
    # スプレッドシート作成
    print("\n📊 新しいスプレッドシートを作成中...")
    result = setup.create_spreadsheet()
    
    if not result:
        print("❌ スプレッドシート作成に失敗しました")
        sys.exit(1)
    
    print(f"✅ スプレッドシート作成完了")
    print(f"   ID: {result['id']}")
    print(f"   URL: {result['url']}")
    
    # シート構造をセットアップ
    print("\n📋 シート構造をセットアップ中...")
    success = setup.setup_sheets(result['id'], str(structure_file))
    
    if not success:
        print("❌ シート構造のセットアップに失敗しました")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ セットアップ完了！")
    print("\n次のステップ:")
    print(f"1. 環境変数を設定: export SNS_SHEETS_ID='{result['id']}'")
    print(f"2. ~/.profile に追加: echo 'export SNS_SHEETS_ID=\"{result['id']}\"' >> ~/.profile")
    print(f"3. スプレッドシートを開く: {result['url']}")
    print(f"4. スプレッドシートを共有（編集権限を付与）")

if __name__ == '__main__':
    main()
