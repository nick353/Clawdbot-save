#!/bin/bash
# SNS Multi-Poster - ブラウザプロファイル版
# 永続的なブラウザプロファイルを使用（一度ログインすればOK）

set -e

IMAGE_PATH="$1"
CAPTION="$2"
PINTEREST_BOARD="${3:-Animal}"  # デフォルト: Animal

if [ -z "$IMAGE_PATH" ] || [ -z "$CAPTION" ]; then
    echo "使い方: $0 <image_path> <caption> [pinterest_board]"
    exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo "❌ 画像が見つかりません: $IMAGE_PATH"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 SNS Multi-Poster（ブラウザプロファイル版）開始"
echo "📷 画像: $IMAGE_PATH"
echo "📝 キャプション: ${CAPTION:0:100}..."
echo "📌 Pinterestボード: $PINTEREST_BOARD"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
RESULTS=""

# ログディレクトリ
LOG_DIR="/tmp/sns-multi-poster-logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 1. Instagram（プロファイル版）
echo "📸 [1/5] Instagram に投稿中..."
if node post-to-instagram-v5.cjs "$IMAGE_PATH" "$CAPTION" > "$LOG_DIR/instagram_${TIMESTAMP}.log" 2>&1; then
    echo "✅ Instagram: 成功"
    RESULTS="${RESULTS}✅ Instagram\n"
    ((SUCCESS_COUNT++))
else
    echo "❌ Instagram: 失敗"
    RESULTS="${RESULTS}❌ Instagram\n"
    ((FAIL_COUNT++))
    echo "  ログ: $LOG_DIR/instagram_${TIMESTAMP}.log"
fi
echo ""

# 2. Threads（プロファイル版 - 今後作成）
echo "🧵 [2/5] Threads に投稿中..."
if [ -f "post-to-threads-profile.cjs" ]; then
    if node post-to-threads-profile.cjs "$IMAGE_PATH" "$CAPTION" > "$LOG_DIR/threads_${TIMESTAMP}.log" 2>&1; then
        echo "✅ Threads: 成功"
        RESULTS="${RESULTS}✅ Threads\n"
        ((SUCCESS_COUNT++))
    else
        echo "❌ Threads: 失敗"
        RESULTS="${RESULTS}❌ Threads\n"
        ((FAIL_COUNT++))
        echo "  ログ: $LOG_DIR/threads_${TIMESTAMP}.log"
    fi
else
    echo "⏭️  Threads: プロファイル版未作成（スキップ）"
    RESULTS="${RESULTS}⏭️  Threads (未実装)\n"
fi
echo ""

# 3. Facebook（プロファイル版 - 今後作成）
echo "📘 [3/5] Facebook に投稿中..."
if [ -f "post-to-facebook-profile.cjs" ]; then
    if node post-to-facebook-profile.cjs "$IMAGE_PATH" "$CAPTION" > "$LOG_DIR/facebook_${TIMESTAMP}.log" 2>&1; then
        echo "✅ Facebook: 成功"
        RESULTS="${RESULTS}✅ Facebook\n"
        ((SUCCESS_COUNT++))
    else
        echo "❌ Facebook: 失敗"
        RESULTS="${RESULTS}❌ Facebook\n"
        ((FAIL_COUNT++))
        echo "  ログ: $LOG_DIR/facebook_${TIMESTAMP}.log"
    fi
else
    echo "⏭️  Facebook: プロファイル版未作成（スキップ）"
    RESULTS="${RESULTS}⏭️  Facebook (未実装)\n"
fi
echo ""

# 4. Pinterest（プロファイル版 - 今後作成）
echo "📌 [4/5] Pinterest に投稿中..."
if [ -f "post-to-pinterest-profile.cjs" ]; then
    if node post-to-pinterest-profile.cjs "$IMAGE_PATH" "$CAPTION" "$PINTEREST_BOARD" > "$LOG_DIR/pinterest_${TIMESTAMP}.log" 2>&1; then
        echo "✅ Pinterest: 成功"
        RESULTS="${RESULTS}✅ Pinterest\n"
        ((SUCCESS_COUNT++))
    else
        echo "❌ Pinterest: 失敗"
        RESULTS="${RESULTS}❌ Pinterest\n"
        ((FAIL_COUNT++))
        echo "  ログ: $LOG_DIR/pinterest_${TIMESTAMP}.log"
    fi
else
    echo "⏭️  Pinterest: プロファイル版未作成（スキップ）"
    RESULTS="${RESULTS}⏭️  Pinterest (未実装)\n"
fi
echo ""

# 5. X (Twitter)（プロファイル版 - 今後作成）
echo "🐦 [5/5] X (Twitter) に投稿中..."
if [ -f "post-to-x-profile.cjs" ]; then
    if node post-to-x-profile.cjs "$IMAGE_PATH" "$CAPTION" > "$LOG_DIR/x_${TIMESTAMP}.log" 2>&1; then
        echo "✅ X: 成功"
        RESULTS="${RESULTS}✅ X\n"
        ((SUCCESS_COUNT++))
    else
        echo "❌ X: 失敗"
        RESULTS="${RESULTS}❌ X\n"
        ((FAIL_COUNT++))
        echo "  ログ: $LOG_DIR/x_${TIMESTAMP}.log"
    fi
else
    echo "⏭️  X: プロファイル版未作成（スキップ）"
    RESULTS="${RESULTS}⏭️  X (未実装)\n"
fi
echo ""

# 結果サマリー
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 投稿結果サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "$RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 成功: $SUCCESS_COUNT / ❌ 失敗: $FAIL_COUNT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "🎉 完了！"
    exit 0
else
    echo "❌ 全て失敗しました"
    exit 1
fi
