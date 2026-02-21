#!/bin/bash
# 依存パッケージインストールスクリプト

echo "📦 SNS Growth Tracker - 依存パッケージインストール"
echo "=" | tee -a "$LOG_FILE"

# pip確認
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3が見つかりません"
    exit 1
fi

# 必須パッケージ
PACKAGES=(
    "google-auth"
    "google-auth-oauthlib"
    "google-auth-httplib2"
    "google-api-python-client"
    "google-generativeai"
)

echo "インストールするパッケージ:"
for pkg in "${PACKAGES[@]}"; do
    echo "  - $pkg"
done
echo ""

# インストール実行
for pkg in "${PACKAGES[@]}"; do
    echo "📦 インストール中: $pkg"
    pip3 install "$pkg" --quiet
    
    if [ $? -eq 0 ]; then
        echo "✅ $pkg"
    else
        echo "❌ $pkg インストール失敗"
        exit 1
    fi
done

echo ""
echo "=" 
echo "✅ すべての依存パッケージをインストールしました"
echo ""
echo "次のステップ:"
echo "1. Google Cloud Consoleでサービスアカウント作成"
echo "2. JSONキーをダウンロード"
echo "3. 配置: /root/clawd/skills/sns-growth-tracker/google-credentials.json"
echo "4. セットアップ実行: ./scripts/setup-sheets.py"
