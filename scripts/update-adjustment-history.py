#!/usr/bin/env python3
"""
Google Sheetsに調整履歴を記録
"""
import sys
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

def update_adjustment_history(adjustments):
    """調整履歴をGoogle Sheetsに追加"""
    
    # 認証情報
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
    SERVICE_ACCOUNT_FILE = '/root/.clawdbot/google-credentials.json'
    SPREADSHEET_ID = '19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'
    
    # 認証
    creds = Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    
    # シート名
    sheet_name = 'Adjustment History'
    
    # シートが存在するか確認
    spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    sheets = spreadsheet.get('sheets', [])
    sheet_exists = any(s['properties']['title'] == sheet_name for s in sheets)
    
    if not sheet_exists:
        # シート作成
        print(f"📋 {sheet_name}シートを作成中...")
        requests = [{
            'addSheet': {
                'properties': {
                    'title': sheet_name,
                    'gridProperties': {
                        'rowCount': 1000,
                        'columnCount': 10
                    }
                }
            }
        }]
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'requests': requests}
        ).execute()
        
        # ヘッダー行を追加
        header = [
            '日時', 'バージョン', '調整項目', '変更前', '変更後', 
            '変更理由', '期待される効果', 'ステータス', '実際の効果', '備考'
        ]
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{sheet_name}!A1:J1',
            valueInputOption='RAW',
            body={'values': [header]}
        ).execute()
        
        # ヘッダー行のフォーマット
        format_requests = [
            {
                'repeatCell': {
                    'range': {
                        'sheetId': [s['properties']['sheetId'] for s in service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()['sheets'] if s['properties']['title'] == sheet_name][0],
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 1.0},
                            'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}},
                            'horizontalAlignment': 'CENTER'
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
            },
            {
                'updateSheetProperties': {
                    'properties': {
                        'sheetId': [s['properties']['sheetId'] for s in service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()['sheets'] if s['properties']['title'] == sheet_name][0],
                        'gridProperties': {
                            'frozenRowCount': 1
                        }
                    },
                    'fields': 'gridProperties.frozenRowCount'
                }
            }
        ]
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'requests': format_requests}
        ).execute()
        
        print(f"✅ {sheet_name}シート作成完了")
    
    # 調整履歴を追加
    rows = []
    for adj in adjustments:
        row = [
            adj.get('timestamp', ''),
            adj.get('version', ''),
            adj.get('item', ''),
            adj.get('before', ''),
            adj.get('after', ''),
            adj.get('reason', ''),
            adj.get('expected_effect', ''),
            adj.get('status', '実装済み'),
            adj.get('actual_effect', '測定中'),
            adj.get('notes', '')
        ]
        rows.append(row)
    
    # 既存データの行数を取得
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f'{sheet_name}!A:A'
    ).execute()
    existing_rows = len(result.get('values', []))
    
    # データを追加
    range_name = f'{sheet_name}!A{existing_rows + 1}'
    service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=range_name,
        valueInputOption='RAW',
        body={'values': rows}
    ).execute()
    
    print(f"✅ 調整履歴を{len(rows)}件追加しました")

if __name__ == "__main__":
    # V2→V3の調整内容
    adjustments = [
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': 'トレイリングストップ発動',
            'before': '+3%',
            'after': '+1.5%',
            'reason': '短時間トレード（1-102分）で利益が出ていた。早期利確を狙う',
            'expected_effect': '利益確定の頻度が2倍に増加、平均利益+$50-80',
            'status': '実装済み',
            'actual_effect': '測定中（TNSRUSDTで発動確認）',
            'notes': 'TNSRUSDTで+4.29%時にトレイリング発動'
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': 'トレイリングストップ追従',
            'before': '-3%',
            'after': '-2%',
            'reason': 'より利益を確保するため、追従距離を縮小',
            'expected_effect': '利益確定時の取りこぼし削減',
            'status': '実装済み',
            'actual_effect': '測定中',
            'notes': ''
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': 'ストップロス',
            'before': '-5%',
            'after': '-3%',
            'reason': '平均損失-$68を削減。長時間ホールドの損失を防ぐ',
            'expected_effect': '平均損失-$68 → -$30-40（約40%削減）',
            'status': '実装済み',
            'actual_effect': '測定中',
            'notes': ''
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': 'テイクプロフィット',
            'before': '+15%',
            'after': '+10%',
            'reason': '+15%は遠すぎる（トレイリングで+10%到達が多い）',
            'expected_effect': 'より早く利益確定',
            'status': '実装済み',
            'actual_effect': '測定中',
            'notes': ''
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': 'ポジションサイズ',
            'before': '20%',
            'after': '15%',
            'reason': '最大ポジション数を増やすため、1ポジションあたりのサイズを縮小',
            'expected_effect': 'リスク分散、より多くのトレードチャンス',
            'status': '実装済み',
            'actual_effect': '測定中',
            'notes': ''
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': '最大ポジション数',
            'before': '3',
            'after': '5',
            'reason': 'より多くのトレードチャンスを活かす',
            'expected_effect': 'トレード機会1.7倍増加',
            'status': '実装済み',
            'actual_effect': '測定中',
            'notes': ''
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': 'チェック間隔',
            'before': '60秒',
            'after': '30秒',
            'reason': 'より早くエントリー/エグジットのチャンスを捉える',
            'expected_effect': 'エントリー/エグジットタイミングが2倍速に',
            'status': '実装済み',
            'actual_effect': '測定中',
            'notes': ''
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': '監視銘柄数',
            'before': '5銘柄',
            'after': '15銘柄',
            'reason': 'より多くのトレードチャンスを探す',
            'expected_effect': 'トレード機会3倍増加',
            'status': '実装済み',
            'actual_effect': '測定中（LRCUSDTで新規エントリー成功）',
            'notes': 'スクリーニング上位10銘柄 + 過去の優良銘柄5銘柄'
        },
        {
            'timestamp': '2026-02-16 08:23:00',
            'version': 'V2 → V3',
            'item': '最大ホールド時間',
            'before': 'なし',
            'after': '240分（4時間）',
            'reason': '長時間ホールド（422分以上）は全て損失だった',
            'expected_effect': '長時間損失を防ぐ',
            'status': '実装済み',
            'actual_effect': '確認済み（LQTYUSDTで機能、-3.24%で損切り）',
            'notes': '以前なら-5%（-$100）になっていた可能性'
        }
    ]
    
    update_adjustment_history(adjustments)
