#!/bin/bash

################################################################################
# SNS API 認可トークン管理スクリプト
# 
# 機能:
#   - env.vars への認可トークン登録
#   - ~/.profile への環境変数設定
#   - トークン有効性検証
#   - トークン情報表示
#
# 使用方法:
#   bash setup-sns-api-credentials.sh [オプション]
#
# オプション:
#   register-meta     Meta API トークン登録
#   register-x        X API トークン登録
#   register-pinterest Pinterest API トークン登録
#   validate          全トークン検証
#   show              登録済みトークン表示
#   help              ヘルプ表示
################################################################################

set -e

# ============ 定数定義 ============

CLAWDBOT_CONFIG="$HOME/.clawdbot/clawdbot.json"
PROFILE_FILE="$HOME/.profile"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/root/clawd/logs/sns-api-setup.log"

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============ ログ関数 ============

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1" | tee -a "$LOG_FILE"
}

# ============ ディレクトリ作成 ============

mkdir -p "$(dirname "$LOG_FILE")"

# ============ Clawdbot 設定更新関数 ============

update_clawdbot_config() {
    local key="$1"
    local value="$2"
    
    if [ ! -f "$CLAWDBOT_CONFIG" ]; then
        log_error "Clawdbot 設定ファイルが見つかりません: $CLAWDBOT_CONFIG"
        log_info "まず clawdbot gateway start で Gateway を起動してください"
        return 1
    fi
    
    log_info "Clawdbot 設定更新: $key=$value"
    
    # Node.js でJSON更新（jq は常に利用可能とは限らないため）
    node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CLAWDBOT_CONFIG', 'utf8'));
    if (!config.env) config.env = {};
    if (!config.env.vars) config.env.vars = {};
    config.env.vars['$key'] = '$value';
    fs.writeFileSync('$CLAWDBOT_CONFIG', JSON.stringify(config, null, 2));
    console.log('Updated: $key');
    " 2>/dev/null || {
        log_error "JSON 更新に失敗しました"
        return 1
    }
    
    return 0
}

# ============ 環境変数設定関数 ============

add_to_profile() {
    local export_cmd="$1"
    
    # ~/.profile に既に存在するか確認
    if grep -q "^$export_cmd" "$PROFILE_FILE" 2>/dev/null; then
        log_warning "既に登録済み: $export_cmd"
        return 0
    fi
    
    echo "" >> "$PROFILE_FILE"
    echo "# SNS API Credentials (registered: $(date))" >> "$PROFILE_FILE"
    echo "$export_cmd" >> "$PROFILE_FILE"
    log_info "環境変数追加: $PROFILE_FILE"
    
    return 0
}

# ============ Meta API トークン登録 ============

register_meta_credentials() {
    log_info "=== Meta API トークン登録 ==="
    
    echo ""
    echo "Meta Developers でアプリを作成したら、以下の情報を入力してください:"
    echo "参考: /root/clawd/docs/sns-api-setup/meta-setup.md"
    echo ""
    
    read -p "App ID: " META_APP_ID
    read -p "App Secret: " META_APP_SECRET
    read -p "Access Token (長期トークン): " META_ACCESS_TOKEN
    read -p "Instagram User ID: " IG_USER_ID
    read -p "Facebook Page ID: " FB_PAGE_ID
    
    # 入力値の検証
    if [ -z "$META_APP_ID" ] || [ -z "$META_ACCESS_TOKEN" ]; then
        log_error "必須項目が入力されていません"
        return 1
    fi
    
    # Clawdbot 設定に登録
    update_clawdbot_config "META_APP_ID" "$META_APP_ID" || return 1
    update_clawdbot_config "META_APP_SECRET" "$META_APP_SECRET" || return 1
    update_clawdbot_config "META_ACCESS_TOKEN" "$META_ACCESS_TOKEN" || return 1
    [ -n "$IG_USER_ID" ] && update_clawdbot_config "IG_USER_ID" "$IG_USER_ID"
    [ -n "$FB_PAGE_ID" ] && update_clawdbot_config "FB_PAGE_ID" "$FB_PAGE_ID"
    
    # ~/.profile に追加
    add_to_profile "export META_APP_ID=\"$META_APP_ID\""
    add_to_profile "export META_APP_SECRET=\"$META_APP_SECRET\""
    add_to_profile "export META_ACCESS_TOKEN=\"$META_ACCESS_TOKEN\""
    [ -n "$IG_USER_ID" ] && add_to_profile "export IG_USER_ID=\"$IG_USER_ID\""
    [ -n "$FB_PAGE_ID" ] && add_to_profile "export FB_PAGE_ID=\"$FB_PAGE_ID\""
    
    log_info "✓ Meta API トークン登録完了"
    return 0
}

# ============ X API トークン登録 ============

register_x_credentials() {
    log_info "=== X API トークン登録 ==="
    
    echo ""
    echo "X Developer Portal でアプリを作成したら、以下の情報を入力してください:"
    echo "参考: /root/clawd/docs/sns-api-setup/x-setup.md"
    echo ""
    
    read -p "Bearer Token: " X_BEARER_TOKEN
    read -p "API Key (Consumer Key): " X_API_KEY
    read -p "API Secret (Consumer Secret): " X_API_SECRET
    read -p "User ID: " X_USER_ID
    read -p "Refresh Token (オプション): " X_REFRESH_TOKEN
    
    # 入力値の検証
    if [ -z "$X_BEARER_TOKEN" ]; then
        log_error "Bearer Token は必須です"
        return 1
    fi
    
    # Clawdbot 設定に登録
    update_clawdbot_config "X_BEARER_TOKEN" "$X_BEARER_TOKEN" || return 1
    [ -n "$X_API_KEY" ] && update_clawdbot_config "X_API_KEY" "$X_API_KEY"
    [ -n "$X_API_SECRET" ] && update_clawdbot_config "X_API_SECRET" "$X_API_SECRET"
    [ -n "$X_USER_ID" ] && update_clawdbot_config "X_USER_ID" "$X_USER_ID"
    [ -n "$X_REFRESH_TOKEN" ] && update_clawdbot_config "X_REFRESH_TOKEN" "$X_REFRESH_TOKEN"
    
    # ~/.profile に追加
    add_to_profile "export X_BEARER_TOKEN=\"$X_BEARER_TOKEN\""
    [ -n "$X_API_KEY" ] && add_to_profile "export X_API_KEY=\"$X_API_KEY\""
    [ -n "$X_API_SECRET" ] && add_to_profile "export X_API_SECRET=\"$X_API_SECRET\""
    [ -n "$X_USER_ID" ] && add_to_profile "export X_USER_ID=\"$X_USER_ID\""
    [ -n "$X_REFRESH_TOKEN" ] && add_to_profile "export X_REFRESH_TOKEN=\"$X_REFRESH_TOKEN\""
    
    log_info "✓ X API トークン登録完了"
    return 0
}

# ============ Pinterest API トークン登録 ============

register_pinterest_credentials() {
    log_info "=== Pinterest API トークン登録 ==="
    
    echo ""
    echo "Pinterest Developers でアプリを作成したら、以下の情報を入力してください:"
    echo "参考: /root/clawd/docs/sns-api-setup/pinterest-setup.md"
    echo ""
    
    read -p "App ID: " PINTEREST_APP_ID
    read -p "App Secret: " PINTEREST_APP_SECRET
    read -p "Access Token: " PINTEREST_ACCESS_TOKEN
    read -p "Refresh Token: " PINTEREST_REFRESH_TOKEN
    read -p "User ID: " PINTEREST_USER_ID
    
    # 入力値の検証
    if [ -z "$PINTEREST_ACCESS_TOKEN" ]; then
        log_error "Access Token は必須です"
        return 1
    fi
    
    # Clawdbot 設定に登録
    update_clawdbot_config "PINTEREST_APP_ID" "$PINTEREST_APP_ID" || return 1
    update_clawdbot_config "PINTEREST_APP_SECRET" "$PINTEREST_APP_SECRET" || return 1
    update_clawdbot_config "PINTEREST_ACCESS_TOKEN" "$PINTEREST_ACCESS_TOKEN" || return 1
    [ -n "$PINTEREST_REFRESH_TOKEN" ] && update_clawdbot_config "PINTEREST_REFRESH_TOKEN" "$PINTEREST_REFRESH_TOKEN"
    [ -n "$PINTEREST_USER_ID" ] && update_clawdbot_config "PINTEREST_USER_ID" "$PINTEREST_USER_ID"
    
    # ~/.profile に追加
    add_to_profile "export PINTEREST_APP_ID=\"$PINTEREST_APP_ID\""
    add_to_profile "export PINTEREST_APP_SECRET=\"$PINTEREST_APP_SECRET\""
    add_to_profile "export PINTEREST_ACCESS_TOKEN=\"$PINTEREST_ACCESS_TOKEN\""
    [ -n "$PINTEREST_REFRESH_TOKEN" ] && add_to_profile "export PINTEREST_REFRESH_TOKEN=\"$PINTEREST_REFRESH_TOKEN\""
    [ -n "$PINTEREST_USER_ID" ] && add_to_profile "export PINTEREST_USER_ID=\"$PINTEREST_USER_ID\""
    
    log_info "✓ Pinterest API トークン登録完了"
    return 0
}

# ============ トークン検証関数 ============

validate_tokens() {
    log_info "=== トークン検証 ==="
    
    # 環境変数をロード
    source "$HOME/.profile" 2>/dev/null || true
    
    echo ""
    
    # Meta API 検証
    if [ -n "$META_ACCESS_TOKEN" ]; then
        log_info "Meta API トークン検証中..."
        python3 -c "
from sys import path
path.insert(0, '/root/clawd/skills/sns-api-automation')
try:
    from meta_graph_api import load_config_from_env
    api = load_config_from_env()
    valid, msg = api.validate_token()
    if valid:
        print('✓ Meta API: ' + msg)
    else:
        print('✗ Meta API: ' + msg)
except Exception as e:
    print(f'✗ Meta API: {e}')
" 2>/dev/null || log_warning "Meta API 検証スキップ"
    else
        log_warning "Meta API トークン未登録"
    fi
    
    echo ""
    
    # X API 検証
    if [ -n "$X_BEARER_TOKEN" ]; then
        log_info "X API トークン検証中..."
        python3 -c "
from sys import path
path.insert(0, '/root/clawd/skills/sns-api-automation')
try:
    from x_api import load_config_from_env
    api = load_config_from_env()
    valid, msg = api.validate_token()
    if valid:
        print('✓ X API: ' + msg)
    else:
        print('✗ X API: ' + msg)
except Exception as e:
    print(f'✗ X API: {e}')
" 2>/dev/null || log_warning "X API 検証スキップ"
    else
        log_warning "X API トークン未登録"
    fi
    
    echo ""
    
    # Pinterest API 検証
    if [ -n "$PINTEREST_ACCESS_TOKEN" ]; then
        log_info "Pinterest API トークン検証中..."
        python3 -c "
from sys import path
path.insert(0, '/root/clawd/skills/sns-api-automation')
try:
    from pinterest_api import load_config_from_env
    api = load_config_from_env()
    valid, msg = api.validate_token()
    if valid:
        print('✓ Pinterest API: ' + msg)
    else:
        print('✗ Pinterest API: ' + msg)
except Exception as e:
    print(f'✗ Pinterest API: {e}')
" 2>/dev/null || log_warning "Pinterest API 検証スキップ"
    else
        log_warning "Pinterest API トークン未登録"
    fi
    
    echo ""
}

# ============ トークン表示関数 ============

show_credentials() {
    log_info "=== 登録済みトークン情報 ==="
    
    source "$HOME/.profile" 2>/dev/null || true
    
    echo ""
    
    # Meta API
    if [ -n "$META_APP_ID" ]; then
        echo "Meta API:"
        echo "  APP ID: ${META_APP_ID:0:20}..."
        echo "  Access Token: ${META_ACCESS_TOKEN:0:20}..."
        echo "  Instagram User ID: ${IG_USER_ID:-未設定}"
        echo "  Facebook Page ID: ${FB_PAGE_ID:-未設定}"
    else
        echo "Meta API: 未登録"
    fi
    
    echo ""
    
    # X API
    if [ -n "$X_BEARER_TOKEN" ]; then
        echo "X API:"
        echo "  Bearer Token: ${X_BEARER_TOKEN:0:20}..."
        echo "  API Key: ${X_API_KEY:0:20}...${X_API_KEY:+（登録済み）}"
        echo "  User ID: ${X_USER_ID:-未設定}"
    else
        echo "X API: 未登録"
    fi
    
    echo ""
    
    # Pinterest API
    if [ -n "$PINTEREST_APP_ID" ]; then
        echo "Pinterest API:"
        echo "  APP ID: ${PINTEREST_APP_ID:0:20}..."
        echo "  Access Token: ${PINTEREST_ACCESS_TOKEN:0:20}..."
        echo "  User ID: ${PINTEREST_USER_ID:-未設定}"
    else
        echo "Pinterest API: 未登録"
    fi
    
    echo ""
}

# ============ ヘルプ表示 ============

show_help() {
    cat << 'EOF'
SNS API トークン管理スクリプト

使用方法:
    bash setup-sns-api-credentials.sh [コマンド]

コマンド:
    register-meta       Meta API トークンを対話的に登録
    register-x          X API トークンを対話的に登録
    register-pinterest  Pinterest API トークンを対話的に登録
    validate            登録済みトークンの有効性を検証
    show                登録済みトークン情報を表示
    help                このヘルプを表示

例:
    # Meta API トークンを登録
    bash setup-sns-api-credentials.sh register-meta
    
    # X API トークンを登録
    bash setup-sns-api-credentials.sh register-x
    
    # Pinterest API トークンを登録
    bash setup-sns-api-credentials.sh register-pinterest
    
    # 全トークンを検証
    bash setup-sns-api-credentials.sh validate
    
    # 登録済み情報を表示
    bash setup-sns-api-credentials.sh show

トークン取得方法:
    - Meta API: /root/clawd/docs/sns-api-setup/meta-setup.md
    - X API: /root/clawd/docs/sns-api-setup/x-setup.md
    - Pinterest API: /root/clawd/docs/sns-api-setup/pinterest-setup.md

EOF
}

# ============ メイン処理 ============

main() {
    local command="${1:-help}"
    
    case "$command" in
        register-meta)
            register_meta_credentials
            ;;
        register-x)
            register_x_credentials
            ;;
        register-pinterest)
            register_pinterest_credentials
            ;;
        validate)
            validate_tokens
            ;;
        show)
            show_credentials
            ;;
        help)
            show_help
            ;;
        *)
            log_error "不明なコマンド: $command"
            show_help
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"
