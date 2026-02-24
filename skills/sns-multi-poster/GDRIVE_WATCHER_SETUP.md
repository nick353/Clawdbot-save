# 📁 Google Drive自動SNS投稿システム

## 🎯 概要
Google Drive「投稿用の動画」フォルダを監視し、新規動画を自動的に5つのSNSに投稿します。

**Discord投稿との違い:**
- **Discord #sns-投稿**: 軽量ファイル（画像・小さい動画）
- **Google Drive「投稿用の動画」**: 大きい動画ファイル

両方を併用可能です。

---

## 🚀 セットアップ

### 1. DRY_RUNモードでテスト
```bash
cd /root/clawd/skills/sns-multi-poster

# DRY_RUNモードで手動実行
DRY_RUN=true bash gdrive-sns-watcher.sh
```

**期待される動作:**
1. Google Drive「投稿用の動画」フォルダを確認
2. 新規動画をダウンロード
3. Geminiでキャプション生成（5つのSNS）
4. DRY_RUN投稿（実際の投稿なし）
5. 結果をDiscordに投稿

---

### 2. cronジョブ設定（5分ごと監視）
```bash
cd /root/clawd/skills/sns-multi-poster

# cronジョブ追加
bash setup-gdrive-watcher-cron.sh

# 確認
clawdbot cron list | grep gdrive
```

---

### 3. 本番モード移行
```bash
# 最初はDRY_RUNモードで数回テスト
DRY_RUN=true bash gdrive-sns-watcher.sh

# 問題なければ、cronジョブが自動的に本番モードで実行
# （cronジョブはDRY_RUN=trueなしで実行される）
```

---

## 📋 使い方

### Google Driveに動画をアップロード
1. Google Drive「投稿用の動画」フォルダを開く
2. 動画ファイルをアップロード（.mp4, .mov, .avi, .mkv, .webm, .m4v）
3. 5分以内にcronジョブが自動検出
4. 自動的にダウンロード → Gemini分析 → SNS投稿
5. 結果をDiscord #sns-投稿チャンネルに投稿

**対応形式:**
- .mp4, .mov, .avi, .mkv, .webm, .m4v

**投稿先:**
- Instagram Reels
- Facebook
- Threads
- X
- Pinterest（動画はスキップ）

---

## 🧪 テスト手順

### Step 1: 手動テスト（DRY_RUN）
```bash
cd /root/clawd/skills/sns-multi-poster

# テスト動画をGoogle Driveにアップロード
# → ブラウザで「投稿用の動画」フォルダにアップロード

# 手動実行（DRY_RUN）
DRY_RUN=true bash gdrive-sns-watcher.sh
```

**確認ポイント:**
- 動画を検出できたか？
- Geminiキャプション生成成功？
- DRY_RUN投稿スキップ？
- Discord通知送信？

---

### Step 2: cronジョブ設定
```bash
bash setup-gdrive-watcher-cron.sh
clawdbot cron list
```

---

### Step 3: 本番テスト
```bash
# 最初の1回はDRY_RUNなしで手動実行
bash gdrive-sns-watcher.sh

# 各SNSで投稿を確認
# 問題なければcronジョブに任せる
```

---

## 📊 処理済みログ
処理済み動画は `.gdrive-processed.log` に記録され、重複投稿を防ぎます。

```bash
# 処理済みログ確認
cat /root/clawd/skills/sns-multi-poster/.gdrive-processed.log

# ログクリア（再投稿したい場合）
rm /root/clawd/skills/sns-multi-poster/.gdrive-processed.log
```

---

## 🛠️ トラブルシューティング

### 動画を検出できない
```bash
# Google Driveフォルダ確認
rclone lsf "gdrive:投稿用の動画" --files-only

# rclone設定確認
rclone config show gdrive
```

### ダウンロード失敗
```bash
# 手動ダウンロードテスト
rclone copy "gdrive:投稿用の動画/test.mp4" /tmp/
```

### SNS投稿失敗
- Cookie認証が期限切れの可能性
- 各SNSのスクリプトログを確認
- `/tmp/sns-auto-poster/results-*.txt` を確認

---

## 🔧 高度な設定

### 監視フォルダ変更
```bash
# gdrive-sns-watcher.sh を編集
nano gdrive-sns-watcher.sh

# GDRIVE_FOLDER を変更
GDRIVE_FOLDER="gdrive:別のフォルダ名"
```

### 監視間隔変更
```bash
# cronジョブ編集
clawdbot cron list
# 該当ジョブのIDを確認

clawdbot cron update --id <job-id> --schedule "*/10 * * * *"  # 10分ごと
```

### 処理済みログリセット
```bash
# 特定の動画を再投稿したい場合
sed -i '/test.mp4/d' /root/clawd/skills/sns-multi-poster/.gdrive-processed.log
```

---

## 📂 ファイル構成

```
/root/clawd/skills/sns-multi-poster/
├── gdrive-sns-watcher.sh          # Google Drive監視スクリプト
├── setup-gdrive-watcher-cron.sh   # cronジョブ設定
├── .gdrive-processed.log          # 処理済みログ
├── auto-sns-poster.sh             # SNS投稿スクリプト（共通）
├── generate-ai-caption.sh         # Geminiキャプション生成（共通）
└── GDRIVE_WATCHER_SETUP.md       # このガイド
```

---

## 🎓 Discord投稿との使い分け

| 方式 | 対象 | 用途 |
|------|------|------|
| **Discord #sns-投稿** | 軽量ファイル（〜8MB） | 画像・短い動画 |
| **Google Drive「投稿用の動画」** | 大容量ファイル | 長い動画・高画質動画 |

**どちらも同じ処理:**
1. Geminiでキャプション生成
2. 5つのSNSに並列投稿
3. 結果をDiscordに投稿

---

## 📞 サポート

問題が発生した場合：
1. 手動実行でテスト: `bash gdrive-sns-watcher.sh`
2. ログ確認: `.gdrive-processed.log`
3. rclone設定確認: `rclone config show gdrive`

---

**実装日**: 2026-02-24  
**バージョン**: 1.0.0  
**メンテナンス**: リッキー 🐥
