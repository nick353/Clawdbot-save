#!/bin/bash
# conversation-continuity-enforcer-lite.sh
# 軽量版（Clawdbotコマンド呼び出しなし）
# Obsidian + Git ベースの高速エンフォーサー

VAULT_PATH="/root/obsidian-vault/daily"
CURRENT_DATE=$(date '+%Y-%m-%d')
CURRENT_TIME=$(date '+%H:%M:%S')
VAULT_DAILY="$VAULT_PATH/${CURRENT_DATE}.md"
EMERGENCY_LOG="/root/clawd/.continuity-emergency-log"

# ============================================
# Phase 1: Obsidianチェックポイント記録（非同期）
# ============================================
{
    mkdir -p "$VAULT_PATH"
    
    if [ ! -f "$VAULT_DAILY" ]; then
        cat > "$VAULT_DAILY" << EOF
# $CURRENT_DATE

## Continuity Checkpoints

EOF
    fi
    
    cat >> "$VAULT_DAILY" << EOF

### ✅ Checkpoint: $CURRENT_TIME UTC
- **Status**: Continuity Active
- **Context Tokens**: $(grep -o '"contextTokens": *[0-9]*' /root/.clawdbot/clawdbot.json | head -1 | grep -o '[0-9]*' || echo "?")
- **Safeguard Mode**: ON

EOF
} &

# ============================================
# Phase 2: Gateway config の軽量チェック
# ============================================
{
    CONTEXT_TOKENS=$(grep -o '"contextTokens": *[0-9]*' /root/.clawdbot/clawdbot.json | head -1 | grep -o '[0-9]*' || echo 0)
    
    if [ "$CONTEXT_TOKENS" -lt 1000000 ] && [ "$CONTEXT_TOKENS" -gt 0 ]; then
        echo "[$CURRENT_TIME] ⚠️  LOW CONTEXT: $CONTEXT_TOKENS" >> "$EMERGENCY_LOG"
    fi
} &

# ============================================
# Phase 3: Git auto-commit（非同期）
# ============================================
{
    cd /root/clawd
    if git status --short 2>/dev/null | grep -q .; then
        git add -A 2>/dev/null && git commit -m "auto: context save @$CURRENT_TIME" 2>/dev/null || true
    fi
} &

# バックグラウンドタスクを全て待機（タイムアウト30秒）
wait $(jobs -p) 2>/dev/null || true

# ============================================
# Phase 4: RUNNING_TASKS.md 確認（long task detection）
# ============================================
if [ -f "/root/clawd/RUNNING_TASKS.md" ]; then
    TASK_START=$(grep "## 実行中" -A 3 "/root/clawd/RUNNING_TASKS.md" | grep "開始" | head -1 | sed 's/.*: //' | sed 's/ .*//')
    
    if [ -n "$TASK_START" ]; then
        TASK_EPOCH=$(date -d "$TASK_START" +%s 2>/dev/null || echo 0)
        NOW=$(date +%s)
        ELAPSED=$((NOW - TASK_EPOCH))
        
        if [ "$ELAPSED" -gt 1800 ]; then
            echo "[$CURRENT_TIME] ⚠️  LONG-RUNNING TASK: ${ELAPSED}s" >> "$EMERGENCY_LOG"
        fi
    fi
fi

# ============================================
# Done (silent exit)
# ============================================
exit 0
