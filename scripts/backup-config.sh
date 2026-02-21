#!/bin/bash
# Clawdbot設定バックアップスクリプト
# 定期的に実行してバックアップを更新

set -e

BACKUP_DIR="/root/clawd/.clawdbot-backup"
CLAWDBOT_DIR="/root/.clawdbot"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

echo "🔄 Clawdbot設定をバックアップ中..."

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR/state"
mkdir -p "$BACKUP_DIR/history"

# 1. /root/.clawdbot/ 全体をバックアップ（ログ・キャッシュ除外）
if [ -d "$CLAWDBOT_DIR" ]; then
  echo "📦 Clawdbot全体をバックアップ..."
  
  # cpコマンドで全体をバックアップ（除外リスト付き）
  mkdir -p "$BACKUP_DIR/state"
  
  # まず全体をコピー
  cp -r "$CLAWDBOT_DIR/"* "$BACKUP_DIR/state/" 2>/dev/null || true
  cp -r "$CLAWDBOT_DIR/".* "$BACKUP_DIR/state/" 2>/dev/null || true
  
  # 除外ファイルを削除
  rm -rf "$BACKUP_DIR/state/logs" 2>/dev/null || true
  find "$BACKUP_DIR/state" -name "*.log" -delete 2>/dev/null || true
  rm -rf "$BACKUP_DIR/state/cache" 2>/dev/null || true
  rm -rf "$BACKUP_DIR/state/tmp" 2>/dev/null || true
  rm -f "$BACKUP_DIR/state/restart-sentinel.json" 2>/dev/null || true
  
  echo "✅ Clawdbot全体バックアップ完了"
else
  echo "⚠️  Clawdbotディレクトリが見つかりません: $CLAWDBOT_DIR"
fi

# 2. 設定ファイルの履歴バックアップ（タイムスタンプ付き）
if [ -f "$CLAWDBOT_DIR/clawdbot.json" ]; then
  echo "📝 設定履歴を保存..."
  cp "$CLAWDBOT_DIR/clawdbot.json" "$BACKUP_DIR/history/clawdbot-${TIMESTAMP}.json"
  echo "✅ 設定履歴保存完了"
fi

# 3. トークンなしテンプレートを作成
if [ -f "$BACKUP_DIR/state/clawdbot.json" ]; then
  echo "📝 トークンなしテンプレートを作成..."
  
  # トークン・APIキーを削除したテンプレート
  cat "$BACKUP_DIR/state/clawdbot.json" | \
    sed 's/"token": "[^"]*"/"token": "YOUR_TOKEN"/g' | \
    sed 's/"apiKey": "[^"]*"/"apiKey": "YOUR_API_KEY"/g' | \
    sed 's/"password": "[^"]*"/"password": "YOUR_PASSWORD"/g' \
    > "$BACKUP_DIR/config-template.json"
  
  echo "✅ テンプレート作成完了"
fi

# 4. システムcrontabをバックアップ（crontab利用可能な場合のみ）
if command -v crontab &> /dev/null; then
  echo "⏰ システムcrontabをバックアップ..."
  crontab -l > "$BACKUP_DIR/state/crontab.backup" 2>/dev/null || echo "# No crontab" > "$BACKUP_DIR/state/crontab.backup"
  echo "✅ システムcrontabバックアップ完了"
else
  echo "ℹ️  crontab コマンドが利用できません（Docker環境では正常）"
  echo "# crontab not available" > "$BACKUP_DIR/state/crontab.backup"
fi

# 5. ホームディレクトリ設定をバックアップ
echo "🏠 ホームディレクトリ設定をバックアップ..."
mkdir -p "$BACKUP_DIR/home"

# bashrc, profile, gitconfig など
for file in .bashrc .profile .bash_profile .bash_aliases .gitconfig .npmrc; do
  if [ -f "/root/$file" ]; then
    cp "/root/$file" "$BACKUP_DIR/home/$file"
  fi
done

# SSH設定（秘密鍵も含む）
if [ -d "/root/.ssh" ]; then
  mkdir -p "$BACKUP_DIR/home/.ssh"
  cp -r /root/.ssh/* "$BACKUP_DIR/home/.ssh/" 2>/dev/null || true
  # パーミッション情報を保存
  chmod 700 "$BACKUP_DIR/home/.ssh"
  find "$BACKUP_DIR/home/.ssh" -type f -name "id_*" ! -name "*.pub" -exec chmod 600 {} \;
fi

echo "✅ ホームディレクトリ設定バックアップ完了"

# 6. インストール済みパッケージリストをバックアップ
echo "📦 インストール済みパッケージをバックアップ..."
mkdir -p "$BACKUP_DIR/packages"

# npmグローバルパッケージ
if command -v npm &> /dev/null; then
  npm list -g --depth=0 --json > "$BACKUP_DIR/packages/npm-global.json" 2>/dev/null || echo "{}" > "$BACKUP_DIR/packages/npm-global.json"
  npm list -g --depth=0 > "$BACKUP_DIR/packages/npm-global.txt" 2>/dev/null || echo "# No packages" > "$BACKUP_DIR/packages/npm-global.txt"
fi

# pnpmグローバルパッケージ
if command -v pnpm &> /dev/null; then
  pnpm list -g --depth=0 > "$BACKUP_DIR/packages/pnpm-global.txt" 2>/dev/null || echo "# No packages" > "$BACKUP_DIR/packages/pnpm-global.txt"
fi

# Bunグローバルパッケージ
if command -v bun &> /dev/null; then
  bun pm ls -g > "$BACKUP_DIR/packages/bun-global.txt" 2>/dev/null || echo "# No packages" > "$BACKUP_DIR/packages/bun-global.txt"
fi

# システムパッケージ（apt）
if command -v apt &> /dev/null; then
  dpkg --get-selections > "$BACKUP_DIR/packages/apt-packages.txt" 2>/dev/null || true
  apt-mark showauto > "$BACKUP_DIR/packages/apt-auto.txt" 2>/dev/null || true
fi

echo "✅ パッケージリストバックアップ完了"

# 7. バックアップ情報を記録
cat > "$BACKUP_DIR/backup-info.txt" << EOF
Clawdbot設定バックアップ
========================

バックアップ日時: $(date '+%Y-%m-%d %H:%M:%S')
タイムスタンプ: ${TIMESTAMP}

バックアップ内容:
- state/ - /root/.clawdbot/ 全体（ログ除外）
  ├── clawdbot.json (メイン設定)
  ├── cron/ (Clawdbot cronジョブ)
  ├── agents/ (エージェント設定・状態)
  ├── sessions/ (セッション履歴)
  ├── skills/ (インストール済みスキル)
  ├── plugins/ (インストール済みプラグイン)
  └── その他すべての設定・データ

- home/ - ホームディレクトリ設定
  ├── .bashrc, .profile, .gitconfig
  └── .ssh/ (SSH鍵・設定)

- packages/ - インストール済みパッケージリスト
  ├── npm-global.json (npmグローバルパッケージ)
  ├── pnpm-global.txt (pnpmグローバルパッケージ)
  ├── bun-global.txt (Bunグローバルパッケージ)
  └── apt-packages.txt (システムパッケージ)

- config-template.json (トークンなしテンプレート)
- history/clawdbot-${TIMESTAMP}.json (設定履歴)

除外項目:
- logs/ (ログファイル)
- cache/ (キャッシュ)
- tmp/ (一時ファイル)
- restart-sentinel.json (再起動マーカー)

復元方法:
bash /root/clawd/scripts/restore-config.sh

自動復元:
VPS起動時に自動で復元されます（startup.sh）
EOF

echo ""
echo "✅ バックアップ完了！"
echo ""
echo "📁 バックアップ場所: $BACKUP_DIR"
echo "📊 バックアップサイズ: $(du -sh $BACKUP_DIR | cut -f1)"
echo "📄 バックアップ情報: $BACKUP_DIR/backup-info.txt"
echo ""
echo "💡 復元方法:"
echo "   bash /root/clawd/scripts/restore-config.sh"
