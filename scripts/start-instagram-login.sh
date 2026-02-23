#!/bin/bash
# Instagram VNC ログインスクリプト実行ラッパー
# 用途: Xvfb を自動起動して Playwright headful モードでログイン

set -e

log_info() {
    echo "[ℹ️  INFO] $*"
}

log_error() {
    echo "[❌ ERROR] $*" >&2
}

log_success() {
    echo "[✅ SUCCESS] $*"
}

# 1️⃣ xvfb-run で自動的に仮想X環境を起動してスクリプトを実行
log_info "================================================"
log_info "Instagram VNC ログインスクリプト実行"
log_info "================================================"
log_info "Xvfb を自動起動して headful モードでブラウザを開きます..."

# xvfb-run のオプション:
# -a: 最初の利用可能な display を自動選択 (:99 など)
# --server-args="-screen 0 1920x1080x24": 画面設定

if ! command -v xvfb-run &> /dev/null; then
    log_error "xvfb-run がインストールされていません"
    log_info "インストール中..."
    apt-get update -qq > /dev/null 2>&1
    apt-get install -y xvfb > /dev/null 2>&1
    log_success "xvfb をインストールしました"
fi

# xvfb-run でスクリプトを実行
log_info "ブラウザを起動しています（VNC経由でアクセス可能です）"
log_info "VNC接続先: <VPS IP>:99 (パスワード: 設定した値)"
log_info ""

xvfb-run \
    --auto-servernum \
    --server-args="-screen 0 1920x1080x24" \
    node /root/clawd/scripts/instagram-vnc-login.cjs

if [ $? -eq 0 ]; then
    log_success "ログイン完了！Cookies が保存されました"
else
    log_error "ログイン処理中にエラーが発生しました"
    exit 1
fi
