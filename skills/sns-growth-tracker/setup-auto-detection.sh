#!/bin/bash
# SNS Growth Tracker 自動検知セットアップスクリプト

set -e

SKILL_DIR="/root/clawd/skills/sns-growth-tracker"

echo "🔧 SNS Growth Tracker 自動検知システムをセットアップ中..."

# 必要なディレクトリを作成
echo "📁 ディレクトリを作成中..."
mkdir -p "$SKILL_DIR/data/downloads"
mkdir -p "$SKILL_DIR/data/media"
mkdir -p "$SKILL_DIR/data/logs"
mkdir -p "$SKILL_DIR/data/trends"
mkdir -p "$SKILL_DIR/data/experiments"
mkdir -p "$SKILL_DIR/data/reports"

# 処理済みメッセージファイルを作成
if [ ! -f "$SKILL_DIR/data/processed_messages.json" ]; then
    echo "[]" > "$SKILL_DIR/data/processed_messages.json"
    echo "✅ processed_messages.json を作成しました"
fi

# 実行権限を確認
chmod +x "$SKILL_DIR/scripts/watch-discord-posts.py" 2>/dev/null || true
chmod +x "$SKILL_DIR/scripts/main-workflow.py" 2>/dev/null || true
chmod +x "$SKILL_DIR/run-trend-monitor.sh" 2>/dev/null || true
chmod +x "$SKILL_DIR/run-weekly-analysis.sh" 2>/dev/null || true

echo "✅ 実行権限を設定しました"

# 環境変数チェック
echo ""
echo "🔍 環境変数チェック:"

if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  GEMINI_API_KEY が設定されていません"
    echo "   ~/.profile に追加してください"
else
    echo "✅ GEMINI_API_KEY 設定済み"
fi

if [ -z "$SNS_SHEETS_ID" ]; then
    echo "⚠️  SNS_SHEETS_ID が設定されていません"
    echo "   Google SheetsのIDを ~/.profile に追加してください"
else
    echo "✅ SNS_SHEETS_ID 設定済み"
fi

# Google認証情報チェック
if [ -f "$SKILL_DIR/google-credentials.json" ]; then
    echo "✅ Google認証情報ファイルが存在します"
else
    echo "⚠️  google-credentials.json が見つかりません"
    echo "   サービスアカウントキーを配置してください:"
    echo "   cp /path/to/service-account.json $SKILL_DIR/google-credentials.json"
fi

echo ""
echo "📋 セットアップ完了！"
echo ""
echo "次のステップ:"
echo "1. 環境変数を設定（必要な場合）"
echo "2. Google認証情報を配置（必要な場合）"
echo "3. テスト実行:"
echo "   python3 $SKILL_DIR/scripts/watch-discord-posts.py"
echo ""
echo "自動実行はHEARTBEAT.mdに追加済みです 🎉"
