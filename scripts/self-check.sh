#!/bin/bash
# 自己診断スクリプト（どんなタスクでも実行）

echo "🔍 自己診断開始: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

ISSUES=0

# 1. プロセスチェック
echo "📊 1. プロセス確認"
TRADER_COUNT=$(ps aux | grep bitget-trader-v2.py | grep python3 | grep -v grep | wc -l)
if [ "$TRADER_COUNT" -eq 0 ]; then
    echo "   ⚠️  トレーダープロセスが停止しています"
    ((ISSUES++))
elif [ "$TRADER_COUNT" -gt 1 ]; then
    echo "   ⚠️  トレーダープロセスが複数起動しています（${TRADER_COUNT}個）"
    ((ISSUES++))
else
    echo "   ✅ トレーダープロセス正常（1個）"
fi
echo ""

# 2. 資金整合性チェック
echo "💰 2. 資金整合性確認"
python3 << 'EOF'
import json
import csv

try:
    # positions.json読み込み
    with open('/root/clawd/data/positions.json', 'r') as f:
        data = json.load(f)
    
    capital = data['capital']
    positions = data['positions']
    
    # 投資額計算
    total_invested = sum(p['position_size'] for p in positions.values())
    
    print(f"   現在資金: ${capital:.2f}")
    print(f"   投資額: ${total_invested:.2f}")
    print(f"   合計: ${capital + total_invested:.2f}")
    
    # ポジション数チェック
    pos_count = len(positions)
    max_positions = 3
    
    if pos_count > max_positions:
        print(f"   ⚠️  ポジション数超過: {pos_count} > {max_positions}")
        exit(1)
    else:
        print(f"   ✅ ポジション数: {pos_count}/{max_positions}")
    
    # 資金が負でないか
    if capital < 0:
        print(f"   ⚠️  資金がマイナス: ${capital:.2f}")
        exit(1)
    
    # エントリー時の資金減算チェック（最新のログを確認）
    with open('/root/clawd/data/trade-log.csv', 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        open_positions = [r for r in rows if r.get('Exit Time', '').strip() == '']
        
        if len(open_positions) != pos_count:
            print(f"   ⚠️  CSVとpositions.jsonの不整合: CSV={len(open_positions)}, JSON={pos_count}")
            exit(1)
    
    print(f"   ✅ 資金整合性OK")
    exit(0)

except Exception as e:
    print(f"   ❌ エラー: {e}")
    exit(1)
EOF

if [ $? -ne 0 ]; then
    ((ISSUES++))
fi
echo ""

# 3. ログエラーチェック
echo "📝 3. ログエラー確認（直近100行）"
ERROR_COUNT=$(tail -100 /root/clawd/data/trader-v2.log 2>/dev/null | grep -i "error\|exception\|failed" | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "   ⚠️  エラー検出: ${ERROR_COUNT}件"
    tail -100 /root/clawd/data/trader-v2.log | grep -i "error\|exception\|failed" | tail -5
    ((ISSUES++))
else
    echo "   ✅ エラーなし"
fi
echo ""

# 4. ファイルサイズチェック
echo "📁 4. ファイルサイズ確認"
LOG_SIZE=$(du -h /root/clawd/data/trader-v2.log 2>/dev/null | cut -f1)
CSV_SIZE=$(du -h /root/clawd/data/trade-log.csv 2>/dev/null | cut -f1)
echo "   trader-v2.log: ${LOG_SIZE}"
echo "   trade-log.csv: ${CSV_SIZE}"

LOG_SIZE_KB=$(du -k /root/clawd/data/trader-v2.log 2>/dev/null | cut -f1)
if [ "$LOG_SIZE_KB" -gt 10240 ]; then
    echo "   ⚠️  ログファイルが大きすぎます（>10MB）"
    ((ISSUES++))
else
    echo "   ✅ ファイルサイズ正常"
fi
echo ""

# 5. Googleスプレッドシート同期確認
echo "📊 5. Googleスプレッドシート同期確認"
LAST_SYNC=$(stat -c %y /root/clawd/data/trade-log.csv 2>/dev/null | cut -d' ' -f1-2)
echo "   最終CSV更新: ${LAST_SYNC}"
# 同期テスト（dry-run的に実行）
python3 /root/clawd/scripts/sync-to-gsheet.py > /tmp/sync-test.log 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ 同期テスト成功"
else
    echo "   ⚠️  同期テスト失敗"
    cat /tmp/sync-test.log
    ((ISSUES++))
fi
echo ""

# 結果サマリー
echo "======================================"
if [ "$ISSUES" -eq 0 ]; then
    echo "✅ 自己診断完了: 問題なし"
    exit 0
else
    echo "⚠️  自己診断完了: ${ISSUES}件の問題検出"
    exit 1
fi
