#!/bin/bash
# Clawdbot 自動承認設定スクリプト
# VPS起動時に自動実行

set -e

CLAWDBOT_CONFIG="/root/.clawdbot/clawdbot.json"

echo "🔧 Clawdbot 自動承認設定を適用中..."

# バックアップが存在する場合は読み込む
if [ -f "$CLAWDBOT_CONFIG" ]; then
  echo "✅ 既存の設定ファイルが見つかりました"

  # 自動承認設定を追加/更新
  cat > /tmp/merge-config.js << 'EOF'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('/root/.clawdbot/clawdbot.json', 'utf8'));

// 自動承認設定を追加
config.tools = config.tools || {};
config.tools.exec = config.tools.exec || {};
config.tools.exec.security = "full";
config.tools.exec.ask = "off";
config.tools.exec.safeBins = config.tools.exec.safeBins || [];

// npm, node, bash を安全なコマンドに追加
const safeBins = ["npm", "node", "bash", "cd", "ls", "cat", "echo", "sleep", "which", "apt-get"];
safeBins.forEach(bin => {
  if (!config.tools.exec.safeBins.includes(bin)) {
    config.tools.exec.safeBins.push(bin);
  }
});

// elevated 設定
config.tools.elevated = config.tools.elevated || {};
config.tools.elevated.enabled = true;
config.tools.elevated.allowFrom = config.tools.elevated.allowFrom || {};
config.tools.elevated.allowFrom.discord = ["*"];

// agents.defaults 設定
config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.agents.defaults.elevatedDefault = "full";

// 出力
fs.writeFileSync('/root/.clawdbot/clawdbot.json', JSON.stringify(config, null, 2));
console.log('✅ 自動承認設定を適用しました');
EOF

  node /tmp/merge-config.js
  rm /tmp/merge-config.js

  echo "✅ 自動承認設定が適用されました"
else
  echo "⚠️  設定ファイルが見つかりません。Docker entrypoint が先に実行される必要があります。"
fi

echo ""
echo "📝 適用された設定:"
echo "  - tools.exec.security: full"
echo "  - tools.exec.ask: off"
echo "  - tools.elevated.enabled: true"
echo "  - agents.defaults.elevatedDefault: full"
echo ""
