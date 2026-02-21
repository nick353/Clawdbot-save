#!/bin/bash
# Clawdbot設定復元スクリプト
# VPSアップデート後に実行

set -e

BACKUP_DIR="/root/clawd/.clawdbot-backup"
CLAWDBOT_DIR="/root/.clawdbot"

echo "🔄 Clawdbot設定を復元中..."

# 設定ディレクトリ作成
mkdir -p "$CLAWDBOT_DIR"

# 1. /root/.clawdbot/ 全体を復元
if [ -d "$BACKUP_DIR/state" ]; then
  echo "📦 Clawdbot全体を復元..."
  
  # cpコマンドで全体を復元
  mkdir -p "$CLAWDBOT_DIR"
  cp -r "$BACKUP_DIR/state/"* "$CLAWDBOT_DIR/" 2>/dev/null || true
  cp -r "$BACKUP_DIR/state/".* "$CLAWDBOT_DIR/" 2>/dev/null || true
  
  echo "✅ Clawdbot全体復元完了"
else
  echo "❌ バックアップディレクトリが見つかりません: $BACKUP_DIR/state"
  echo "💡 バックアップスクリプトを実行してください"
  exit 1
fi

# 2. 環境変数から機密情報を確認（オプション）
echo "🔑 環境変数をチェック..."

if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "✅ ANTHROPIC_API_KEY が設定されています"
else
  echo "⚠️  ANTHROPIC_API_KEY が設定されていません"
fi

if [ -n "$DISCORD_BOT_TOKEN" ]; then
  echo "✅ DISCORD_BOT_TOKEN が設定されています"
else
  echo "⚠️  DISCORD_BOT_TOKEN が設定されていません"
fi

if [ -n "$BRAVE_API_KEY" ]; then
  echo "✅ BRAVE_API_KEY が設定されています"
else
  echo "⚠️  BRAVE_API_KEY が設定されていません"
fi

# 3. システムcrontabを復元
if [ -f "$BACKUP_DIR/state/crontab.backup" ]; then
  echo "⏰ システムcrontabを復元..."
  crontab "$BACKUP_DIR/state/crontab.backup"
  echo "✅ システムcrontab復元完了"
  
  echo ""
  echo "現在のcrontab:"
  crontab -l | grep -v "^#" | grep -v "^$" || echo "  (空)"
else
  echo "⚠️  crontabバックアップが見つかりません"
fi

# 4. ホームディレクトリ設定を復元
if [ -d "$BACKUP_DIR/home" ]; then
  echo "🏠 ホームディレクトリ設定を復元..."
  
  # bashrc, profile, gitconfig など
  for file in .bashrc .profile .bash_profile .bash_aliases .gitconfig .npmrc; do
    if [ -f "$BACKUP_DIR/home/$file" ]; then
      cp "$BACKUP_DIR/home/$file" "/root/$file"
      echo "  ✓ $file 復元"
    fi
  done
  
  # SSH設定
  if [ -d "$BACKUP_DIR/home/.ssh" ]; then
    mkdir -p /root/.ssh
    cp -r "$BACKUP_DIR/home/.ssh/"* /root/.ssh/ 2>/dev/null || true
    chmod 700 /root/.ssh
    chmod 600 /root/.ssh/id_* 2>/dev/null || true
    chmod 644 /root/.ssh/*.pub 2>/dev/null || true
    echo "  ✓ SSH設定復元"
  fi
  
  echo "✅ ホームディレクトリ設定復元完了"
else
  echo "ℹ️  ホームディレクトリバックアップが見つかりません"
fi

# 5. インストール済みパッケージを復元（オプション）
if [ -d "$BACKUP_DIR/packages" ]; then
  echo "📦 インストール済みパッケージを確認..."
  
  # npmグローバルパッケージ（復元はスキップ、手動確認用）
  if [ -f "$BACKUP_DIR/packages/npm-global.txt" ]; then
    echo "  ℹ️  npmグローバルパッケージリスト: $BACKUP_DIR/packages/npm-global.txt"
    echo "  💡 手動復元: 必要なパッケージを npm install -g <package> で再インストール"
  fi
  
  # システムパッケージ（復元はスキップ、手動確認用）
  if [ -f "$BACKUP_DIR/packages/apt-packages.txt" ]; then
    echo "  ℹ️  システムパッケージリスト: $BACKUP_DIR/packages/apt-packages.txt"
    echo "  💡 手動復元: dpkg --set-selections < apt-packages.txt && apt-get dselect-upgrade"
  fi
  
  echo "✅ パッケージリスト確認完了（手動復元が必要な場合あり）"
fi

# 6. パーミッション設定
echo "🔒 パーミッションを設定..."
chmod 600 "$CLAWDBOT_DIR/clawdbot.json" 2>/dev/null || true
chmod 700 "$CLAWDBOT_DIR/cron" 2>/dev/null || true
chmod 700 "$CLAWDBOT_DIR/agents" 2>/dev/null || true
chmod 700 "$CLAWDBOT_DIR/sessions" 2>/dev/null || true
chmod +x /root/clawd/scripts/*.sh 2>/dev/null || true

echo ""
echo "✅ 復元完了！"
echo ""
echo "📊 復元された内容:"
echo "   - 設定ファイル: $CLAWDBOT_DIR/clawdbot.json"
echo "   - Clawdbot cronジョブ: $CLAWDBOT_DIR/cron/"
echo "   - エージェント設定: $CLAWDBOT_DIR/agents/"
echo "   - セッション履歴: $CLAWDBOT_DIR/sessions/"
echo "   - スキル: $CLAWDBOT_DIR/skills/"
echo "   - プラグイン: $CLAWDBOT_DIR/plugins/"
echo "   - ホームディレクトリ設定"
echo "   - SSH鍵と設定"
echo "   - その他すべての設定・データ"
echo ""
echo "🚀 次のステップ:"
echo "   1. Gatewayを起動: clawdbot gateway start"
echo "   2. 状態確認: clawdbot status"
echo "   3. Discordで動作テスト"
echo ""
echo "💡 トラブルシューティング:"
echo "   clawdbot doctor"
