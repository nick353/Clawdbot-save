#!/usr/bin/env bash
# Google Drive監視cronジョブ設定

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# cronジョブ追加（5分ごと）
clawdbot cron add \
  --schedule "*/5 * * * *" \
  --text "Google Drive「投稿用の動画」フォルダを監視して、新規動画をSNS自動投稿

bash $SCRIPT_DIR/gdrive-sns-watcher.sh

完了したら、#sns-投稿チャンネルに結果を報告（エラー時のみ）" \
  --context-messages 0

echo "✅ Google Drive監視cronジョブを追加しました"
echo "📋 確認: clawdbot cron list"
