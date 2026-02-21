#!/bin/bash
# エンゲージメント自動取得システムのテストスクリプト

SKILL_DIR="/root/clawd/skills/sns-growth-tracker"
VENV_PYTHON="$SKILL_DIR/venv/bin/python3"

echo "🧪 SNS Growth Tracker - エンゲージメント自動取得システム テスト"
echo "========================================================================"
echo ""

# 1. 依存関係チェック
echo "1️⃣ 依存関係チェック..."
echo ""

if [ ! -d "$SKILL_DIR/venv" ]; then
    echo "❌ 仮想環境が見つかりません"
    echo "   実行: python3 -m venv $SKILL_DIR/venv"
    exit 1
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo "❌ Pythonが見つかりません: $VENV_PYTHON"
    exit 1
fi

echo "✅ 仮想環境: OK"

# Playwrightチェック
"$VENV_PYTHON" -c "import playwright" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Playwrightがインストールされていません"
    echo "   実行: source $SKILL_DIR/venv/bin/activate && pip install playwright"
    exit 1
fi

echo "✅ Playwright: OK"

# Chromiumチェック
"$VENV_PYTHON" -c "from playwright.sync_api import sync_playwright; sync_playwright().start().chromium.executable_path" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Chromiumがインストールされていません"
    echo "   実行: source $SKILL_DIR/venv/bin/activate && playwright install chromium"
    exit 1
fi

echo "✅ Chromium: OK"

# Google APIクライアントチェック
"$VENV_PYTHON" -c "import google.auth" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Google API クライアントがインストールされていません"
    echo "   実行: source $SKILL_DIR/venv/bin/activate && pip install google-auth google-api-python-client"
    exit 1
fi

echo "✅ Google API クライアント: OK"
echo ""

# 2. ファイル存在チェック
echo "2️⃣ ファイル存在チェック..."
echo ""

required_files=(
    "scripts/get-engagement.py"
    "scripts/schedule-engagement-tracking.py"
    "scripts/record-to-sheets.py"
    "run-engagement-check.sh"
    "setup-login.sh"
    "README-ENGAGEMENT.md"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$SKILL_DIR/$file" ]; then
        echo "❌ ファイルが見つかりません: $file"
        exit 1
    fi
    echo "✅ $file"
done

echo ""

# 3. ディレクトリ存在チェック
echo "3️⃣ ディレクトリチェック..."
echo ""

required_dirs=(
    "data/cookies"
    "data/logs"
    "venv"
)

for dir in "${required_dirs[@]}"; do
    if [ ! -d "$SKILL_DIR/$dir" ]; then
        echo "❌ ディレクトリが見つかりません: $dir"
        exit 1
    fi
    echo "✅ $dir"
done

echo ""

# 4. スクリプト実行可能チェック
echo "4️⃣ 実行権限チェック..."
echo ""

executable_files=(
    "scripts/get-engagement.py"
    "scripts/schedule-engagement-tracking.py"
    "run-engagement-check.sh"
    "setup-login.sh"
)

for file in "${executable_files[@]}"; do
    if [ ! -x "$SKILL_DIR/$file" ]; then
        echo "⚠️ 実行権限がありません: $file"
        chmod +x "$SKILL_DIR/$file"
        echo "   → 実行権限を付与しました"
    else
        echo "✅ $file"
    fi
done

echo ""

# 5. スケジューラーテスト
echo "5️⃣ スケジューラーテスト..."
echo ""

echo "スケジュール一覧を表示:"
"$VENV_PYTHON" "$SKILL_DIR/scripts/schedule-engagement-tracking.py" list

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ スケジューラー: OK"
else
    echo "❌ スケジューラーエラー"
    exit 1
fi

echo ""

# 6. HEARTBEAT設定チェック
echo "6️⃣ HEARTBEAT設定チェック..."
echo ""

if grep -q "run-engagement-check.sh" /root/clawd/HEARTBEAT.md; then
    echo "✅ HEARTBEATに設定済み"
else
    echo "⚠️ HEARTBEATに設定されていません"
    echo "   /root/clawd/HEARTBEAT.md を確認してください"
fi

echo ""

# 7. テスト完了
echo "========================================================================"
echo "✅ 全てのテストに合格しました！"
echo ""
echo "📝 次のステップ:"
echo ""
echo "1. 初回ログイン（各SNSのクッキーを保存）:"
echo "   bash $SKILL_DIR/setup-login.sh"
echo ""
echo "2. テスト投稿のスケジュール追加:"
echo "   cd $SKILL_DIR"
echo "   source venv/bin/activate"
echo "   python3 scripts/schedule-engagement-tracking.py add POST-ID PLATFORM POST-URL"
echo ""
echo "3. スケジュール確認:"
echo "   python3 scripts/schedule-engagement-tracking.py list"
echo ""
echo "4. 手動でエンゲージメント取得テスト:"
echo "   python3 scripts/get-engagement.py PLATFORM POST-URL --headless"
echo ""
echo "5. 自動実行確認（ハートビートで実行されます）:"
echo "   bash $SKILL_DIR/run-engagement-check.sh"
echo ""
echo "========================================================================"
