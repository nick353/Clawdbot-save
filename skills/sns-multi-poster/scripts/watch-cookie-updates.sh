#!/bin/bash
# Cookie更新ディレクトリ監視スクリプト
# 使い方: bash watch-cookie-updates.sh
# /root/clawd/skills/sns-multi-poster/cookies/updates/ に新しいJSONファイルが追加されたら自動更新

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COOKIES_DIR="$(dirname "$SCRIPT_DIR")/cookies"
UPDATES_DIR="$COOKIES_DIR/updates"

# 更新ディレクトリ作成
mkdir -p "$UPDATES_DIR"

echo "🔍 Cookie更新ディレクトリを監視中: $UPDATES_DIR"
echo "ファイル命名規則: <platform>.json（例: instagram.json, x.json）"

# inotifywaitがインストールされているかチェック
if ! command -v inotifywait &> /dev/null; then
  echo "⚠️  inotifywait未インストール - ポーリングモードで監視します"
  
  # ポーリングモード（5秒ごとにチェック）
  while true; do
    for FILE in "$UPDATES_DIR"/*.json; do
      [ -f "$FILE" ] || continue
      
      FILENAME=$(basename "$FILE")
      PLATFORM="${FILENAME%.json}"
      
      echo "📥 新しいCookieファイル検出: $FILENAME"
      
      # 自動更新実行
      if bash "$SCRIPT_DIR/update-cookies.sh" "$PLATFORM" "$FILE"; then
        # 更新成功 → ファイル削除
        rm "$FILE"
        echo "✅ $PLATFORM のCookie更新完了（ファイル削除）"
      else
        # 更新失敗 → エラーログ
        echo "❌ $PLATFORM のCookie更新失敗" >&2
        mv "$FILE" "$UPDATES_DIR/failed-$(date +%Y%m%d-%H%M%S)-$FILENAME"
      fi
    done
    
    sleep 5
  done
else
  # inotifywaitモード（リアルタイム監視）
  inotifywait -m -e close_write --format '%f' "$UPDATES_DIR" | while read FILENAME; do
    # .jsonファイルのみ処理
    if [[ ! "$FILENAME" =~ \.json$ ]]; then
      continue
    fi
    
    PLATFORM="${FILENAME%.json}"
    FILE="$UPDATES_DIR/$FILENAME"
    
    echo "📥 新しいCookieファイル検出: $FILENAME"
    
    # 自動更新実行
    if bash "$SCRIPT_DIR/update-cookies.sh" "$PLATFORM" "$FILE"; then
      # 更新成功 → ファイル削除
      rm "$FILE"
      echo "✅ $PLATFORM のCookie更新完了（ファイル削除）"
    else
      # 更新失敗 → エラーログ
      echo "❌ $PLATFORM のCookie更新失敗" >&2
      mv "$FILE" "$UPDATES_DIR/failed-$(date +%Y%m%d-%H%M%S)-$FILENAME"
    fi
  done
fi
