#!/bin/bash
# ディスク使用量監視スクリプト
# 80%を超えたらDiscordに警告通知

set -e

# ディスク使用率を取得（%なしの数値）
USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

# 閾値
WARN_THRESHOLD=80
CRITICAL_THRESHOLD=90

if [ "$USAGE" -ge "$CRITICAL_THRESHOLD" ]; then
    # 緊急レベル（90%以上）
    clawdbot message send \
        --channel discord \
        --target "channel:1464650064357232948" \
        --message "🚨 **ディスク容量緊急警告** 🚨

現在の使用率: **${USAGE}%**

即座に対応が必要です：
1. \`bash /root/clawd/scripts/disk-cleanup.sh\` 実行
2. 不要なファイル削除
3. Pipキャッシュ削除: \`rm -rf /root/.cache/pip\`
4. npmキャッシュ削除: \`npm cache clean --force\`

現在のディスク状況:
\`\`\`
$(df -h /)
\`\`\`"

elif [ "$USAGE" -ge "$WARN_THRESHOLD" ]; then
    # 警告レベル（80%以上）
    clawdbot message send \
        --channel discord \
        --target "channel:1464650064357232948" \
        --message "⚠️ **ディスク容量警告**

現在の使用率: **${USAGE}%**

近日中に対応を検討してください：
- 定期クリーンアップの実行
- 不要なファイルの確認

現在のディスク状況:
\`\`\`
$(df -h /)
\`\`\`"
fi
