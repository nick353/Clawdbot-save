#!/bin/bash

# Discord古いメッセージ削除スクリプト
# 10日以上前のメッセージを自動削除

set -e

CHANNEL_ID="1464650064357232948"  # #一般
DAYS_TO_KEEP=10
CUTOFF_DATE=$(date -d "$DAYS_TO_KEEP days ago" +%s000)

echo "🗑️ Discord古いメッセージ削除スクリプト開始"
echo "チャンネル: $CHANNEL_ID"
echo "削除対象: $DAYS_TO_KEEP日以上前のメッセージ"

# メッセージを取得して削除
DELETED_COUNT=0
BEFORE_ID=""

while true; do
  # メッセージ取得（limit=100で最大100件）
  if [ -z "$BEFORE_ID" ]; then
    RESPONSE=$(message read channel=$CHANNEL_ID limit=100 2>/dev/null || echo "[]")
  else
    RESPONSE=$(message read channel=$CHANNEL_ID limit=100 before=$BEFORE_ID 2>/dev/null || echo "[]")
  fi

  # 取得したメッセージがない場合は終了
  if [ -z "$RESPONSE" ] || [ "$RESPONSE" = "[]" ]; then
    break
  fi

  # メッセージの数を確認
  MESSAGE_COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
  if [ "$MESSAGE_COUNT" -eq 0 ]; then
    break
  fi

  # 各メッセージを処理
  echo "$RESPONSE" | jq -r '.[] | "\(.id)|\(.timestamp)"' | while IFS='|' read -r MSG_ID TIMESTAMP; do
    # タイムスタンプをミリ秒に変換
    TIMESTAMP_MS=$(date -d "$TIMESTAMP" +%s000 2>/dev/null || echo "0")

    # 古いメッセージかチェック
    if [ "$TIMESTAMP_MS" -lt "$CUTOFF_DATE" ]; then
      if message delete messageId=$MSG_ID channel=$CHANNEL_ID 2>/dev/null; then
        ((DELETED_COUNT++))
        sleep 0.5  # API制限を避ける
      fi
    fi
  done

  # 最後のメッセージIDを取得（次のページへ）
  BEFORE_ID=$(echo "$RESPONSE" | jq -r '.[-1].id')
  if [ -z "$BEFORE_ID" ] || [ "$BEFORE_ID" = "null" ]; then
    break
  fi

  sleep 1  # API制限を避ける
done

# 報告をDiscordに投稿
REPORT="✅ Discord メッセージ削除完了
削除件数: $DELETED_COUNT 件
対象期間: 10日以上前
実行日時: $(date '+%Y-%m-%d %H:%M:%S UTC')"

message send channel=discord target='#一般' message="$REPORT" 2>/dev/null || true

echo "✅ 削除完了: $DELETED_COUNT 件"
