#!/bin/bash
# 自動トレーディングセットアップ

echo "🚀 Bitget自動トレーディングセットアップ"
echo "======================================"
echo ""

# 権限設定
chmod +x /root/clawd/scripts/bitget-auto-trader.py
chmod +x /root/clawd/scripts/bitget-screener.py
chmod +x /root/clawd/scripts/daily-screening.sh

echo "✅ スクリプト権限設定完了"
echo ""

# cronジョブ設定
echo "⏰ cronジョブ設定..."
echo ""

# 既存のcronジョブを取得
crontab -l > /tmp/current_cron 2>/dev/null || touch /tmp/current_cron

# Bitget関連のcronジョブを削除（重複防止）
grep -v "bitget-screener" /tmp/current_cron > /tmp/new_cron
grep -v "daily-screening" /tmp/new_cron > /tmp/current_cron

# 新しいcronジョブを追加
cat >> /tmp/current_cron << 'EOF'

# Bitget自動トレーディング
# 毎日 UTC 0:00（日本時間 9:00）にスクリーニング実行
0 0 * * * /bin/bash /root/clawd/scripts/daily-screening.sh >> /root/clawd/logs/screening.log 2>&1

EOF

# cronジョブを適用
crontab /tmp/current_cron
rm /tmp/current_cron /tmp/new_cron

echo "✅ cronジョブ設定完了"
echo ""
echo "📅 スクリーニングスケジュール:"
echo "  - 毎日 UTC 0:00（日本時間 9:00）"
echo ""
echo "======================================"
echo ""
echo "🎯 次のステップ:"
echo ""
echo "1. 初回スクリーニング実行:"
echo "   bash /root/clawd/scripts/daily-screening.sh"
echo ""
echo "2. 自動トレーダー起動:"
echo "   python3 /root/clawd/scripts/bitget-auto-trader.py"
echo ""
echo "3. トレード記録確認:"
echo "   cat /root/clawd/data/trade-log.csv"
echo ""
echo "======================================"
