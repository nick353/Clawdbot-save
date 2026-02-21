#!/bin/bash
# VPS定期クリーンアップスクリプト
# 安全な一時ファイルとキャッシュの削除

set -e

echo "🧹 VPSクリーンアップ開始: $(date)"

# 実行前のディスク状況
echo "📊 実行前:"
df -h / | tail -1

DELETED_SIZE=0

# 1. /tmp の古いファイル（7日以上経過）
echo "🗑️  /tmp の古いファイルを削除..."
find /tmp -type f -mtime +7 -delete 2>/dev/null || true

# 2. Adobe Podcast 一時ファイル
if ls /tmp/adobe-podcast* 1> /dev/null 2>&1; then
    echo "🗑️  Adobe Podcast 一時ファイルを削除..."
    rm -f /tmp/adobe-podcast*.{png,html} 2>/dev/null || true
fi

# 3. 古いログのローテーション（30日以上 → 圧縮）
echo "📦 古いログを圧縮..."
find /root/clawd/data -name "*.log" -mtime +30 -exec gzip {} \; 2>/dev/null || true

# 4. 圧縮済みログの削除（90日以上）
echo "🗑️  90日以上経過した圧縮ログを削除..."
find /root/clawd/data -name "*.log.gz" -mtime +90 -delete 2>/dev/null || true

# 5. npm キャッシュのクリーン（オプション）
# 注: 必要に応じてコメント解除
# echo "🗑️  npm キャッシュをクリア..."
# npm cache clean --force 2>/dev/null || true

# 6. Pip キャッシュのクリーン（オプション）
# 注: 必要に応じてコメント解除
# echo "🗑️  Pip キャッシュをクリア..."
# rm -rf /root/.cache/pip/* 2>/dev/null || true

# 実行後のディスク状況
echo "📊 実行後:"
df -h / | tail -1

echo "✅ クリーンアップ完了: $(date)"
