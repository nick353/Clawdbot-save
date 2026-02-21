#!/bin/bash
# Bitget取引ダッシュボード自動更新

set -e

echo "🐥 Bitget取引ダッシュボード更新開始..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 現在のポジション損益を計算
echo "📊 ポジション損益を計算中..."
python3 /root/clawd/scripts/calc-position-pnl.py

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 2. Google Sheetsに反映
echo "☁️  Google Sheetsに反映中..."
python3 /root/clawd/scripts/update-sheets.py

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ダッシュボード更新完了！"
echo "📊 URL: https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
