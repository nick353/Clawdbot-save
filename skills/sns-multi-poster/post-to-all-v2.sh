#!/bin/bash
# post-to-all-v2.sh - 全SNSに画像投稿するスクリプト（camoufox版）
# 使い方: bash post-to-all-v2.sh <画像パス> "キャプション"

IMAGE_PATH="$1"
CAPTION="$2"

if [ -z "$IMAGE_PATH" ] || [ -z "$CAPTION" ]; then
    echo "使い方: $0 <画像パス> 'キャプション'"
    echo "例: $0 /tmp/image.jpg 'テスト投稿 #ukiyoe'"
    exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo "❌ 画像ファイルが見つかりません: $IMAGE_PATH"
    exit 1
fi

source /root/camoufox-test/bin/activate
source ~/.profile 2>/dev/null || true

RESULTS=""

echo "📤 全SNS投稿開始..."
echo "📁 画像: $IMAGE_PATH"
echo "💬 キャプション: $CAPTION"
echo ""

# Instagram
echo "📸 Instagram..."
IG_OUT=$(timeout 90 python3 /root/camoufox-test/post_instagram.py "$IMAGE_PATH" "$CAPTION" 2>&1)
IG_RESULT=$(echo "$IG_OUT" | grep -E "✅|❌|DRY RUN" | grep -v "navigating\|waiting\|locator" | tail -1)
if [ -z "$IG_RESULT" ]; then
    IG_RESULT=$(echo "$IG_OUT" | grep -v "^$\|navigating\|waiting\|locator\|^\-" | tail -1)
fi
echo "$IG_RESULT"
RESULTS="${RESULTS}\n• Instagram: ${IG_RESULT}"

# Threads
echo ""
echo "🧵 Threads..."
TH_OUT=$(timeout 90 python3 /root/camoufox-test/post_threads.py "$IMAGE_PATH" "$CAPTION" 2>&1)
TH_RESULT=$(echo "$TH_OUT" | grep -E "✅|❌|DRY RUN" | grep -v "navigating\|waiting\|locator" | tail -1)
if [ -z "$TH_RESULT" ]; then
    TH_RESULT=$(echo "$TH_OUT" | grep -v "^$\|navigating\|waiting\|locator\|^\-" | tail -1)
fi
echo "$TH_RESULT"
RESULTS="${RESULTS}\n• Threads: ${TH_RESULT}"

# Facebook
echo ""
echo "📘 Facebook..."
FB_OUT=$(timeout 90 python3 /root/camoufox-test/post_facebook.py "$IMAGE_PATH" "$CAPTION" 2>&1)
FB_RESULT=$(echo "$FB_OUT" | grep -E "✅|❌|DRY RUN" | grep -v "navigating\|waiting\|locator" | tail -1)
if [ -z "$FB_RESULT" ]; then
    FB_RESULT=$(echo "$FB_OUT" | grep -v "^$\|navigating\|waiting\|locator\|^\-" | tail -1)
fi
echo "$FB_RESULT"
RESULTS="${RESULTS}\n• Facebook: ${FB_RESULT}"

# Pinterest
echo ""
echo "📌 Pinterest..."
PIN_OUT=$(timeout 90 python3 /root/camoufox-test/post_pinterest.py "$IMAGE_PATH" "$CAPTION" 2>&1)
PIN_RESULT=$(echo "$PIN_OUT" | grep -E "✅.*完了|投稿完了|❌|エラー" | tail -1)
if [ -z "$PIN_RESULT" ]; then
    PIN_RESULT=$(echo "$PIN_OUT" | tail -1)
fi
echo "$PIN_RESULT"
RESULTS="${RESULTS}\n• Pinterest: ${PIN_RESULT}"

# X (bird CLI)
echo ""
echo "🐦 X..."
if [ -n "${DRY_RUN}" ]; then
    X_RESULT="[DRY_RUN] bird tweet skipped"
else
    X_RESULT=$(bird tweet "$CAPTION" --media "$IMAGE_PATH" 2>&1 | head -2)
fi
echo "$X_RESULT"
RESULTS="${RESULTS}\n• X: ${X_RESULT}"

echo ""
echo "=============================="
echo "=== 投稿結果 ==="
echo -e "$RESULTS"
echo "=============================="
