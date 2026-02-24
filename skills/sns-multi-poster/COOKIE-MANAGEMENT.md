# Cookie自動更新システム

**作成日**: 2026-02-24  
**目的**: SNS投稿用Cookieの自動更新・期限チェック・Discord通知を実現

---

## 📋 概要

5つのSNS（Instagram, Facebook, Threads, Pinterest, X）のCookie認証を一元管理し、期限切れを自動検出・通知するシステムです。

---

## 🛠️ システム構成

### 1️⃣ **Cookie更新スクリプト** (`update-cookies.sh`)
新しいCookieファイルを読み取り、バックアップを取ってから本番環境に反映します。

**使い方:**
```bash
bash /root/clawd/skills/sns-multi-poster/scripts/update-cookies.sh <platform> <json-path>
```

**例:**
```bash
# Instagram Cookie更新
bash /root/clawd/skills/sns-multi-poster/scripts/update-cookies.sh instagram /tmp/instagram-new.json

# X Cookie更新
bash /root/clawd/skills/sns-multi-poster/scripts/update-cookies.sh x /tmp/x-new.json
```

**機能:**
- ✅ JSON形式検証
- ✅ 自動バックアップ作成（`cookies/backups/`）
- ✅ 更新ログ記録（`cookies/updates/update-log.txt`）
- ✅ Discord通知（更新成功時）

---

### 2️⃣ **Cookie期限チェックスクリプト** (`check-cookie-expiry.sh`)
各SNSのCookie有効期限をチェックし、期限切れまたは警告期間（デフォルト7日）に入っている場合、Discord通知を送信します。

**使い方:**
```bash
bash /root/clawd/skills/sns-multi-poster/scripts/check-cookie-expiry.sh [--warn-days 7]
```

**例:**
```bash
# デフォルト（7日前に警告）
bash /root/clawd/skills/sns-multi-poster/scripts/check-cookie-expiry.sh

# 3日前に警告
bash /root/clawd/skills/sns-multi-poster/scripts/check-cookie-expiry.sh --warn-days 3
```

**機能:**
- ✅ 各SNSのCookie有効期限を自動チェック
- ✅ 期限切れまたは警告期間内の場合、Discord通知
- ✅ Cronジョブで毎日実行（9:00 UTC = 日本時間18:00）

**Cronジョブ:**
```
名前: sns-check-cookie-expiry
スケジュール: 0 9 * * *（毎日9:00 UTC）
コマンド: bash /root/clawd/skills/sns-multi-poster/scripts/check-cookie-expiry.sh --warn-days 7
```

---

### 3️⃣ **Cookie更新監視スクリプト** (`watch-cookie-updates.sh`)
`cookies/updates/` ディレクトリを監視し、新しいCookieファイルが追加されたら自動的に更新します。

**使い方:**
```bash
# バックグラウンドで起動
nohup bash /root/clawd/skills/sns-multi-poster/scripts/watch-cookie-updates.sh > /tmp/watch-cookie-updates.log 2>&1 &
```

**ファイル命名規則:**
- `<platform>.json`（例: `instagram.json`, `x.json`）
- プラットフォーム名はファイル名から自動判定

**機能:**
- ✅ リアルタイム監視（inotifywait利用）
- ✅ ポーリングモード（inotifywait未インストール時）
- ✅ 自動更新実行 → 成功時はファイル削除、失敗時は `failed-*` にリネーム

---

## 📝 Cookie更新手順（マニュアル）

### ステップ1: ブラウザでCookie取得

1. **ブラウザ拡張機能をインストール:**
   - Chrome/Edge: [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg)
   - Firefox: [Cookie-Editor](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)

2. **各SNSにログイン:**
   - Instagram: https://www.instagram.com/
   - Facebook: https://www.facebook.com/
   - Threads: https://www.threads.net/
   - Pinterest: https://www.pinterest.com/
   - X (Twitter): https://x.com/

3. **Cookieをエクスポート:**
   - 拡張機能を開く → "Export" → JSON形式で保存

### ステップ2: Cookie更新スクリプト実行

```bash
# 例: Instagram Cookie更新
bash /root/clawd/skills/sns-multi-poster/scripts/update-cookies.sh instagram /tmp/instagram-new.json
```

### ステップ3: 確認

```bash
# Cookie期限チェック
bash /root/clawd/skills/sns-multi-poster/scripts/check-cookie-expiry.sh

# 投稿テスト（DRY RUN）
cd /root/clawd/skills/sns-multi-poster
DRY_RUN=true node post-to-instagram-v12-final.cjs test-images/sample-landscape.jpg "Test caption"
```

---

## 🔄 Cookie自動更新フロー（推奨）

### 方法1: updatesディレクトリ経由（推奨）

1. **ブラウザでCookieを書き出し** → `/tmp/<platform>.json`
2. **updatesディレクトリにコピー:**
   ```bash
   cp /tmp/instagram.json /root/clawd/skills/sns-multi-poster/cookies/updates/
   ```
3. **自動更新スクリプトが検出 → 自動更新 → Discord通知**

### 方法2: 手動実行

```bash
bash /root/clawd/skills/sns-multi-poster/scripts/update-cookies.sh <platform> <json-path>
```

---

## 📊 Cookie管理ディレクトリ構造

```
/root/clawd/skills/sns-multi-poster/cookies/
├── instagram.json          # Instagram Cookie（本番）
├── facebook.json           # Facebook Cookie（本番）
├── threads.json            # Threads Cookie（本番）
├── pinterest.json          # Pinterest Cookie（本番）
├── x.json                  # X Cookie（本番）
├── backups/                # バックアップディレクトリ
│   ├── instagram-20260224-140000.json
│   ├── x-20260224-140000.json
│   └── ...
└── updates/                # 自動更新ディレクトリ
    ├── update-log.txt      # 更新ログ
    └── failed-*.json       # 更新失敗時のファイル
```

---

## ⚙️ トラブルシューティング

### 問題: Cookie更新後も投稿失敗

**原因:**
- Cookie形式が間違っている
- sameSite属性が不正

**解決策:**
```bash
# Cookie形式検証
jq empty /root/clawd/skills/sns-multi-poster/cookies/instagram.json

# sameSite正規化確認（スクリプト内で自動実行）
# no_restriction → None
# null → Lax
```

### 問題: 期限チェックが動作しない

**原因:**
- Cronジョブが無効化されている
- スクリプトの実行権限がない

**解決策:**
```bash
# Cronジョブ確認
clawdbot cron list | grep sns-check-cookie-expiry

# 実行権限付与
chmod +x /root/clawd/skills/sns-multi-poster/scripts/check-cookie-expiry.sh

# 手動実行テスト
bash /root/clawd/skills/sns-multi-poster/scripts/check-cookie-expiry.sh
```

### 問題: Discord通知が送信されない

**原因:**
- `clawdbot` コマンドが見つからない
- チャンネルIDが間違っている

**解決策:**
```bash
# clawdbot確認
which clawdbot

# 手動通知テスト
clawdbot message send \
  --channel discord \
  --target "channel:1470060780111007950" \
  --message "テスト通知"
```

---

## 📚 関連ドキュメント

- **TOOLS.md**: SNS投稿のトラブルシューティング
- **AGENTS.md**: ブラウザ自動化のベストプラクティス
- **lessons.md**: 今回の学習内容と失敗事例

---

## 🎯 次のステップ

1. ✅ Cookie自動更新スクリプト作成
2. ✅ Cookie期限チェックスクリプト作成
3. ✅ Cronジョブ設定
4. ⏳ Cookie更新監視スクリプトのバックグラウンド起動（オプション）
5. ⏳ ブラウザ拡張機能との統合（将来的）

---

**更新日**: 2026-02-24  
**作成者**: Ricky 🐥  
**ステータス**: 完成（Cronジョブ稼働中）
