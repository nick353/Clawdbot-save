#!/bin/bash
# ============================================================
# SNSコンテンツキュレーター cron設定スクリプト
#
# Usage:
#   bash cron-setup.sh install    # cronジョブを追加
#   bash cron-setup.sh remove     # cronジョブを削除
#   bash cron-setup.sh status     # 現在のcron設定を確認
#
# スケジュール: 毎日 09:00 JST（= 00:00 UTC）
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_SCRIPT="$SCRIPT_DIR/curate-and-post.sh"
LOG_FILE="$SCRIPT_DIR/cron.log"

# cronエントリ（00:00 UTC = 09:00 JST）
CRON_SCHEDULE="0 0 * * *"
CRON_CMD="$CRON_SCHEDULE bash $MAIN_SCRIPT >> $LOG_FILE 2>&1"
CRON_MARKER="# sns-curator"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

case "${1:-status}" in
  install)
    echo -e "${GREEN}[INSTALL]${NC} SNSキュレーターのcronジョブを設定します..."
    echo -e "  スケジュール: 毎日 09:00 JST (00:00 UTC)"
    echo -e "  スクリプト: $MAIN_SCRIPT"
    echo -e "  ログ: $LOG_FILE"

    # 既存のエントリを削除してから追加
    (crontab -l 2>/dev/null | grep -v "$CRON_MARKER" || true) | {
      cat
      echo "$CRON_CMD $CRON_MARKER"
    } | crontab -

    echo -e "${GREEN}[OK]${NC} cronジョブを設定しました！"
    echo ""
    echo "現在のcron設定:"
    crontab -l 2>/dev/null | grep "$CRON_MARKER" || echo "（設定なし）"
    ;;

  remove)
    echo -e "${YELLOW}[REMOVE]${NC} SNSキュレーターのcronジョブを削除します..."
    (crontab -l 2>/dev/null | grep -v "$CRON_MARKER" || true) | crontab -
    echo -e "${GREEN}[OK]${NC} cronジョブを削除しました。"
    ;;

  status)
    echo "=== SNSキュレーター cron設定状況 ==="
    CRON_ENTRY=$(crontab -l 2>/dev/null | grep "$CRON_MARKER" || echo "")
    if [ -n "$CRON_ENTRY" ]; then
      echo -e "${GREEN}✅ cronジョブ: 設定済み${NC}"
      echo "  $CRON_ENTRY"
    else
      echo -e "${YELLOW}⚠️  cronジョブ: 未設定${NC}"
      echo "  設定するには: bash $0 install"
    fi
    echo ""
    echo "ログファイル: $LOG_FILE"
    if [ -f "$LOG_FILE" ]; then
      echo "最後の実行:"
      tail -5 "$LOG_FILE" 2>/dev/null || echo "（空）"
    else
      echo "（ログなし）"
    fi
    ;;

  test)
    echo -e "${GREEN}[TEST]${NC} テスト実行（--no-postオプション付き）..."
    bash "$MAIN_SCRIPT" --no-post
    ;;

  *)
    echo "使い方: bash $0 [install|remove|status|test]"
    echo ""
    echo "  install  - cronジョブを追加（毎日 09:00 JST）"
    echo "  remove   - cronジョブを削除"
    echo "  status   - 現在のcron設定を確認"
    echo "  test     - テスト実行（投稿なし）"
    ;;
esac
