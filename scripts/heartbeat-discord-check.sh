#!/bin/bash
# Discord投稿待ちチェック（HEARTBEAT専用）- ログ最適化版

set -e

PENDING_FLAG="/root/clawd/.discord_post_pending"

[ ! -f "$PENDING_FLAG" ] && exit 0

DATE=$(sed -n '1p' "$PENDING_FLAG")
REPORT_FILE=$(sed -n '2p' "$PENDING_FLAG")
CHANNEL_ID=$(sed -n '3p' "$PENDING_FLAG")

[ -z "$CHANNEL_ID" ] && CHANNEL_ID="1464650064357232948"

if [ ! -f "$REPORT_FILE" ]; then
    echo "❌ レポートファイルなし: $REPORT_FILE" >&2
    rm -f "$PENDING_FLAG"
    exit 1
fi

rm -f "$PENDING_FLAG"
echo "$REPORT_FILE"
echo "$CHANNEL_ID"
