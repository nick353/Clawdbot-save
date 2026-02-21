#!/bin/bash
# 全てのGoogle Sheetsシートを最新データで更新（統合版）
# Summary/Positions/Historyシートは更新しない（不要）

set -e

echo "🐥 Bitget Trading - Google Sheets更新開始..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 現在のポジション損益を計算
echo "📊 ステップ1: ポジション損益を計算..."
python3 /root/clawd/scripts/calc-position-pnl.py

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 2. ChartDataシートを同期
echo "📊 ステップ2: ChartData同期..."
python3 /root/clawd/scripts/sync-chartdata.py

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 3. Dashboardを最新情報で更新
echo "📊 ステップ3: Dashboard更新..."
python3 /root/clawd/scripts/update-full-dashboard.py

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Google Sheets更新完了！"
echo "📊 URL: https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
