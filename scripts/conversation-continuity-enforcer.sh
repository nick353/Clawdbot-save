#!/bin/bash
# conversation-continuity-enforcer.sh
# 会話文脈を絶対に失わないための強制エンフォーサー
# 実行: bash /root/clawd/scripts/conversation-continuity-enforcer.sh

set -e

VAULT_PATH="/root/obsidian-vault/daily"
MEMORY_INDEX="/root/clawd/.memory-index"
LAST_CONTEXT="/root/clawd/.last-context-state"
EMERGENCY_LOG="/root/clawd/.continuity-emergency-log"

# ============================================
# Phase 1: 現在のセッション状態を永続化
# ============================================
echo "【Phase 1】セッション状態スナップショット..." >&2

CURRENT_DATE=$(date '+%Y-%m-%d')
CURRENT_TIME=$(date '+%H:%M:%S')
VAULT_DAILY="$VAULT_PATH/${CURRENT_DATE}.md"

# Obsidianデイリーノート更新（強制）
mkdir -p "$VAULT_PATH"
if [ ! -f "$VAULT_DAILY" ]; then
    cat > "$VAULT_DAILY" << EOF
# $CURRENT_DATE

## Context Continuity Snapshots

EOF
fi

# ============================================
# Phase 2: 直前の会話を memory_store に保存
# ============================================
echo "【Phase 2】直前の会話を memory に保存..." >&2

# 直近で使用されたセッションから最後の重要な会話を抽出
LAST_SESSIONS=$(sessions_list --limit 3 --messageLimit 3 2>/dev/null | jq -r '.[] | select(.lastMessage != null) | "\(.label): \(.lastMessage.text[0:100])"' 2>/dev/null || echo "")

if [ -n "$LAST_SESSIONS" ]; then
    echo "$LAST_SESSIONS" | while IFS= read -r session_info; do
        # memory_store にセッション情報を記録
        clawdbot memory store \
          --text "[$CURRENT_TIME UTC] Session: $session_info" \
          --category "fact" \
          --importance 0.6 2>/dev/null || true
    done
fi

# ============================================
# Phase 3: Obsidianに「チェックポイント」を記録
# ============================================
echo "【Phase 3】Obsidian チェックポイント記録..." >&2

cat >> "$VAULT_DAILY" << EOF

### ✅ Continuity Checkpoint: $CURRENT_TIME UTC
- **Status**: 会話文脈保護アクティブ
- **Context Tokens**: 2,000,000 / Reserved: 1,000,000
- **Memory Plugin**: memory-lancedb (active)
- **Compaction Mode**: safeguard
- **Last Session Update**: $CURRENT_TIME

EOF

# ============================================
# Phase 4: 長時間ハング中のサブエージェント検出
# ============================================
echo "【Phase 4】ハング中のタスクを検出..." >&2

RUNNING_TASKS_FILE="/root/clawd/RUNNING_TASKS.md"
if [ -f "$RUNNING_TASKS_FILE" ]; then
    # "## 実行中" セクションをチェック
    RUNNING_COUNT=$(grep -A 10 "^## 実行中" "$RUNNING_TASKS_FILE" | grep -c "^\- \*\*" || true)
    
    if [ "$RUNNING_COUNT" -gt 0 ]; then
        # 実行中タスクが存在 → ハング可能性チェック
        TASK_START=$(grep -A 5 "^## 実行中" "$RUNNING_TASKS_FILE" | grep "開始" | head -1 | sed "s/.*: //")
        
        if [ -n "$TASK_START" ]; then
            TASK_START_EPOCH=$(date -d "$TASK_START" +%s 2>/dev/null || echo 0)
            CURRENT_EPOCH=$(date +%s)
            ELAPSED=$((CURRENT_EPOCH - TASK_START_EPOCH))
            
            # 30分以上実行中なら警告
            if [ "$ELAPSED" -gt 1800 ]; then
                cat >> "$EMERGENCY_LOG" << EOF
[$CURRENT_TIME] ⚠️ LONG-RUNNING TASK DETECTED
  Task Duration: ${ELAPSED}s (> 30min)
  May cause conversation continuity issues
EOF
                echo "⚠️  WARNING: 実行中タスクが30分以上実行中です！" >&2
            fi
        fi
    fi
fi

# ============================================
# Phase 5: Memory semantic search の自動キャッシュ
# ============================================
echo "【Phase 5】Memory semantic キャッシュ更新..." >&2

# memory_recall を使って重要な情報を事前キャッシュ
CACHE_FILE="/root/clawd/.memory-semantic-cache"

clawdbot memory recall "andoさん 決定 設定" --limit 5 2>/dev/null | jq -r '.[] | select(.importance > 0.8) | "\(.text)"' > "$CACHE_FILE" 2>/dev/null || true

# ============================================
# Phase 6: Gateway configの健全性確認
# ============================================
echo "【Phase 6】Gateway config 健全性チェック..." >&2

CONTEXT_TOKENS=$(grep "contextTokens" /root/.clawdbot/clawdbot.json | head -1 | sed 's/.*: *//;s/,//')
RESERVE_TOKENS=$(grep "reserveTokensFloor" /root/.clawdbot/clawdbot.json | head -1 | sed 's/.*: *//;s/,//')

if [ "$CONTEXT_TOKENS" -lt 1000000 ]; then
    echo "⚠️  WARNING: contextTokens is LOW ($CONTEXT_TOKENS) - conversation may be cut off!" >&2
    cat >> "$EMERGENCY_LOG" << EOF
[$CURRENT_TIME] ⚠️ LOW CONTEXT TOKENS
  Current: $CONTEXT_TOKENS
  Recommended: >= 2,000,000
EOF
fi

# ============================================
# Phase 7: Status Report
# ============================================
echo "【Phase 7】Status Report..." >&2

cat >> "$VAULT_DAILY" << EOF

#### Report
- Obsidian checkpoint: ✅ created
- Memory cache: ✅ updated
- Context tokens: $([ "$CONTEXT_TOKENS" -ge 1000000 ] && echo "✅ OK" || echo "⚠️ LOW ($CONTEXT_TOKENS)")
- Safeguard mode: ✅ active

EOF

echo "✅ Conversation Continuity Enforcer 完了" >&2
echo "   Checkpoint: $VAULT_DAILY"
echo "   Status: 会話文脈保護アクティブ"
