#!/bin/bash
# 各SNSへの初回ログインセットアップスクリプト

SKILL_DIR="/root/clawd/skills/sns-growth-tracker"
VENV_PYTHON="$SKILL_DIR/venv/bin/python3"
GET_ENGAGEMENT_SCRIPT="$SKILL_DIR/scripts/get-engagement.py"

cd "$SKILL_DIR"

echo "🔐 SNSログインセットアップ"
echo "========================================"
echo ""
echo "このスクリプトは、各SNSに手動でログインして"
echo "クッキーを保存します。"
echo ""
echo "ブラウザが開いたら、手動でログインしてください。"
echo "ログイン完了を検出したら自動的に次に進みます。"
echo ""

PLATFORMS=("Instagram" "X" "Threads" "Facebook" "Pinterest")

for platform in "${PLATFORMS[@]}"; do
    echo "----------------------------------------"
    echo "📱 $platform へのログイン"
    echo "----------------------------------------"
    
    read -p "$platform にログインしますか? [Y/n] " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        "$VENV_PYTHON" "$GET_ENGAGEMENT_SCRIPT" "$platform" "" --login-only
        
        if [ $? -eq 0 ]; then
            echo "✅ $platform のクッキーを保存しました"
        else
            echo "❌ $platform のログインに失敗しました"
        fi
        
        echo ""
        sleep 2
    else
        echo "⏭️  $platform をスキップしました"
        echo ""
    fi
done

echo "========================================"
echo "✅ ログインセットアップ完了"
echo ""
echo "クッキーは以下に保存されています:"
echo "$SKILL_DIR/data/cookies/"
echo ""
echo "次のステップ:"
echo "1. 投稿をスケジュールに追加"
echo "   python3 $SKILL_DIR/scripts/schedule-engagement-tracking.py add POST-ID PLATFORM POST-URL"
echo ""
echo "2. スケジュールを確認"
echo "   python3 $SKILL_DIR/scripts/schedule-engagement-tracking.py list"
echo ""
echo "3. 手動でエンゲージメント取得テスト"
echo "   python3 $SKILL_DIR/scripts/get-engagement.py PLATFORM POST-URL --headless"
