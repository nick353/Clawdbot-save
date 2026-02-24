#!/bin/bash
# Cookie自動更新スクリプト
# 使い方: bash update-cookies.sh <platform> <cookie-json-path>
# 例: bash update-cookies.sh instagram /tmp/instagram-new.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COOKIES_DIR="$(dirname "$SCRIPT_DIR")/cookies"
UPDATES_DIR="$COOKIES_DIR/updates"

# 引数チェック
if [ $# -lt 2 ]; then
  echo "使い方: $0 <platform> <cookie-json-path>" >&2
  echo "例: $0 instagram /tmp/instagram-new.json" >&2
  exit 1
fi

PLATFORM="$1"
NEW_COOKIE_PATH="$2"

# プラットフォーム検証
VALID_PLATFORMS=("instagram" "facebook" "threads" "pinterest" "x")
if [[ ! " ${VALID_PLATFORMS[@]} " =~ " $PLATFORM " ]]; then
  echo "❌ 無効なプラットフォーム: $PLATFORM" >&2
  echo "有効なプラットフォーム: ${VALID_PLATFORMS[*]}" >&2
  exit 1
fi

# Cookieファイル検証
if [ ! -f "$NEW_COOKIE_PATH" ]; then
  echo "❌ Cookieファイルが見つかりません: $NEW_COOKIE_PATH" >&2
  exit 1
fi

# JSON形式検証
if ! jq empty "$NEW_COOKIE_PATH" 2>/dev/null; then
  echo "❌ 無効なJSON形式: $NEW_COOKIE_PATH" >&2
  exit 1
fi

# 更新ディレクトリ作成
mkdir -p "$UPDATES_DIR"

# バックアップ作成
TARGET_COOKIE="$COOKIES_DIR/${PLATFORM}.json"
if [ -f "$TARGET_COOKIE" ]; then
  BACKUP_PATH="$COOKIES_DIR/backups/${PLATFORM}-$(date +%Y%m%d-%H%M%S).json"
  mkdir -p "$(dirname "$BACKUP_PATH")"
  cp "$TARGET_COOKIE" "$BACKUP_PATH"
  echo "📦 バックアップ作成: $BACKUP_PATH"
fi

# Cookie更新
cp "$NEW_COOKIE_PATH" "$TARGET_COOKIE"
echo "✅ Cookie更新完了: $TARGET_COOKIE"

# 更新ログ記録
echo "$(date +%Y-%m-%d_%H:%M:%S)|$PLATFORM|updated|$(basename "$NEW_COOKIE_PATH")" >> "$UPDATES_DIR/update-log.txt"

# Discord通知（オプション）
if command -v clawdbot &> /dev/null; then
  clawdbot message send \
    --channel discord \
    --target "channel:1470060780111007950" \
    --message "🍪 **Cookie更新完了！**

プラットフォーム: **$PLATFORM**
更新日時: $(date +'%Y-%m-%d %H:%M:%S')
バックアップ: $BACKUP_PATH" 2>/dev/null || echo "⚠️  Discord通知スキップ（clawdbot未インストール）"
fi

echo "🎉 Cookie自動更新完了！"
