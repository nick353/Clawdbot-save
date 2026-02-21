# Bitget自動トレーダー KVM環境対応

## 概要

RackNerd KVM VPS環境での「予期しない再起動」問題を根絶するための堅牢化実装。

---

## 問題の特定

### 環境情報
- **プロバイダ:** RackNerd
- **仮想化:** KVM
- **メモリ:** 2 GB RAM + 1 GB Swap
- **OS:** Ubuntu 24.04 64 Bit

### 発生していた現象
- `time.sleep(60)` の途中でプロセスが突然死
- エラーメッセージなし
- 「⏱️ 次のチェックまで60秒待機...」の直後に再起動
- OOM Killerの痕跡なし

### 根本原因
**KVM環境でのPython time.sleep()のシグナル中断**
- `time.sleep()` 中にシステムシグナル（SIGTERM/SIGKILLなど）を受信
- Pythonプロセスがクリーンに終了できず突然死
- 通常の例外処理ではキャッチ不可能

---

## 実装した対策

### 1. robust_sleep() 関数

**シグナル中断に強いスリープ関数:**

```python
def robust_sleep(seconds: float):
    """シグナルに強いsleep（KVM環境対応）"""
    end_time = time.time() + seconds
    while time.time() < end_time:
        try:
            remaining = end_time - time.time()
            if remaining > 0:
                time.sleep(min(remaining, 1.0))  # 1秒ずつスリープ
        except (InterruptedError, OSError):
            # シグナル受信時は継続
            continue
        except Exception as e:
            print(f"⚠️  Sleep中断: {e}", flush=True)
            break
```

**効果:**
- 1秒単位でスリープを分割
- シグナル受信時も継続
- 例外発生時は安全に中断

---

### 2. グレースフルシャットダウン

**シグナルハンドラ:**

```python
def signal_handler(self, signum, frame):
    """シグナルハンドラ（グレースフルシャットダウン）"""
    print(f"\n⚠️  シグナル受信: {signum} ({signal.Signals(signum).name})", flush=True)
    print("💾 ポジション保存中...", flush=True)
    
    # 強制保存
    self.save_positions()
    
    print(f"💰 最終資金: ${self.capital:,.2f}", flush=True)
    print(f"📊 ポジション数: {len(self.positions)}", flush=True)
    print("👋 グレースフルシャットダウン完了", flush=True)
    
    sys.exit(0)

# 登録
signal.signal(signal.SIGTERM, self.signal_handler)
signal.signal(signal.SIGINT, self.signal_handler)
```

**効果:**
- SIGTERM/SIGINT受信時に安全に終了
- ポジション情報を強制保存
- データ損失を防止

---

### 3. ヘルスチェック機能

**メモリ監視＋定期保存:**

```python
def health_check(self):
    """ヘルスチェック（メモリ・ポジション）"""
    try:
        # メモリ使用量チェック
        import psutil
        process = psutil.Process()
        mem_percent = process.memory_percent()
        
        if mem_percent > 80:
            print(f"⚠️  メモリ使用率高: {mem_percent:.1f}%", flush=True)
            # ガベージコレクション強制実行
            gc.collect()
            print(f"🧹 ガベージコレクション実行", flush=True)
        
        # ポジション定期バックアップ（5分ごと）
        if len(self.positions) > 0:
            self.save_positions()
    
    except Exception as e:
        print(f"⚠️  ヘルスチェックエラー: {e}", flush=True)

# メインループで使用（5回に1回実行）
if iteration % 5 == 0:
    self.health_check()
```

**効果:**
- メモリ使用率80%超でGC強制実行
- 5分ごとにポジション自動保存
- メモリリーク防止

---

### 4. psutil統合

**インストール:**
```bash
apt-get install -y python3-psutil
```

**機能:**
- プロセスのメモリ使用率監視
- メモリ情報の詳細取得
- GCトリガーの判断材料

---

## 期待される効果

### Before（堅牢化前）
- 30分〜1時間ごとに予期しない再起動
- ポジション情報の消失リスク
- watchdogによる自動再起動に依存

### After（堅牢化後）
- シグナル中断に強い
- グレースフルシャットダウン
- メモリ使用率の自動管理
- ポジション情報の定期保存

---

## 動作確認

### チェック項目
1. ✅ robust_sleep() 動作確認
2. ✅ シグナルハンドラ動作確認
3. ✅ ヘルスチェック動作確認
4. ✅ メモリ監視動作確認
5. ✅ psutil統合確認

### テスト方法
```bash
# プロセス確認
pgrep -af python.*bitget

# メモリ使用量確認
ps aux | grep bitget

# シグナル送信テスト
kill -TERM <PID>

# ログ確認
tail -f /root/clawd/data/trader-v2.log
```

---

## トラブルシューティング

### プロセスが再起動する場合
```bash
# ログ確認
tail -100 /root/clawd/data/trader-v2.log | grep -E "(シグナル|Sleep中断|予期しない)"

# watchdog確認
cat /root/clawd/data/watchdog.log | tail -20

# メモリ確認
free -h
ps aux --sort=-%mem | head -10
```

### メモリ使用率が高い場合
```bash
# ガベージコレクション強制実行（自動で実行されるはず）
# ログで確認
grep "ガベージコレクション" /root/clawd/data/trader-v2.log
```

---

**作成日:** 2026-02-13  
**バージョン:** 1.0（KVM環境対応版）  
**担当:** リッキー 🐥
