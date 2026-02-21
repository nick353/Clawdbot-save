#!/bin/bash
# Clawdbot VPS起動時の自動復元スクリプト
# Zeaburの起動時に自動実行

set -e

echo "🚀 Clawdbot VPS起動処理を開始..."

# Docker container path
BACKUP_DIR="/root/clawd/.clawdbot-backup"
CLAWDBOT_DIR="/root/.clawdbot"
RESTORE_SCRIPT="/app/scripts/restore-config.sh"

# 1. 設定ファイルが存在しない場合、バックアップから復元
if [ ! -f "$CLAWDBOT_DIR/clawdbot.json" ]; then
  echo "⚠️  設定ファイルが見つかりません。バックアップから復元します..."

  if [ -d "$BACKUP_DIR/state" ] && [ -f "$RESTORE_SCRIPT" ]; then
    bash "$RESTORE_SCRIPT"
  else
    echo "ℹ️  バックアップまたは復元スクリプトが見つかりません。"
    echo "ℹ️  初回起動またはバックアップ未作成の状態です。"
  fi
else
  echo "✅ 設定ファイルが存在します"
fi

# 2. crontabが空の場合、バックアップから復元
if command -v crontab &> /dev/null; then
  if ! crontab -l 2>/dev/null | grep -q "backup-config.sh"; then
    echo "ℹ️  crontabが設定されていません（初回起動時は正常）"

    if [ -f "$BACKUP_DIR/state/crontab.backup" ]; then
      crontab "$BACKUP_DIR/state/crontab.backup"
      echo "✅ crontab復元完了"
    fi
  else
    echo "✅ crontabが設定されています"
  fi
else
  echo "ℹ️  crontab コマンドが利用できません（Docker環境では正常）"
fi

# 3. スクリプトに実行権限を付与
chmod +x /app/scripts/*.sh 2>/dev/null || true

# 4. 自動承認設定を適用
echo "🔧 自動承認設定を適用中..."

if [ -f "$CLAWDBOT_DIR/clawdbot.json" ] && command -v node &> /dev/null; then
  cat > /tmp/apply-auto-approval.js << 'EOFJS'
const fs = require('fs');
const configPath = '/root/.clawdbot/clawdbot.json';

if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // 自動承認設定を追加
  config.tools = config.tools || {};
  config.tools.exec = config.tools.exec || {};
  config.tools.exec.security = "full";
  config.tools.exec.ask = "off";

  // elevated 設定
  config.tools.elevated = config.tools.elevated || {};
  config.tools.elevated.enabled = true;
  config.tools.elevated.allowFrom = config.tools.elevated.allowFrom || {};
  config.tools.elevated.allowFrom.discord = ["*"];

  // agents.defaults 設定
  config.agents = config.agents || {};
  config.agents.defaults = config.agents.defaults || {};
  config.agents.defaults.elevatedDefault = "full";
  // エージェントタイムアウトを1時間（3600秒）に延長
  config.agents.defaults.timeoutSeconds = 3600;

  // 出力
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ 自動承認設定 + タイムアウト延長(1時間)を適用しました');
} else {
  console.log('⚠️  設定ファイルが見つかりません');
}
EOFJS

  node /tmp/apply-auto-approval.js
  rm /tmp/apply-auto-approval.js

  echo "✅ 自動承認設定が適用されました"
else
  echo "ℹ️  自動承認設定をスキップ（初回起動時は正常）"
fi

echo ""
echo "✅ VPS起動処理完了！"
echo ""
