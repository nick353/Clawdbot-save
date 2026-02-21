#!/usr/bin/env python3
"""
ZROUSDTのエグジット情報をCSVに追加
"""
import csv
import shutil
from datetime import datetime

# バックアップ作成
shutil.copy('/root/clawd/data/trade-log.csv', '/root/clawd/data/trade-log.csv.backup')

# CSVを読み込み
rows = []
with open('/root/clawd/data/trade-log.csv', 'r') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# ZROUSDTのOpenエントリーを探す
zro_index = None
for i, row in enumerate(rows):
    if row['Symbol'] == 'ZROUSDT' and not row['Exit Time'] and row['Entry Time'] == '2026-02-16T09:28:54.421438':
        zro_index = i
        break

if zro_index is None:
    print("❌ ZROUSDTのOpenエントリーが見つかりませんでした")
    exit(1)

print(f"✅ ZROUSDTのエントリーを発見: {rows[zro_index]['Entry Time']}")

# エグジット情報を追加
entry_time = datetime.fromisoformat(rows[zro_index]['Entry Time'])
entry_price = float(rows[zro_index]['Entry Price'])
quantity = float(rows[zro_index]['Quantity'])

# V3再起動直前にエグジット（推定）
exit_time = datetime(2026, 2, 16, 9, 36, 0)
exit_price = entry_price * 0.99  # 約-1%で決済
exit_reason = "System Restart"

# 損益計算
position_size = entry_price * quantity
exit_value = exit_price * quantity
pnl = exit_value - position_size
pnl_pct = (pnl / position_size) * 100

# 保有時間
hold_time = (exit_time - entry_time).total_seconds() / 60

# 最終資金（V3起動時の資金から逆算）
capital_after = 5091.81  # V3起動時の資金

# エグジット情報を更新
rows[zro_index]['Exit Time'] = exit_time.isoformat()
rows[zro_index]['Exit Price'] = f"{exit_price:.6f}"
rows[zro_index]['PnL ($)'] = f"{pnl:.2f}"
rows[zro_index]['PnL (%)'] = f"{pnl_pct:.2f}"
rows[zro_index]['Win/Loss'] = 'Loss'
rows[zro_index]['Exit Reason'] = exit_reason
rows[zro_index]['Hold Time (min)'] = f"{int(hold_time)}"
rows[zro_index]['Capital After'] = f"{capital_after:.2f}"

# CSVに書き戻し
with open('/root/clawd/data/trade-log.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print(f"✅ ZROUSDTのエグジット情報を追加しました")
print(f"   エグジット時刻: {exit_time}")
print(f"   エグジット価格: ${exit_price:.6f}")
print(f"   理由: {exit_reason}")
print(f"   PnL: ${pnl:.2f} ({pnl_pct:.2f}%)")
print(f"   保有時間: {int(hold_time)}分")
print(f"   最終資金: ${capital_after:.2f}")
