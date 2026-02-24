#!/bin/bash
# Instagram自動投稿 - Browser Tool + Vision版
# Claudeが画面を見ながら操作を進める Computer Use 的アプローチ

set -euo pipefail

IMAGE_PATH="${1:-}"
CAPTION="${2:-}"

if [ -z "$IMAGE_PATH" ] || [ -z "$CAPTION" ]; then
  echo "Usage: $0 <image_path> <caption>"
  exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
  echo "❌ Image not found: $IMAGE_PATH"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COOKIE_FILE="$SCRIPT_DIR/cookies/instagram.json"

if [ ! -f "$COOKIE_FILE" ]; then
  echo "❌ Cookie file not found: $COOKIE_FILE"
  exit 1
fi

echo "🐥 Instagram自動投稿（Browser Tool版）"
echo "📸 画像: $IMAGE_PATH"
echo "📝 キャプション: $CAPTION"
echo ""

# Clawdbot Browser Tool を使った投稿フロー
# NOTE: この部分はClawdbotの対話セッション内で実行される想定
# このスクリプトは「準備」のみ、実際の操作はClaudeが browser tool で行う

cat <<EOF

🎯 次のステップを Clawdbot の browser tool で実行:

1. browser start (profile="clawd")
2. browser navigate (targetUrl="https://www.instagram.com")
3. Cookie認証適用
4. browser snapshot (refs="aria") で画面確認
5. Claude が画面を見て「新規投稿」ボタンを探す
6. browser act (kind="click") で投稿フロー開始
7. browser snapshot → act を繰り返し
8. 画像アップロード → キャプション入力 → 投稿完了

---

準備完了っぴ 🐥！
次は Clawdbot 内で browser tool を使って実際に操作を進めますっぴ！

EOF
