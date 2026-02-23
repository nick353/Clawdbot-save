#!/bin/bash
# Discord #一般チャンネルから10日以上前のメッセージを定期削除

set -e

CHANNEL_ID="1464650064357232948"  # #一般
DAYS_AGO=10
CUTOFF_TIME=$(date -d "$DAYS_AGO days ago" +%s)000  # ミリ秒

echo "🧹 Discord #一般チャンネル古メッセージ削除開始..."
echo "削除対象: $(date -d "$DAYS_AGO days ago" '+%Y年%m月%d日')以前のメッセージ"

# Clawdbotコマンドで削除
# NOTE: message toolは個別削除のため、複数メッセージは反復処理
DELETED_COUNT=0
LIMIT=100  # 1回の取得件数

# Discord APIで古いメッセージを検索・削除
# before パラメータで古い方向に検索
BEFORE_ID="999999999999999999"  # 最新

while true; do
  # メッセージ取得（API制限考慮）
  RESPONSE=$(curl -s -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
    "https://discord.com/api/v10/channels/$CHANNEL_ID/messages?limit=$LIMIT&before=$BEFORE_ID" 2>/dev/null || echo "[]")
  
  MESSAGE_COUNT=$(echo "$RESPONSE" | jq 'length' 2>/dev/null || echo 0)
  
  if [ "$MESSAGE_COUNT" -eq 0 ]; then
    break
  fi
  
  # 各メッセージを確認してタイムスタンプをチェック
  for row in $(echo "$RESPONSE" | jq -r '.[] | @base64' 2>/dev/null); do
    _jq() {
      echo ${row} | base64 --decode | jq -r ${1}
    }
    
    MSG_ID=$(_jq '.id')
    TIMESTAMP=$(_jq '.timestamp')
    AUTHOR_ID=$(_jq '.author.id')
    
    # タイムスタンプをミリ秒に変換（ISO形式）
    EPOCH_MS=$(date -d "$TIMESTAMP" +%s000 2>/dev/null || echo 0)
    
    if [ "$EPOCH_MS" -lt "$CUTOFF_TIME" ]; then
      # 10日以上前のメッセージを削除
      if curl -s -X DELETE -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
        "https://discord.com/api/v10/channels/$CHANNEL_ID/messages/$MSG_ID" >/dev/null 2>&1; then
        ((DELETED_COUNT++))
        sleep 0.5  # API制限対策
      fi
    fi
    
    BEFORE_ID=$MSG_ID
  done
  
  sleep 1  # リクエスト間隔
done

echo "✅ 削除完了: $DELETED_COUNT件のメッセージを削除しました"
