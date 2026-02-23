#!/bin/bash

###############################################################################
# VNC + Xvfb セットアップスクリプト for Instagram ブラウザログイン
# 用途: VPS上でVNC経由でInstagramへのブラウザログインをリモート操作
# 使い方: bash setup-vnc-instagram-login.sh [start|stop|status|restart]
###############################################################################

set -e

# 設定
DISPLAY_NUMBER=99
DISPLAY=":${DISPLAY_NUMBER}"
GEOMETRY="1920x1080"
DEPTH="24"
VNC_PORT="5999"
VNC_DISPLAY_PORT=$((5900 + DISPLAY_NUMBER))
LOG_DIR="/root/clawd/logs/vnc"
PID_DIR="/var/run/vnc-instagram"
XVFB_PID_FILE="${PID_DIR}/xvfb.pid"
VNC_PID_FILE="${PID_DIR}/vncserver.pid"

# ログディレクトリ作成
mkdir -p "$LOG_DIR" "$PID_DIR"

# 色付きログ関数
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  $*" | tee -a "${LOG_DIR}/setup.log"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $*" | tee -a "${LOG_DIR}/setup.log"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $*" | tee -a "${LOG_DIR}/setup.log" >&2
}

log_warn() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $*" | tee -a "${LOG_DIR}/setup.log"
}

###############################################################################
# 1. Xvfb 仮想ディスプレイ起動
###############################################################################
start_xvfb() {
    log_info "Xvfb 仮想ディスプレイを起動中..."

    if pgrep -f "Xvfb ${DISPLAY}" > /dev/null; then
        log_warn "Xvfb ${DISPLAY} は既に実行中です"
        return 0
    fi

    # Xvfb を起動（バックグラウンド）
    Xvfb "${DISPLAY}" -screen 0 "${GEOMETRY}x${DEPTH}" \
        -nolisten tcp -ac \
        >> "${LOG_DIR}/xvfb.log" 2>&1 &
    
    XVFB_PID=$!
    echo "$XVFB_PID" > "$XVFB_PID_FILE"
    
    # Xvfb が完全に起動するまで待機
    sleep 2
    
    if ps -p "$XVFB_PID" > /dev/null; then
        log_success "Xvfb (PID: $XVFB_PID) が起動しました"
        log_info "DISPLAY=${DISPLAY}"
        return 0
    else
        log_error "Xvfb の起動に失敗しました"
        return 1
    fi
}

###############################################################################
# 2. VNC サーバー起動
###############################################################################
start_vncserver() {
    log_info "VNC サーバーを起動中..."

    if pgrep -f "vncserver.*${DISPLAY}" > /dev/null; then
        log_warn "VNC サーバーは既に実行中です (ポート: ${VNC_PORT})"
        return 0
    fi

    # VNC パスワード設定（初回のみ）
    setup_vnc_password

    # VNC サーバー起動
    DISPLAY="${DISPLAY}" vncserver "${DISPLAY}" \
        -geometry "${GEOMETRY}" \
        -depth "${DEPTH}" \
        -SecurityTypes None \
        >> "${LOG_DIR}/vncserver.log" 2>&1 &
    
    VNC_PID=$!
    echo "$VNC_PID" > "$VNC_PID_FILE"
    
    # VNC が完全に起動するまで待機
    sleep 2
    
    if pgrep -f "vncserver.*${DISPLAY}" > /dev/null; then
        log_success "VNC サーバーが起動しました"
        log_info "接続先: <VPS_IP>:${VNC_PORT}"
        log_info "DISPLAY: ${DISPLAY}"
        return 0
    else
        log_error "VNC サーバーの起動に失敗しました"
        return 1
    fi
}

###############################################################################
# 3. VNC パスワード設定
###############################################################################
setup_vnc_password() {
    local vnc_config_dir="$HOME/.vnc"
    local passwd_file="${vnc_config_dir}/passwd"
    
    # .vnc ディレクトリが存在しなければ作成
    if [ ! -d "$vnc_config_dir" ]; then
        mkdir -p "$vnc_config_dir"
        chmod 700 "$vnc_config_dir"
    fi
    
    # パスワードファイルが既に存在すれば、何もしない
    if [ -f "$passwd_file" ]; then
        log_info "VNC パスワードは既に設定されています"
        return 0
    fi
    
    # vncpasswd でパスワード設定（対話的）
    log_info "VNC パスワードを設定してください（vncpasswd）"
    vncpasswd "$passwd_file" || {
        log_warn "VNC パスワード設定をスキップしました"
    }
}

###############################################################################
# 4. Playwright headful スクリプト起動
###############################################################################
start_playwright_script() {
    log_info "Playwright Instagram ログインスクリプトを起動中..."

    local script_path="/root/clawd/scripts/instagram-vnc-login.cjs"

    if [ ! -f "$script_path" ]; then
        log_error "スクリプトが見つかりません: $script_path"
        return 1
    fi

    # Playwright スクリプトを起動（バックグラウンド）
    DISPLAY="${DISPLAY}" node "$script_path" \
        >> "${LOG_DIR}/playwright.log" 2>&1 &
    
    PLAYWRIGHT_PID=$!
    echo "$PLAYWRIGHT_PID" > "${PID_DIR}/playwright.pid"
    
    sleep 2
    
    if ps -p "$PLAYWRIGHT_PID" > /dev/null; then
        log_success "Playwright スクリプトが起動しました (PID: $PLAYWRIGHT_PID)"
        return 0
    else
        log_warn "Playwright スクリプトの起動に失敗しました"
        log_info "ログを確認: ${LOG_DIR}/playwright.log"
        return 1
    fi
}

###############################################################################
# 5. 全プロセス停止
###############################################################################
stop_all() {
    log_info "VNC関連プロセスを停止中..."

    # Playwright スクリプト停止
    if [ -f "${PID_DIR}/playwright.pid" ]; then
        PLAYWRIGHT_PID=$(cat "${PID_DIR}/playwright.pid" 2>/dev/null)
        if [ -n "$PLAYWRIGHT_PID" ] && ps -p "$PLAYWRIGHT_PID" > /dev/null 2>&1; then
            kill "$PLAYWRIGHT_PID" 2>/dev/null || true
            log_info "Playwright スクリプトを停止しました"
        fi
        rm -f "${PID_DIR}/playwright.pid"
    fi

    # VNC サーバー停止
    if [ -f "$VNC_PID_FILE" ]; then
        VNC_PID=$(cat "$VNC_PID_FILE" 2>/dev/null)
        if [ -n "$VNC_PID" ] && ps -p "$VNC_PID" > /dev/null 2>&1; then
            vncserver -kill "${DISPLAY}" 2>/dev/null || kill "$VNC_PID" 2>/dev/null || true
            log_info "VNC サーバーを停止しました"
        fi
        rm -f "$VNC_PID_FILE"
    fi

    # Xvfb 停止
    if [ -f "$XVFB_PID_FILE" ]; then
        XVFB_PID=$(cat "$XVFB_PID_FILE" 2>/dev/null)
        if [ -n "$XVFB_PID" ] && ps -p "$XVFB_PID" > /dev/null 2>&1; then
            kill "$XVFB_PID" 2>/dev/null || true
            log_info "Xvfb を停止しました"
        fi
        rm -f "$XVFB_PID_FILE"
    fi

    log_success "全プロセスを停止しました"
}

###############################################################################
# 6. ステータス確認
###############################################################################
status() {
    log_info "ステータス確認中..."
    echo ""
    
    # Xvfb
    if pgrep -f "Xvfb ${DISPLAY}" > /dev/null; then
        echo "✅ Xvfb (DISPLAY=${DISPLAY}): 実行中"
    else
        echo "❌ Xvfb (DISPLAY=${DISPLAY}): 停止"
    fi
    
    # VNC サーバー
    if pgrep -f "vncserver.*${DISPLAY}" > /dev/null; then
        echo "✅ VNC サーバー (ポート ${VNC_PORT}): 実行中"
        echo "   接続先: <VPS_IP>:${VNC_PORT}"
    else
        echo "❌ VNC サーバー: 停止"
    fi
    
    # Playwright
    if [ -f "${PID_DIR}/playwright.pid" ]; then
        PLAYWRIGHT_PID=$(cat "${PID_DIR}/playwright.pid" 2>/dev/null)
        if [ -n "$PLAYWRIGHT_PID" ] && ps -p "$PLAYWRIGHT_PID" > /dev/null 2>&1; then
            echo "✅ Playwright スクリプト (PID: $PLAYWRIGHT_PID): 実行中"
        else
            echo "❌ Playwright スクリプト: 停止"
        fi
    else
        echo "❌ Playwright スクリプト: 起動未試行"
    fi
    
    echo ""
    echo "📋 ログ: ${LOG_DIR}/"
}

###############################################################################
# 7. メイン処理
###############################################################################
main() {
    local command="${1:-start}"

    case "$command" in
        start)
            log_info "VNC Instagram ログインセットアップを開始します"
            start_xvfb || exit 1
            start_vncserver || exit 1
            # Playwright スクリプトは手動で起動した方が良いため、コメントアウト
            # start_playwright_script || true
            status
            log_success "セットアップが完了しました"
            ;;
        stop)
            stop_all
            ;;
        status)
            status
            ;;
        restart)
            stop_all
            sleep 2
            main start
            ;;
        *)
            echo "使い方: $0 [start|stop|status|restart]"
            echo "  start   - Xvfb, VNC サーバーを起動"
            echo "  stop    - 全プロセスを停止"
            echo "  status  - ステータスを表示"
            echo "  restart - 再起動"
            exit 1
            ;;
    esac
}

main "$@"
