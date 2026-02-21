#!/usr/bin/env python3
"""
全てのシートを最適化
"""
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import csv

# 認証情報
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SERVICE_ACCOUNT_FILE = '/root/.clawdbot/google-credentials.json'
SPREADSHEET_ID = '19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo'

# 認証
creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)

print("📊 全シートの最適化を開始します\n")

# スプレッドシート情報取得
spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
sheets = spreadsheet.get('sheets', [])

# シートIDを取得
sheet_ids = {}
for sheet in sheets:
    sheet_ids[sheet['properties']['title']] = sheet['properties']['sheetId']

print(f"✅ シート情報取得: {len(sheets)}個のシート")
for name in sheet_ids.keys():
    print(f"   - {name}")

# ========================================
# 1. Dashboardシートの最適化
# ========================================
print("\n📊 1. Dashboardシート最適化中...")

dashboard_data = [
    ['Bitget自動トレーディング - Dashboard'],
    [''],
    ['📊 総合成績'],
    ['トータルトレード数', '=COUNTA(FILTER(Trades!C:C,Trades!I:I<>""))'],
    ['勝ちトレード', '=COUNTIF(Trades!I:I,"Win")'],
    ['負けトレード', '=COUNTIF(Trades!I:I,"Loss")'],
    ['勝率', '=IF(B4>0,B5/B4*100,0)', '%'],
    ['総損益 ($)', '=SUM(FILTER(Trades!G:G,Trades!I:I<>""))'],
    ['平均損益 ($)', '=AVERAGE(FILTER(Trades!G:G,Trades!I:I<>""))'],
    ['最大利益 ($)', '=MAX(FILTER(Trades!G:G,Trades!I:I<>""))'],
    ['最大損失 ($)', '=MIN(FILTER(Trades!G:G,Trades!I:I<>""))'],
    [''],
    ['💰 資金状況'],
    ['初期資金', '10000'],
    ['現在資金', '=MAX(FILTER(Trades!O:O,Trades!O:O<>""))'],
    ['総損益 ($)', '=B15-B14'],
    ['総損益率 (%)', '=(B15-B14)/B14*100', '%'],
    [''],
    ['⏱️ トレード時間'],
    ['平均保有時間（分）', '=AVERAGE(FILTER(Trades!L:L,Trades!I:I<>""))'],
    ['最長保有時間（分）', '=MAX(FILTER(Trades!L:L,Trades!I:I<>""))'],
    ['最短保有時間（分）', '=MIN(FILTER(Trades!L:L,Trades!I:I<>""))'],
    [''],
    ['🎯 エグジット理由'],
    ['トレイリングストップ', '=COUNTIF(Trades!K:K,"Trailing Stop")'],
    ['ストップロス', '=COUNTIF(Trades!K:K,"Stop Loss")'],
    ['テイクプロフィット', '=COUNTIF(Trades!K:K,"Take Profit")'],
    ['最大ホールド時間', '=COUNTIF(Trades!K:K,"Max Hold Time")'],
    ['システム再起動', '=COUNTIF(Trades!K:K,"System Restart")'],
]

service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='Dashboard!A1:C29',
    valueInputOption='USER_ENTERED',
    body={'values': dashboard_data}
).execute()

print("✅ Dashboard更新完了")

# ========================================
# 2. Statisticsシートの最適化
# ========================================
print("\n📊 2. Statisticsシート最適化中...")

# CSVから統計を計算
with open('/root/clawd/data/trade-log.csv', 'r') as f:
    reader = csv.DictReader(f)
    trades = [row for row in reader if row['Win/Loss'] in ['Win', 'Loss']]

# 銘柄別統計
from collections import defaultdict
symbol_stats = defaultdict(lambda: {'count': 0, 'win': 0, 'loss': 0, 'pnl': 0})
for trade in trades:
    symbol = trade['Symbol']
    symbol_stats[symbol]['count'] += 1
    if trade['Win/Loss'] == 'Win':
        symbol_stats[symbol]['win'] += 1
    else:
        symbol_stats[symbol]['loss'] += 1
    symbol_stats[symbol]['pnl'] += float(trade['PnL ($)'])

# エグジット理由別統計
exit_stats = defaultdict(lambda: {'count': 0, 'win': 0, 'loss': 0, 'pnl': 0})
for trade in trades:
    reason = trade['Exit Reason']
    exit_stats[reason]['count'] += 1
    if trade['Win/Loss'] == 'Win':
        exit_stats[reason]['win'] += 1
    else:
        exit_stats[reason]['loss'] += 1
    exit_stats[reason]['pnl'] += float(trade['PnL ($)'])

# Statisticsシートのデータ
statistics_data = [
    ['Bitget自動トレーディング - Statistics'],
    [''],
    ['📊 銘柄別統計'],
    ['銘柄', 'トレード数', '勝ち', '負け', '勝率', '総損益 ($)']
]

# 銘柄別データを追加
for symbol, stats in sorted(symbol_stats.items(), key=lambda x: x[1]['pnl'], reverse=True):
    win_rate = stats['win'] / stats['count'] * 100 if stats['count'] > 0 else 0
    statistics_data.append([
        symbol,
        stats['count'],
        stats['win'],
        stats['loss'],
        f'{win_rate:.1f}%',
        f"${stats['pnl']:.2f}"
    ])

statistics_data.extend([
    [''],
    [''],
    ['📊 エグジット理由別統計'],
    ['理由', 'トレード数', '勝ち', '負け', '勝率', '総損益 ($)']
])

# エグジット理由別データを追加
for reason, stats in sorted(exit_stats.items(), key=lambda x: x[1]['pnl'], reverse=True):
    win_rate = stats['win'] / stats['count'] * 100 if stats['count'] > 0 else 0
    statistics_data.append([
        reason,
        stats['count'],
        stats['win'],
        stats['loss'],
        f'{win_rate:.1f}%',
        f"${stats['pnl']:.2f}"
    ])

# 日別統計
from datetime import datetime
daily_stats = defaultdict(lambda: {'count': 0, 'win': 0, 'loss': 0, 'pnl': 0})
for trade in trades:
    date = datetime.fromisoformat(trade['Exit Time']).strftime('%Y-%m-%d')
    daily_stats[date]['count'] += 1
    if trade['Win/Loss'] == 'Win':
        daily_stats[date]['win'] += 1
    else:
        daily_stats[date]['loss'] += 1
    daily_stats[date]['pnl'] += float(trade['PnL ($)'])

statistics_data.extend([
    [''],
    [''],
    ['📊 日別統計'],
    ['日付', 'トレード数', '勝ち', '負け', '勝率', '総損益 ($)']
])

# 日別データを追加
for date, stats in sorted(daily_stats.items(), reverse=True):
    win_rate = stats['win'] / stats['count'] * 100 if stats['count'] > 0 else 0
    statistics_data.append([
        date,
        stats['count'],
        stats['win'],
        stats['loss'],
        f'{win_rate:.1f}%',
        f"${stats['pnl']:.2f}"
    ])

service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='Statistics!A1:F100',
    valueInputOption='USER_ENTERED',
    body={'values': statistics_data}
).execute()

print("✅ Statistics更新完了")

# ========================================
# 3. フォーマット設定
# ========================================
print("\n🎨 3. フォーマット設定中...")

format_requests = []

# Dashboardのフォーマット
if 'Dashboard' in sheet_ids:
    format_requests.extend([
        # タイトル行
        {
            'repeatCell': {
                'range': {
                    'sheetId': sheet_ids['Dashboard'],
                    'startRowIndex': 0,
                    'endRowIndex': 1
                },
                'cell': {
                    'userEnteredFormat': {
                        'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 1.0},
                        'textFormat': {
                            'bold': True,
                            'fontSize': 16,
                            'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}
                        },
                        'horizontalAlignment': 'CENTER'
                    }
                },
                'fields': 'userEnteredFormat'
            }
        },
        # セクションヘッダー
        {
            'repeatCell': {
                'range': {
                    'sheetId': sheet_ids['Dashboard'],
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
        }
    ])

# Statisticsのフォーマット
if 'Statistics' in sheet_ids:
    format_requests.extend([
        # タイトル行
        {
            'repeatCell': {
                'range': {
                    'sheetId': sheet_ids['Statistics'],
                    'startRowIndex': 0,
                    'endRowIndex': 1
                },
                'cell': {
                    'userEnteredFormat': {
                        'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 1.0},
                        'textFormat': {
                            'bold': True,
                            'fontSize': 16,
                            'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}
                        },
                        'horizontalAlignment': 'CENTER'
                    }
                },
                'fields': 'userEnteredFormat'
            }
        }
    ])

if format_requests:
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': format_requests}
    ).execute()
    print("✅ フォーマット設定完了")

# ========================================
# 4. 列幅の自動調整
# ========================================
print("\n📏 4. 列幅を自動調整中...")

resize_requests = []
for sheet_name, sheet_id in sheet_ids.items():
    if sheet_name in ['Dashboard', 'Trades', 'Statistics']:
        resize_requests.append({
            'autoResizeDimensions': {
                'dimensions': {
                    'sheetId': sheet_id,
                    'dimension': 'COLUMNS',
                    'startIndex': 0,
                    'endIndex': 20
                }
            }
        })

if resize_requests:
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': resize_requests}
    ).execute()
    print("✅ 列幅調整完了")

print("\n" + "="*80)
print("✅ 全シートの最適化が完了しました！")
print("="*80)
print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
print("\n📊 最適化されたシート:")
print("   1. Dashboard - 総合成績とサマリー")
print("   2. Trades - 全トレード履歴（21件）")
print("   3. Statistics - 詳細な統計分析")
print("   4. Charts - 視覚的なグラフ")
print("   5. Adjustment History - 設定変更履歴")
