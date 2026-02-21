#!/usr/bin/env python3
"""
PnL統計の数式を修正（明示的な範囲指定）
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
    
    # Statistics修正（明示的な範囲 C3:C1000, G3:G1000 を使用）
    values = [
        ['統計情報（自動更新）'],
        [],
        ['銘柄別成績'],
        ['Symbol', 'トレード数', '勝ち', '負け', '勝率(%)', '総PnL($)', '平均PnL($)'],
        ['LQTYUSDT', '=COUNTIF(Trades!C3:C1000,"LQTYUSDT")', '=COUNTIFS(Trades!C3:C1000,"LQTYUSDT",Trades!I3:I1000,"Win")', '=COUNTIFS(Trades!C3:C1000,"LQTYUSDT",Trades!I3:I1000,"Loss")', '=IF(B5>0,C5/B5*100,0)', '=SUMIF(Trades!C3:C1000,"LQTYUSDT",Trades!G3:G1000)', '=IF(B5>0,F5/B5,0)'],
        ['TNSRUSDT', '=COUNTIF(Trades!C3:C1000,"TNSRUSDT")', '=COUNTIFS(Trades!C3:C1000,"TNSRUSDT",Trades!I3:I1000,"Win")', '=COUNTIFS(Trades!C3:C1000,"TNSRUSDT",Trades!I3:I1000,"Loss")', '=IF(B6>0,C6/B6*100,0)', '=SUMIF(Trades!C3:C1000,"TNSRUSDT",Trades!G3:G1000)', '=IF(B6>0,F6/B6,0)'],
        ['ZROUSDT', '=COUNTIF(Trades!C3:C1000,"ZROUSDT")', '=COUNTIFS(Trades!C3:C1000,"ZROUSDT",Trades!I3:I1000,"Win")', '=COUNTIFS(Trades!C3:C1000,"ZROUSDT",Trades!I3:I1000,"Loss")', '=IF(B7>0,C7/B7*100,0)', '=SUMIF(Trades!C3:C1000,"ZROUSDT",Trades!G3:G1000)', '=IF(B7>0,F7/B7,0)'],
        ['STGUSDT', '=COUNTIF(Trades!C3:C1000,"STGUSDT")', '=COUNTIFS(Trades!C3:C1000,"STGUSDT",Trades!I3:I1000,"Win")', '=COUNTIFS(Trades!C3:C1000,"STGUSDT",Trades!I3:I1000,"Loss")', '=IF(B8>0,C8/B8*100,0)', '=SUMIF(Trades!C3:C1000,"STGUSDT",Trades!G3:G1000)', '=IF(B8>0,F8/B8,0)'],
        ['MANTAUSDT', '=COUNTIF(Trades!C3:C1000,"MANTAUSDT")', '=COUNTIFS(Trades!C3:C1000,"MANTAUSDT",Trades!I3:I1000,"Win")', '=COUNTIFS(Trades!C3:C1000,"MANTAUSDT",Trades!I3:I1000,"Loss")', '=IF(B9>0,C9/B9*100,0)', '=SUMIF(Trades!C3:C1000,"MANTAUSDT",Trades!G3:G1000)', '=IF(B9>0,F9/B9,0)'],
        ['合計', '=SUM(B5:B9)', '=SUM(C5:C9)', '=SUM(D5:D9)', '=IF(B10>0,C10/B10*100,0)', '=SUM(F5:F9)', '=IF(B10>0,F10/B10,0)'],
        [],
        [],
        ['エグジット理由別'],
        ['Exit Reason', 'トレード数', '総PnL($)', '平均PnL($)'],
        ['Stop Loss', '=COUNTIF(Trades!K3:K1000,"Stop Loss")', '=SUMIF(Trades!K3:K1000,"Stop Loss",Trades!G3:G1000)', '=IF(B15>0,C15/B15,0)'],
        ['Trailing Stop', '=COUNTIF(Trades!K3:K1000,"Trailing Stop")', '=SUMIF(Trades!K3:K1000,"Trailing Stop",Trades!G3:G1000)', '=IF(B16>0,C16/B16,0)'],
        ['Take Profit', '=COUNTIF(Trades!K3:K1000,"Take Profit")', '=SUMIF(Trades!K3:K1000,"Take Profit",Trades!G3:G1000)', '=IF(B17>0,C17/B17,0)'],
        [],
        [],
        ['日付別サマリー'],
        ['日付', 'トレード数', '勝ち', '勝率(%)', '総PnL($)'],
        ['2026-02-13', '=COUNTIFS(Trades!A3:A1000,">=2026-02-13",Trades!A3:A1000,"<2026-02-14")', '=COUNTIFS(Trades!A3:A1000,">=2026-02-13",Trades!A3:A1000,"<2026-02-14",Trades!I3:I1000,"Win")', '=IF(B22>0,C22/B22*100,0)', '=SUMIFS(Trades!G3:G1000,Trades!A3:A1000,">=2026-02-13",Trades!A3:A1000,"<2026-02-14")'],
        ['2026-02-14', '=COUNTIFS(Trades!A3:A1000,">=2026-02-14",Trades!A3:A1000,"<2026-02-15")', '=COUNTIFS(Trades!A3:A1000,">=2026-02-14",Trades!A3:A1000,"<2026-02-15",Trades!I3:I1000,"Win")', '=IF(B23>0,C23/B23*100,0)', '=SUMIFS(Trades!G3:G1000,Trades!A3:A1000,">=2026-02-14",Trades!A3:A1000,"<2026-02-15")'],
    ]
    
    body = {'values': values}
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Statistics!A1',
        valueInputOption='USER_ENTERED',
        body=body
    ).execute()
    print("✅ Statistics数式修正完了")
    
    print("\n" + "="*80)
    print("✅ PnL統計の修正完了！")
    print("="*80)
    print(f"\n🔗 URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
    print("\n💡 修正内容:")
    print("   ✅ 明示的な範囲指定（C3:C1000, G3:G1000）")
    print("   ✅ PnL($)が正しく集計されるようになりましたっぴ！")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
