#!/bin/bash

# Threads API セットアップスクリプト
# 短期トークンを長期トークンに変換し、THREADS_USER_ID を取得する

set -e

THREADS_ACCESS_TOKEN="${THREADS_ACCESS_TOKEN}"
THREADS_APP_SECRET="${THREADS_APP_SECRET}"
THREADS_APP_ID="${THREADS_APP_ID}"

if [ -z "$THREADS_ACCESS_TOKEN" ] || [ -z "$THREADS_APP_SECRET" ]; then
  echo "❌ エラー: THREADS_ACCESS_TOKEN と THREADS_APP_SECRET が必要です"
  exit 1
fi

echo "🔄 Threads API セットアップ開始..."

# Step 1: 短期トークンを長期トークンに変換
echo "📝 短期トークンを長期トークンに変換中..."

RESPONSE=$(curl -s "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${THREADS_APP_SECRET}&access_token=${THREADS_ACCESS_TOKEN}")

echo "API Response: $RESPONSE"

# JSON から access_token と user_id を抽出
LONG_LIVED_TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
THREADS_USER_ID=$(echo "$RESPONSE" | grep -o '"user_id":"[^"]*' | cut -d'"' -f4 || echo "$RESPONSE" | grep -o '"user_id":[0-9]*' | cut -d':' -f2)

if [ -z "$LONG_LIVED_TOKEN" ] || [ -z "$THREADS_USER_ID" ]; then
  echo "❌ エラー: トークン変換失敗"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ トークン変換成功"
echo "🆔 THREADS_USER_ID: $THREADS_USER_ID"
echo "🔐 長期トークン: ${LONG_LIVED_TOKEN:0:20}..."

# 設定ファイルに保存
mkdir -p /root/clawd/config
cat > /root/clawd/config/threads-api.conf << EOF
export THREADS_USER_ID="$THREADS_USER_ID"
export THREADS_LONG_LIVED_TOKEN="$LONG_LIVED_TOKEN"
export THREADS_APP_ID="$THREADS_APP_ID"
export THREADS_APP_SECRET="$THREADS_APP_SECRET"
EOF

echo "✅ 設定ファイルに保存: /root/clawd/config/threads-api.conf"

# ~/.profile に追記
if ! grep -q "THREADS_USER_ID" ~/.profile; then
  echo "source /root/clawd/config/threads-api.conf" >> ~/.profile
  echo "✅ ~/.profile に追記"
fi

echo "🎉 Threads API セットアップ完了！"
echo ""
echo "以下の環境変数が使用可能になりました："
echo "  - THREADS_USER_ID"
echo "  - THREADS_LONG_LIVED_TOKEN"
echo "  - THREADS_APP_ID"
echo "  - THREADS_APP_SECRET"
