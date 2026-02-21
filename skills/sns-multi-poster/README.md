# SNS Multi Poster (v4.0 - 動画対応版)

5つのSNS（Instagram, Threads, Facebook, Pinterest, X）に画像・動画を自動投稿するスキル。

## 🎥 動画対応 (v4.0)
- 📷 **画像** (.jpg, .png, .jpeg, .gif, .webp, .bmp) → **5SNS全て**
- 🎥 **動画** (.mp4, .mov, .avi, .mkv, .webm, .m4v) → **4SNS** (Instagram Reels, Threads, X, Facebook) ※Pinterest除外

## ローカル（Mac）でテストする

### 自動同期（推奨）

VPSから最新版を自動ダウンロード：

```bash
# VPSから sync-to-local.sh をダウンロード
scp root@<VPSのIP>:/root/clawd/skills/sns-multi-poster/sync-to-local.sh ~/Downloads/

# 実行権限を付与
chmod +x ~/Downloads/sync-to-local.sh

# VPSのIPを設定して実行
VPS_HOST=<VPSのIP> ~/Downloads/sync-to-local.sh
```

これで `~/.clawdbot/skills/sns-multi-poster/` に最新版が配置されます。

### 手動同期

```bash
scp -r root@<VPSのIP>:/root/clawd/skills/sns-multi-poster ~/.clawdbot/skills/
```

## 使い方

### 基本的な呼び出し
```
SNS投稿
マルチ投稿
```

### 必要な情報
1. 画像 or 動画パス（拡張子で自動判別）
2. キャプション
3. Pinterestボード名（オプション、デフォルト: Animal）
4. 投稿先の選択（オプション、デフォルト: 全て）

### 動画制限
- Instagram Reels: 最大90秒
- X (Twitter): 最大2分20秒
- Threads: 最大5分
- Facebook: 長時間OK

## 2つの実行モード

### 🆕 ブラウザプロファイル版（推奨）

**特徴:**
- 一度ログインすればずっと使える
- Cookie JSONファイルが不要
- より安定した動作

**初回セットアップ:**
```bash
cd ~/.clawdbot/skills/sns-multi-poster
node setup-all-logins.js
```

ブラウザが開くので、各SNSに手動ログインします。

**投稿実行:**
```bash
# 画像投稿（5SNS）
./sns-multi-poster-profile.sh <画像パス> "<キャプション>" [Pinterestボード]

# 動画投稿（4SNS - Pinterest除外）
./sns-multi-poster-profile.sh <動画パス> "<キャプション 🎥>" [Pinterestボード]

# DRY_RUN（テストモード）
DRY_RUN=true bash post-to-all-sns.sh /tmp/test.mp4 "テスト動画" Animal
```

---

### 旧方式: Cookie版

Cookie JSONファイルを使用する旧方式も利用可能ですが、ブラウザプロファイル版を推奨します。

## 複数アカウント設定

`config.json` を編集してアカウントを追加：

```json
{
  "accounts": {
    "personal": {
      "name": "個人アカウント",
      "instagram": "your_username",
      "x": "your_handle",
      "facebook": "your_id",
      "pinterest": "your_username"
    },
    "business": {
      "name": "ビジネスアカウント",
      "instagram": "business_username",
      "x": "business_handle",
      "facebook": "business_id",
      "pinterest": "business_username"
    }
  }
}
```

### アカウント指定で投稿
```
SNS投稿 (business)
```

## 注意事項

- 初回実行時は各SNSへのログインが必要
- Playwright MCPを使用（ブラウザ自動操作）
- ログイン状態は同一セッション内で維持

詳細は `SKILL.md` を参照。
