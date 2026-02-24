#!/bin/bash
# Cookie期限チェックスクリプト
# 使い方: bash check-cookie-expiry.sh [--warn-days 7]
# Cronで毎日実行し、期限切れが近い場合Discord通知

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COOKIES_DIR="$(dirname "$SCRIPT_DIR")/cookies"
WARN_DAYS=7  # デフォルト7日前に警告

# 引数パース
while [[ $# -gt 0 ]]; do
  case $1 in
    --warn-days)
      WARN_DAYS="$2"
      shift 2
      ;;
    *)
      echo "不明な引数: $1" >&2
      exit 1
      ;;
  esac
done

# 現在のタイムスタンプ（秒）
NOW=$(date +%s)
WARN_THRESHOLD=$((NOW + WARN_DAYS * 86400))

EXPIRING_COOKIES=()

# 各プラットフォームのCookieをチェック
for PLATFORM in instagram facebook threads pinterest x; do
  COOKIE_FILE="$COOKIES_DIR/${PLATFORM}.json"
  
  if [ ! -f "$COOKIE_FILE" ]; then
    echo "⚠️  Cookieファイルなし: $PLATFORM" >&2
    continue
  fi
  
  # 最小有効期限を取得（expirationDateフィールド）
  MIN_EXPIRY=$(jq -r '[.[] | select(.expirationDate != null) | .expirationDate] | min // 0' "$COOKIE_FILE")
  
  if [ "$MIN_EXPIRY" = "null" ] || [ "$MIN_EXPIRY" = "0" ]; then
    echo "✅ $PLATFORM: 期限なし（セッションCookie）"
    continue
  fi
  
  # 整数に変換
  MIN_EXPIRY_INT=$(echo "$MIN_EXPIRY" | awk '{print int($1)}')
  
  if [ "$MIN_EXPIRY_INT" -lt "$NOW" ]; then
    echo "❌ $PLATFORM: 期限切れ！（$(date -d @"$MIN_EXPIRY_INT" +'%Y-%m-%d %H:%M:%S')）"
    EXPIRING_COOKIES+=("$PLATFORM (期限切れ)")
  elif [ "$MIN_EXPIRY_INT" -lt "$WARN_THRESHOLD" ]; then
    DAYS_LEFT=$(( (MIN_EXPIRY_INT - NOW) / 86400 ))
    echo "⚠️  $PLATFORM: あと${DAYS_LEFT}日で期限切れ（$(date -d @"$MIN_EXPIRY_INT" +'%Y-%m-%d')）"
    EXPIRING_COOKIES+=("$PLATFORM (あと${DAYS_LEFT}日)")
  else
    DAYS_LEFT=$(( (MIN_EXPIRY_INT - NOW) / 86400 ))
    echo "✅ $PLATFORM: OK（あと${DAYS_LEFT}日）"
  fi
done

# Discord通知（期限切れまたは警告がある場合のみ）
if [ ${#EXPIRING_COOKIES[@]} -gt 0 ]; then
  MESSAGE="🍪 **Cookie期限警告！**

以下のプラットフォームのCookieを更新してください：
"
  for COOKIE in "${EXPIRING_COOKIES[@]}"; do
    MESSAGE="$MESSAGE
- $COOKIE"
  done
  
  MESSAGE="$MESSAGE

**更新方法:**
1. ブラウザで各プラットフォームにログイン
2. Cookie拡張機能（EditThisCookie等）で書き出し
3. \`bash /root/clawd/skills/sns-multi-poster/scripts/update-cookies.sh <platform> <json-path>\`"
  
  if command -v clawdbot &> /dev/null; then
    clawdbot message send \
      --channel discord \
      --target "channel:1470060780111007950" \
      --message "$MESSAGE" 2>/dev/null || echo "⚠️  Discord通知スキップ"
  fi
  
  exit 1  # 警告あり
else
  echo "✅ 全てのCookieは有効期限内です"
  exit 0  # 問題なし
fi
