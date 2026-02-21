# SNS Growth Tracker - エンゲージメント自動取得システム

## 📋 概要

このシステムは、各SNS（Instagram, X, Threads, Facebook, Pinterest）にブラウザ自動化でログインし、エンゲージメント数値をスクレイピングして、Google Sheetsに自動記録します。

## 🎯 機能

### 自動取得されるデータ

- **Instagram**: いいね、コメント、保存、シェア、リーチ
- **X (Twitter)**: いいね、リツイート、返信、インプレッション
- **Threads**: いいね、リポスト、返信、表示回数
- **Facebook**: いいね、コメント、シェア、リーチ
- **Pinterest**: 保存、クリック、インプレッション

### 自動スケジュール

投稿後の3つのタイミングで自動取得：

1. **24時間後** - 初期反応の確認
2. **48時間後** - 拡散の状況確認
3. **7日後** - 最終的な成果測定

## 🔧 セットアップ

### 1. 依存関係のインストール

```bash
cd /root/clawd/skills/sns-growth-tracker

# 仮想環境とPlaywrightをインストール
python3 -m venv venv
source venv/bin/activate
pip install playwright google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
playwright install chromium
```

### 2. 各SNSへのログイン（初回のみ）

```bash
./setup-login.sh
```

このスクリプトは以下を実行します：

- 各SNSへのブラウザを開く
- 手動でログイン
- クッキーを `/root/clawd/skills/sns-growth-tracker/data/cookies/` に保存

**注意:** ログインは1回だけ必要です。クッキーが保存されるため、次回以降は自動ログインします。

### 3. HEARTBEAT設定

`/root/clawd/HEARTBEAT.md` に以下が追加されています：

```bash
echo "📊 エンゲージメント自動取得をチェック..."
/root/clawd/skills/sns-growth-tracker/run-engagement-check.sh
```

ハートビート時（30分ごと）に自動実行されます。

## 📝 使い方

### 投稿をスケジュールに追加

```bash
cd /root/clawd/skills/sns-growth-tracker
source venv/bin/activate

python3 scripts/schedule-engagement-tracking.py add \
    POST-20260215-001 \
    Instagram \
    "https://www.instagram.com/p/ABC123/"
```

**パラメータ:**
- `POST-ID`: 投稿ID（投稿マスターと同じID）
- `PLATFORM`: プラットフォーム名（Instagram, X, Threads, Facebook, Pinterest）
- `POST-URL`: 投稿URL

### スケジュール確認

```bash
python3 scripts/schedule-engagement-tracking.py list
```

**出力例:**

```
📅 エンゲージメント追跡スケジュール:

投稿ID: POST-20260215-001
プラットフォーム: Instagram
投稿日時: 2026-02-15T10:30:00
URL: https://www.instagram.com/p/ABC123/
追跡ポイント:
  - 24時間後: ⏰ 待機中 (あと12.5時間)
  - 48時間後: ⏰ 待機中 (あと36.5時間)
  - 168時間後: ⏰ 待機中 (あと160.5時間)
```

### 手動でエンゲージメント取得（テスト用）

```bash
python3 scripts/get-engagement.py \
    Instagram \
    "https://www.instagram.com/p/ABC123/" \
    --headless
```

**オプション:**
- `--headless`: ヘッドレスモードで実行（バックグラウンド）
- `--login-only`: ログインのみ実行（エンゲージメント取得なし）

### 手動でスケジュールチェック

```bash
./run-engagement-check.sh
```

または

```bash
python3 scripts/schedule-engagement-tracking.py check
```

## 🔄 自動化フロー

### 1. 投稿時（Discord検知）

`watch-discord-posts.py` が投稿を検知すると：

```python
# 自動的にスケジュールに追加
scheduler.add_post(
    post_id='POST-20260215-001',
    platform='Instagram',
    post_url='https://www.instagram.com/p/ABC123/',
    post_time=datetime.now().isoformat()
)
```

### 2. ハートビート時（30分ごと）

`run-engagement-check.sh` が実行され：

1. スケジュールをチェック
2. 実行タイミングに達した投稿を検出
3. 自動的にエンゲージメント取得
4. Google Sheetsに記録
5. スケジュールを更新

### 3. エンゲージメント取得

1. **ログイン確認**: クッキーを読み込み、必要に応じて再ログイン
2. **スクレイピング**: 投稿ページを開いてデータ抽出
3. **リトライ**: 失敗時は最大3回リトライ
4. **記録**: Google Sheetsに自動記録

## 🔐 クッキー管理

### クッキー保存場所

```
/root/clawd/skills/sns-growth-tracker/data/cookies/
├── instagram_cookies.json
├── x_cookies.json
├── threads_cookies.json
├── facebook_cookies.json
└── pinterest_cookies.json
```

### クッキーの有効期限

- 通常は数週間〜数ヶ月有効
- セッション切れの場合は自動検出 → 再ログイン要求

### 再ログインが必要な場合

```bash
# 特定のプラットフォームのみ
python3 scripts/get-engagement.py Instagram "" --login-only

# 全プラットフォーム
./setup-login.sh
```

## 🚨 エラーハンドリング

### ログイン失敗

- **検出方法**: ログインページへのリダイレクト
- **対処**: 手動ログインを要求 → クッキーを再保存

### DOM要素が見つからない

- **検出方法**: セレクターのマッチ失敗
- **対処**: エラーをログに記録 → スキップ → 次回リトライ

### リトライ機能

- **最大試行回数**: 3回
- **待機時間**: 5秒
- **失敗時**: 30分後に自動再スケジュール

## 📊 Google Sheetsへの記録

### 記録内容

エンゲージメントデータは各プラットフォームのシートに記録されます：

```json
{
  "platform": "Instagram",
  "url": "https://www.instagram.com/p/ABC123/",
  "timestamp": "2026-02-15T10:30:00",
  "likes": 150,
  "comments": 12,
  "saves": 45,
  "shares": 8,
  "reach": 2500
}
```

### シート構造

- **投稿マスター**: 投稿の基本情報
- **Instagram, X, Threads, Facebook, Pinterest**: 各SNSのエンゲージメント
- **トレンド分析**: バズった投稿の分析
- **実験ログ**: A/Bテストの結果

## 🛠️ トラブルシューティング

### Playwrightがインストールされていない

```bash
pip install playwright
playwright install chromium
```

### クッキーが保存されない

- ディレクトリの書き込み権限を確認
- 手動でディレクトリを作成: `mkdir -p data/cookies`

### スクレイピングが失敗する

- SNSのUIが変更された可能性
- セレクターを更新: `scripts/get-engagement.py` を編集

### Google Sheets APIエラー

- 認証情報を確認: `google-credentials.json`
- スプレッドシートIDを確認: `SNS_SHEETS_ID` 環境変数

## 🔧 カスタマイズ

### 取得タイミングの変更

`scripts/schedule-engagement-tracking.py` の `tracking_points` を編集：

```python
tracking_points = [
    {'hours_after': 24, 'scheduled_time': ...},  # 24時間後
    {'hours_after': 48, 'scheduled_time': ...},  # 48時間後
    {'hours_after': 168, 'scheduled_time': ...}, # 7日後
    # 追加例：
    {'hours_after': 72, 'scheduled_time': ...},  # 3日後
]
```

### 新しいプラットフォームの追加

1. `scripts/get-engagement.py` に取得メソッドを追加
2. セレクターを定義
3. ログイン処理を追加

## 📚 関連ファイル

- `scripts/get-engagement.py` - メインスクレイピングスクリプト
- `scripts/schedule-engagement-tracking.py` - スケジューラー
- `scripts/record-to-sheets.py` - Google Sheets記録
- `run-engagement-check.sh` - ハートビート実行用ラッパー
- `setup-login.sh` - 初回ログインセットアップ
- `data/engagement_schedule.json` - スケジュールデータ
- `data/cookies/` - クッキー保存ディレクトリ

## ✅ 完成チェックリスト

- [x] Playwright + Chromiumインストール
- [x] エンゲージメント取得スクリプト作成
- [x] スケジューラー実装
- [x] クッキー管理機能
- [x] Google Sheets連携
- [x] リトライ機能
- [x] エラーハンドリング
- [x] HEARTBEAT設定
- [x] セットアップスクリプト
- [x] ドキュメント作成

## 🎯 次のステップ

1. **初回ログイン**: `./setup-login.sh` を実行
2. **テスト投稿**: 手動でエンゲージメント取得をテスト
3. **自動化確認**: スケジュール追加 → ハートビート実行を確認
4. **監視**: 数日間運用して安定性を確認

---

**作成日**: 2026-02-15  
**バージョン**: 1.0.0  
**担当**: リッキー 🐥
