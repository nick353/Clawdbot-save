---
name: sns-multi-poster
description: 5つのSNS（Instagram, Threads, Facebook, Pinterest, X）に画像・動画を自動投稿。AIキャプション生成・パフォーマンス収集・PDCA分析まで完全自動化。「SNS投稿」「マルチ投稿」でトリガー。
---

# SNS Multi Poster - 完全自動化システム (v5.0 - Discord自動投稿)

**最終更新:** 2026-02-24

## 🤖 Discord自動投稿 (v5.0 - NEW!)

**機能:**
- Discord #sns-投稿チャンネルに画像・動画を投稿 → 自動的に5つのSNSに投稿
- Gemini APIで各SNS最適化キャプションを自動生成（AI感を排除した自然な文体）
- 並列投稿で高速処理
- DRY_RUNモード対応（テスト用）

**使い方:**
1. Discord #sns-投稿チャンネルに画像・動画を投稿
2. 自動的にメディアをダウンロード → Gemini分析 → 5SNSに投稿
3. 結果をDiscordに投稿

**詳細:** [AUTO_POSTER_SETUP.md](./AUTO_POSTER_SETUP.md)

**systemdサービス:** `discord-sns-watcher.service`

**ログ確認:**
```bash
sudo journalctl -u discord-sns-watcher.service -f
```

---

## 📁 Google Drive自動投稿 (v5.0 - NEW!)

**機能:**
- Google Drive「投稿用の動画」フォルダを監視（5分ごと）
- 新規動画を自動検出 → ダウンロード → Gemini分析 → 5SNSに投稿
- 大容量動画に対応（Discordのファイルサイズ制限を回避）
- 処理済みログで重複投稿を防止

**使い方:**
1. Google Drive「投稿用の動画」フォルダに動画をアップロード
2. 5分以内にcronジョブが自動検出
3. 自動的にダウンロード → Gemini分析 → SNS投稿
4. 結果をDiscord #sns-投稿チャンネルに投稿

**セットアップ:**
```bash
cd /root/clawd/skills/sns-multi-poster

# DRY_RUNテスト
DRY_RUN=true bash gdrive-sns-watcher.sh

# cronジョブ設定（5分ごと監視）
bash setup-gdrive-watcher-cron.sh
```

**詳細:** [GDRIVE_WATCHER_SETUP.md](./GDRIVE_WATCHER_SETUP.md)

**使い分け:**
- **Discord投稿**: 軽量ファイル（〜8MB）、画像・短い動画
- **Google Drive**: 大容量動画、長い動画・高画質動画

---

## 🎥 動画投稿対応 (v4.0)

**対応形式:** .mp4, .mov, .avi, .mkv, .webm, .m4v

**投稿先:**
- 📷 **画像** (.jpg, .png, .jpeg, .gif, .webp, .bmp) → Instagram, Threads, X, Facebook, Pinterest **(5SNS)**
- 🎥 **動画** (.mp4, .mov, .avi, .mkv, .webm, .m4v) → Instagram Reels, Threads, X, Facebook **(4SNS - Pinterest除外)**

**制限:**
- Instagram Reels: 最大90秒
- X (Twitter): 最大2分20秒（鳥無料プラン）
- Threads: 最大5分
- Facebook: 長時間OK

---

## 🚀 クイックスタート

```bash
cd /root/clawd/skills/sns-multi-poster

# 画像を5SNSに一括投稿
bash post-to-all-sns.sh /path/to/image.jpg "キャプション" Animal

# 動画を4SNSに一括投稿（Pinterest除外）
bash post-to-all-sns.sh /path/to/video.mp4 "動画キャプション 🎥" Animal

# テストモード（実際には投稿しない）
DRY_RUN=true bash post-to-all-sns.sh /tmp/test.mp4 "テスト動画 #test" Animal
```

---

## 📋 スクリプト一覧（v4.0）

| スクリプト | 対応メディア | 認証方式 | DRY_RUN |
|-----------|------------|---------|---------|
| `post-to-instagram-v5.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-instagram-reels.cjs` | 🎥 動画 | Cookie JSON | ✅ 対応 |
| `post-to-threads.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-threads-video.cjs` | 🎥 動画 | Cookie JSON | ✅ 対応 |
| `post-to-facebook.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-facebook-video.cjs` | 🎥 動画 | Cookie JSON | ✅ 対応 |
| `post-to-facebook-api.cjs` | 📷 画像 | **Graph API Token** ✨新 | ✅ 対応 |
| `post-to-pinterest.cjs` | 📷 画像 | Cookie JSON | ✅ 対応 |
| `post-to-x.cjs` | 📷🎥 両対応 | Cookie JSON | ✅ 対応 |
| `post-to-all-sns.sh` | 📷🎥 自動判別 | - | ✅ 対応 |

### DRY_RUN の動作
- 全スクリプトに**早期終了**チェックを追加（ブラウザ起動不要）
- `DRY_RUN=true` → 即座に「スキップ」メッセージを出力して終了
- タイムアウト：各プラットフォーム180秒以内（動画対応で延長）

---

## 🔐 認証方式

### Cookie ベース認証（既存方式）

```bash
# Cookieファイル一覧
ls /root/clawd/skills/sns-multi-poster/cookies/
# instagram.json  threads.json  facebook.json  pinterest.json  x.json
```

#### Cookie更新方法
1. 対象SNSにブラウザでログイン
2. Chrome拡張「Cookie-Editor」などでJSON形式でコピー
3. `cookies/<platform>.json` に保存

---

### Facebook Graph API トークン認証 ✨新 (2026-02-22)

**対応スクリプト:** `post-to-facebook-api.cjs`

Facebook Graph API を使用した認証方式です。Cookie の有効期限切れやアカウントロックの問題を回避できます。

#### セットアップ

```bash
# 環境変数: FACEBOOK_API_TOKEN （自動で読み込み）
echo $FACEBOOK_API_TOKEN
# => EAAauWWKRF7sBQ...（先頭確認）

# PAGE_ID オプション（デフォルト: "me"）
export PAGE_ID="your_page_id"
```

#### 直接実行

```bash
# 基本使用法
node post-to-facebook-api.cjs /path/to/image.jpg "投稿キャプション"

# テストモード
DRY_RUN=true node post-to-facebook-api.cjs /tmp/test.jpg "テスト"

# ページIDを指定
PAGE_ID="123456789" node post-to-facebook-api.cjs /tmp/img.jpg "キャプション"
```

#### 必要な環境変数

| 変数 | 値 | 必須 |
|------|-----|------|
| `FACEBOOK_API_TOKEN` | Graph API アクセストークン | ✅ YES |
| `PAGE_ID` | Facebook ページID（デフォルト: "me"） | ❌ NO |

#### トークン取得方法

1. [Facebook Developers Console](https://developers.facebook.com/)
2. Settings → User Token
3. Permissions: `pages_manage_posts`, `pages_read_engagement`
4. トークンをコピー → `FACEBOOK_API_TOKEN` に設定

---

## 📊 自動化システム

### Phase 2: パフォーマンス収集 (毎日09:00 JST自動実行)
- **`collect-all-performance.sh`**: 全SNSパフォーマンス収集

### Phase 3: PDCA分析 (毎週月曜09:00 JST自動実行)
- **`analyze-sns-performance.sh`**: 週次レポート生成・Discord送信

### データ保存先
- 投稿記録: `/root/clawd/data/sns-posts/`
- パフォーマンス: `/root/clawd/data/sns-performance/`
- 週次レポート: `/root/clawd/data/reports/`

---

## トリガーワード

- `SNS投稿`
- `マルチ投稿`
- `5つのSNSに投稿`
- `/sns-multi-poster`

---

## 🛡️ **BAN対策システム (v6 - 新機能)** 

**作成日:** 2026-02-21  
**目的:** VPS運用でもBANリスクを80%削減

### 📊 **対策レベル**

| Level | コスト | BANリスク削減 | 実装状況 |
|-------|--------|--------------|---------|
| Level 1 | 無料 | 60%削減 | ✅ 実装済み |
| Level 2 | 無料 | 80%削減 | ✅ 実装済み |
| Level 3 | 無料 | 85%削減 | ⚠️ 非推奨 |
| Level 4 | $8.5/月〜 | 95%削減 | ⚠️ BAN発生時 |

### ✅ **実装済み機能（Level 1 + Level 2）**

1. **レート制限**
   - Instagram: 3投稿/時間、20投稿/日
   - 最低15分間隔
   
2. **投稿時間制限**
   - 7時〜23時のみ許可（深夜投稿禁止）
   
3. **ランダム遅延**
   - 操作前: 2〜5秒
   - クリック間: 0.5〜1.5秒
   - タイピング: 50〜150ms/文字
   
4. **高度検出回避**
   - puppeteer-extra + stealth plugin
   - navigator.webdriver削除
   - Chrome Detection対策
   - User-Agentローテーション
   - Timezone/言語設定（日本）

### 🚀 **使い方**

#### BAN対策版（推奨）
```bash
# Instagram投稿（BAN対策完全版）
node post-to-instagram-v6-anti-ban.cjs /path/to/image.jpg "キャプション"

# テストモード
DRY_RUN=true node post-to-instagram-v6-anti-ban.cjs /path/to/image.jpg "テスト"
```

#### レート制限確認
```bash
cat /root/clawd/data/sns-posts/rate-limit-log.json
```

### 📋 **ドキュメント**

- **詳細ガイド:** `/root/clawd/skills/sns-multi-poster/ANTI_BAN_GUIDE.md`
- **クイックスタート:** `/root/clawd/skills/sns-multi-poster/README_ANTI_BAN.md`

### ⚠️ **重要な注意事項**

- レート制限を守る（変更禁止）
- 深夜投稿しない（BOT検出リスク高）
- **BANされたら即座に投稿停止**
- 必要ならLevel 4（有料プロキシ: $8.5/月〜）導入を検討

---

## 🗑️ 投稿削除機能 (v4.1)

### 削除スクリプト一覧

| スクリプト | 対応SNS | 動作 |
|-----------|---------|------|
| `delete-instagram-post.cjs` | Instagram | Puppeteerで自動削除 |
| `delete-threads-post.cjs` | Threads | Puppeteerで自動削除 |
| `delete-facebook-post.cjs` | Facebook | Puppeteerで自動削除 |
| `delete-pinterest-pin.cjs` | Pinterest | Puppeteerで自動削除 |
| `delete-x-post.sh` | X (Twitter) | 手動削除URL案内 |
| `delete-all-sns-posts.sh` | 全SNS一括 | JSONから削除 |

### 個別削除

```bash
cd /root/clawd/skills/sns-multi-poster

# Instagram投稿削除
node delete-instagram-post.cjs "https://www.instagram.com/p/ABC123/"

# Threads投稿削除
node delete-threads-post.cjs "https://www.threads.net/@username/post/ABC123"

# Facebook投稿削除
node delete-facebook-post.cjs "https://www.facebook.com/username/posts/123456"

# Pinterestピン削除
node delete-pinterest-pin.cjs "https://www.pinterest.com/pin/123456789/"

# X投稿削除（手動案内）
bash delete-x-post.sh "https://x.com/username/status/123456789"
```

### 一括削除（推奨）

投稿時に保存されたJSONファイルから全SNSの投稿を一括削除：

```bash
# post_idを指定して一括削除
bash delete-all-sns-posts.sh 2026-02-18_001

# 削除対象が見つからない場合はスキップされる
```

**動作：**
1. `/root/clawd/data/sns-posts/<post_id>.json` を読み込み
2. 各SNSのURLを抽出
3. 各削除スクリプトを順次実行
4. URLがない場合はスキップ

**注意：**
- X (Twitter) は bird CLI に削除機能がないため手動削除URLを表示
- Cookie期限切れの場合は削除失敗（`cookies/<platform>.json` 更新が必要）

---

## 🔧 トラブルシューティング

| 症状 | 対処法 |
|------|--------|
| Cookie期限切れ | `cookies/<platform>.json` を更新 |
| タイムアウト | 90秒制限内に完了しない場合、Cookieを確認 |
| ブラウザハング | 各スクリプトに `DRY_RUN=true` で早期終了確認 |
| Facebookポストボタン見つからない | Cookieが期限切れの可能性、再取得 |

---

## 更新履歴

- 2026-02-21 v4.1: 投稿削除機能追加（Instagram, Threads, Facebook, Pinterest自動削除、X手動案内、一括削除スクリプト）
- 2026-02-21 v4.0: 動画投稿対応（Instagram Reels, Threads, Facebook動画スクリプト追加）
- 2026-02-17 v3.0: 全スクリプトにDRY_RUN早期終了追加、post-to-all-sns.sh修正（5SNS対応、タイムアウト管理）
- 2026-02-17 v2.0: post-to-instagram-v5.cjs完成（Cookie認証方式）
- 2026-02-08: Clawdbot標準browserツール版に変換（VPS対応）
- 2026-02-01: Playwright MCP版作成（ローカル開発用）
