#!/usr/bin/env python3
"""
Bitget取引データをGoogle Sheetsに書き込み（グラフ対応）
"""

import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import sys
import os

# 認証情報のパス
CREDENTIALS_PATH = os.environ.get('GOOGLE_SHEETS_CREDENTIALS', 
                                   '/root/clawd/config/google-sheets-credentials.json')
SHEET_NAME = os.environ.get('BITGET_SHEET_NAME', 'トレード記録')
SHEET_URL = os.environ.get('BITGET_SHEET_URL', 
                            'https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo')

def authenticate():
    """Google Sheets認証"""
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    if not os.path.exists(CREDENTIALS_PATH):
        print(f"❌ 認証情報が見つかりません: {CREDENTIALS_PATH}")
        print()
        print("📋 セットアップ手順:")
        print("1. Google Cloud Console → APIs & Services → Credentials")
        print("2. サービスアカウントを作成")
        print("3. JSONキーをダウンロード")
        print(f"4. {CREDENTIALS_PATH} に保存")
        print("5. Google Sheetsでシートを作成し、サービスアカウントのメールアドレスに編集権限を付与")
        sys.exit(1)
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_PATH, scope)
    client = gspread.authorize(creds)
    return client

def update_sheets():
    """Google Sheetsを更新"""
    
    # 現在の損益データ読み込み
    with open('/root/clawd/data/current-pnl.json', 'r') as f:
        data = json.load(f)
    
    print("🔐 Google Sheets認証中...")
    client = authenticate()
    
    # スプレッドシートを開く（URLで直接指定）
    try:
        sheet = client.open_by_url(SHEET_URL)
        print(f"✅ スプレッドシート '{SHEET_NAME}' を開きました")
    except Exception as e:
        # フォールバック：名前で開く
        try:
            sheet = client.open(SHEET_NAME)
            print(f"✅ スプレッドシート '{SHEET_NAME}' を開きました")
        except gspread.exceptions.SpreadsheetNotFound:
            print(f"❌ スプレッドシート '{SHEET_NAME}' が見つかりません")
            print(f"指定されたURL: {SHEET_URL}")
            raise
    
    # ワークシート取得または作成
    try:
        summary_ws = sheet.worksheet("Summary")
    except gspread.exceptions.WorksheetNotFound:
        summary_ws = sheet.add_worksheet(title="Summary", rows=100, cols=10)
    
    try:
        positions_ws = sheet.worksheet("Positions")
    except gspread.exceptions.WorksheetNotFound:
        positions_ws = sheet.add_worksheet(title="Positions", rows=100, cols=15)
    
    try:
        history_ws = sheet.worksheet("History")
    except gspread.exceptions.WorksheetNotFound:
        history_ws = sheet.add_worksheet(title="History", rows=1000, cols=10)
    
    # --- Summary シート更新 ---
    print("📊 Summaryシート更新中...")
    
    timestamp = datetime.fromisoformat(data['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
    
    summary_data = [
        ['Bitget Trading Summary', '', '', ''],
        ['Updated', timestamp, '', ''],
        ['', '', '', ''],
        ['💰 資金状況', '', '', ''],
        ['現金部分（残り資金）', f"${data['last_capital']:,.2f}", '', ''],
        ['ポジションの現在価値', f"${sum(p['current_value'] for p in data['positions']):,.2f}", '', ''],
        ['未実現損益', f"${data['total_unrealized_pnl']:+,.2f}", '', ''],
        ['━━━━━━━━━━━━━━━━━━━━━━', '', '', ''],
        ['総資金', f"${data['total_capital']:,.2f}", '', ''],
        ['', '', '', ''],
        ['初期資金', '$8,000.00', '', ''],
        ['トータル利益', f"${data['total_capital'] - 8000:+,.2f}", '', ''],
        ['利益率', f"{((data['total_capital'] - 8000) / 8000 * 100):+.2f}%", '', ''],
    ]
    
    summary_ws.clear()
    summary_ws.update('A1', summary_data)
    
    # --- Positions シート更新 ---
    print("📦 Positionsシート更新中...")
    
    positions_header = [
        'Symbol', 'Entry Price', 'Current Price', 'Quantity',
        'Entry Value', 'Current Value', 'Unrealized PnL ($)',
        'Unrealized PnL (%)', 'Entry Time'
    ]
    
    positions_data = [positions_header]
    
    for pos in data['positions']:
        positions_data.append([
            pos['symbol'],
            f"${pos['entry_price']:.6f}",
            f"${pos['current_price']:.6f}",
            f"{pos['quantity']:,.2f}",
            f"${pos['entry_value']:,.2f}",
            f"${pos['current_value']:,.2f}",
            f"${pos['unrealized_pnl']:+,.2f}",
            f"{pos['unrealized_pnl_pct']:+.2f}%",
            pos['entry_time']
        ])
    
    positions_ws.clear()
    positions_ws.update('A1', positions_data)
    
    # --- History シート更新（時系列データ） ---
    print("📈 Historyシート更新中...")
    
    # 既存のヘッダー確認
    try:
        existing_header = history_ws.row_values(1)
    except:
        existing_header = []
    
    if not existing_header or existing_header[0] != 'Timestamp':
        # ヘッダー作成
        history_header = [
            'Timestamp', 'Total Capital', 'Cash', 'Position Value', 'Unrealized PnL'
        ]
        history_ws.update('A1', [history_header])
    
    # 新しい行を追加
    new_row = [
        timestamp,
        data['total_capital'],
        data['last_capital'],
        sum(p['current_value'] for p in data['positions']),
        data['total_unrealized_pnl']
    ]
    
    history_ws.append_row(new_row)
    
    print("✅ Google Sheets更新完了！")
    print(f"📊 URL: {sheet.url}")
    
    return sheet.url

if __name__ == '__main__':
    try:
        url = update_sheets()
        print()
        print("=" * 60)
        print("🎉 完了！")
        print(f"📊 スプレッドシート: {url}")
        print("=" * 60)
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
