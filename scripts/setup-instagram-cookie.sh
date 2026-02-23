#!/bin/bash

set -e

echo "🔧 Instagram Cookie 取得セットアップ開始..."

# Xvfb が起動してなければ起動
if ! pgrep -x "Xvfb" > /dev/null; then
    echo "📺 Xvfb を起動中..."
    Xvfb :99 -screen 0 1280x1024x24 > /dev/null 2>&1 &
    sleep 2
fi

# VNC サーバーを起動
if ! pgrep -x "vncserver" > /dev/null; then
    echo "🖥️ VNC サーバーを起動中..."
    vncserver :1 -geometry 1280x1024 -depth 24 > /dev/null 2>&1 &
    sleep 2
fi

# ウィンドウマネージャーを起動
DISPLAY=:99 fluxbox > /dev/null 2>&1 &
sleep 1

echo "✅ セットアップ完了"
echo ""
echo "📍 VNC で接続してください:"
echo "   URL: http://<VPS IP>:6080"
echo "   またはポート転送: ssh -L 6080:localhost:6080 root@<VPS>"
echo ""
echo "🔑 Cookie 取得スクリプト実行:"
echo "   cd /root/clawd/auth"
echo "   DISPLAY=:99 node instagram-cookie-extractor.cjs"
