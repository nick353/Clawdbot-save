# サブエージェント活用例

## 1. バックテストの分離

### Before（メインセッションで実行）
```python
# 直接実行 → メインセッションで大量出力
python3 scripts/crypto-backtest-multiframe-v2.py
```

### After（サブエージェントで実行）
```python
# sessions_spawn で別セッション起動
sessions_spawn(
    task="仮想通貨バックテスト（5分足、1時間足、4時間足、日足）を実行して、結果をサマリーで報告してください",
    label="crypto-backtest",
    cleanup="delete",  # 完了後に自動削除
    runTimeoutSeconds=600  # 10分でタイムアウト
)
```

**結果:**
- サブエージェントが全ての処理を実行
- 完了後、結果のみメインセッションに報告
- サブエージェントのセッションは自動削除（cleanup="delete"）

---

## 2. 長時間監視タスク

### Bitgetトレーダー（現在の問題）
```bash
# メインセッションで実行 → 永遠に出力
python3 scripts/bitget-trader.py
```

**問題:**
- 1時間ごとにレポート → メインセッション肥大化
- エントリー条件一致時の通知 → メインセッションに蓄積

### サブエージェント版
```python
sessions_spawn(
    task="Bitgetトレーダーを24時間監視し、エントリー条件一致時のみDiscord #bitget-tradingに通知してください",
    label="bitget-trader-monitor",
    cleanup="keep"  # 長期実行のため保持
)
```

**効果:**
- メインセッション: 起動メッセージのみ（100トークン）
- 監視セッション: 全ての出力を保持（別カウント）
- 通知は #bitget-trading に直接送信

---

## 3. 定期レポート生成

### 毎日のリサーチ（現在）
```bash
# cron で実行 → Discord #一般に大量投稿
/root/clawd/scripts/daily-research.sh
```

### サブエージェント版
```python
# cron から sessions_spawn 経由で起動
sessions_spawn(
    task="今日のClawdbot関連トレンドをリサーチして、#aiチャンネルに投稿してください",
    label="daily-research",
    cleanup="delete"
)
```

**効果:**
- メインセッション: 無関係
- リサーチセッション: 完了後に自動削除

---

## 使い分けガイド

### **メインセッションで実行:**
- 短い会話
- 簡単なファイル操作
- 即座に結果が必要なタスク

### **サブエージェントで実行:**
- バックテスト（大量の出力）
- 長時間監視（Bitgetトレーダー）
- 定期レポート生成
- 複雑な分析（多段階処理）

---

## 期待される効果

### トークン削減:
- バックテスト: 99%削減（メインセッションから）
- 長時間監視: 95%削減
- 定期レポート: 100%削減（メインセッション無関係）

### コスト削減:
- サブエージェントは独立したセッション
- cleanup="delete" で使い捨て → 長期的なコスト増加なし
- メインセッションの寿命が延びる → プロンプトキャッシュ効率向上
