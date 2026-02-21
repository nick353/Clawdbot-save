# 自動モデルルーティング設定

## 🎯 チャンネル別デフォルトモデル

### **Haiku（軽量・低コスト）を使うチャンネル:**
- `#bitget-trading` - 監視・通知専用
- `heartbeat` - ヘルスチェック専用
- `#sns` - SNS投稿（軽量タスク）

### **Sonnet（高性能）を使うチャンネル:**
- `#一般` - 通常会話・開発作業
- `#ai` - AI研究・実験

---

## 📋 設定方法

### 1. チャンネルごとのモデル設定

```json
{
  "channels": {
    "discord": {
      "guilds": {
        "1464650062952005644": {
          "channels": {
            "1471389526592327875": {
              "model": "anthropic/claude-3-5-haiku-20241022"
            }
          }
        }
      }
    }
  }
}
```

### 2. セッションごとのモデル固定

#### heartbeat → Haiku
```bash
# セッションキー: agent:main:main
# デフォルトモデル: haiku
```

#### #bitget-trading → Haiku
```bash
# チャンネルID: 1471389526592327875
# デフォルトモデル: haiku
```

---

## 🔄 手動切り替え

一時的に高性能モデルが必要な場合:

```
/model sonnet
```

元に戻す:

```
/model haiku
```

---

## 📊 期待される効果

### Before（全てSonnet）
- 1日のトークン使用量: ~500k
- 1日のコスト: ~$7.50

### After（自動切り替え）
- **heartbeat（Haiku）**: ~50k → ~12k（75%削減）
- **#bitget-trading（Haiku）**: ~100k → ~25k（75%削減）
- **#一般（Sonnet）**: ~350k（変更なし）

**合計削減:**
- トークン: 500k → 387k（**22%削減**）
- コスト: $7.50 → $5.25（**30%削減**）

---

## ⚙️ 適用方法

設定ファイルに追記:

```bash
# ~/.clawdbot/clawdbot.json に追加
```

再起動:

```bash
clawdbot gateway restart
```
