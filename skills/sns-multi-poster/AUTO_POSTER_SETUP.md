# 📸 Discord自動SNS投稿システム

## 🎯 概要
Discord #sns-投稿チャンネルに画像・動画を投稿すると、自動的に5つのSNSに投稿します。
- **Instagram**（画像・動画）
- **Facebook**（画像・動画）
- **Threads**（画像のみ）
- **Pinterest**（画像のみ）
- **X**（画像・動画）

キャプションは**Gemini API**で自動生成し、各SNSのアルゴリズムに最適化されます。

---

## 🚀 セットアップ

### 1. systemdサービス起動
```bash
sudo systemctl enable discord-sns-watcher.service
sudo systemctl start discord-sns-watcher.service
sudo systemctl status discord-sns-watcher.service
```

### 2. DRY_RUNモード（テスト用）
```bash
# DRY_RUNモード有効化（実際の投稿なし）
sudo systemctl edit discord-sns-watcher.service
# 以下を追加
# [Service]
# Environment="DRY_RUN=true"

sudo systemctl daemon-reload
sudo systemctl restart discord-sns-watcher.service
```

### 3. 本番モード
```bash
# DRY_RUNモード無効化
sudo systemctl edit discord-sns-watcher.service
# DRY_RUN=true の行を削除

sudo systemctl daemon-reload
sudo systemctl restart discord-sns-watcher.service
```

---

## 📋 使い方

### Discord #sns-投稿チャンネルに投稿
1. #sns-投稿チャンネルを開く
2. 画像または動画を添付して投稿
3. 自動的に以下の処理が実行されます：
   - メディアダウンロード
   - Gemini APIで各SNS最適化キャプション生成
   - 5つのSNSに並列投稿
   - 結果をDiscordに投稿

### キャプション生成の特徴
- **Instagram**: ハッシュタグ多め、ストーリー性重視（200文字）
- **Facebook**: エンゲージメント誘発、質問形式（300文字）
- **Threads**: カジュアル、会話調（150文字）
- **Pinterest**: 発見性重視、キーワード豊富（250文字）
- **X**: 短文、インパクト重視（100文字以内）

**重要**: 全てのキャプションは「個人が投稿するような自然な文体」で生成され、AI感を排除します。

---

## 🧪 テスト手順

### DRY_RUNモードでテスト
1. DRY_RUNモード有効化（上記参照）
2. #sns-投稿チャンネルにテスト画像を投稿
3. ログ確認：
   ```bash
   sudo journalctl -u discord-sns-watcher.service -f
   ```
4. 結果を確認（実際の投稿は行われない）

### 本番テスト
1. 本番モード有効化（DRY_RUN無効化）
2. テスト画像を投稿
3. 各SNSで投稿を確認
4. 問題なければ通常運用開始

---

## 📊 ログ確認

```bash
# リアルタイムログ
sudo journalctl -u discord-sns-watcher.service -f

# 過去100行
sudo journalctl -u discord-sns-watcher.service -n 100

# エラーのみ
sudo journalctl -u discord-sns-watcher.service -p err
```

---

## 🛠️ トラブルシューティング

### Bot起動失敗
```bash
# ステータス確認
sudo systemctl status discord-sns-watcher.service

# ログ確認
sudo journalctl -u discord-sns-watcher.service -n 50

# 再起動
sudo systemctl restart discord-sns-watcher.service
```

### Gemini APIエラー
- `GEMINI_API_KEY` が設定されているか確認
- レート制限（1分15リクエスト）に注意
- スクリプト内で2秒間隔を空けている

### SNS投稿失敗
- Cookie認証が期限切れの可能性
- 各SNSのスクリプトログを確認
- `/tmp/sns-auto-poster/results-*.txt` を確認

---

## 🔧 手動実行（デバッグ用）

```bash
cd /root/clawd/skills/sns-multi-poster

# キャプション生成テスト
bash generate-ai-caption.sh /path/to/image.jpg instagram

# 自動投稿テスト（DRY_RUN）
DRY_RUN=true bash auto-sns-poster.sh "https://example.com/image.jpg" /path/to/image.jpg

# 本番実行
bash auto-sns-poster.sh "https://example.com/image.jpg" /path/to/image.jpg
```

---

## 📝 ファイル構成

```
/root/clawd/skills/sns-multi-poster/
├── discord-sns-watcher.cjs       # Discord bot（メイン）
├── auto-sns-poster.sh             # 自動SNS投稿スクリプト
├── generate-ai-caption.sh         # Geminiキャプション生成
├── post-to-instagram-v12-final.cjs
├── post-to-facebook-v2-anti-ban.cjs
├── post-to-threads-v2-anti-ban.cjs
├── post-to-pinterest-v2-anti-ban.cjs
├── post-to-x-v2-anti-ban.cjs
└── cookies/                       # SNS認証情報

/etc/systemd/system/
└── discord-sns-watcher.service    # systemdサービス設定
```

---

## 📞 サポート

問題が発生した場合は、以下を確認してください：
1. systemdサービスのステータス
2. ログファイル（journalctl）
3. 結果ファイル（`/tmp/sns-auto-poster/results-*.txt`）
4. Discord botの接続状態

---

**実装日**: 2026-02-24  
**バージョン**: 1.0.0  
**メンテナンス**: リッキー 🐥
