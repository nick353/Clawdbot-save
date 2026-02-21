# Bitget自動トレーダー 予期しない再起動の修正

**修正日:** 2026-02-14
**報告者:** ando
**対応者:** リッキー 🐥

---

## 🔍 問題の症状

- トレーダーが頻繁に再起動（10回/1000行ログ）
- SIGTERMを受信してグレースフルシャットダウン
- チェック#30付近で自然終了するケースも

---

## 🐛 根本原因

### 1. systemdサービス設定の不備
```bash
CPUQuota=infinity  # ← 無効な設定値（systemdが警告）
Restart=always     # ← 正常終了でも再起動
RestartSec=10      # ← 10秒ごとに再起動
```

### 2. 二重管理の競合
- systemdが `Restart=always` で管理
- cronのwatchdogも5分ごとにチェック
- 両方が干渉して不安定化

### 3. SIGTERMの送信元
- systemdが再起動時にSIGTERMを送信
- トレーダーはグレースフルシャットダウンで終了
- systemdが10秒後に再起動（無限ループ）

---

## ✅ 修正内容

### 1. systemdサービスファイル修正

**変更前:**
```ini
CPUQuota=infinity
MemoryMax=infinity
Restart=always
RestartSec=10
```

**変更後:**
```ini
# CPUQuota削除（無効な設定）
LimitNOFILE=65536      # 適切なファイル数制限
LimitNPROC=4096        # 適切なプロセス数制限
Restart=on-failure     # 異常終了時のみ再起動
RestartSec=30          # 再起動間隔を30秒に延長
KillMode=mixed         # グレースフルシャットダウン優先
```

### 2. watchdogスクリプト調整

**変更点:**
- ログ更新停滞チェックを削除（systemdが管理）
- サービスが **完全停止した場合のみ** 起動
- systemdとの競合を回避

---

## 📊 期待される効果

1. **✅ 不要な再起動の削減**
   - 正常動作中は再起動しない
   - 異常終了時のみ自動復旧

2. **✅ systemdの安定性向上**
   - 無効な設定値を削除
   - 適切なリソース制限を設定

3. **✅ 管理の一本化**
   - systemdが主管理者
   - watchdogはバックアップのみ

---

## 🧪 検証方法

### 正常動作の確認
```bash
# サービス状態確認
systemctl status bitget-trader.service

# ログ確認（再起動メッセージがないこと）
tail -f /root/clawd/data/trader-v2.log

# watchdogログ確認
tail -f /root/clawd/data/watchdog.log
```

### 再起動回数の追跡
```bash
# 直近1000行でプロセス起動回数
tail -1000 /root/clawd/data/trader-v2.log | grep "Bitget自動トレーダー V2 起動中" | wc -l

# systemd再起動履歴
journalctl -u bitget-trader.service --since "1 hour ago" | grep "Started"
```

---

## 📝 運用ルール

### systemdサービス管理

- **起動:** `systemctl start bitget-trader.service`
- **停止:** `systemctl stop bitget-trader.service`
- **再起動:** `systemctl restart bitget-trader.service`
- **状態確認:** `systemctl status bitget-trader.service`

### 異常時の対応

1. サービスが頻繁に再起動する場合：
   ```bash
   journalctl -u bitget-trader.service -n 50
   ```
   で原因を確認

2. プロセスが完全停止した場合：
   - watchdogが自動起動（5分以内）
   - 手動起動も可能: `systemctl start bitget-trader.service`

3. 設定変更後：
   ```bash
   systemctl daemon-reload
   systemctl restart bitget-trader.service
   ```

---

## 🎯 今後の監視ポイント

- [ ] 24時間稼働での再起動回数確認
- [ ] メモリ使用量の推移監視
- [ ] SIGTERM受信頻度の確認
- [ ] watchdogログの異常検知

---

**修正完了:** 2026-02-14 11:03 UTC
**次回レビュー:** 2026-02-15 11:00 UTC（24時間後）
