# SNS Growth Tracker - 完全自動化システム

## 🎯 概要

andoさんがDiscordの#sns-投稿チャンネルに画像・動画を投稿するだけで、全処理が自動実行されます。

## 🔄 自動処理フロー

```
1. Discord投稿検知（ハートビート毎）
   ↓
2. 画像・動画を自動ダウンロード（リトライ機能付き）
   ↓
3. Gemini APIで内容分析
   ↓
4. 各SNS向けキャプション自動生成
   ↓
5. 5つのSNSに自動投稿
   - Instagram
   - Threads
   - Facebook
   - Pinterest
   - X (Twitter)
   ↓
6. Google Sheetsに自動記録
   ↓
7. Discord に完了通知
```

## 📁 ファイル構成

```
/root/clawd/skills/sns-growth-tracker/
├── README-AUTO-DETECTION.md       # このファイル
├── SKILL.md                       # スキル説明
├── config.json                    # 設定ファイル
├── setup-auto-detection.sh        # セットアップスクリプト
├── run-trend-monitor.sh           # トレンド監視実行
├── run-weekly-analysis.sh         # 週次分析実行
├── scripts/
│   ├── watch-discord-posts.py     # 🆕 Discord投稿自動検知
│   ├── main-workflow.py           # メインワークフロー統合
│   ├── analyze-image.py           # Gemini画像分析
│   ├── generate-captions.py       # キャプション生成
│   ├── post-to-sns.py             # SNS投稿
│   ├── record-to-sheets.py        # Google Sheets記録
│   ├── trend-monitor.py           # トレンド監視
│   ├── experiment-planner.py      # 実験計画
│   ├── learning-engine.py         # 学習エンジン
│   └── weekly-analysis.py         # 週次分析
└── data/
    ├── downloads/                 # ダウンロードした画像・動画
    ├── media/                     # バックアップメディア
    ├── logs/                      # 処理ログ
    ├── trends/                    # トレンドデータ
    ├── experiments/               # 実験ログ
    ├── reports/                   # 週次レポート
    └── processed_messages.json    # 処理済みメッセージID
```

## 🔧 セットアップ

### 1. 初期セットアップ

```bash
bash /root/clawd/skills/sns-growth-tracker/setup-auto-detection.sh
```

### 2. 環境変数（既に設定済み）

```bash
# ~/.profile に追加済み
export GEMINI_API_KEY="your-api-key"
export SNS_SHEETS_ID="your-google-sheets-id"
```

### 3. Google認証情報（既に配置済み）

```bash
# サービスアカウントキーが必要
/root/clawd/skills/sns-growth-tracker/google-credentials.json
```

## 🚀 使い方

### andoさんの操作（超シンプル！）

1. Discordの#sns-投稿チャンネルを開く
2. 画像または動画ファイルを添付して投稿
3. 待つだけ！

リッキーが自動的に：
- ダウンロード
- 分析
- キャプション生成
- SNS投稿
- シート記録
- 完了通知

をすべて実行します。

### 処理時間の目安

- ダウンロード: 5〜10秒
- Gemini分析: 30秒
- キャプション生成: 10秒
- SNS投稿: 60秒
- Google Sheets記録: 5秒
- **合計: 約2分**

## 📊 自動スケジュール

### ハートビート毎（リアルタイム監視）
```bash
python3 /root/clawd/skills/sns-growth-tracker/scripts/watch-discord-posts.py
```

### 毎日09:00 UTC（トレンド監視）
```bash
bash /root/clawd/skills/sns-growth-tracker/run-trend-monitor.sh
```

### 毎週月曜08:00 UTC（週次分析）
```bash
bash /root/clawd/skills/sns-growth-tracker/run-weekly-analysis.sh
```

## 🛡️ エラーハンドリング

### ダウンロード失敗
- 自動リトライ: 3回
- リトライ間隔: 指数バックオフ（2秒 → 4秒 → 8秒）
- 最終的に失敗したらDiscordに通知

### 処理タイムアウト
- タイムアウト: 5分
- タイムアウト時はDiscordに通知

### 予期しないエラー
- スタックトレースをログに記録
- Discordに通知
- 処理を中断（次の投稿には影響しない）

## 📝 ログ

### ログファイル
```bash
/root/clawd/skills/sns-growth-tracker/data/logs/watcher-YYYYMMDD.log
```

### ログ形式
```
[2026-02-15 12:34:56] [INFO] 新しい投稿をチェック中...
[2026-02-15 12:34:58] [INFO] 新しい投稿を1件検知しました
[2026-02-15 12:34:59] [INFO] 投稿処理開始: POST-20260215-123459-abc12345
[2026-02-15 12:35:01] [INFO] ダウンロード中: image.jpg
[2026-02-15 12:35:05] [INFO] ダウンロード完了: /root/clawd/skills/sns-growth-tracker/data/downloads/POST-20260215-123459-abc12345.jpg
[2026-02-15 12:35:06] [INFO] メインワークフローを実行中...
[2026-02-15 12:37:15] [INFO] 投稿処理完了: POST-20260215-123459-abc12345
```

## 🔍 手動テスト

### 投稿検知をテスト
```bash
python3 /root/clawd/skills/sns-growth-tracker/scripts/watch-discord-posts.py
```

### メインワークフローをテスト
```bash
python3 /root/clawd/skills/sns-growth-tracker/scripts/main-workflow.py /path/to/image.jpg TEST-001
```

## 📋 Discord設定

- **チャンネルID**: 1470060780111007950 (#sns-投稿)
- **andoさんのユーザーID**: 802126034631393320
- **通知先**: 同じチャンネル

## 🎯 通知メッセージ

### 成功時
```
✅ 投稿処理完了っぴ！

📝 投稿ID: POST-20260215-123459-abc12345
📊 分析・投稿・記録が完了しました
🔗 Google Sheetsで詳細を確認できますっぴ！
```

### エラー時
```
❌ 処理エラー（POST-20260215-123459-abc12345）
```
エラー詳細
```
```

## 🔄 処理済みメッセージ管理

### 処理済みメッセージID
```bash
/root/clawd/skills/sns-growth-tracker/data/processed_messages.json
```

### フォーマット
```json
[
  "1234567890123456789",
  "9876543210987654321"
]
```

### リセット方法（必要な場合）
```bash
echo "[]" > /root/clawd/skills/sns-growth-tracker/data/processed_messages.json
```

## 🚨 トラブルシューティング

### 投稿が検知されない
1. ハートビートが動いているか確認
2. ログファイルを確認
3. 処理済みメッセージファイルを確認

### ダウンロードが失敗する
1. Discord APIの接続を確認
2. ログでエラー詳細を確認
3. 手動でダウンロードできるか確認

### Gemini分析が失敗する
1. `GEMINI_API_KEY` が設定されているか確認
2. APIクォータを確認
3. 画像ファイルが破損していないか確認

### Google Sheets記録が失敗する
1. `SNS_SHEETS_ID` が正しいか確認
2. Google認証情報ファイルが存在するか確認
3. シートのアクセス権限を確認

## 📈 今後の拡張

- [ ] エンゲージメント自動取得（API実装後）
- [ ] リアルタイム投稿（ハートビート待ちなし）
- [ ] 投稿予約機能
- [ ] 複数画像投稿対応（カルーセル）
- [ ] 動画の自動圧縮・最適化

---

**作成日**: 2026-02-15  
**作成者**: リッキー 🐥  
**バージョン**: 1.0.0
