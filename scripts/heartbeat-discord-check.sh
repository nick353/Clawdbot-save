#!/bin/bash
# Discord投稿待ちチェック（HEARTBEAT専用）

set -e

PENDING_FLAG="/root/clawd/.discord_post_pending"

if [ ! -f "$PENDING_FLAG" ]; then
    # フラグファイルなし = 何もしない
    exit 0
fi

echo "🔔 Discord投稿待ちを検知"

# フラグファイルから読み取り
DATE=$(sed -n '1p' "$PENDING_FLAG")
REPORT_FILE=$(sed -n '2p' "$PENDING_FLAG")
CHANNEL_ID=$(sed -n '3p' "$PENDING_FLAG")

# デフォルトチャンネル（指定がない場合）
if [ -z "$CHANNEL_ID" ]; then
    CHANNEL_ID="1464650064357232948"  # #一般
    echo "⚠️ チャンネルIDが指定されていないため、デフォルト（#一般）に投稿します"
fi

# レポートファイル存在確認
if [ ! -f "$REPORT_FILE" ]; then
    echo "❌ エラー: レポートファイルが見つかりません: $REPORT_FILE"
    rm -f "$PENDING_FLAG"
    exit 1
fi

# レポート内容を読み取り
REPORT_CONTENT=$(cat "$REPORT_FILE")

# Discord投稿（Clawdbotのmessage toolを使用）
echo "📤 $DATE のレポートをDiscord（チャンネルID: $CHANNEL_ID）に投稿します"

# ここでリッキーがmessage toolを使って投稿
# （このスクリプトは直接message toolを呼べないので、ここは空）
# 実際の投稿はHEARTBEAT.md内でリッキーが行う

# フラグファイル削除
rm -f "$PENDING_FLAG"

echo "✅ Discord投稿フラグ処理完了"
echo "$REPORT_FILE"
echo "$CHANNEL_ID"
