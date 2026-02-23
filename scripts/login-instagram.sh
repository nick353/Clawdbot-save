#!/bin/bash

# =============================================================================
# Instagram ログインスクリプト
# =============================================================================

set -euo pipefail

# スクリプトディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# テンプレートを実行
bash "$SCRIPT_DIR/sns-browser-login-template.sh" "instagram" "$@"
