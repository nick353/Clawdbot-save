#!/bin/bash
# エラー自動リトライ戦略付き投稿スクリプト
# Usage: post-with-retry.sh <platform> <media-path> <caption>

set -e

PLATFORM="$1"
MEDIA_PATH="$2"
CAPTION="$3"

if [[ -z "$PLATFORM" || -z "$MEDIA_PATH" ]]; then
    echo "❌ Usage: post-with-retry.sh <platform> <media-path> <caption>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_RETRIES=3
RETRY_COUNT=0

# プラットフォーム別スクリプトマッピング
declare -A SCRIPTS=(
    ["instagram"]="post-to-instagram-v12-final.cjs"
    ["threads"]="post-to-threads-v2-anti-ban.cjs"
    ["facebook"]="post-to-facebook-v4-reels-support.cjs"
    ["x"]="post-to-x-v2-anti-ban.cjs"
)

SCRIPT_PATH="${SCRIPT_DIR}/${SCRIPTS[$PLATFORM]}"

if [[ ! -f "$SCRIPT_PATH" ]]; then
    echo "❌ Unknown platform: $PLATFORM"
    exit 1
fi

# エラー解析関数
analyze_error() {
    local screenshot_path="$1"
    local platform="$2"
    
    if [[ ! -f "$screenshot_path" ]]; then
        echo "⚠️ Screenshot not found: $screenshot_path"
        return 1
    fi
    
    # Gemini Vision APIで解析
    python3 "${SCRIPT_DIR}/analyze-error-frame.py" "$screenshot_path" "$platform"
}

# リトライ実行
while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
    echo "🔄 Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES for $PLATFORM"
    
    # スクリーンショットパス（エラー時に生成される）
    SCREENSHOT_PATH="/tmp/${PLATFORM}-error-$(date +%s).png"
    
    # 実行
    if node "$SCRIPT_PATH" "$MEDIA_PATH" "$CAPTION" 2>&1; then
        echo "✅ $PLATFORM: Post successful"
        exit 0
    else
        EXIT_CODE=$?
        echo "❌ $PLATFORM: Post failed (exit code: $EXIT_CODE)"
        
        # スクリーンショットが生成されているか確認
        LATEST_SCREENSHOT=$(ls -t /tmp/${PLATFORM}-debug-*.png 2>/dev/null | head -1)
        
        if [[ -n "$LATEST_SCREENSHOT" ]]; then
            echo "📸 Analyzing error screenshot: $LATEST_SCREENSHOT"
            
            # エラー解析
            ANALYSIS=$(analyze_error "$LATEST_SCREENSHOT" "$PLATFORM")
            echo "🔍 Analysis result:"
            echo "$ANALYSIS"
            
            # JSONパース
            ERROR_TYPE=$(echo "$ANALYSIS" | jq -r '.error_type // "unknown"')
            RETRY_STRATEGY=$(echo "$ANALYSIS" | jq -r '.retry_strategy // "manual"')
            
            echo "📊 Error type: $ERROR_TYPE"
            echo "🎯 Retry strategy: $RETRY_STRATEGY"
            
            case "$RETRY_STRATEGY" in
                reauth)
                    echo "🔑 Cookie期限切れを検出。手動でCookie再取得が必要です。"
                    echo "⚠️ Please update cookies/${PLATFORM}.json"
                    exit 1
                    ;;
                wait)
                    echo "⏳ Rate limit detected. Waiting 60 seconds..."
                    sleep 60
                    ;;
                alternative_selector)
                    echo "🔀 Selector変更を検出。代替セレクタで再試行..."
                    # この場合は単純にリトライ（スクリプト内のフォールバックセレクタが使われる）
                    ;;
                none)
                    echo "✅ 一時的なエラー。リトライします..."
                    sleep 5
                    ;;
                *)
                    echo "❓ Unknown retry strategy. Retrying anyway..."
                    sleep 10
                    ;;
            esac
        else
            echo "⚠️ No screenshot found. Retrying in 10 seconds..."
            sleep 10
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

echo "❌ $PLATFORM: All $MAX_RETRIES attempts failed"
exit 1
