#!/bin/bash
# 浮世絵猫シリーズ画像・プロンプト転記スクリプト（VPS版）
# Google Docs → Spreadsheet 自動転記

set -e

# 固定設定
DOC_URL="https://docs.google.com/document/d/1j2lsvr1zJs9k9cCkLGeGF-soZZSGuY2p0tQ6wJp8S0s/edit?tab=t.0"
SHEET_URL="https://docs.google.com/spreadsheets/d/180Vjl8YwdM8tNy1suaYoq84FlbAdkc-uMvWh8aEc_3o/edit?gid=0#gid=0"
IMAGE_DIR="/root/clawd/cat_images"
LOG_FILE="/root/clawd/.clawdbot-backup/logs/ukiyoe-transfer.log"

# ログディレクトリ作成
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$IMAGE_DIR"

# ログ出力関数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🎨 浮世絵猫転記スクリプト開始"

# Clawdbot browser tool を使った処理
# 注: この部分は実際には Clawdbot の agent として実行される
# シェルスクリプトから直接 browser tool は呼べないため、
# clawdbot agent コマンド経由で実行

# 実行タスクをメッセージとして送信
TASK_MESSAGE="浮世絵猫の転記を実行してっぴ

Google Docs: $DOC_URL
Spreadsheet: $SHEET_URL

以下の手順で実行：
1. スプレッドシートを開いて登録済み画像を確認
2. Google Docs を開いて新規画像を検出
3. 新規画像をスクリーンショット保存（$IMAGE_DIR）
4. スプレッドシートに追加（A列:画像, B列:テーマ, C列:プロンプト, D列:○）
5. 未採用画像（D列空白）をDocsから削除
6. 完了報告を Discord (#sns-投稿) に送信"

# Discord にタスク実行依頼を送信
# 注: この方法だと無限ループになる可能性があるため、
# 実際には message tool を使って別チャンネルに送るか、
# 直接 browser tool を呼び出す必要がある

log "⚠️  このスクリプトは Clawdbot agent として実行される必要があります"
log "手動実行: clawdbot agent --message '浮世絵猫の転記を実行' --channel discord --target sns-投稿"

exit 0
