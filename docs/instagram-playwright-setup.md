# Instagram Playwright Remote Browser セットアップガイド

## 概要

このガイドは、Playwright を使用してInstagramセッションを安全かつ効率的に生成し、自動投稿スクリプトで使用するための完全なセットアップ手順です。

**セットアップ日**: 2026-02-23  
**ステータス**: ✅ 完全なエンドツーエンド実装

---

## 📋 セットアップ方法

### 手順 1: VPS 側でスクリプトの準備確認

```bash
# セットアップスクリプトの位置確認
ls -la /root/clawd/scripts/instagram-*.sh

# 出力例:
# -rwxr-xr-x  instagram-playwright-remote-login.sh
# -rwxr-xr-x  instagram-codegen-session.sh
```

**確認項目:**
- ✅ `/root/clawd/scripts/instagram-playwright-remote-login.sh` - 方法A
- ✅ `/root/clawd/scripts/instagram-codegen-session.sh` - 方法B（推奨）

---

### 手順 2: Playwright セッション生成（推奨方法）

**方法B: Codegen + Session Capture（推奨）**

```bash
# スクリプト実行
bash /root/clawd/scripts/instagram-codegen-session.sh
```

**スクリプトの動作:**

1. Node.js 環境確認
2. `@playwright/test` インストール確認
3. Chromium ブラウザを起動
4. ブラウザでの手動操作待機:
   - Instagram にログイン
   - OTP(ワンタイムパスワード) 入力
   - ホームページの確認
5. セッション情報を自動保存:
   - `/root/clawd/auth/instagram-storage-state.json` - ブラウザストレージ状態
   - `/root/clawd/auth/instagram.json` - プロファイル + メタデータ

---

## 🔐 生成されるセッションファイル

### `instagram-storage-state.json`

Playwright ブラウザコンテキストで使用するストレージ状態：

```json
{
  "cookies": [
    {
      "name": "sessionid",
      "value": "...",
      "domain": ".instagram.com",
      "path": "/",
      "expires": 1...,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    },
    ...
  ],
  "origins": [
    {
      "origin": "https://www.instagram.com",
      "localStorage": [...],
      "indexedDB": [...]
    }
  ]
}
```

### `instagram.json`

プロファイル + メタデータ：

```json
{
  "type": "instagram",
  "method": "playwright-codegen",
  "generated_at": "2026-02-23T...",
  
  "storage_state": { /* 上記と同じ */ },
  
  "session_id": "...",
  "csrf_token": "...",
  
  "session_info": {
    "is_authenticated": true,
    "session_established_at": "2026-02-23T...",
    "expires_at": "2026-03-23T..."
  }
}
```

---

## 🤖 自動投稿スクリプト（V5）

セッション生成後、自動投稿スクリプトを使用できます。

### セットアップ確認

```bash
ls -la /root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs
# 出力: -rwxr-xr-x post-to-instagram-v5.cjs
```

### 使用方法

```bash
# 基本コマンド
node /root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs <画像パス> "キャプション"

# 例
node /root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs ./photo.jpg "Good morning everyone! 🌅"

# スクリプトから実行
bash /root/clawd/skills/sns-multi-poster/sns-multi-poster.sh post "photo.jpg" "キャプション"
```

### V5 スクリプトの特徴

- ✅ Playwright リモートブラウザ対応
- ✅ セッション再利用（再ログイン不要）
- ✅ 高速・軽量（メモリ効率化）
- ✅ メモリリーク対策
- ✅ エラーハンドリング強化
- ✅ Instagram UI 変更への柔軟対応

---

## 🔄 セッション更新フロー

セッションが期限切れの場合：

```bash
# セッションを再生成
bash /root/clawd/scripts/instagram-codegen-session.sh

# または V5 スクリプトを実行（失敗時）
node /root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs photo.jpg "test"
# → セッション期限切れエラーが表示される
# → 上記コマンドでセッション再生成
```

---

## 🐛 トラブルシューティング

### Q: ブラウザが起動しない

```bash
# 原因: Xvfb が必要
# 解決策: VPS 環境は画面なしなため、リモートモニタリングを使用
xvfb-run bash /root/clawd/scripts/instagram-codegen-session.sh
```

### Q: ログインに失敗する

1. Instagram アカウント情報を確認
2. 2要素認証が有効な場合、OTP を手動入力
3. IP ブロックの場合、VPS IP をホワイトリストに追加

### Q: セッション期限切れ

```bash
# セッションを再生成
bash /root/clawd/scripts/instagram-codegen-session.sh
```

### Q: ファイアウォールブロック

VPS がInstagram API にアクセスできるか確認：

```bash
curl -I https://www.instagram.com/
# HTTP/1.1 200 OK が返る → アクセス可能
```

---

## 📊 プロファイル検証

セッション生成後、プロファイルを検証：

```bash
# ファイル存在確認
ls -la /root/clawd/auth/instagram*.json

# プロファイル内容確認（先頭15行）
head -15 /root/clawd/auth/instagram.json

# セッションID確認
cat /root/clawd/auth/instagram.json | grep "session_id"
```

**期待される出力:**

```
"session_id": "12345...",
"is_authenticated": true,
```

---

## 🚀 エンドツーエンドテスト

### テストシナリオ 1: セッション生成

```bash
# 1. セッション生成
bash /root/clawd/scripts/instagram-codegen-session.sh

# 出力:
# ✅ セッション生成完了!
# 📁 生成されたファイル:
#   • プロファイル: /root/clawd/auth/instagram.json
#   • ストレージ状態: /root/clawd/auth/instagram-storage-state.json

# 2. 確認
ls -la /root/clawd/auth/
# total 24
# -rw-r--r-- instagram.json
# -rw-r--r-- instagram-storage-state.json
```

### テストシナリオ 2: 自動投稿

```bash
# 1. テスト画像を準備
echo "Creating test image..." 
# または既存の画像を使用: ~/photo.jpg

# 2. 投稿スクリプト実行
node /root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs ./photo.jpg "【テスト投稿】Playwrightセッションテスト"

# 出力:
# 🚀 Instagram 投稿スクリプト V5 - Playwright版
# ✅ ログイン確認
# 📸 画像をアップロード中...
# ✍️ キャプションを入力中...
# 🔘 投稿を共有中...
# ✅ Instagram 投稿成功!

# 3. Instagram でポストを確認
```

---

## 📁 ディレクトリ構成

```
/root/clawd/
├── auth/
│   ├── instagram.json                          # プロファイル（メタデータ）
│   └── instagram-storage-state.json            # ブラウザストレージ状態
├── scripts/
│   ├── instagram-playwright-remote-login.sh    # 方法A
│   └── instagram-codegen-session.sh            # 方法B（推奨）
├── skills/sns-multi-poster/
│   └── post-to-instagram-v5.cjs               # 自動投稿スクリプト（V5）
└── docs/
    └── instagram-playwright-setup.md           # このドキュメント
```

---

## 🎯 次のステップ

1. **セッション生成:**
   ```bash
   bash /root/clawd/scripts/instagram-codegen-session.sh
   ```

2. **自動投稿テスト:**
   ```bash
   node /root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs photo.jpg "テスト投稿"
   ```

3. **Cronジョブ登録（オプション）:**
   ```bash
   # 毎日 09:00 に自動投稿
   0 9 * * * node /root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs /path/to/photo.jpg "Daily post"
   ```

4. **API統合（オプション）:**
   - Discord との連携
   - 自動スケジュール機能
   - バッチ処理

---

## 📞 サポート

問題が発生した場合：

1. **ログを確認:**
   ```bash
   npm list playwright
   node --version
   ```

2. **スクリプトを再実行:**
   ```bash
   bash /root/clawd/scripts/instagram-codegen-session.sh
   ```

3. **セッションをリセット:**
   ```bash
   rm /root/clawd/auth/instagram*.json
   bash /root/clawd/scripts/instagram-codegen-session.sh
   ```

---

## 📝 更新履歴

- **2026-02-23**: Playwright Remote Browser セットアップ完成
  - 方法A: instagram-playwright-remote-login.sh 実装
  - 方法B: instagram-codegen-session.sh 実装（推奨）
  - V5 投稿スクリプト実装
  - 完全なエンドツーエンドテスト実装

---

**このセットアップにより、Instagram への安全で効率的な自動投稿が可能になります。** ✨
