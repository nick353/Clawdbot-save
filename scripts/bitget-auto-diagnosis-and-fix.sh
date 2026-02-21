#!/usr/bin/env bash
#
# Bitget自動診断＋自動修正スクリプト
# - 自己診断実行
# - 問題検出時は即座に自動修正
# - 承認不要（全自動）
#

set -euo pipefail

DIAGNOSIS_SCRIPT="/root/clawd/scripts/bitget-self-diagnosis.py"
FIX_SCRIPT="/root/clawd/scripts/bitget-auto-fix.py"
LOG_PATH="/root/clawd/data/auto-diagnosis-fix.log"

# ログ出力
log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*" | tee -a "$LOG_PATH"
}

log "🔍 自動診断開始..."

# 診断実行
if python3 "$DIAGNOSIS_SCRIPT" >> "$LOG_PATH" 2>&1; then
    log "✅ 診断完了（問題なし）"
    exit 0
fi

log "⚠️  問題検出 - 自動修正開始..."

# 自動修正実行（全ての修正を適用）
if python3 "$FIX_SCRIPT" all >> "$LOG_PATH" 2>&1; then
    log "✅ 自動修正完了"
else
    log "❌ 自動修正失敗"
    exit 1
fi

log "🎉 全プロセス完了"
