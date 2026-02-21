#!/bin/bash
# YouTube動画分析のラッパースクリプト

set -e

# 仮想環境のパス
VENV_PATH="/root/clawd/venv-trading"
SCRIPT_PATH="/root/clawd/scripts/analyze-youtube-trading.py"

# 引数チェック
if [ $# -eq 0 ]; then
    echo "Usage: $0 <YouTube URL>"
    echo "Example: $0 https://www.youtube.com/watch?v=VIDEO_ID"
    exit 1
fi

YOUTUBE_URL="$1"

# 環境変数チェック
if [ -z "$GEMINI_API_KEY" ]; then
    # ~/.profileから読み込み
    if [ -f ~/.profile ]; then
        source ~/.profile
    fi
    
    if [ -z "$GEMINI_API_KEY" ]; then
        echo "❌ エラー: GEMINI_API_KEY環境変数が設定されていません"
        exit 1
    fi
fi

# 仮想環境存在チェック
if [ ! -d "$VENV_PATH" ]; then
    echo "❌ エラー: 仮想環境が見つかりません: $VENV_PATH"
    echo "セットアップが完了していない可能性があります"
    exit 1
fi

# スクリプト実行
echo "🐥 YouTube動画分析を開始します"
echo "📺 URL: $YOUTUBE_URL"
echo ""

cd /root/clawd
source "$VENV_PATH/bin/activate"
python3 "$SCRIPT_PATH" "$YOUTUBE_URL"

echo ""
echo "✅ 分析完了っぴ！"
