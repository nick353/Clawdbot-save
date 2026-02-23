#!/bin/bash

# =============================================================================
# SNS Browser Login Template
# 汎用テンプレート: VNC自動起動 + Playwright ブラウザ + Cookies 自動保存
# 使用方法: bash sns-browser-login-template.sh <sns-name>
# =============================================================================

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# 1. 引数チェック
# =============================================================================

if [ $# -lt 1 ]; then
    echo -e "${RED}❌ エラー: SNS名を指定してください${NC}"
    echo "使用方法: bash $0 <sns-name> [headless]"
    echo ""
    echo "利用可能なSNS:"
    jq -r 'keys | .[] | "  - \(.)"' /root/clawd/config/sns-login-config.json 2>/dev/null || echo "  - instagram, facebook, tiktok, pinterest, x"
    exit 1
fi

SNS_NAME="$1"
HEADLESS="${2:-false}"

# =============================================================================
# 2. 設定ファイル読み込み
# =============================================================================

CONFIG_FILE="/root/clawd/config/sns-login-config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ 設定ファイルが見つかりません: $CONFIG_FILE${NC}"
    exit 1
fi

# jq で SNS 設定を読み込む
SNS_CONFIG=$(jq -r ".\"$SNS_NAME\"" "$CONFIG_FILE" 2>/dev/null)
if [ "$SNS_CONFIG" = "null" ] || [ -z "$SNS_CONFIG" ]; then
    echo -e "${RED}❌ SNS設定が見つかりません: $SNS_NAME${NC}"
    echo "利用可能なSNS: $(jq -r 'keys | join(", ")' "$CONFIG_FILE")"
    exit 1
fi

# 設定値を変数に抽出
SNS_FULL_NAME=$(echo "$SNS_CONFIG" | jq -r '.name')
LOGIN_URL=$(echo "$SNS_CONFIG" | jq -r '.login_url')
COOKIES_PATH=$(echo "$SNS_CONFIG" | jq -r '.cookies_path')
PROFILE_PATH=$(echo "$SNS_CONFIG" | jq -r '.profile_path')
VNC_PORT=$(echo "$SNS_CONFIG" | jq -r '.vnc_port')

# =============================================================================
# 3. 環境変数設定
# =============================================================================

export SNS_NAME="$SNS_NAME"
export SNS_CONFIG="$SNS_CONFIG"
export HEADLESS="$HEADLESS"

# =============================================================================
# 4. Node.js ログインスクリプトを実行
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGIN_JS="${SCRIPT_DIR}/sns-browser-login-runner.cjs"

if [ ! -f "$LOGIN_JS" ]; then
    echo -e "${RED}❌ ログインスクリプトが見つかりません: $LOGIN_JS${NC}"
    exit 1
fi

echo -e "${BLUE}🔐 $SNS_FULL_NAME ログインセットアップ${NC}"
echo "設定ファイル: $CONFIG_FILE"
echo "SNS: $SNS_NAME"
echo ""

node "$LOGIN_JS"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ $SNS_FULL_NAME ログインセットアップが完了しました！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Cookie保存先: $COOKIES_PATH"
    echo "プロファイル: $PROFILE_PATH"
    echo ""
else
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ ログインセットアップに失敗しました${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
fi

exit $exit_code
