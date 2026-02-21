#!/bin/bash
# SNS Multi Poster - VPS → Mac 自動同期スクリプト

set -e

echo "🦜 SNS Multi Poster 同期スクリプト"
echo ""

# VPS設定（環境変数で上書き可能）
VPS_HOST="${VPS_HOST:-<VPSのIPアドレス>}"
VPS_USER="${VPS_USER:-root}"
VPS_PATH="${VPS_PATH:-/root/clawd/skills/sns-multi-poster}"
LOCAL_PATH="$HOME/.clawdbot/skills/sns-multi-poster"

echo "📡 VPSから最新版をダウンロード中..."
echo "   VPS: $VPS_USER@$VPS_HOST:$VPS_PATH"
echo "   ローカル: $LOCAL_PATH"
echo ""

# ローカルフォルダ作成
mkdir -p "$HOME/.clawdbot/skills"

# VPSから同期（既存ファイルは上書き）
rsync -avz --progress \
  "$VPS_USER@$VPS_HOST:$VPS_PATH/" \
  "$LOCAL_PATH/"

echo ""
echo "✅ 同期完了！"
echo ""
echo "📍 スキルの場所: $LOCAL_PATH"
echo ""
echo "次のステップ:"
echo "  1. テスト画像を準備 (例: ~/Pictures/test.jpg)"
echo "  2. Clawdbot Dashboardを開く: open http://127.0.0.1:18789/"
echo "  3. 「SNS投稿」と入力して実行"
echo ""
