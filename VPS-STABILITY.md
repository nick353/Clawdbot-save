# VPS 安定稼働設定ガイド (RackNerd KVM)

このガイドは、RackNerd VPS（コンテナ環境）でClawdbotを「止まらないように」設定する方法をまとめたものです。

## 環境情報

- **VPS**: RackNerd 2GB KVM (racknerd-6e3cccf)
- **OS**: Debian 12 (bookworm)
- **実行環境**: コンテナ（PID 1 = clawdbot-gateway）
- **プロセス管理**: なし（systemd/supervisor/cron 未インストール）

## 現在の安定性対策

### ✅ 自動実装済み

1. **HEARTBEAT自動実行**
   - `HEARTBEAT.md` に定義されたタスクを定期実行（約15分ごと）
   - ヘルスチェック: `scripts/health-check.sh`
   - バックアップ: `scripts/backup-with-retry.sh`

2. **プロセス監視スクリプト**
   - `scripts/watchdog.sh` - 30秒ごとにヘルスチェック
   - 異常検知時に Discord 通知（Webhook 設定時）

3. **設定自動復元**
   - VPS再起動時に `scripts/startup.sh` が自動実行
   - バックアップから設定ファイルを復元

## 追加設定（推奨）

### 1. Discord Webhook 通知

異常時に Discord へ通知を送るため、環境変数を設定：

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
```

#### Webhook URL の取得方法
1. Discord サーバー設定 → 連携サービス → ウェブフック
2. "新しいウェブフック" をクリック
3. 名前を設定（例: Clawdbot Alerts）
4. チャンネルを選択（#sns-投稿 など）
5. "ウェブフックURLをコピー"

#### 環境変数を永続化
```bash
echo 'export DISCORD_WEBHOOK_URL="YOUR_WEBHOOK_URL"' >> ~/.bashrc
source ~/.bashrc
```

### 2. Watchdog 起動（バックグラウンド監視）

30秒ごとにプロセスを監視し、異常時に通知：

```bash
# バックグラウンドで起動
nohup bash /root/clawd/scripts/watchdog.sh > /root/clawd/.clawdbot-backup/logs/watchdog-output.log 2>&1 &

# プロセスIDを保存
echo $! > /root/clawd/.clawdbot-backup/watchdog.pid
```

#### Watchdog の確認
```bash
# プロセスが動いているか確認
ps aux | grep watchdog.sh | grep -v grep

# ログを確認
tail -f /root/clawd/.clawdbot-backup/logs/watchdog.log
```

#### Watchdog の停止
```bash
# PIDファイルから停止
kill $(cat /root/clawd/.clawdbot-backup/watchdog.pid)
rm /root/clawd/.clawdbot-backup/watchdog.pid
```

### 3. コンテナ再起動ポリシー（ホスト側）

VPSホストでDockerを使っている場合、再起動ポリシーを確認：

```bash
# コンテナの再起動ポリシーを確認（ホストで実行）
docker inspect <container_id> | grep -A 5 RestartPolicy

# 推奨設定: always または unless-stopped
docker update --restart=always <container_id>
```

※ この設定はVPSホスト側（SSHでログイン後）で行います

### 4. 手動ヘルスチェック

現在の状態を確認：

```bash
# ヘルスチェック実行
bash /root/clawd/scripts/health-check.sh

# プロセス確認
ps aux | grep clawdbot-gateway

# HTTP応答確認
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
```

## ログ確認

### ヘルスチェックログ
```bash
tail -f /root/clawd/.clawdbot-backup/logs/health-check.log
```

### Watchdogログ
```bash
tail -f /root/clawd/.clawdbot-backup/logs/watchdog.log
```

### Gatewayログ（標準出力）
コンテナ環境では通常 `docker logs <container_id>` で確認

## トラブルシューティング

### プロセスが停止した場合

1. **手動で再起動**（通常はコンテナが自動再起動）
```bash
# コンテナ環境では通常不要（ホストが再起動）
# 直接実行する場合:
cd /root/clawd
node dist/index.js gateway --bind lan --port 8080 &
```

2. **ログを確認**
```bash
tail -100 /root/clawd/.clawdbot-backup/logs/health-check.log
```

3. **Discord通知を確認**
Webhook設定済みの場合、#sns-投稿 チャンネルにアラートが届きます

### メモリ不足で停止する場合

```bash
# メモリ使用量を確認
free -h

# Gateway のメモリ使用量
ps aux | grep clawdbot-gateway | awk '{print $6}'
```

VPSのメモリが不足している場合、プラン変更を検討してください（現在: 2GB）

### ネットワークエラーの場合

```bash
# ポート8080が開いているか確認
curl -v http://localhost:8080/

# 外部からアクセス可能か確認（別マシンから）
curl -v http://104.223.75.239:8080/
```

ファイアウォール設定が必要な場合があります。

## バックアップ

自動バックアップが HEARTBEAT で実行されます：
- **頻度**: 約15分ごと
- **スクリプト**: `scripts/backup-with-retry.sh`
- **リポジトリ**: 
  - 本家: https://github.com/nick353/Nandemo-work-flow
  - バックアップ: https://github.com/nick353/save-point

### 手動バックアップ
```bash
bash /root/clawd/scripts/backup-with-retry.sh
```

## まとめ

### ✅ 自動で動作中
- HEARTBEAT によるヘルスチェック（15分ごと）
- 設定ファイル自動復元（起動時）
- GitHubバックアップ（15分ごと）

### 🔧 設定推奨
- Discord Webhook 通知（異常時のアラート）
- Watchdog 起動（30秒ごとの詳細監視）
- コンテナ再起動ポリシー確認（ホスト側）

### 📊 監視方法
- ログ確認: `tail -f ~/.clawdbot-backup/logs/*.log`
- Discord 通知: Webhook設定時に自動送信
- 手動チェック: `bash scripts/health-check.sh`

---

**これで RackNerd VPS 上の Clawdbot は「止まらない」設定が完了です！** 🎉🐥
