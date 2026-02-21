# Bitget自動トレーダー V2 機能一覧

## ✅ 実装済み機能

### 1. 基本機能
- ✅ 5銘柄監視（ZROUSDT, STGUSDT, MEUSDT, TNSRUSDT, OGUSDT）
- ✅ 5分足データ取得（250本）
- ✅ SMA/EMA 200反発戦略
- ✅ MACD + 出来高確認
- ✅ トレイリングストップ機能
- ✅ ペーパートレードモード

### 2. 記録機能
- ✅ CSV記録（/root/clawd/data/trade-log.csv）
- ✅ エントリー時刻、価格、理由
- ✅ エグジット時刻、価格、理由
- ✅ PnL（$・%）、勝敗判定
- ✅ 保有時間、トレイリングストップ使用有無
- ✅ 最高価格、資金推移

### 3. Discord通知機能 🆕
- ✅ エントリー時に即座に通知
  - 銘柄、価格、理由
  - ポジションサイズ
  - ストップロス、テイクプロフィット設定
- ✅ エグジット時に即座に通知
  - 銘柄、価格、理由
  - PnL（$・%）、勝敗
  - 保有時間、現在資金
- ✅ 通知先: Discord #bitget-trading (1471389526592327875)

### 4. Googleスプレッドシート同期機能 🆕
- ✅ エグジット後に自動同期
- ✅ Tradesシートにデータ追加（3行目から）
- ✅ Dashboard、Statistics、Charts自動更新
- ✅ URL: https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo

### 5. 最適化機能
- ✅ データ量削減（500本 → 250本）
- ✅ 銘柄数削減（9銘柄 → 5銘柄）
- ✅ 処理時間短縮（13.5秒 → 3秒以下）
- ✅ 安定動作（2回目以降のチェックでハングしない）

## 📊 動作フロー

### エントリー時
1. エントリー条件判定（SMA/EMA接近 + MACD + 出来高）
2. ポジション記録
3. Discord通知送信 🆕
4. ログ出力

### エグジット時
1. エグジット条件判定（ストップロス / テイクプロフィット / トレイリングストップ）
2. PnL計算
3. CSV記録
4. **Googleスプレッドシート同期** 🆕
5. **Discord通知送信** 🆕
6. ログ出力
7. ポジション削除

### チェックループ
1. 60秒ごとに全銘柄チェック
2. ポジションあり → エグジット判定
3. ポジションなし → エントリー判定
4. 次のチェックまで待機

## 🔧 設定

### Discord通知
- チャンネルID: `1471389526592327875`
- 設定ファイル: `/root/clawd/config/bitget-trading.json`

### Googleスプレッドシート
- スプレッドシートID: `19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo`
- 認証情報: `/root/.clawdbot/google-credentials.json`
- 同期スクリプト: `/root/clawd/scripts/sync-to-gsheet.py`

### ログ
- ログファイル: `/root/clawd/data/trader-v2.log`
- リアルタイム確認: `tail -f /root/clawd/data/trader-v2.log`

## 🚀 実行コマンド

### 起動
```bash
cd /root/clawd && nohup python3 -u scripts/bitget-trader-v2.py > /root/clawd/data/trader-v2.log 2>&1 &
```

### プロセス確認
```bash
ps aux | grep bitget-trader-v2.py | grep -v grep
```

### ログ確認
```bash
tail -f /root/clawd/data/trader-v2.log
```

### 停止
```bash
pkill -f bitget-trader-v2.py
```

## 📈 トレード戦略

### エントリー条件
1. **SMA/EMA接近**: 価格がSMA200またはEMA200に±2%以内
2. **MACD上抜け**: MACDがシグナルを上抜け
3. **出来高増加**: 現在出来高 > 出来高MA × 1.5倍

### エグジット条件
1. **ストップロス**: エントリー価格 -5%
2. **テイクプロフィット**: エントリー価格 +10%
3. **トレイリングストップ**: 
   - 発動: +5%利益達成時
   - 距離: 最高値 -3%

### リスク管理
- **ポジションサイズ**: 資金の10%
- **最大ポジション数**: 3
- **最大日次損失**: -$100
- **最大日次トレード数**: 20

## 🎯 今後の拡張（オプション）

- [ ] リアルトレードモード（要API設定）
- [ ] 複数時間足戦略
- [ ] 銘柄自動スクリーニング連携
- [ ] エラー通知（Discord）
- [ ] パフォーマンスレポート自動生成
- [ ] バックテスト機能
- [ ] パラメータ最適化
