#!/usr/bin/env python3
"""HEARTBEAT: Bitget状況をmemory/bitget-trading.mdに自動保存 - ログ最適化版"""
import json, csv, sys
from datetime import datetime

try:
    with open('/root/clawd/data/positions.json') as f:
        pos = json.load(f)
    capital = pos.get('capital', 0)
    n_pos = len(pos.get('positions', {}))

    confirmed = 0
    try:
        with open('/root/clawd/data/trade-log.csv') as f:
            for row in csv.DictReader(f):
                if row.get('Exit Time') and row.get('PnL ($)'):
                    confirmed += float(row['PnL ($)'])
    except FileNotFoundError:
        pass

    status = f"\n\n## 📊 最新状況（{datetime.now().strftime('%Y-%m-%d %H:%M')} UTC）\n"
    status += f"- 現金: ${capital:,.2f}\n"
    status += f"- ポジション数: {n_pos}個\n"
    status += f"- 確定損益: ${confirmed:+,.2f}\n"

    mem_file = '/root/clawd/memory/bitget-trading.md'
    try:
        with open(mem_file) as f:
            content = f.read()
    except FileNotFoundError:
        content = "# Bitget Trading Status\n"

    if '## 📊 最新状況' in content:
        content = content[:content.index('## 📊 最新状況')]

    with open(mem_file, 'w') as f:
        f.write(content.rstrip() + status)

except Exception as e:
    print(f"❌ Bitget状況保存エラー: {e}", file=sys.stderr)
    sys.exit(1)
