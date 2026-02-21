# Bitget自動トレーダー V2 - 最終フロー

## 🎯 完成した全体フロー

### 📅 毎日自動スケジュール
```
毎日 UTC 0:00（日本時間 9:00）
    ↓
自動スクリーニング実行
    ↓
前日比+10%以上の銘柄を検出
    ↓
screener-results.json に保存
    ↓
自動トレーダーが読み込み
```

### 🔄 60秒ごとのチェックループ
```
60秒待機
    ↓
5銘柄のデータ取得（250本ローソク足）
    ↓
インジケーター計算（SMA/EMA 200, MACD, 出来高MA）
    ↓
【ポジションなし】
    ↓
エントリー条件判定
    ├─ SMA/EMA 200への接近（±2%以内）
    ├─ MACDゴールデンクロス
    └─ 出来高1.5倍以上
    ↓
【条件一致】
    ↓
エントリー実行
    ↓
Discord通知送信 🆕
    ├─ 銘柄、価格、理由
    ├─ ポジションサイズ
    └─ ストップロス/テイクプロフィット
    ↓
ログ出力
    ↓
60秒待機 → 繰り返し
```

### 📊 エグジット時のフロー
```
60秒ごとのチェック
    ↓
【ポジションあり】
    ↓
エグジット条件判定
    ├─ ストップロス（-5%）
    ├─ テイクプロフィット（+10%）
    └─ トレイリングストップ（+5%発動、-3%利確）
    ↓
【条件一致】
    ↓
エグジット実行
    ↓
PnL計算
    ↓
CSV記録
    ├─ /root/clawd/data/trade-log.csv
    └─ 全16項目を記録
    ↓
Googleスプレッドシート同期 🆕
    ├─ sync-to-gsheet.py 実行
    ├─ Tradesシートに3行目から追加
    ├─ Dashboard自動更新
    ├─ Statistics自動更新
    └─ Charts自動更新
    ↓
Discord通知送信 🆕
    ├─ 銘柄、価格、理由
    ├─ PnL（$・%）、勝敗
    ├─ 保有時間
    └─ 現在資金
    ↓
ポジション削除
    ↓
60秒待機 → 繰り返し
```

## 📋 完成した機能一覧

### ✅ 基本機能
- [x] 5銘柄監視（ZROUSDT, STGUSDT, MEUSDT, TNSRUSDT, OGUSDT）
- [x] 5分足データ取得（250本）
- [x] SMA/EMA 200反発戦略
- [x] MACD + 出来高確認
- [x] トレイリングストップ機能
- [x] ペーパートレードモード

### ✅ 記録機能
- [x] CSV記録（/root/clawd/data/trade-log.csv）
- [x] 16項目記録（エントリー/エグジット時刻、価格、理由、PnL、保有時間など）

### ✅ Discord通知機能 🆕
- [x] エントリー時に即座に通知
  - 銘柄、価格、理由
  - ポジションサイズ
  - ストップロス、テイクプロフィット設定
- [x] エグジット時に即座に通知
  - 銘柄、価格、理由
  - PnL（$・%）、勝敗
  - 保有時間、現在資金
- [x] 通知先: Discord #bitget-trading (1471389526592327875)

### ✅ Googleスプレッドシート同期機能 🆕
- [x] エグジット後に自動同期
- [x] Tradesシートにデータ追加（3行目から）
- [x] Dashboard、Statistics、Charts自動更新
- [x] スプレッドシートID: 19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo
- [x] URL: https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo

### ✅ 自動スケジュール
- [x] 毎日UTC 0:00（日本時間9:00）に自動スクリーニング
- [x] cronジョブ設定済み
- [x] 検出銘柄を自動で監視リストに反映

### ✅ 最適化機能
- [x] データ量削減（500本 → 250本）
- [x] 銘柄数削減（9銘柄 → 5銘柄）
- [x] 処理時間短縮（13.5秒 → 3秒以下）
- [x] 安定動作（2回目以降のチェックでハングしない）

### ❌ 無効化機能
- [ ] スクリーンショット機能（ハング原因のため無効化）

## 🚀 運用状況

### 現在の稼働状態
- **プロセスID**: 93361
- **稼働時間**: 約7分
- **チェック回数**: 5回完了
- **状態**: 🟢 正常稼働中

### ログファイル
- **ログ**: /root/clawd/data/trader-v2.log
- **確認コマンド**: `tail -f /root/clawd/data/trader-v2.log`

### 記録ファイル
- **CSV**: /root/clawd/data/trade-log.csv（ヘッダー行のみ、トレード待ち）
- **スクリーニング結果**: /root/clawd/data/screener-results.json

## 🎯 トレード戦略

### エントリー条件（全て必須）
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

## 📱 トレード発生時の動作

### エントリー時（自動）
1. ポジションオープン
2. **Discord通知送信** 🆕
   ```
   🟢 エントリー
   
   銘柄: XXXUSDT
   価格: $X.XXXXXX
   理由: SMA/EMA反発 + MACD上抜け + 出来高増
   ポジションサイズ: $XXX.XX (10%)
   ストップロス: $X.XXXXXX (-5%)
   テイクプロフィット: $X.XXXXXX (+10%)
   ```
3. ログ出力

### エグジット時（自動）
1. ポジションクローズ
2. PnL計算
3. CSV記録
4. **Googleスプレッドシート同期** 🆕
   - Tradesシートに3行目から追加
   - Dashboard、Statistics、Charts自動更新
5. **Discord通知送信** 🆕
   ```
   🔴 エグジット
   
   銘柄: XXXUSDT
   価格: $X.XXXXXX
   理由: Take Profit / Stop Loss / Trailing Stop
   PnL: $XX.XX (+X.XX%) ✅ Win / ❌ Loss
   保有時間: XX分
   現在資金: $X,XXX.XX
   ```
6. ポジション削除

## 🔧 管理コマンド

### ログ確認（リアルタイム）
```bash
tail -f /root/clawd/data/trader-v2.log
```

### プロセス確認
```bash
ps aux | grep bitget-trader-v2.py | grep python3
```

### 停止
```bash
pkill -f bitget-trader-v2.py
```

### 再起動
```bash
cd /root/clawd && nohup python3 -u scripts/bitget-trader-v2.py > /root/clawd/data/trader-v2.log 2>&1 &
```

### CSV確認
```bash
cat /root/clawd/data/trade-log.csv
```

### スクリーニング結果確認
```bash
cat /root/clawd/data/screener-results.json | jq
```

## 📊 Googleスプレッドシート構成

### シート構成
1. **Dashboard**（ダッシュボード）
   - 総合成績サマリー
   - 総トレード数、勝率、総PnL、現在資金
   - 最近のトレード（直近5件）

2. **Trades**（トレード記録）
   - 全トレードの詳細記録（16項目）
   - 3行目以降にデータ自動追加
   - Win/Loss色分け（緑/赤）

3. **Statistics**（統計）
   - 銘柄別成績（自動集計）
   - エグジット理由別統計（自動集計）
   - 日別PnL（自動集計）

4. **Charts**（グラフ）
   - 資金推移グラフ（折れ線）
   - 日別PnL推移グラフ（棒）
   - 銘柄別PnL比較グラフ（横棒）

### 完全自動連携
```
Tradesシートに1行追加
    ↓
Dashboard自動更新
    ↓
Statistics自動更新（銘柄別、理由別、日別）
    ↓
Charts自動更新（3つのグラフ）
```

## 🎯 推奨確認頻度

### 毎日のルーティン
- **朝（日本時間9時以降）**: Dashboardで総合成績確認
- **トレード発生時**: Discord通知 → Tradesシートで詳細確認
- **週末**: Statisticsで振り返り
- **月末**: Chartsでトレンド確認

## 📈 バックテスト実績

### 過去の実績（5分足、RSI削除版）
- **トレード数**: 6
- **勝率**: 83.3%（5勝1敗）
- **総PnL**: $245.09 (+2.45%)
- **トップ3**: 
  - JASMYUSDT: +$100
  - CYBERUSDT: +$65.74
  - TNSRUSDT: +$64.28

### 戦略の特徴
- **高品質重視**: 条件が厳しいため、トレード頻度は低い
- **高勝率**: 83.3%の勝率を維持
- **トレイリングストップ**: 5銘柄中5銘柄で機能

## 🚨 注意事項

### トレード頻度
- **予想**: 1日あたり1トレード程度
- **理由**: エントリー条件が厳しい（高品質重視）
- **バックテスト**: 約7日間で6トレード

### 待機時間
- 最初のトレードは数時間〜1日かかる可能性
- 条件が揃うまで自動で待機

### エラー時の対応
1. プロセス停止確認: `ps aux | grep bitget-trader-v2.py`
2. ログ確認: `tail -100 /root/clawd/data/trader-v2.log`
3. 再起動: 上記の再起動コマンド実行

## 🎉 完成！

全ての機能が実装され、完全自動運用が開始されましたっぴ！

- ✅ 5銘柄監視（最適化済み）
- ✅ 60秒ごと自動チェック
- ✅ Discord通知（エントリー/エグジット）
- ✅ Googleスプレッドシート自動同期
- ✅ CSV記録（Excel対応）
- ✅ 毎日自動スクリーニング
- ✅ 完全自動連携

---

**URL:** https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo

**PID:** 93361

**ログ:** /root/clawd/data/trader-v2.log

**CSV:** /root/clawd/data/trade-log.csv
