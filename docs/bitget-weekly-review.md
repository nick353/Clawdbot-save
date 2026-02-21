# 週次トレーディングレビュー

## 📊 概要

毎週月曜日の朝9時（UTC 0時）に自動実行され、過去7日間のトレード履歴を分析して改善提案を生成します。

## 🎯 目的

- トレードパフォーマンスを定期的に評価
- データに基づいた改善提案を生成
- 効果の低い設定を早期に発見
- 継続的な最適化を実現

## 📋 分析内容

### 1. パフォーマンスサマリー
- トレード数
- 勝率
- 総損益
- 平均勝ち/負け
- 平均ホールド時間
- ベスト/ワーストトレード

### 2. エグジット理由別分析
- Stop Loss
- Take Profit
- Trailing Stop
- Max Hold Time

各理由ごとに：
- 回数
- 平均損益
- 効果の評価

### 3. 銘柄別分析
- トレード回数
- 勝率
- 総損益

パフォーマンスの悪い銘柄を特定。

### 4. ホールド時間別分析
- 0-30分
- 30-60分
- 1-2時間
- 2-4時間
- 4時間以上

各時間帯の勝率と平均損益を評価。

## 🔍 改善提案のロジック

### 最低データ要件
- トレード数 ≥ 10回

データが不足している場合は「現状維持」を推奨。

### トレイリングストップ
- **条件**: 勝率 < 60% または 平均損益 < 全体平均の80%
- **提案**: 発動タイミングを20%遅らせる
- **理由**: より大きな利益を狙う

### ストップロス
- **条件**: 平均損失が設定値の120%を超える
- **提案**: ストップロスを10%緩める
- **理由**: ノイズでの損切りを防ぐ

### 最大ホールド時間
- **条件**: 4時間以上のトレードの勝率 < 40%
- **提案**: 最大ホールド時間を20%短縮
- **理由**: 長時間損失を防ぐ

### 銘柄除外
- **条件**: 3回以上トレードして勝率 < 30% または 総損益 < -$50
- **提案**: 該当銘柄を監視リストから除外
- **理由**: 不採算トレードを削減

### 現状維持
- **条件**: 勝率 ≥ 55% かつ 総損益 > 0
- **提案**: 変更なし
- **理由**: 良好なパフォーマンス

## 📝 実装フロー

1. **自動レビュー実行**（毎週月曜日 9:00 JST / 0:00 UTC）
   ```bash
   python3 /root/clawd/scripts/weekly-trading-review.py
   ```

2. **レポート生成**
   - ファイル: `/root/clawd/data/weekly-review-YYYYMMDD.txt`
   - Discord通知: #bitget-trading チャンネル

3. **レビュー確認**
   - andoさんがレポートを確認
   - 改善提案がある場合、承認/却下を判断

4. **実装**
   - 承認された場合のみ実装
   - Google Sheets「Adjustment History」に記録

5. **効果測定**
   - 次回のレビューで効果を確認
   - 「実際の効果」列を更新

## 🛠️ 手動実行

即座にレビューを実行したい場合：

```bash
cd /root/clawd
python3 scripts/weekly-trading-review.py
```

## 📊 出力例

```
📊 **週次トレーディングレビュー**
期間: 2026-02-09 ～ 2026-02-16

**📈 パフォーマンスサマリー**
- トレード数: 15回
- 勝率: 60.0% (9勝6敗)
- 総損益: +$120.50
- 平均勝ち: +$45.00
- 平均負け: $-30.00
- 平均ホールド時間: 120分

**🎯 改善提案**
1. **trailing_stop_activation**
   現在: 1.5%
   提案: 1.8%
   理由: トレイリングストップの勝率が低い（55.0%）。発動を遅らせて利益を伸ばす。
   期待効果: 平均利益+$15.00
   信頼度: medium

2. **symbol_exclusion**
   現在: 15銘柄
   提案: 13銘柄
   理由: 勝率が低い銘柄を除外: LQTYUSDT, MANTAUSDT
   期待効果: 不採算トレードを削減
   信頼度: medium

**📝 実装は承認後に行います。**
```

## ⚙️ カスタマイズ

### レビュー頻度の変更

`crontab -e` で以下を編集：

```bash
# 毎週月曜日 0:00 UTC（デフォルト）
0 0 * * 1 cd /root/clawd && /usr/bin/python3 /root/clawd/scripts/weekly-trading-review.py

# 毎日 0:00 UTC
0 0 * * * cd /root/clawd && /usr/bin/python3 /root/clawd/scripts/weekly-trading-review.py

# 2週間ごと（隔週月曜日）
0 0 * * 1 [ $(expr $(date +\%W) \% 2) -eq 0 ] && cd /root/clawd && /usr/bin/python3 /root/clawd/scripts/weekly-trading-review.py
```

### 分析期間の変更

スクリプト内の `days` パラメータを変更：

```python
trades = load_recent_trades(days=14)  # 14日間に変更
```

### 改善提案の閾値調整

スクリプト内の各条件を調整：

```python
# トレイリングストップの閾値
if trailing_win_rate < 60:  # 60% → 70% など

# 最低トレード数
if perf['total_trades'] < 10:  # 10 → 20 など
```

## 📞 トラブルシューティング

### レビューが実行されない

```bash
# cronログを確認
tail -f /root/clawd/data/weekly-review.log

# cronジョブを確認
crontab -l | grep weekly

# 手動実行してエラー確認
cd /root/clawd && python3 scripts/weekly-trading-review.py
```

### Discord通知が届かない

```bash
# Clawdbotステータス確認
clawdbot status

# Discord設定確認
clawdbot config get | grep discord
```

## 📚 関連ドキュメント

- [Bitget自動トレーダー運用ガイド](/root/clawd/docs/bitget-auto-trading.md)
- [調整履歴（Google Sheets）](https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo)
- [バックテスト手順](/root/clawd/docs/bitget-backtest.md)

---

**最終更新**: 2026-02-16
