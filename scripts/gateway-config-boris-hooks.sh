#!/bin/bash
# Boris Cherny流のHooks設定を追加するスクリプト

set -euo pipefail

CONFIG_PATH="/root/.clawdbot/clawdbot.json"
BACKUP_PATH="/root/.clawdbot/clawdbot.json.backup-boris-$(date +%Y%m%d-%H%M%S)"

echo "🔧 Boris Cherny流Hooks設定を追加します..."

# バックアップ
cp "$CONFIG_PATH" "$BACKUP_PATH"
echo "✅ バックアップ作成: $BACKUP_PATH"

# jqで設定追加
jq '
  .agents.defaults.hooks = {
    "postToolUse": {
      "format": {
        "enabled": true,
        "command": "prettier --write",
        "patterns": ["*.ts", "*.js", "*.json", "*.md"],
        "description": "Boris流: Claudeのコードを自動フォーマット（CI失敗防止）"
      }
    },
    "stop": {
      "verify": {
        "enabled": true,
        "description": "Boris流: 長時間タスク完了時の自動検証",
        "command": "echo \"✅ タスク完了 - lessons.mdに記録してください\""
      }
    }
  }
' "$CONFIG_PATH" > "$CONFIG_PATH.tmp" && mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"

echo "✅ Hooks設定追加完了"

# パーミッション最適化（安全なコマンドの事前承認）
jq '
  .tools.exec.preapproved = [
    "git status",
    "git diff",
    "git log",
    "npm run lint",
    "npm run lint:*",
    "bun run build",
    "bun run build:*",
    "pnpm lint",
    "pnpm test",
    "cat /root/clawd/tasks/lessons.md",
    "grep -i",
    "find /root/clawd -name",
    "ls -la /root/clawd",
    "process list",
    "cron list"
  ] |
  .tools.exec.preapprovedDescription = "Boris流: 安全なコマンドは自動承認（効率化）"
' "$CONFIG_PATH" > "$CONFIG_PATH.tmp" && mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"

echo "✅ パーミッション最適化完了"

# 設定確認
echo ""
echo "📋 追加された設定:"
jq '.agents.defaults.hooks, .tools.exec.preapproved' "$CONFIG_PATH"

echo ""
echo "🔄 Gateway再起動が必要です:"
echo "  clawdbot gateway restart"
echo ""
echo "📚 参考: https://paddo.dev/blog/how-boris-uses-claude-code/"
