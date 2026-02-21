#!/usr/bin/env python3
"""
Statistics & Charts 完全修正（シンプル版）
"""

from google.oauth2 import service_account
from googleapiclient.discovery import build

def main():
    credentials_path = "/root/.clawdbot/google-credentials.json"
    spreadsheet_id = "19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo"
    
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    service = build('sheets', 'v4', credentials=credentials)
    
    print("✅ API接続成功")
    
    # Statisticsシートクリア
    service.spreadsheets().values().clear(
        spreadsheetId=spreadsheet_id,
        range="Statistics!A1:Z1000"
    ).execute()
    print("✅ Statisticsクリア完了")
    
    # Statistics新データ
    values = [
        ['統計情報（自動更新）'],
        [],
        ['銘柄別成績'],
        ['Symbol', 'トレード数', '勝ち', '負け', '勝率(%)', '総PnL($)', '平均PnL($)'],
        ['LQTYUSDT', '=COUNTIF(Trades!C:C,"LQTYUSDT")', '=COUNTIFS(Trades!C:C,"LQTYUSDT",Trades!I:I,"Win")', '=COUNTIFS(Trades!C:C,"LQTYUSDT",Trades!I:I,"Loss")', '=IF(B5>0,C5/B5*100,0)', '=SUMIF(Trades!C:C,"LQTYUSDT",Trades!G:G)', '=IF(B5>0,F5/B5,0)'],
        ['TNSRUSDT', '=COUNTIF(Trades!C:C,"TNSRUSDT")', '=COUNTIFS(Trades!C:C,"TNSRUSDT",Trades!I:I,"Win")', '=COUNTIFS(Trades!C:C,"TNSRUSDT",Trades!I:I,"Loss")', '=IF(B6>0,C6/B6*100,0)', '=SUMIF(Trades!C:C,"TNSRUSDT",Trades!G:G)', '=IF(B6>0,F6/B6,0)'],
        ['ZROUSDT', '=COUNTIF(Trades!C:C,"ZROUSDT")', '=COUNTIFS(Trades!C:C,"ZROUSDT",Trades!I:I,"Win")', '=COUNTIFS(Trades!C:C,"ZROUSDT",Trades!I:I,"Loss")', '=IF(B7>0,C7/B7*100,0)', '=SUMIF(Trades!C:C,"ZROUSDT",Trades!G:G)', '=IF(B7>0,F7/B7,0)'],
        ['STGUSDT', '=COUNTIF(Trades!C:C,"STGUSDT")', '=COUNTIFS(Trades!C:C,"STGUSDT",Trades!I:I,"Win")', '=COUNTIFS(Trades!C:C,"STGUSDT",Trades!I:I,"Loss")', '=IF(B8>0,C8/B8*100,0)', '=SUMIF(Trades!C:C,"STGUSDT",Trades!G:G)', '=IF(B8>0,F8/B8,0)'],
        ['MANTAUSDT', '=COUNTIF(Trades!C:C,"MANTAUSDT")', '=COUNTIFS(Trades!C:C,"MANTAUSDT",Trades!I:I,"Win")', '=COUNTIFS(Trades!C:C,"MANTAUSDT",Trades!I:I,"Loss")', '=IF(B9>0,C9/B9*100,0)', '=SUMIF(Trades!C:C,"MANTAUSDT",Trades!G:G)', '=IF(B9>0,F9/B9,0)'],
        ['合計', '=SUM(B5:B9)', '=SUM(C5:C9)', '=SUM(D5:D9)', '=IF(B10>0,C10/B10*100,0)', '=SUM(F5:F9)', '=IF(B10>0,F10/B10,0)'],
        [],
        [],
        ['エグジット理由別'],
        ['Exit Reason', 'トレード数', '総PnL($)', '平均PnL($)'],
        ['Stop Loss', '=COUNTIF(Trades!K:K,"Stop Loss")', '=SUMIF(Trades!K:K,"Stop Loss",Trades!G:G)', '=IF(B15>0,C15/B15,0)'],
        ['Trailing Stop', '=COUNTIF(Trades!K:K,"Trailing Stop")', '=SUMIF(Trades!K:K,"Trailing Stop",Trades!G:G)', '=IF(B16>0,C16/B16,0)'],
        ['Take Profit', '=COUNTIF(Trades!K:K,"Take Profit")', '=SUMIF(Trades!K:K,"Take Profit",Trades!G:G)', '=IF(B17>0,C17/B17,0)'],
        [],
        [],
        ['日付別サマリー'],
        ['日付', 'トレード数', '勝ち', '勝率(%)', '総PnL($)'],
        ['2026-02-13', '=COUNTIFS(Trades!A:A,">=2026-02-13",Trades!A:A,"<2026-02-14")', '=COUNTIFS(Trades!A:A,">=2026-02-13",Trades!A:A,"<2026-02-14",Trades!I:I,"Win")', '=IF(B22>0,C22/B22*100,0)', '=SUMIFS(Trades!G:G,Trades!A:A,">=2026-02-13",Trades!A:A,"<2026-02-14")'],
        ['2026-02-14', '=COUNTIFS(Trades!A:A,">=2026-02-14",Trades!A:A,"<2026-02-15")', '=COUNTIFS(Trades!A:A,">=2026-02-14",Trades!A:A,"<2026-02-15",Trades!I:I,"Win")', '=IF(B23>0,C23/B23*100,0)', '=SUMIFS(Trades!G:G,Trades!A:A,">=2026-02-14",Trades!A:A,"<2026-02-15")'],
    ]
    
    body = {'values': values}
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Statistics!A1',
        valueInputOption='USER_ENTERED',
        body=body
    ).execute()
    print("✅ Statistics書き込み完了")
    
    # Chartsシートクリア
    service.spreadsheets().values().clear(
        spreadsheetId=spreadsheet_id,
        range="Charts!A1:Z1000"
    ).execute()
    print("✅ Chartsクリア完了")
    
    # Charts新データ
    chart_values = [
        ['チャート用データ（自動更新）'],
        [],
        ['資金推移'],
        ['トレード#', '資金残高($)'],
    ]
    
    # 資金推移（Tradesシートから参照）
    for i in range(3, 50):  # 最大50トレード分
        chart_values.append([
            f'={i-2}',
            f'=IF(Trades!O{i}<>"",Trades!O{i},"")'
        ])
    
    chart_values.extend([
        [],
        [],
        ['銘柄別PnL'],
        ['Symbol', 'Total PnL($)'],
        ['=Statistics!A5', '=Statistics!F5'],
        ['=Statistics!A6', '=Statistics!F6'],
        ['=Statistics!A7', '=Statistics!F7'],
        ['=Statistics!A8', '=Statistics!F8'],
        ['=Statistics!A9', '=Statistics!F9'],
        [],
        [],
        ['日別PnL'],
        ['Date', 'PnL($)'],
        ['=Statistics!A22', '=Statistics!E22'],
        ['=Statistics!A23', '=Statistics!E23'],
    ])
    
    body = {'values': chart_values}
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Charts!A1',
        valueInputOption='USER_ENTERED',
        body=body
    ).execute()
    print("✅ Charts書き込み完了")
    
    print("\n" + "="*80)
    print("✅ 修正完了！")
    print("="*80)
    print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
    print("\n💡 修正内容:")
    print("   ✅ Statistics: 銘柄別・理由別・日別統計（完全自動更新）")
    print("   ✅ Charts: グラフ用データ（完全連携）")
    print("\n📊 Tradesシートのデータから全て自動計算されますっぴ！")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
