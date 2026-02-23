#!/bin/bash
# pre-message-context-save.sh
# ユーザーメッセージ受信時に自動実行される
# 「受け取ったメッセージの文脈」を memory_store に永続化
# Usage: bash /root/clawd/scripts/pre-message-context-save.sh "<user_message>" "<channel>" "<user_id>"

USER_MESSAGE="$1"
CHANNEL="${2:-unknown}"
USER_ID="${3:-unknown}"
TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%SZ')
VAULT_PATH="/root/obsidian-vault/daily"
VAULT_DAILY="$VAULT_PATH/$(date '+%Y-%m-%d').md"

# ============================================
# User Message Context を memory_store に記録
# ============================================

# 重要度判定：キーワードで判定
IMPORTANCE=0.6
if echo "$USER_MESSAGE" | grep -qiE "(決定|修正|変更|実装|確認|問題|バグ|エラー|失敗|重要|緊急)"; then
    IMPORTANCE=0.9
elif echo "$USER_MESSAGE" | grep -qiE "(？|？？|教えて|何|どう|理由)"; then
    IMPORTANCE=0.7
fi

# memory_store に保存
MEMORY_TEXT="[$TIMESTAMP] ユーザーメッセージ@$CHANNEL by $USER_ID: $USER_MESSAGE"

clawdbot memory store \
  --text "$MEMORY_TEXT" \
  --category "fact" \
  --importance "$IMPORTANCE" 2>/dev/null || true

# ============================================
# Obsidianにも記録
# ============================================
mkdir -p "$VAULT_PATH"
if [ ! -f "$VAULT_DAILY" ]; then
    cat > "$VAULT_DAILY" << EOF
# $(date '+%Y-%m-%d')

## Messages

EOF
fi

# メッセージを追記（見出しは時刻のみ）
cat >> "$VAULT_DAILY" << EOF

### $TIMESTAMP [$CHANNEL]
- **From**: $USER_ID
- **Importance**: $(echo "$IMPORTANCE" | awk '{printf "%.1f", $1}')
- **Text**: $USER_MESSAGE

EOF

# ============================================
# SUCCESS: Silent exit（処理確認ログは出さない）
# ============================================
exit 0
