#!/usr/bin/env python3
"""
既存のGoogle Sheetsにシート構造をセットアップ
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
    sys.exit(1)

class ExistingSheetsSetup:
    def __init__(self, credentials_path, spreadsheet_id):
        self.credentials_path = credentials_path
        self.spreadsheet_id = spreadsheet_id
        self.service = self._authenticate()
    
    def _authenticate(self):
        """Google Sheets APIに認証"""
        SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
        
        if not Path(self.credentials_path).exists():
            raise FileNotFoundError(f"認証情報が見つかりません: {self.credentials_path}")
        
        creds = service_account.Credentials.from_service_account_file(
            self.credentials_path, scopes=SCOPES)
        
        return build('sheets', 'v4', credentials=creds)
    
    def setup_sheets(self, structure_file):
        """シート構造をセットアップ"""
        # 構造ファイルを読み込み
        with open(structure_file, 'r', encoding='utf-8') as f:
            structure = json.load(f)
        
        # 既存のシート情報を取得
        try:
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()
            
            existing_sheets = {sheet['properties']['title']: sheet['properties']['sheetId'] 
                              for sheet in spreadsheet.get('sheets', [])}
            
            print(f"✅ 既存シート: {', '.join(existing_sheets.keys())}")
        except HttpError as e:
            print(f"❌ スプレッドシート取得エラー: {e}")
            return False
        
        requests = []
        
        # 各シートを作成（デフォルトシートの削除は後で）
        for idx, sheet in enumerate(structure['sheets']):
            if sheet['name'] not in existing_sheets:
                # シート作成リクエスト
                requests.append({
                    'addSheet': {
                        'properties': {
                            'title': sheet['name'],
                            'gridProperties': {
                                'rowCount': 1000,
                                'columnCount': len(sheet['headers']),
                                'frozenRowCount': 1
                            }
                        }
                    }
                })
                print(f"📄 {sheet['name']} を作成します")
            else:
                print(f"⏭️  {sheet['name']} は既に存在します")
        
        # バッチ実行
        if requests:
            try:
                self.service.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={'requests': requests}
                ).execute()
                
                print(f"\n✅ {len(requests)}個のシートを作成しました")
            except HttpError as error:
                print(f"❌ シート作成エラー: {error}")
                return False
        
        # 再度シート情報を取得（新規作成されたシートのIDを取得するため）
        spreadsheet = self.service.spreadsheets().get(
            spreadsheetId=self.spreadsheet_id
        ).execute()
        
        existing_sheets = {sheet['properties']['title']: sheet['properties']['sheetId'] 
                          for sheet in spreadsheet.get('sheets', [])}
        
        # デフォルトのSheet1を削除（新しいシートが作成された後）
        if 'Sheet1' in existing_sheets or 'シート1' in existing_sheets:
            sheet_id = existing_sheets.get('Sheet1') or existing_sheets.get('シート1')
            if sheet_id is not None:
                try:
                    self.service.spreadsheets().batchUpdate(
                        spreadsheetId=self.spreadsheet_id,
                        body={'requests': [{'deleteSheet': {'sheetId': sheet_id}}]}
                    ).execute()
                    print(f"\n🗑️  デフォルトシートを削除しました")
                except HttpError as e:
                    print(f"⚠️  デフォルトシート削除エラー（続行します）: {e}")
        
        # ヘッダー行を設定
        for sheet in structure['sheets']:
            if sheet['name'] in existing_sheets:
                sheet_id = existing_sheets[sheet['name']]
                self._setup_sheet_headers(
                    sheet_id,
                    sheet['name'],
                    sheet['headers'],
                    structure['formatting']
                )
        
        return True
    
    def _setup_sheet_headers(self, sheet_id, sheet_name, headers, formatting):
        """ヘッダー行を設定"""
        # ヘッダーデータを書き込み
        values = [headers]
        
        try:
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
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
                spreadsheetId=self.spreadsheet_id,
                body={'requests': requests}
            ).execute()
            
            print(f"✅ {sheet_name}: ヘッダー設定完了")
        
        except HttpError as error:
            print(f"❌ ヘッダー設定エラー ({sheet_name}): {error}")

def main():
    """メイン処理"""
    if len(sys.argv) < 2:
        print("使い方: python setup-existing-sheets.py <spreadsheet_id>")
        sys.exit(1)
    
    spreadsheet_id = sys.argv[1]
    
    # パス設定
    skill_dir = Path(__file__).parent.parent
    credentials_path = skill_dir / 'google-credentials.json'
    structure_file = skill_dir / 'templates' / 'sheets-structure.json'
    
    # 認証情報チェック
    if not credentials_path.exists():
        print("❌ Google認証情報が見つかりません")
        print(f"配置先: {credentials_path}")
        sys.exit(1)
    
    # セットアップ開始
    print("🚀 SNS成長トラッカー - Google Sheets セットアップ")
    print("=" * 60)
    print(f"📊 スプレッドシートID: {spreadsheet_id}")
    print("")
    
    setup = ExistingSheetsSetup(str(credentials_path), spreadsheet_id)
    
    # シート構造をセットアップ
    print("📋 シート構造をセットアップ中...")
    success = setup.setup_sheets(str(structure_file))
    
    if not success:
        print("❌ シート構造のセットアップに失敗しました")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ セットアップ完了！")
    print("\n次のステップ:")
    print(f"1. 環境変数を設定: export SNS_SHEETS_ID='{spreadsheet_id}'")
    print(f"2. ~/.profile に追加: echo 'export SNS_SHEETS_ID=\"{spreadsheet_id}\"' >> ~/.profile")
    print(f"3. スプレッドシートを開く: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")

if __name__ == '__main__':
    main()
