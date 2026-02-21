#!/usr/bin/env python3
"""
既存シートの初期資金を$10,000 → $8,000に調整
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials

CREDENTIALS_PATH = '/root/clawd/config/google-sheets-credentials.json'
SHEET_URL = 'https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'

def adjust_capital():
    """初期資金を$8,000に調整"""
    
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_PATH, scope)
    client = gspread.authorize(creds)
    
    print("🔐 Google Sheets認証中...")
    sheet = client.open_by_url(SHEET_URL)
    print(f"✅ スプレッドシート開きました")
    
    # ChartDataシート修正
    print("\n📊 ChartDataシート修正中...")
    chartdata_ws = sheet.worksheet("ChartData")
    
    # 全データ取得
    all_data = chartdata_ws.get_all_values()
    
    print(f"   データ行数: {len(all_data)}")
    
    # 初期資金を$8,000に修正して、全ての資金を再計算
    ADJUSTMENT = -2000.0  # $10,000 → $8,000
    
    new_data = []
    for i, row in enumerate(all_data):
        if i == 0:
            # ヘッダー行はそのまま
            new_data.append(row)
            continue
        
        # トータル資金を調整（列3）
        if len(row) > 3 and row[3]:
            try:
                old_capital = float(row[3].replace('$', '').replace(',', ''))
                new_capital = old_capital + ADJUSTMENT
                row[3] = f"{new_capital:.2f}"
            except:
                pass
        
        new_data.append(row)
    
    # 初期資金（トレード番号0）の確認
    if len(new_data) > 1 and new_data[1][0] == '0':
        print(f"   ⚠️  初期資金行が見つかりません（トレード番号0）")
        # 初期資金行を先頭に挿入
        initial_row = ['0', '', '', '8000.00', '', '', '']
        new_data.insert(1, initial_row)
        print(f"   ✅ 初期資金行を追加しました")
    
    # データ更新
    chartdata_ws.clear()
    chartdata_ws.update(new_data, value_input_option='USER_ENTERED')
    print(f"   ✅ ChartData更新完了（{len(new_data)}行）")
    
    # Dashboardシート修正
    print("\n📊 Dashboardシート修正中...")
    dashboard_ws = sheet.worksheet("Dashboard")
    
    # 初期資金の行を探す
    all_values = dashboard_ws.get_all_values()
    
    for i, row in enumerate(all_values, 1):
        if len(row) > 0 and '初期資金' in row[0]:
            dashboard_ws.update_cell(i, 2, '$8,000.00')
            print(f"   ✅ 初期資金を$8,000.00に更新（行{i}）")
        
        # 現在の資金も確認
        if len(row) > 0 and '現在の資金' in row[0]:
            # 最新の資金を計算（ChartDataの最終行から取得）
            if new_data and len(new_data[-1]) > 3:
                current_capital = new_data[-1][3]
                dashboard_ws.update_cell(i, 2, f'${current_capital}')
                print(f"   ✅ 現在の資金を${current_capital}に更新（行{i}）")
        
        # トータルPnLも再計算
        if len(row) > 0 and 'トータル損益' in row[0]:
            try:
                current = float(new_data[-1][3])
                initial = 8000.0
                total_pnl = current - initial
                pnl_pct = (total_pnl / initial) * 100
                dashboard_ws.update_cell(i, 2, f'${total_pnl:+.2f} ({pnl_pct:+.2f}%)')
                print(f"   ✅ トータル損益を${total_pnl:+.2f}に更新（行{i}）")
            except:
                pass
    
    # Statisticsシート修正
    print("\n📊 Statisticsシート修正中...")
    stats_ws = sheet.worksheet("Statistics")
    
    # 日別統計の資金計算を調整
    stats_data = stats_ws.get_all_values()
    
    for i, row in enumerate(stats_data, 1):
        if len(row) > 0 and '初期資金' in row[0]:
            stats_ws.update_cell(i, 2, '$8,000.00')
            print(f"   ✅ 初期資金を$8,000.00に更新（行{i}）")
    
    print("\n" + "="*60)
    print("✅ 調整完了！")
    print(f"📊 初期資金: $10,000 → $8,000")
    print(f"📊 URL: {sheet.url}")
    print("="*60)

if __name__ == '__main__':
    try:
        adjust_capital()
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
