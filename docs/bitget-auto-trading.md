# Bitget自動トレーディング - 運用ガイド

## 📋 概要

5分足SMA/EMA 200反発戦略による自動トレーディングシステム。

### 戦略:
- SMA/EMA 200への接近（±2%）
- 価格反発確認
- MACDゴールデンクロス
- 出来高急増フィルター（1.5倍以上）
- トレイリングストップ（+5%で有効化、-3%で利確）

### 銘柄選定:
- 日足で前日比+10%以上の銘柄のみ
- 毎日UTC 0:00（日本時間9:00）に自動スクリーニング

---

## 🚀 初回セットアップ

### 1. セットアップスクリプト実行

```bash
bash /root/clawd/scripts/setup-auto-trading.sh
```

これにより:
- スクリプト権限設定
- cronジョブ設定（毎日UTC 0:00にスクリーニング）
- ディレクトリ準備

### 2. 初回スクリーニング実行

```bash
bash /root/clawd/scripts/daily-screening.sh
```

結果: `/root/clawd/data/screener-results.json`

---

## 💰 自動トレーダー起動

### ペーパートレードモード（推奨）

```bash
cd /root/clawd
python3 scripts/bitget-auto-trader.py
```

### 停止

`Ctrl+C` で停止

---

## 📊 トレード記録

### 記録ファイル

- **CSV**: `/root/clawd/data/trade-log.csv`
- **Googleスプレッドシート**: https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo/edit
- Excelで開けます

### 📸 スクリーンショット機能

**エントリー時に自動でチャートスクリーンショット撮影:**
- Bitgetチャートを自動で開く
- スクリーンショット撮影
- `/root/clawd/data/screenshots/` に保存
- 備考欄にファイルパス記録

### 記録内容

| 項目 | 説明 |
|------|------|
| Entry Time | エントリー日時 |
| Exit Time | エグジット日時 |
| Symbol | 銘柄 |
| Entry Price | エントリー価格 |
| Exit Price | エグジット価格 |
| Quantity | 数量 |
| PnL ($) | 損益（ドル） |
| PnL (%) | 損益（%） |
| Win/Loss | 勝敗 |
| Entry Reason | エントリー理由 |
| Exit Reason | エグジット理由 |
| Hold Time (min) | 保有時間（分） |
| Trailing Stop Used | トレイリングストップ使用 |
| Highest Price | 最高価格 |
| Capital After | 資金残高 |
| Notes | 備考 |

---

## 📈 分析ツール

### トレード分析レポート

```bash
python3 /root/clawd/scripts/analyze-trades.py
```

表示内容:
- 総合成績（勝率、総PnL、平均PnLなど）
- 銘柄別成績
- エグジット理由別統計
- トレイリングストップ効果
- ポジション保有時間
- 日別PnL

### Excel出力（オプション）

```bash
# openpyxlインストール
pip install openpyxl

# Excel出力
python3 /root/clawd/scripts/analyze-trades.py --excel
```

出力: `/root/clawd/data/trade-analysis.xlsx`

---

## ⏰ スケジュール

### 毎日の流れ

1. **UTC 0:00（日本時間 9:00）**: 自動スクリーニング実行
2. **スクリーニング完了後**: トレード対象銘柄更新
3. **自動トレーダー**: 60秒ごとに監視・エントリー・エグジット判定

### 手動スクリーニング

cronジョブとは別に、いつでも手動実行可能:

```bash
bash /root/clawd/scripts/daily-screening.sh
```

---

## 🛠️ 設定ファイル

### `/root/clawd/config/bitget-trading.json`

```json
{
  "paper_trade": true,
  "initial_capital": 10000.0,
  "discord_channel": "1471389526592327875",
  "strategy": {
    "sma_period": 200,
    "ema_period": 200,
    "proximity_pct": 2.0,
    "stop_loss_pct": 5.0,
    "take_profit_pct": 10.0,
    "position_size_pct": 10.0,
    "volume_multiplier": 1.5,
    "trailing_stop_activation": 5.0,
    "trailing_stop_distance": 3.0
  },
  "timeframe": "5m",
  "check_interval": 60
}
```

### パラメータ説明

| パラメータ | 説明 | デフォルト |
|-----------|------|-----------|
| `paper_trade` | ペーパートレードモード | true |
| `initial_capital` | 初期資金 | $10,000 |
| `proximity_pct` | SMA/EMA接近判定（%） | 2.0 |
| `stop_loss_pct` | ストップロス（%） | 5.0 |
| `take_profit_pct` | テイクプロフィット（%） | 10.0 |
| `position_size_pct` | ポジションサイズ（%） | 10.0 |
| `volume_multiplier` | 出来高フィルター倍率 | 1.5 |
| `trailing_stop_activation` | トレイリングストップ有効化（%） | 5.0 |
| `trailing_stop_distance` | トレイリングストップ距離（%） | 3.0 |

---

## 🔔 Discord通知（今後実装予定）

トレード実行時にDiscord #bitget-tradingへ自動通知:
- エントリー通知
- エグジット通知
- 日次サマリー

---

## ⚠️ 注意事項

### ペーパートレードモード

- **実際のお金は動きません**
- バックテスト同様のシミュレーション
- 本番運用前に十分テスト

### リアルトレードモード

1. Bitget APIキー設定が必要
2. `paper_trade: false` に変更
3. **十分なテスト後に実行**

---

## 🔄 Googleスプレッドシート同期

### セットアップ（初回のみ）

1. **Google Cloud Consoleでサービスアカウント作成**
   - https://console.cloud.google.com/
   - 「IAMと管理」→「サービスアカウント」
   - 新しいサービスアカウント作成
   - 「キー」→「JSON」をダウンロード

2. **認証情報を配置**
   ```bash
   mkdir -p ~/.clawdbot
   # ダウンロードしたJSONを配置
   cp ~/Downloads/your-key.json ~/.clawdbot/google-credentials.json
   ```

3. **スプレッドシートに共有権限付与**
   - スプレッドシートを開く
   - 「共有」ボタン
   - サービスアカウントのメールアドレス追加（編集権限）

### 同期実行

```bash
# 手動同期
python3 /root/clawd/scripts/sync-to-gsheet.py

# 自動同期（トレード後に自動実行）
# 自動トレーダーに組み込み済み
```

### Googleスプレッドシート

- **URL**: https://docs.google.com/spreadsheets/d/19QcpMmopW_pkixdFDDx0edO1Jhw7kUGfPc8uirTUODo/edit
- **シート名**: `Trades`
- **自動更新**: エグジット時に自動同期

---

## 📸 スクリーンショット機能

### テスト実行

```bash
bash /root/clawd/scripts/test-screenshot.sh
```

成功すると:
- `/root/clawd/data/screenshots/` にPNG画像保存
- Bitgetチャートのスクリーンショット

### スクリーンショット保存場所

```
/root/clawd/data/screenshots/
├── 20260212_073000_BTCUSDT.png
├── 20260212_091500_JASMYUSDT.png
└── ...
```

### 備考欄の形式

```
Screenshot: /root/clawd/data/screenshots/20260212_073000_BTCUSDT.png
```

---

## 📁 ファイル構成

```
/root/clawd/
├── config/
│   └── bitget-trading.json          # 設定ファイル
├── data/
│   ├── screener-results.json        # スクリーニング結果
│   ├── trade-log.csv                # トレード記録（Excel対応）
│   ├── trade-analysis.xlsx          # 分析レポート（オプション）
│   └── screenshots/                 # チャートスクリーンショット
│       ├── 20260212_073000_BTCUSDT.png
│       └── ...
├── scripts/
│   ├── bitget-screener.py           # スクリーニングツール
│   ├── bitget-auto-trader.py        # 自動トレーダー（スクショ機能付き）
│   ├── daily-screening.sh           # 毎日スクリーニング
│   ├── analyze-trades.py            # 分析ツール
│   ├── sync-to-gsheet.py            # Googleスプレッドシート同期
│   ├── test-screenshot.sh           # スクリーンショットテスト
│   └── setup-auto-trading.sh        # セットアップスクリプト
├── logs/
│   └── screening.log                # スクリーニングログ
└── docs/
    └── bitget-auto-trading.md       # このドキュメント
```

---

## 🆘 トラブルシューティング

### スクリーニング結果が空

```bash
# 手動でスクリーニング実行
bash /root/clawd/scripts/daily-screening.sh
```

### トレードが発生しない

- スクリーニング結果を確認
- 条件が厳しすぎる可能性（出来高フィルターなど）
- ログで詳細確認

### cronジョブが動かない

```bash
# cronジョブ確認
crontab -l

# 手動で再設定
bash /root/clawd/scripts/setup-auto-trading.sh
```

---

## 📞 サポート

質問・問題があれば、Discord #bitget-tradingで報告してくださいっぴ！🐥
